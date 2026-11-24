import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ROOT, loadConfig } from './config.js';
import { openDb } from './db.js';
import { loadFees } from './fees.js';
import { searchAirports } from './airports.js';
import { createSearchService } from './search.js';

export function createApp({ config = loadConfig(), db, fees = loadFees(), fetchImpl } = {}) {
  const database = db || openDb(config.dbPath);
  const svc = createSearchService({ db: database, config, fees, fetchImpl });
  const app = express();
  app.disable('x-powered-by');

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
  app.get('/api/airports', wrap((req) => ({ airports: searchAirports(req.query.q) })));
  app.get('/api/fees', wrap(() => fees));
  app.get('/api/search', wrap((req) => svc.search(req.query, { refresh: req.query.refresh === '1' })));
  app.get('/api/return', wrap((req) => svc.returnFlights(req.query, { refresh: req.query.refresh === '1' })));
  app.get('/api/calendar', wrap((req) => svc.calendar(req.query)));
  app.get('/api/explore', wrap((req) => svc.explore(req.query)));
  app.get('/api/history', wrap((req) => svc.history(req.query)));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));
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
    console.log(`  calendar/explore: ${svc.calendarProvider}${svc.calendarProvider === 'demo' ? ' (set TRAVELPAYOUTS_TOKEN for cached real fares)' : ''}`);
  });
}
