// Runs in Node and (bundled) in the browser for the static GitHub Pages build.
import AIRPORT_DATA from '../data/airports.json' with { type: 'json' };

export const AIRPORTS = AIRPORT_DATA;
const BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a]));

export const getAirport = (code) => BY_CODE.get(String(code || '').toUpperCase()) || null;

export function searchAirports(term, limit = 8) {
  return rankPlaces(AIRPORTS, term, limit);
}

/** Rank places by how well they match what was typed. Bundled (major) airports win ties. */
export function rankPlaces(places, term, limit = 8) {
  const t = String(term || '').trim().toLowerCase();
  if (!t) return [];
  const scored = [];
  for (const a of places) {
    const code = a.code.toLowerCase();
    const city = a.city.toLowerCase();
    const name = a.name.toLowerCase();
    let score = -1;
    if (code === t) score = 100;
    else if (city.startsWith(t)) score = 80;
    else if (code.startsWith(t)) score = 70;
    else if (name.startsWith(t)) score = 60;
    else if (city.includes(t) || name.includes(t)) score = 40;
    else if (a.country.toLowerCase().startsWith(t)) score = 20;
    if (score >= 0) scored.push([score + (a.minor ? 0 : 5), a]);
  }
  scored.sort((x, y) => y[0] - x[0] || x[1].city.localeCompare(y[1].city));
  return scored.slice(0, limit).map(([, a]) => publicAirport(a));
}

export const publicAirport = (a) => ({ code: a.code, name: a.name, city: a.city, country: a.country });

export function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
