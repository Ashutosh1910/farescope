// Demo provider: deterministic, synthetic fares so the app works with no API keys.
// Every response is marked source: 'demo' and the UI says so. These are NOT real prices.
import { AIRPORTS, getAirport, distanceKm } from '../airports.js';
import { ProviderError } from './errors.js';

const DOMESTIC_AIRLINES = [
  { name: 'IndiGo', code: '6E', weight: 5, f: 1.0, hubs: ['DEL', 'BOM', 'BLR', 'HYD'], craft: ['A320neo', 'A321neo', 'ATR 72'] },
  { name: 'Air India', code: 'AI', weight: 3, f: 1.12, hubs: ['DEL', 'BOM', 'BLR'], craft: ['A320neo', 'A321neo', 'A350-900'] },
  { name: 'Air India Express', code: 'IX', weight: 2, f: 0.95, hubs: ['BLR', 'HYD', 'COK', 'DEL'], craft: ['737 MAX 8'] },
  { name: 'Akasa Air', code: 'QP', weight: 2, f: 0.97, hubs: ['BOM', 'BLR', 'DEL'], craft: ['737 MAX 8'] },
  { name: 'SpiceJet', code: 'SG', weight: 1, f: 0.93, hubs: ['DEL', 'BOM'], craft: ['737-800', 'Q400'] },
];
const INTL_AIRLINES = [
  { name: 'Emirates', code: 'EK', weight: 4, f: 1.08, hubs: ['DXB'], craft: ['777-300ER', 'A380'] },
  { name: 'Qatar Airways', code: 'QR', weight: 4, f: 1.06, hubs: ['DOH'], craft: ['787-9', 'A350-1000'] },
  { name: 'Etihad', code: 'EY', weight: 2, f: 1.0, hubs: ['AUH'], craft: ['787-10'] },
  { name: 'Singapore Airlines', code: 'SQ', weight: 3, f: 1.12, hubs: ['SIN'], craft: ['A350-900', '787-10'] },
  { name: 'Lufthansa', code: 'LH', weight: 2, f: 1.1, hubs: ['FRA', 'MUC'], craft: ['A350-900', '747-8'] },
  { name: 'British Airways', code: 'BA', weight: 2, f: 1.12, hubs: ['LHR'], craft: ['787-9', '777-200'] },
  { name: 'Air France', code: 'AF', weight: 1, f: 1.08, hubs: ['CDG'], craft: ['777-300ER'] },
  { name: 'KLM', code: 'KL', weight: 1, f: 1.06, hubs: ['AMS'], craft: ['787-10'] },
  { name: 'Turkish Airlines', code: 'TK', weight: 2, f: 0.94, hubs: ['IST'], craft: ['A350-900', '777-300ER'] },
  { name: 'Thai Airways', code: 'TG', weight: 1, f: 0.96, hubs: ['BKK'], craft: ['787-9'] },
  { name: 'Cathay Pacific', code: 'CX', weight: 1, f: 1.1, hubs: ['HKG'], craft: ['A350-900'] },
];
const INDIA_INTL = [
  { ...DOMESTIC_AIRLINES[0], weight: 3, craft: ['A321neo', 'A321XLR'] },
  { ...DOMESTIC_AIRLINES[1], weight: 3, craft: ['787-8', '777-300ER', 'A350-900'] },
];
const GENERIC_HUBS = ['DXB', 'DOH', 'AUH', 'IST', 'SIN', 'FRA', 'LHR', 'AMS', 'BKK', 'HKG', 'DEL', 'BOM'];
const DOMESTIC_HUBS = ['DEL', 'BOM', 'BLR', 'HYD', 'CCU', 'MAA', 'AMD', 'JAI', 'IDR', 'NAG', 'PNQ', 'LKO', 'GOI'];
const EXPLORE_CODES = [
  'DEL', 'BOM', 'BLR', 'MAA', 'CCU', 'HYD', 'GOX', 'COK', 'JAI', 'SXR', 'IXL', 'IXZ', 'UDR', 'TRV', 'IXB',
  'DXB', 'SIN', 'BKK', 'KUL', 'DPS', 'MLE', 'CMB', 'KTM', 'DOH', 'HKT', 'LHR', 'CDG', 'IST', 'NRT', 'JFK', 'SYD',
];
const CABIN_F = { economy: 1, premium: 1.75, business: 3.6, first: 6.2 };
const DEMO_FX = { INR: 1, USD: 1 / 84, EUR: 1 / 91, GBP: 1 / 107, AED: 1 / 22.9, SGD: 1 / 62.5 };

