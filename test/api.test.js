import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, inDays } from './helpers.js';
import { createApp } from '../server/index.js';

test('HTTP API end to end (demo)', async (t) => {
  const { config, db, fees } = setup({ DEMO: '1' });
  const server = createApp({ config, db, fees }).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (p) => { const r = await fetch(base + p); return [r.status, await r.json()]; };

  let [s, body] = await get('/api/status');
  assert.equal(s, 200);
  assert.equal(body.liveProvider, 'demo');

  [s, body] = await get('/api/airports?q=goa');
  assert.ok(body.airports.some((a) => a.code === 'GOX'));

  [s, body] = await get(`/api/search?from=DEL&to=BLR&depart=${inDays(10)}`);
  assert.equal(s, 200);
  assert.ok(body.flights.length > 0);

  [s, body] = await get('/api/search?from=DEL&to=DEL&depart=2030-01-01');
  assert.equal(s, 400);
  assert.match(body.error, /differ/);

  [s, body] = await get('/api/nope');
  assert.equal(s, 404);

  // The page needs `npm run build`; without it the server says so instead of failing obscurely.
  const page = await fetch(base + '/?from=BOM');
  assert.ok([200, 503].includes(page.status));
  assert.match(await page.text(), /FareScope/);
});

test('APP_PASSWORD protects pages and API but not /healthz', async (t) => {
  const { config, db, fees } = setup({ DEMO: '1', APP_PASSWORD: 's3cret' });
  const server = createApp({ config, db, fees }).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = (pw) => ({ headers: { Authorization: `Basic ${Buffer.from(`me:${pw}`).toString('base64')}` } });

  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  const denied = await fetch(`${base}/api/status`);
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get('www-authenticate'), /Basic/);
  assert.equal((await fetch(`${base}/`)).status, 401);
  assert.equal((await fetch(`${base}/api/status`, auth('wrong'))).status, 401);
  assert.equal((await fetch(`${base}/api/status`, auth('s3cret'))).status, 200);
  // 200 once the web app is built, 503 "not built yet" before; either way the password was accepted.
  assert.ok([200, 503].includes((await fetch(`${base}/`, auth('s3cret'))).status));
});

test('REQUIRE_WEB makes /healthz fail when the web app is missing', async (t) => {
  const { config, db, fees } = setup({ DEMO: '1' });
  const fs = await import('node:fs');
  const built = fs.existsSync(new URL('../dist/index.html', import.meta.url));
  process.env.REQUIRE_WEB = '1';
  t.after(() => { delete process.env.REQUIRE_WEB; });
  const server = createApp({ config, db, fees }).listen(0);
  t.after(() => server.close());
  const r = await fetch(`http://127.0.0.1:${server.address().port}/healthz`);
  assert.equal(r.status, built ? 200 : 503);
});
