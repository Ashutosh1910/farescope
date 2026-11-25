// Pure filter / sort logic over normalized flights. No DOM, so it's unit-tested in Node.
export const WINDOWS = [
  { id: 'night', label: 'Night', hint: '00:00–04:59', from: 0, to: 5 },
  { id: 'morning', label: 'Morning', hint: '05:00–11:59', from: 5, to: 12 },
  { id: 'afternoon', label: 'Afternoon', hint: '12:00–17:59', from: 12, to: 18 },
  { id: 'evening', label: 'Evening', hint: '18:00–23:59', from: 18, to: 24 },
];

export function hourOf(t) {
  const m = /(\d{1,2}):(\d{2})/.exec(t || '');
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
}
export function windowOf(t) {
  const h = hourOf(t);
  return h == null ? null : WINDOWS.find((w) => h >= w.from && h < w.to)?.id ?? null;
}
export const priceOf = (f, useEstimate) => (useEstimate && f.estimate ? f.estimate.total : f.price);
export const stopBucket = (f) => Math.min(f.leg.stops, 2);
const maxLayover = (f) => f.leg.layovers.reduce((m, l) => Math.max(m, l.durationMin || 0), 0);

export function emptyFilters() {
  return {
    stops: new Set(), // included buckets; empty = all
    excludedAirlines: new Set(),
    departWindows: new Set(),
    arriveWindows: new Set(),
    maxPrice: null,
    maxDuration: null,
    maxLayover: null,
    noOvernightLayovers: false,
    noSeparateTickets: false,
  };
}

export function isFiltered(f) {
  return !!(f.stops.size || f.excludedAirlines.size || f.departWindows.size || f.arriveWindows.size ||
    f.maxPrice != null || f.maxDuration != null || f.maxLayover != null || f.noOvernightLayovers || f.noSeparateTickets);
}

export function facets(flights, useEstimate = false) {
  const stops = {};
  const airlines = new Map();
  let minPrice = Infinity, maxPrice = -Infinity, minDur = Infinity, maxDur = -Infinity, maxLay = 0;
  let hasSeparate = false, hasOvernight = false;
  for (const f of flights) {
    const p = priceOf(f, useEstimate);
    const b = stopBucket(f);
    stops[b] = Math.min(stops[b] ?? Infinity, p);
    for (const a of f.airlines) {
      const cur = airlines.get(a) || { name: a, minPrice: Infinity, count: 0, logo: null };
      cur.minPrice = Math.min(cur.minPrice, p);
      cur.count++;
      if (!cur.logo) cur.logo = f.leg.segments.find((s) => s.airline === a)?.airlineLogo || null;
      airlines.set(a, cur);
    }
    minPrice = Math.min(minPrice, p);
    maxPrice = Math.max(maxPrice, p);
    minDur = Math.min(minDur, f.leg.durationMin);
    maxDur = Math.max(maxDur, f.leg.durationMin);
    maxLay = Math.max(maxLay, maxLayover(f));
    hasSeparate ||= f.separateTickets;
    hasOvernight ||= f.leg.layovers.some((l) => l.overnight);
  }
  return {
    count: flights.length,
    stops,
    airlines: [...airlines.values()].sort((a, b) => a.minPrice - b.minPrice),
    price: flights.length ? { min: minPrice, max: maxPrice } : null,
    duration: flights.length ? { min: minDur, max: maxDur } : null,
    maxLayover: maxLay,
    hasSeparate,
    hasOvernight,
  };
}

export function applyFilters(flights, f, useEstimate = false) {
  return flights.filter((x) => {
    if (f.stops.size && !f.stops.has(stopBucket(x))) return false;
    if (f.excludedAirlines.size && x.airlines.every((a) => f.excludedAirlines.has(a))) return false;
    if (f.departWindows.size && !f.departWindows.has(windowOf(x.leg.departTime))) return false;
    if (f.arriveWindows.size && !f.arriveWindows.has(windowOf(x.leg.arriveTime))) return false;
    if (f.maxPrice != null && priceOf(x, useEstimate) > f.maxPrice) return false;
    if (f.maxDuration != null && x.leg.durationMin > f.maxDuration) return false;
    if (f.maxLayover != null && x.leg.stops > 0 && maxLayover(x) > f.maxLayover) return false;
    if (f.noOvernightLayovers && x.leg.layovers.some((l) => l.overnight)) return false;
    if (f.noSeparateTickets && x.separateTickets) return false;
    return true;
  });
}

function bestScorer(flights, useEstimate) {
  const minP = Math.min(...flights.map((f) => priceOf(f, useEstimate))) || 1;
  const minD = Math.min(...flights.map((f) => f.leg.durationMin)) || 1;
  return (f) => priceOf(f, useEstimate) / minP + 0.7 * (f.leg.durationMin / minD) + 0.15 * f.leg.stops - (f.isBest ? 0.15 : 0);
}

export const SORTS = {
  best: 'Best',
  cheapest: 'Cheapest',
  fastest: 'Fastest',
  earliest: 'Earliest departure',
  latest: 'Latest departure',
};

export function sortFlights(flights, by = 'best', useEstimate = false) {
  const list = [...flights];
  const p = (f) => priceOf(f, useEstimate);
  const dep = (f) => f.leg.departTime || '';
  switch (by) {
    case 'cheapest': return list.sort((a, b) => p(a) - p(b) || a.leg.durationMin - b.leg.durationMin);
    case 'fastest': return list.sort((a, b) => a.leg.durationMin - b.leg.durationMin || p(a) - p(b));
    case 'earliest': return list.sort((a, b) => dep(a).localeCompare(dep(b)) || p(a) - p(b));
    case 'latest': return list.sort((a, b) => dep(b).localeCompare(dep(a)) || p(a) - p(b));
    default: {
      if (!list.length) return list;
      const s = bestScorer(list, useEstimate);
      return list.sort((a, b) => s(a) - s(b));
    }
  }
}

/** Headline numbers for the Best / Cheapest / Fastest tabs. */
export function sortSummary(flights, useEstimate = false) {
  if (!flights.length) return null;
  const top = (by) => {
    const f = sortFlights(flights, by, useEstimate)[0];
    return { price: priceOf(f, useEstimate), durationMin: f.leg.durationMin };
  };
  return { best: top('best'), cheapest: top('cheapest'), fastest: top('fastest') };
}