// ---------- deterministic randomness ----------
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rngFrom(seed) {
  let a = typeof seed === 'number' ? seed : hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function weighted(rng, arr) {
  const total = arr.reduce((t, x) => t + x.weight, 0);
  let r = rng() * total;
  for (const x of arr) if ((r -= x.weight) < 0) return x;
  return arr[arr.length - 1];
}

// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, '0');
function localString(utcMs, tz) {
  const d = new Date(utcMs + tz * 3600e3);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function localToUtc(dateStr, minutesOfDay, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 0, minutesOfDay) - tz * 3600e3;
}
const isDomestic = (o, d) => o.country === 'India' && d.country === 'India';
const fx = (inr, currency) => Math.round(inr * (DEMO_FX[currency] ?? 1));

function dateFactor(dateStr, now = Date.now()) {
  const days = (Date.parse(`${dateStr}T00:00:00Z`) - now) / 86400e3;
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  let f = days < 3 ? 1.6 : days < 7 ? 1.35 : days < 21 ? 1.12 : days < 60 ? 1 : 0.95;
  if (dow === 5 || dow === 0) f *= 1.08;
  return f;
}
function basePerPersonInr(o, d) {
  const km = distanceKm(o, d);
  return isDomestic(o, d) ? 1900 + km * 3.6 : 5200 + km * 3.9;
}
function paxMultiplier(q) {
  return q.adults + q.children + q.infantsSeat * 0.9 + q.infantsLap * 0.1;
}

function airlinePool(o, d) {
  if (isDomestic(o, d)) return DOMESTIC_AIRLINES;
  if (o.country === 'India' || d.country === 'India') return [...INTL_AIRLINES, ...INDIA_INTL];
  return INTL_AIRLINES;
}

function hubsFor(airline, o, d, domestic) {
  const directKm = distanceKm(o, d);
  const candidates = [...airline.hubs, ...(domestic ? DOMESTIC_HUBS : GENERIC_HUBS)];
  const seen = new Set([o.code, d.code]);
  const out = [];
  for (const code of candidates) {
    if (seen.has(code)) continue;
    seen.add(code);
    const h = getAirport(code);
    if (!h) continue;
    const detour = (distanceKm(o, h) + distanceKm(h, d)) / Math.max(directKm, 1);
    out.push({ h, detour, own: airline.hubs.includes(code) });
  }
  const limit = domestic ? 1.8 : 1.45;
  const ok = out.filter((x) => x.detour < limit);
  const pool = ok.length >= 2 ? ok : out.sort((a, b) => a.detour - b.detour).slice(0, 2);
  pool.sort((a, b) => (b.own - a.own) || a.detour - b.detour);
  return pool.map((x) => x.h);
}

function makeLeg(rng, o, d, dateStr, airline, stops, q, domestic) {
  let path = [o, d];
  if (stops > 0) {
    const hubs = hubsFor(airline, o, d, domestic);
    if (hubs.length >= stops) path = [o, ...hubs.slice(0, stops), d];
    else if (hubs.length) path = [o, hubs[0], d];
  }
  let t = localToUtc(dateStr, 5 * 60 + Math.floor(rng() * 220) * 5, o.tz); // 05:00–23:20 local
  const segments = [];
  const layovers = [];
  let totalKm = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const km = distanceKm(a, b);
    totalKm += km;
    const dur = Math.round((km / 800) * 60 + 28 + rng() * 15);
    const depart = t;
    const arrive = t + dur * 60e3;
    segments.push({
      from: { code: a.code, name: a.name, time: localString(depart, a.tz) },
      to: { code: b.code, name: b.name, time: localString(arrive, b.tz) },
      airline: airline.name,
      airlineLogo: null,
      flightNumber: `${airline.code} ${100 + Math.floor(rng() * 1800)}`,
      aircraft: pick(rng, airline.craft),
      durationMin: dur,
      cabin: { economy: 'Economy', premium: 'Premium economy', business: 'Business', first: 'First' }[q.cabin],
      legroom: q.cabin === 'economy' ? pick(rng, ['71 cm', '74 cm', '76 cm', '79 cm']) : '',
      overnight: new Date(arrive + b.tz * 3600e3).getUTCDate() !== new Date(depart + a.tz * 3600e3).getUTCDate(),
      oftenDelayed: rng() < 0.08,
      extensions: km > 3000 ? ['In-seat power & USB outlets', 'On-demand video'] : rng() < 0.5 ? ['In-seat USB outlet'] : [],
    });
    t = arrive;
    if (i < path.length - 2) {
      const lay = 50 + Math.floor(rng() * 62) * 5; // 50 min – ~6 h
      layovers.push({
        code: b.code,
        name: b.name,
        durationMin: lay,
        overnight: new Date(t + lay * 60e3 + b.tz * 3600e3).getUTCDate() !== new Date(t + b.tz * 3600e3).getUTCDate(),
      });
      t += lay * 60e3;
    }
  }
  const durationMin = segments.reduce((s, x) => s + x.durationMin, 0) + layovers.reduce((s, x) => s + x.durationMin, 0);
  return {
    leg: {
      segments,
      layovers,
      stops: segments.length - 1,
      durationMin,
      departTime: segments[0].from.time,
      arriveTime: segments[segments.length - 1].to.time,
    },
    totalKm,
  };
}

