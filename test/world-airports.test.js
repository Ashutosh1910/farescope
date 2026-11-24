import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWorldList, loadWorldAirports, lookupPlace, searchPlaces } from '../server/world-airports.js';

const airports = [
  { code: 'GWL', name: 'Gwalior Airport', city_code: 'GWL', country_code: 'IN', iata_type: 'airport', flightable: true },
  { code: 'LHR', name: 'Heathrow', city_code: 'LON', country_code: 'GB', iata_type: 'airport', flightable: true },
  { code: 'XQE', name: 'Ebbsfleet Rail', city_code: 'LON', country_code: 'GB', iata_type: 'railway', flightable: true },
  { code: 'НАВ', name: 'Navoiy', city_code: 'NVI', country_code: 'UZ', iata_type: 'airport', flightable: true },
];
const cities = [
  { code: 'GWL', name: 'Gwalior', country_code: 'IN', has_flightable_airport: true },
  { code: 'LON', name: 'London', country_code: 'GB', has_flightable_airport: true },
];
const countries = [{ code: 'IN', name: 'India' }, { code: 'GB', name: 'United Kingdom' }];

test('buildWorldList keeps real airports, adds multi-airport city codes, drops rail and non-IATA', () => {
  const list = buildWorldList(airports, cities, countries);
  const codes = list.map((p) => p.code).sort();
  assert.deepEqual(codes, ['GWL', 'LHR', 'LON']);
  assert.deepEqual(list.find((p) => p.code === 'GWL'), { code: 'GWL', name: 'Gwalior Airport', city: 'Gwalior', country: 'India', minor: true });
  assert.equal(list.find((p) => p.code === 'LON').name, 'All airports');
  assert.equal(list.find((p) => p.code === 'LON').cityCode, true);
});

test('loadWorldAirports downloads once, caches to disk, and bundled airports still rank first', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fs-')), 'world.json');
  let calls = 0;
  const data = { 'airports.json': airports, 'cities.json': cities, 'countries.json': countries };
  const fetchImpl = async (url) => { calls++; return { ok: true, json: async () => data[url.split('/').pop()] }; };
  await loadWorldAirports({ fetchImpl, file, log: () => {} });
  assert.equal(calls, 3);
  assert.ok(fs.existsSync(file));
  await loadWorldAirports({ fetchImpl, file, log: () => {} });
  assert.equal(calls, 3, 'second load uses the cached file');
  assert.equal(lookupPlace('gwl').city, 'Gwalior');
  assert.equal(searchPlaces('gwal')[0].code, 'GWL');
  assert.equal(searchPlaces('lon')[0].code, 'LHR');
  assert.ok(!searchPlaces('lon').some((p) => p.code === 'LON'), 'city codes are not offered for search');
  assert.equal(lookupPlace('LON').city, 'London', 'but they are still named');
});

test('loadWorldAirports failure falls back to bundled airports', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fs-')), 'none.json');
  const n = await loadWorldAirports({ fetchImpl: async () => ({ ok: false, status: 503 }), file, log: () => {} });
  assert.ok(n >= 98);
});
