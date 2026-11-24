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

import { normalizeBookingOptions } from '../server/providers/serpapi.js';
import { bookingFixture } from './fixtures-serpapi.js';

test('booking options: cheapest first, airline flagged, separate tickets combined, unsafe links dropped', () => {
  const { options, baggage } = normalizeBookingOptions(bookingFixture);
  assert.deepEqual(options.map((o) => o.seller), ['Trip.com + Kiwi.com', 'IndiGo', 'Goibibo', 'SomeSite']);
  const [sep, airline, ota, unpriced] = options;
  assert.equal(sep.price, 6100);
  assert.equal(sep.separateTickets, true);
  assert.equal(sep.requests.length, 2);
  assert.equal(airline.isAirline, true);
  assert.deepEqual(airline.extensions, ['Saver fare']);
  assert.deepEqual(ota.requests, [{ url: 'https://www.google.com/travel/clk/f', postData: 'u=abc&tfs=x%3Dy' }]);
  assert.equal(unpriced.price, null);
  assert.equal(unpriced.requests.length, 0, 'non-https booking links are dropped');
  assert.deepEqual(baggage, ['1 free carry-on', '1st checked bag free']);
  assert.equal(buildParams(q, { apiKey: 'k', bookingToken: 'B' }).get('booking_token'), 'B');
});
