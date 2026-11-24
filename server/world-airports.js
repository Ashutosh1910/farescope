// World airport + city names (server only), from Travelpayouts' free public data files.
// Downloaded at startup and cached in data/airports-world.json (gitignored) instead of being
// committed, since the data is Travelpayouts'. Without it, the app uses the 98 bundled airports.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';
import { AIRPORTS, rankPlaces, publicAirport } from './airports.js';

const BASE = 'https://api.travelpayouts.com/data/en/';
export const WORLD_FILE = path.join(ROOT, 'data', 'airports-world.json');

let places = AIRPORTS; // searchable airports only
let byCode = new Map(AIRPORTS.map((a) => [a.code, a]));

const en = (x) => x?.name_translations?.en || x?.name || '';

/** Turn the three raw Travelpayouts lists into compact {code,name,city,country,minor} rows. */
export function buildWorldList(airports, cities, countries) {
  const country = new Map(countries.map((c) => [c.code, en(c)]));
  const city = new Map(cities.map((c) => [c.code, c]));
  const out = new Map();
  for (const a of airports) {
    if (!a.flightable || a.iata_type !== 'airport' || !/^[A-Z]{3}$/.test(a.code || '')) continue;
    const c = city.get(a.city_code);
    out.set(a.code, {
      code: a.code,
      name: en(a),
      city: en(c) || en(a),
      country: country.get(a.country_code) || a.country_code || '',
      minor: true,
    });
  }
  // Multi-airport city codes (LON, NYC, MOW…) appear as destinations in cached fares. They're used
  // for names only — never offered in autocomplete, since live search expects airport codes.
  for (const c of cities) {
    if (!c.has_flightable_airport || !/^[A-Z]{3}$/.test(c.code || '') || out.has(c.code)) continue;
    out.set(c.code, { code: c.code, name: 'All airports', city: en(c), country: country.get(c.country_code) || '', minor: true, cityCode: true });
  }
  return [...out.values()];
}

function install(world) {
  const merged = new Map(world.map((p) => [p.code, p]));
  for (const a of AIRPORTS) merged.set(a.code, a); // bundled entries (with coordinates) win
  places = [...merged.values()].filter((p) => !p.cityCode);
  byCode = merged;
}

export async function loadWorldAirports({ fetchImpl = fetch, file = WORLD_FILE, maxAgeDays = 30, log = console.log } = {}) {
  try {
    const st = fs.statSync(file, { throwIfNoEntry: false });
    if (st && Date.now() - st.mtimeMs < maxAgeDays * 86400e3) {
      install(JSON.parse(fs.readFileSync(file, 'utf8')));
      return places.length;
    }
    const get = async (name) => {
      const res = await fetchImpl(BASE + name, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      return res.json();
    };
    const [airports, cities, countries] = await Promise.all([get('airports.json'), get('cities.json'), get('countries.json')]);
    const world = buildWorldList(airports, cities, countries);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(world));
    install(world);
    log(`  world airport list: ${world.length} places`);
    return places.length;
  } catch (e) {
    log(`  world airport list unavailable (${e.message}); using the ${AIRPORTS.length} bundled airports`);
    return places.length;
  }
}

export const searchPlaces = (term, limit = 8) => rankPlaces(places, term, limit).map(publicAirport);
export function lookupPlace(code) {
  const p = byCode.get(String(code || '').toUpperCase());
  return p ? publicAirport(p) : null;
}
