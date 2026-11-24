import { searchSerpApi, bookingOptionsSerpApi } from './providers/serpapi.js';
import { tpCalendar, tpExplore } from './providers/travelpayouts.js';
import { demoSearch, demoReturnSearch, demoBookingOptions, demoCalendar, demoExplore } from './providers/demo.js';
import { ProviderError } from './providers/errors.js';
import { estimateTotal, bookUrlFor } from './fees.js';
import { getAirport, publicAirport } from './airports.js';

const CABINS = ['economy', 'premium', 'business', 'first'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const CODE_RE = /^[A-Z]{3}$/;

export class ValidationError extends Error {
  status = 400;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const intIn = (v, d, min, max, name) => {
  const n = v === undefined || v === '' ? d : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ValidationError(`${name} must be ${min}–${max}`);
  return n;
};
const code = (v, name) => {
  const c = String(v || '').trim().toUpperCase();
  if (!CODE_RE.test(c)) throw new ValidationError(`${name} must be a 3-letter airport code`);
  return c;
};
const currency = (v) => {
  const c = String(v || 'INR').toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) throw new ValidationError('currency must be a 3-letter code');
  return c;
};

export function parseSearchQuery(raw) {
  const from = code(raw.from, 'from');
  const to = code(raw.to, 'to');
  if (from === to) throw new ValidationError('Origin and destination must differ');
  const depart = String(raw.depart || '');
  if (!DATE_RE.test(depart) || Number.isNaN(Date.parse(depart))) throw new ValidationError('depart must be YYYY-MM-DD');
  if (depart < todayIso()) throw new ValidationError('Departure date is in the past');
  let ret = raw.return ? String(raw.return) : '';
  if (ret) {
    if (!DATE_RE.test(ret) || Number.isNaN(Date.parse(ret))) throw new ValidationError('return must be YYYY-MM-DD');
    if (ret < depart) throw new ValidationError('Return date is before departure');
  }
  const adults = intIn(raw.adults, 1, 1, 9, 'adults');
  const children = intIn(raw.children, 0, 0, 8, 'children');
  const infantsSeat = intIn(raw.infantsSeat, 0, 0, 8, 'infantsSeat');
  const infantsLap = intIn(raw.infantsLap, 0, 0, 8, 'infantsLap');
  if (adults + children + infantsSeat + infantsLap > 9) throw new ValidationError('Maximum 9 passengers');
  if (infantsLap > adults) throw new ValidationError('Each lap infant needs an adult');
  const cabin = String(raw.cabin || 'economy');
  if (!CABINS.includes(cabin)) throw new ValidationError(`cabin must be one of ${CABINS.join(', ')}`);
  return { from, to, depart, return: ret || null, adults, children, infantsSeat, infantsLap, cabin, currency: currency(raw.currency) };
}

export function parseMonthQuery(raw, { needTo = true } = {}) {
  const from = code(raw.from, 'from');
  const to = needTo ? code(raw.to, 'to') : null;
  const month = String(raw.month || todayIso().slice(0, 7));
  if (!MONTH_RE.test(month)) throw new ValidationError('month must be YYYY-MM');
  const cabin = CABINS.includes(raw.cabin) ? raw.cabin : 'economy';
  return { from, to, month, oneWay: raw.oneWay !== 'false', currency: currency(raw.currency), cabin };
}

const cacheKey = (kind, provider, obj) =>
  `${kind}:${provider}:${JSON.stringify(Object.keys(obj).sort().map((k) => [k, obj[k]]))}`;

export function createSearchService({ db, config, fees, fetchImpl = fetch, now = () => Date.now(), lookupPlace = () => null }) {
  const liveProvider = config.serpapiKey && !config.forceDemo ? 'serpapi' : 'demo';
  const calendarProvider = config.travelpayoutsToken && !config.forceDemo ? 'travelpayouts' : 'demo';

  function quota() {
    const t = now();
    const monthStart = new Date(t);
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    return {
      usedThisMonth: db.countCalls('serpapi', monthStart.getTime()),
      usedThisHour: db.countCalls('serpapi', t - 3600e3),
      monthlyLimit: config.serpapiMonthlyLimit,
      hourlyLimit: config.serpapiHourlyLimit,
    };
  }

  function guardQuota() {
    const qt = quota();
    if (qt.usedThisMonth >= qt.monthlyLimit) {
      throw new ProviderError(`Monthly SerpApi budget reached (${qt.monthlyLimit}). Cached results still work.`, { status: 429 });
    }
    if (qt.usedThisHour >= qt.hourlyLimit) {
      throw new ProviderError(`Hourly SerpApi limit reached (${qt.hourlyLimit}/h). Try again later.`, { status: 429 });
    }
  }

  async function cached(kind, provider, keyObj, ttlMin, refresh, load) {
    const key = cacheKey(kind, provider, keyObj);
    if (!refresh) {
      const hit = db.getCache(key, ttlMin * 60e3, now());
      if (hit) return { ...hit.body, cached: true, fetchedAt: hit.fetchedAt };
    }
    const body = await load();
    const fetchedAt = now();
    db.setCache(key, provider, body, fetchedAt);
    return { ...body, cached: false, fetchedAt };
  }

  function enrich(result, q, provider) {
    const pax = { adults: q.adults, children: q.children, infantsSeat: q.infantsSeat, infantsLap: q.infantsLap };
    const directions = q.return ? 2 : 1;
    const flights = result.flights.map((f) => ({
      ...f,
      estimate: estimateTotal(fees, { price: f.price, currency: q.currency, airline: f.primaryAirline, pax, directions }),
      bookUrl: bookUrlFor(fees, f.primaryAirline),
    }));
    return {
      ...result,
      flights,
      source: provider,
      query: q,
      airports: { from: airportInfo(q.from), to: airportInfo(q.to) },
    };
  }

  const airportInfo = (c) => {
    const a = getAirport(c);
    return a ? publicAirport(a) : lookupPlace(c) || { code: c, name: c, city: c, country: '' };
  };

  function recordHistory(q, result) {
    if (result.cached || !result.flights.length) return;
    const cheapest = result.flights.reduce((m, f) => (f.price < m.price ? f : m));
    db.addHistory({
      origin: q.from, destination: q.to, depart: q.depart, return: q.return, cabin: q.cabin,
      currency: q.currency, price: cheapest.price, airline: cheapest.primaryAirline,
      source: result.source, checkedAt: result.fetchedAt,
    });
  }

  return {
    status() {
      return {
        liveProvider,
        calendarProvider,
        quota: liveProvider === 'serpapi' ? quota() : null,
        cacheMinutes: { live: config.liveCacheMinutes, calendar: config.calendarCacheMinutes },
        feesCurrency: fees.currency,
      };
    },

    async search(raw, { refresh = false } = {}) {
      const q = parseSearchQuery(raw);
      const res = await cached('search', liveProvider, q, config.liveCacheMinutes, refresh, async () => {
        if (liveProvider === 'demo') return demoSearch(q);
        guardQuota();
        db.logCall('serpapi', now());
        return searchSerpApi(q, { apiKey: config.serpapiKey, gl: config.gl, hl: config.hl, fetchImpl });
      });
      const out = enrich(res, q, liveProvider);
      recordHistory(q, out);
      return out;
    },

    async returnFlights(raw, { refresh = false } = {}) {
      const q = parseSearchQuery(raw);
      if (!q.return) throw new ValidationError('return date is required');
      const token = String(raw.token || '');
      if (!token || token.length > 4096) throw new ValidationError('token is required');
      const res = await cached('return', liveProvider, { ...q, token }, config.liveCacheMinutes, refresh, async () => {
        if (liveProvider === 'demo') return demoReturnSearch(q, token);
        guardQuota();
        db.logCall('serpapi', now());
        return searchSerpApi(q, {
          apiKey: config.serpapiKey, gl: config.gl, hl: config.hl, fetchImpl, departureToken: token,
        });
      });
      return enrich(res, q, liveProvider);
    },

    /** Every seller for one itinerary (needs the flight's booking token). Costs 1 SerpApi search, then cached. */
    async bookingOptions(raw, { refresh = false } = {}) {
      const q = parseSearchQuery(raw);
      const token = String(raw.token || '');
      if (!token || token.length > 4096) throw new ValidationError('token is required');
      const res = await cached('booking', liveProvider, { ...q, token }, config.liveCacheMinutes, refresh, async () => {
        if (liveProvider === 'demo') return demoBookingOptions(q, token);
        guardQuota();
        db.logCall('serpapi', now());
        return bookingOptionsSerpApi(q, token, { apiKey: config.serpapiKey, gl: config.gl, hl: config.hl, fetchImpl });
      });
      const pax = { adults: q.adults, children: q.children, infantsSeat: q.infantsSeat, infantsLap: q.infantsLap };
      const directions = q.return ? 2 : 1;
      return {
        ...res,
        options: res.options.map((o) => ({
          ...o,
          estimate: estimateTotal(fees, {
            price: o.price, currency: q.currency, pax, directions,
            ...(o.isAirline ? { airline: o.seller } : { seller: o.seller }),
          }),
        })),
        source: liveProvider,
        query: q,
      };
    },

    async calendar(raw) {
      const q = parseMonthQuery(raw);
      const res = await cached('calendar', calendarProvider, q, config.calendarCacheMinutes, false, async () => ({
        days: calendarProvider === 'demo'
          ? demoCalendar(q)
          : await tpCalendar(q, { token: config.travelpayoutsToken, fetchImpl }),
      }));
      return { ...res, source: calendarProvider, query: q };
    },

    async explore(raw) {
      const q = parseMonthQuery(raw, { needTo: false });
      const res = await cached('explore', calendarProvider, q, config.calendarCacheMinutes, false, async () => ({
        destinations: calendarProvider === 'demo'
          ? demoExplore(q)
          : await tpExplore(q, { token: config.travelpayoutsToken, fetchImpl }),
      }));
      return {
        ...res,
        destinations: res.destinations.map((d) => ({ ...d, airport: airportInfo(d.destination) })),
        source: calendarProvider,
        query: q,
      };
    },

    history(raw) {
      const q = parseSearchQuery(raw);
      return {
        points: db.history({
          origin: q.from, destination: q.to, depart: q.depart, return: q.return, cabin: q.cabin, currency: q.currency,
        }),
      };
    },
  };
}
