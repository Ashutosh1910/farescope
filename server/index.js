import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ROOT, loadConfig } from './config.js';
import { openDb } from './db.js';
import { loadFees } from './fees-file.js';
import { searchPlaces, lookupPlace, loadWorldAirports } from './world-airports.js';
import { createSearchService } from './search.js';

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();

/** HTTP Basic auth: any username, password must equal APP_PASSWORD. */
export function passwordGate(password) {
  const want = sha256(password);
  return (req, res, next) => {
    const [scheme, encoded] = String(req.headers.authorization || '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const given = decoded.slice(decoded.indexOf(':') + 1);
      if (crypto.timingSafeEqual(sha256(given), want)) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="FareScope", charset="UTF-8"');
    res.status(401).json({ error: 'Password required' });
  };
}

export function createApp({ config = loadConfig(), db, fees = loadFees(), fetchImpl } = {}) {
  const database = db || openDb(config.dbPath);
  const svc = createSearchService({ db: database, config, fees, fetchImpl, lookupPlace });
  const app = express();
  app.disable('x-powered-by');

  // Unauthenticated liveness check for hosts like Render. Shows only the running commit
  // (Render sets RENDER_GIT_COMMIT) so a deploy can be verified without the password.
  let commit = (process.env.RENDER_GIT_COMMIT || '').slice(0, 7);
  if (!commit) {
    try {
      commit = fs.readFileSync(path.join(ROOT, '.build-commit'), 'utf8').trim().slice(0, 7);
    } catch {
      /* not a Render build */
    }
  }
  // With REQUIRE_WEB=1 (set on Render) a deploy without the built web app reports unhealthy,
  // so Render keeps the previous version live instead of serving a blank site.
  const webBuilt = () => fs.existsSync(path.join(ROOT, 'dist', 'index.html'));
  app.get('/healthz', (req, res) => {
    if (process.env.REQUIRE_WEB === '1' && !webBuilt()) return res.status(503).type('text').send('web app not built');
    // "no-web" tells the deploy workflow the server is up but the React app wasn't built.
    res.type('text').send(['ok', commit, webBuilt() ? '' : 'no-web'].filter(Boolean).join(' '));
  });
  if (config.appPassword) app.use(passwordGate(config.appPassword));

  const wrap = (fn) => async (req, res) => {
    try {
      res.json(await fn(req));
    } catch (e) {
      const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
      if (status >= 500) console.error(e);
      res.status(status).json({ error: e.message || 'Something went wrong' });
    }
  };

  app.get('/api/status', wrap(() => svc.status()));
  app.get('/api/airports', wrap((req) => ({ airports: searchPlaces(req.query.q) })));
  app.get('/api/fees', wrap(() => fees));
  app.get('/api/search', wrap((req) => svc.search(req.query, { refresh: req.query.refresh === '1' })));
  app.get('/api/return', wrap((req) => svc.returnFlights(req.query, { refresh: req.query.refresh === '1' })));
  app.get('/api/booking', wrap((req) => svc.bookingOptions(req.query, { refresh: req.query.refresh === '1' })));
  app.get('/api/calendar', wrap((req) => svc.calendar(req.query)));
  app.get('/api/explore', wrap((req) => svc.explore(req.query)));
  app.get('/api/history', wrap((req) => svc.history(req.query)));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // The React app, built by `npm run build` into dist/. Hashed assets can be cached for a long time.
  const web = path.join(ROOT, 'dist');
  app.use('/assets', express.static(path.join(web, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(web, { index: false }));
  app.get('*', (req, res) => {
    const index = path.join(web, 'index.html');
    if (!fs.existsSync(index)) return res.status(503).type('text').send('FareScope: the web app is not built yet. Run `npm run build`.');
    res.set('Cache-Control', 'no-cache').sendFile(index);
  });
  app.locals.db = database;
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const app = createApp({ config });
  app.listen(config.port, () => {
    const svc = createSearchService({ db: app.locals.db, config, fees: loadFees() }).status();
    console.log(`FareScope running at http://localhost:${config.port}`);
    console.log(`  live prices: ${svc.liveProvider}${svc.liveProvider === 'demo' ? ' (set SERPAPI_KEY for real fares)' : ''}`);
    console.log(`  password: ${config.appPassword ? 'on (APP_PASSWORD)' : 'off — anyone who can reach this server can spend your searches'}`);
    loadWorldAirports();
    console.log(`  calendar/explore: ${svc.calendarProvider}${svc.calendarProvider === 'demo' ? ' (set TRAVELPAYOUTS_TOKEN for cached real fares)' : ''}`);
  });
}
