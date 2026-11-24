import test from 'node:test';
import assert from 'node:assert/strict';
import { buildParams, normalizeSerpApi, searchSerpApi } from '../server/providers/serpapi.js';
import { serpFixture } from './fixtures-serpapi.js';

const q = { from: 'BOM', to: 'DEL', depart: '2026-12-12', return: '2026-12-18', adults: 2, children: 1, infantsSeat: 0, infantsLap: 1, cabin: 'business', currency: 'INR' };

test('buildParams maps the query onto SerpApi parameters', () => {
  const p = buildParams(q, { apiKey: 'k', departureToken: 'T' });
  assert.equal(p.get('engine'), 'google_flights');
  assert.equal(p.get('type'), '1');
  assert.equal(p.get('travel_class'), '3');
  assert.equal(p.get('return_date'), '2026-12-18');
  assert.equal(p.get('infants_on_lap'), '1');
  assert.equal(p.get('departure_token'), 'T');
  assert.equal(buildParams({ ...q, return: null }, { apiKey: 'k' }).get('type'), '2');
});

test('normalizeSerpApi flattens best + other flights and drops unpriced ones', () => {
  const r = normalizeSerpApi(serpFixture, q);
  assert.equal(r.flights.length, 2);
  assert.equal(r.unpriced, 1);
  const [a, b] = r.flights;
  assert.equal(a.isBest, true);
  assert.equal(a.primaryAirline, 'IndiGo');
  assert.equal(a.leg.stops, 0);
  assert.equal(a.departureToken, 'TOKEN_A');
  assert.equal(a.carbon.diffPercent, -6);
  assert.equal(b.leg.stops, 1);
  assert.equal(b.leg.layovers[0].overnight, true);
  assert.equal(b.leg.segments[0].oftenDelayed, true);
  assert.equal(b.leg.arriveTime, '2026-12-13 03:15');
  assert.equal(r.insights.level, 'low');
  assert.equal(r.insights.history[0].ts, 1764000000 * 1000);
  assert.match(r.googleFlightsUrl, /google\.com\/travel\/flights/);
});

test('searchSerpApi treats "no results" as an empty list and other errors as failures', async () => {
  const fake = (body, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });
  const empty = await searchSerpApi(q, { apiKey: 'k', fetchImpl: fake({ error: "Google Flights hasn't returned any results for this query." }) });
  assert.equal(empty.flights.length, 0);
  await assert.rejects(searchSerpApi(q, { apiKey: 'k', fetchImpl: fake({ error: 'Invalid API key.' }, 401) }), (e) => e.status === 401);
});
