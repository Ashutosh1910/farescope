import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, inDays } from './helpers.js';
import { createSearchService, parseSearchQuery } from '../server/search.js';
import { serpFixture } from './fixtures-serpapi.js';

const base = { from: 'BOM', to: 'DEL', depart: inDays(20), return: inDays(25), adults: '2' };

test('query validation', () => {
  assert.throws(() => parseSearchQuery({ ...base, from: 'BOMBAY' }), /3-letter/);
  assert.throws(() => parseSearchQuery({ ...base, to: 'BOM' }), /differ/);
  assert.throws(() => parseSearchQuery({ ...base, depart: inDays(-2), return: '' }), /past/);
  assert.throws(() => parseSearchQuery({ ...base, return: inDays(10) }), /before departure/);
  assert.throws(() => parseSearchQuery({ ...base, adults: '1', infantsLap: '2' }), /lap infant/);
  assert.throws(() => parseSearchQuery({ ...base, adults: '9', children: '1' }), /9 passengers/);
  assert.equal(parseSearchQuery({ ...base, from: 'bom' }).from, 'BOM');
});

test('demo search: deterministic, enriched with fee estimates, return leg via token', async () => {
  const { config, db, fees } = setup({ DEMO: '1' });
  const svc = createSearchService({ db, config, fees });
  const a = await svc.search(base);
  assert.equal(a.source, 'demo');
  assert.ok(a.flights.length >= 10);
  assert.ok(a.flights.every((f) => f.estimate && typeof f.price === 'number' && f.departureToken));
  const indigo = a.flights.find((f) => f.primaryAirline === 'IndiGo');
  if (indigo) assert.equal(indigo.estimate.fee, 249 * 2);
  const again = await svc.search(base, { refresh: true });
  assert.deepEqual(again.flights.map((f) => f.price), a.flights.map((f) => f.price));

  const ret = await svc.returnFlights({ ...base, token: a.flights[0].departureToken });
  assert.ok(ret.flights.length > 0);
  assert.equal(Math.min(...ret.flights.map((f) => f.price)), a.flights[0].price, 'cheapest return keeps the outbound total');
  assert.ok(ret.flights.every((f) => f.leg.segments[0].from.code === 'DEL'));
});

test('serpapi path: caches results, counts quota, records history, enforces budget', async () => {
  const { config, db, fees } = setup({ SERPAPI_KEY: 'k', SERPAPI_MONTHLY_LIMIT: '2' });
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    assert.match(url, /engine=google_flights/);
    return { ok: true, status: 200, json: async () => serpFixture };
  };
  const svc = createSearchService({ db, config, fees, fetchImpl });
  const first = await svc.search(base);
  assert.equal(first.source, 'serpapi');
  assert.equal(first.cached, false);
  const second = await svc.search(base);
  assert.equal(second.cached, true);
  assert.equal(calls, 1, 'second identical search served from cache');
  assert.equal(svc.status().quota.usedThisMonth, 1);
  assert.equal(svc.history(base).points.length, 1);
  assert.equal(svc.history(base).points[0].price, 4300);

  await svc.search({ ...base, adults: '1' });
  await assert.rejects(svc.search({ ...base, adults: '3' }), (e) => e.status === 429);
  assert.equal(calls, 2);
});

test('calendar and explore in demo mode', async () => {
  const { config, db, fees } = setup({ DEMO: '1' });
  const svc = createSearchService({ db, config, fees });
  const month = inDays(40).slice(0, 7);
  const cal = await svc.calendar({ from: 'DEL', to: 'GOX', month, oneWay: 'true', currency: 'INR' });
  assert.ok(Object.keys(cal.days).length > 10);
  assert.ok(Object.keys(cal.days).every((d) => d.startsWith(month)));
  const ex = await svc.explore({ from: 'DEL', month, oneWay: 'true', currency: 'INR' });
  assert.ok(ex.destinations.length > 10);
  assert.ok(ex.destinations[0].price <= ex.destinations.at(-1).price);
  assert.ok(ex.destinations.every((d) => d.airport.city));
});

test('travelpayouts path groups cached rows by day', async () => {
  const { config, db, fees } = setup({ TRAVELPAYOUTS_TOKEN: 't' });
  const month = inDays(40).slice(0, 7);
  const fetchImpl = async (url, opts) => {
    assert.equal(opts.headers['X-Access-Token'], 't');
    return { ok: true, status: 200, json: async () => ({ success: true, data: [
      { departure_at: `${month}-05T06:00:00+05:30`, price: 5000, airline: '6E', transfers: 0, link: '/search/x' },
      { departure_at: `${month}-05T20:00:00+05:30`, price: 4200, airline: 'QP', transfers: 0 },
      { departure_at: `${month}-09T09:00:00+05:30`, price: 3900, airline: 'AI', transfers: 1 },
    ] }) };
  };
  const svc = createSearchService({ db, config, fees, fetchImpl });
  const cal = await svc.calendar({ from: 'BOM', to: 'DEL', month, currency: 'INR' });
  assert.equal(cal.source, 'travelpayouts');
  assert.equal(cal.days[`${month}-05`].price, 4200);
  assert.equal(cal.days[`${month}-09`].airline, 'AI');
});

import { bookingFixture } from './fixtures-serpapi.js';

test('booking options: live call counts against the budget, is cached, and gets fee estimates', async () => {
  const { config, db, fees } = setup({ SERPAPI_KEY: 'k' });
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    assert.match(url, /booking_token=TOK/);
    return { ok: true, status: 200, json: async () => bookingFixture };
  };
  const svc = createSearchService({ db, config, fees, fetchImpl });
  const q = { ...base, return: '', adults: '1', token: 'TOK' };
  const a = await svc.bookingOptions(q);
  assert.equal(a.options.length, 4);
  assert.equal(a.options.find((o) => o.seller === 'IndiGo').estimate.fee, 249, 'airline offer uses the airline fee');
  assert.equal(a.options.find((o) => o.seller === 'Goibibo').estimate.status, 'not-configured');
  const b = await svc.bookingOptions(q);
  assert.equal(b.cached, true);
  assert.equal(calls, 1);
  assert.equal(svc.status().quota.usedThisMonth, 1);
  await assert.rejects(svc.bookingOptions({ ...q, token: '' }), /token/);
});

test('booking options in demo mode: airline plus generic, clearly fake sellers', async () => {
  const { config, db, fees } = setup({ DEMO: '1' });
  const svc = createSearchService({ db, config, fees });
  const one = { ...base, return: '' };
  const s = await svc.search(one);
  const f = s.flights[0];
  assert.ok(f.bookingToken, 'one-way demo flights carry a booking token');
  const r = await svc.bookingOptions({ ...one, token: f.bookingToken });
  assert.equal(r.source, 'demo');
  assert.ok(r.options.some((o) => o.isAirline && o.seller === f.primaryAirline && o.price === f.price));
  assert.ok(r.options.filter((o) => !o.isAirline).every((o) => /^Travel site [A-E]$/.test(o.seller)));
  const rt = await svc.search(base);
  const ret = await svc.returnFlights({ ...base, token: rt.flights[0].departureToken });
  assert.ok(ret.flights.every((x) => x.bookingToken), 'return-leg demo flights carry a booking token');
});
