// Browser-side backend for the static (GitHub Pages) build. Bundled by scripts/build-static.mjs.
// It always uses the demo provider: a public page must never carry an API key.
import { createSearchService } from '../server/search.js';
import { searchAirports } from '../server/airports.js';
import fees from '../data/fees.json' with { type: 'json' };

const HISTORY_KEY = 'fs:history';
const readHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
};

/** Same interface as server/db.js: cache in memory, price history in localStorage. */
function browserDb() {
  const cache = new Map();
  return {
    getCache(key, maxAgeMs, now = Date.now()) {
      const hit = cache.get(key);
      return hit && now - hit.fetchedAt <= maxAgeMs ? hit : null;
    },
    setCache(key, _provider, body, now = Date.now()) {
      cache.set(key, { body, fetchedAt: now });
    },
    logCall() {},
    countCalls: () => 0,
    addHistory(h) {
      const all = readHistory();
      all.push({ ...h, return: h.return || '', checkedAt: h.checkedAt ?? Date.now() });
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(all.slice(-500)));
      } catch {
        /* storage full or blocked: history is optional */
      }
    },
    history(h) {
      return readHistory()
        .filter((x) => x.origin === h.origin && x.destination === h.destination && x.depart === h.depart &&
          (x.return || '') === (h.return || '') && x.cabin === h.cabin && x.currency === h.currency)
        .map(({ price, airline, source, checkedAt }) => ({ price, airline, source, checkedAt }));
    },
  };
}

const svc = createSearchService({
  db: browserDb(),
  fees,
  config: {
    serpapiKey: '', travelpayoutsToken: '', forceDemo: true,
    liveCacheMinutes: 180, calendarCacheMinutes: 720, serpapiMonthlyLimit: 0, serpapiHourlyLimit: 0,
  },
});

const routes = {
  status: () => ({ ...svc.status(), hosted: true }),
  airports: (p) => ({ airports: searchAirports(p.q) }),
  fees: () => fees,
  search: (p) => svc.search(p, { refresh: p.refresh === '1' }),
  return: (p) => svc.returnFlights(p, { refresh: p.refresh === '1' }),
  calendar: (p) => svc.calendar(p),
  explore: (p) => svc.explore(p),
  history: (p) => svc.history(p),
};

export async function handle(path, params) {
  const route = routes[path];
  if (!route) throw new Error('Not found');
  // Round-trip through JSON so the UI gets the same plain data the HTTP API returns.
  return JSON.parse(JSON.stringify(await route(params)));
}