function generateLegOptions(o, d, dateStr, q, salt) {
  const rng = rngFrom(`${salt}|${o.code}|${d.code}|${dateStr}|${q.cabin}`);
  const domestic = isDomestic(o, d);
  const km = distanceKm(o, d);
  const nonstopOk = domestic ? km > 120 : km < 8600;
  const pool = airlinePool(o, d);
  const count = 14 + Math.floor(rng() * 14);
  const perPersonBase = basePerPersonInr(o, d) * CABIN_F[q.cabin] * dateFactor(dateStr);
  const out = [];
  const seen = new Set();
  for (let n = 0; n < count; n++) {
    const airline = weighted(rng, pool);
    const r = rng();
    let stops = nonstopOk ? (r < 0.45 ? 0 : r < 0.88 ? 1 : 2) : r < 0.7 ? 1 : 2;
    if (stops === 0 && !domestic && !airline.hubs.includes(o.code) && !airline.hubs.includes(d.code)) stops = 1;
    const { leg, totalKm } = makeLeg(rng, o, d, dateStr, airline, stops, q, domestic);
    const key = leg.segments.map((s) => s.flightNumber).join('_');
    if (seen.has(key)) continue;
    seen.add(key);
    const stopF = [1.08, 0.92, 0.85][leg.stops] ?? 0.85;
    const perPerson = perPersonBase * airline.f * stopF * (0.85 + rng() * 0.4);
    out.push({
      key,
      leg,
      airline,
      perPersonInr: perPerson,
      carbon: {
        grams: Math.round(totalKm * 88 * (q.cabin === 'economy' ? 1 : 2.4)),
        typical: Math.round(km * 92),
      },
    });
  }
  return out;
}

function toFlight(opt, priceInr, q, extra = {}) {
  const price = fx(priceInr, q.currency);
  return {
    id: `d-${opt.key}`,
    price,
    currency: q.currency,
    isBest: false,
    airlines: [opt.airline.name],
    primaryAirline: opt.airline.name,
    logo: null,
    separateTickets: false,
    leg: opt.leg,
    carbon: {
      ...opt.carbon,
      diffPercent: Math.round(((opt.carbon.grams - opt.carbon.typical) / opt.carbon.typical) * 100),
    },
    departureToken: null,
    bookingToken: null,
    ...extra,
  };
}

function markBest(flights) {
  if (!flights.length) return flights;
  const minP = Math.min(...flights.map((f) => f.price));
  const minD = Math.min(...flights.map((f) => f.leg.durationMin));
  const score = (f) => f.price / minP + 0.7 * (f.leg.durationMin / minD) + 0.15 * f.leg.stops;
  const ranked = [...flights].sort((a, b) => score(a) - score(b));
  ranked.slice(0, Math.min(3, ranked.length)).forEach((f) => (f.isBest = true));
  return [...ranked.filter((f) => f.isBest), ...ranked.filter((f) => !f.isBest)];
}

function insightsFor(flights, q) {
  if (!flights.length) return null;
  const prices = flights.map((f) => f.price).sort((a, b) => a - b);
  const pct = (p) => prices[Math.min(prices.length - 1, Math.floor(p * prices.length))];
  const lo = pct(0.2);
  const hi = pct(0.7);
  const lowest = prices[0];
  const level = lowest < lo * 0.97 ? 'low' : lowest > hi ? 'high' : 'typical';
  const rng = rngFrom(`hist|${q.from}|${q.to}|${q.depart}`);
  const now = Date.now();
  const history = Array.from({ length: 30 }, (_, i) => ({
    ts: now - (30 - i) * 86400e3,
    price: Math.round(lowest * (0.9 + rng() * 0.35)),
  }));
  return { lowest, level, typicalRange: [lo, hi], history };
}

// base64url without Buffer, so this module also runs in the browser build.
const encodeToken = (obj) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function decodeToken(token) {
  try {
    const b64 = String(token).replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ProviderError('Invalid return-flight token', { status: 400, provider: 'demo' });
  }
}

function endpoints(q) {
  const o = getAirport(q.from);
  const d = getAirport(q.to);
  if (!o || !d) {
    throw new ProviderError(
      `Demo mode only knows the bundled airport list; ${!o ? q.from : q.to} isn't in it. Add a SerpApi key for any airport.`,
      { status: 400, provider: 'demo' }
    );
  }
  return [o, d];
}

