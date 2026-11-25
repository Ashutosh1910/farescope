import test from 'node:test';
import assert from 'node:assert/strict';
import { facets, applyFilters, emptyFilters, sortFlights, windowOf, sortSummary } from '../src/lib/filters.js';
import { duration, money, dayDiff } from '../src/lib/format.js';

const mk = (id, price, dur, stops, dep, airline, extra = {}) => ({
  id, price, isBest: false, airlines: [airline], primaryAirline: airline, separateTickets: false,
  estimate: { total: price + 249, applied: true },
  leg: {
    stops, durationMin: dur, departTime: `2026-12-12 ${dep}`, arriveTime: '2026-12-12 23:00',
    segments: [{ airline, airlineLogo: null }],
    layovers: Array.from({ length: stops }, () => ({ code: 'HYD', durationMin: 120, overnight: false })),
  },
  ...extra,
});
const flights = [
  mk('a', 5000, 130, 0, '06:00', 'IndiGo'),
  mk('b', 4300, 375, 1, '21:00', 'Air India'),
  mk('c', 7000, 125, 0, '13:30', 'Akasa Air'),
  mk('d', 3900, 600, 2, '02:15', 'SpiceJet', { separateTickets: true }),
];

test('time windows', () => {
  assert.equal(windowOf('2026-12-12 04:59'), 'night');
  assert.equal(windowOf('2026-12-12 05:00'), 'morning');
  assert.equal(windowOf('2026-12-12 18:00'), 'evening');
});
test('facets report min price per stop bucket and airline', () => {
  const f = facets(flights);
  assert.deepEqual(f.stops, { 0: 5000, 1: 4300, 2: 3900 });
  assert.equal(f.airlines[0].name, 'SpiceJet');
  assert.deepEqual(f.price, { min: 3900, max: 7000 });
  assert.equal(f.hasSeparate, true);
});
test('filters combine', () => {
  const f = emptyFilters();
  f.stops = new Set([0]);
  assert.deepEqual(applyFilters(flights, f).map((x) => x.id), ['a', 'c']);
  f.departWindows = new Set(['morning']);
  assert.deepEqual(applyFilters(flights, f).map((x) => x.id), ['a']);
  const g = emptyFilters();
  g.excludedAirlines = new Set(['IndiGo', 'SpiceJet']);
  g.maxPrice = 5000;
  assert.deepEqual(applyFilters(flights, g).map((x) => x.id), ['b']);
  const h = emptyFilters();
  h.noSeparateTickets = true;
  h.maxDuration = 400;
  assert.deepEqual(applyFilters(flights, h).map((x) => x.id).sort(), ['a', 'b', 'c']);
});
test('sorting, including by estimated total', () => {
  assert.deepEqual(sortFlights(flights, 'cheapest').map((x) => x.id), ['d', 'b', 'a', 'c']);
  assert.deepEqual(sortFlights(flights, 'fastest').map((x) => x.id), ['c', 'a', 'b', 'd']);
  assert.deepEqual(sortFlights(flights, 'earliest').map((x) => x.id), ['d', 'a', 'c', 'b']);
  assert.equal(sortFlights(flights, 'best')[0].id, 'a');
  assert.equal(sortSummary(flights, true).cheapest.price, 3900 + 249);
});
test('formatting', () => {
  assert.equal(duration(125), '2h 05m');
  assert.equal(duration(45), '45m');
  assert.equal(money(123456, 'INR'), '₹1,23,456');
  assert.equal(dayDiff('2026-12-31 23:00', '2027-01-01 02:00'), 1);
});