export function demoSearch(q) {
  const [o, d] = endpoints(q);
  const pax = paxMultiplier(q);
  const outs = generateLegOptions(o, d, q.depart, q, 'out');
  let cheapestReturnPP = 0;
  if (q.return) {
    const rets = generateLegOptions(d, o, q.return, q, 'ret');
    cheapestReturnPP = Math.min(...rets.map((r) => r.perPersonInr)) * 0.92; // round-trip discount
  }
  const flights = markBest(
    outs.map((opt) => {
      const totalInr = (opt.perPersonInr + cheapestReturnPP) * pax;
      return toFlight(opt, totalInr, q, {
        departureToken: q.return ? encodeToken({ k: opt.key, inr: Math.round(totalInr) }) : null,
        bookingToken: q.return ? null : encodeToken({ b: opt.key, a: opt.airline.name, p: fx(totalInr, q.currency) }),
      });
    })
  );
  return { flights, unpriced: 0, insights: insightsFor(flights, q), googleFlightsUrl: null };
}

export function demoReturnSearch(q, token) {
  const { inr } = decodeToken(token);
  if (!q.return) throw new ProviderError('Return date required', { status: 400, provider: 'demo' });
  const [o, d] = endpoints(q);
  const pax = paxMultiplier(q);
  const rets = generateLegOptions(d, o, q.return, q, 'ret');
  const cheapest = Math.min(...rets.map((r) => r.perPersonInr));
  const flights = markBest(
    rets.map((opt) => {
      const totalInr = inr + (opt.perPersonInr - cheapest) * 0.92 * pax;
      return toFlight(opt, totalInr, q, {
        bookingToken: encodeToken({ b: opt.key, a: opt.airline.name, p: fx(totalInr, q.currency) }),
      });
    })
  );
  return { flights, unpriced: 0, insights: null, googleFlightsUrl: null };
}

function cheapestDayPrice(o, d, day, q) {
  const rng = rngFrom(`cal|${o.code}|${d.code}|${day}`);
  const pp = basePerPersonInr(o, d) * CABIN_F[q.cabin ?? 'economy'] * dateFactor(day) * (0.72 + rng() * 0.45);
  return { inr: q.oneWay ? pp : pp * 1.85, rng };
}

// Generic names on purpose: fake prices must never appear under a real company's name.
const DEMO_SELLERS = ['Travel site A', 'Travel site B', 'Travel site C', 'Travel site D', 'Travel site E'];

export function demoBookingOptions(q, token) {
  const { b, a, p } = decodeToken(token);
  if (!b || typeof p !== 'number') throw new ProviderError('Invalid booking token', { status: 400, provider: 'demo' });
  const rng = rngFrom(`sellers|${b}|${q.depart}|${q.return || ''}`);
  const options = [{ seller: a, isAirline: true, separateTickets: false, price: p, title: null, extensions: [], baggage: ['1 free carry-on'], phone: null, requests: [] }];
  for (const name of DEMO_SELLERS) {
    if (rng() < 0.25) continue;
    options.push({
      seller: name,
      isAirline: false,
      separateTickets: false,
      price: Math.round(p * (0.97 + rng() * 0.12)),
      title: null,
      extensions: [],
      baggage: [],
      phone: null,
      requests: [],
    });
  }
  options.sort((x, y) => x.price - y.price);
  return { options, baggage: ['1 free carry-on'] };
}

export function demoCalendar(q) {
  const [o, d] = endpoints(q);
  const [y, m] = q.month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = new Date().toISOString().slice(0, 10);
  const pool = airlinePool(o, d);
  const days = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${q.month}-${pad(day)}`;
    if (ds < today) continue;
    const { inr, rng } = cheapestDayPrice(o, d, ds, q);
    if (rng() < 0.12) continue; // cached data has gaps
    days[ds] = {
      price: fx(inr, q.currency),
      airline: weighted(rng, pool).code,
      transfers: rng() < 0.6 ? 0 : 1,
      returnAt: null,
      link: null,
    };
  }
  return days;
}

export function demoExplore(q) {
  const o = getAirport(q.from);
  if (!o) throw new ProviderError(`Unknown airport ${q.from} in demo mode`, { status: 400, provider: 'demo' });
  const [y, m] = q.month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  for (const code of EXPLORE_CODES) {
    if (code === o.code) continue;
    const d = getAirport(code);
    let best = null;
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${q.month}-${pad(day)}`;
      if (ds < today) continue;
      const { inr } = cheapestDayPrice(o, d, ds, q);
      if (!best || inr < best.inr) best = { inr, ds };
    }
    if (!best) continue;
    out.push({
      destination: code,
      price: fx(best.inr, q.currency),
      airline: weighted(rngFrom(code + q.month), airlinePool(o, d)).code,
      departAt: best.ds,
      returnAt: null,
      transfers: isDomestic(o, d) ? 0 : 1,
      link: null,
    });
  }
  return out.sort((a, b) => a.price - b.price);
}

export const DEMO_AIRPORT_CODES = AIRPORTS.map((a) => a.code);
