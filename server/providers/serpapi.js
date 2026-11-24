// SerpApi Google Flights engine: live prices scraped from Google Flights by SerpApi.
// Docs: https://serpapi.com/google-flights-api
import { ProviderError } from './errors.js';

const ENDPOINT = 'https://serpapi.com/search.json';
const CABIN = { economy: '1', premium: '2', business: '3', first: '4' };
const NO_RESULTS = /hasn'?t returned any results/i;

export function buildParams(q, { apiKey, gl = 'in', hl = 'en', departureToken } = {}) {
  const p = new URLSearchParams({
    engine: 'google_flights',
    api_key: apiKey,
    departure_id: q.from,
    arrival_id: q.to,
    outbound_date: q.depart,
    type: q.return ? '1' : '2',
    travel_class: CABIN[q.cabin] || '1',
    adults: String(q.adults),
    children: String(q.children),
    infants_in_seat: String(q.infantsSeat),
    infants_on_lap: String(q.infantsLap),
    currency: q.currency,
    gl,
    hl,
  });
  if (q.return) p.set('return_date', q.return);
  if (departureToken) p.set('departure_token', departureToken);
  return p;
}

export async function searchSerpApi(q, opts) {
  const { fetchImpl = fetch } = opts;
  const url = `${ENDPOINT}?${buildParams(q, opts)}`;
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(45_000) });
  } catch (e) {
    throw new ProviderError(`Could not reach SerpApi: ${e.message}`, { provider: 'serpapi' });
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw new ProviderError(`SerpApi returned a non-JSON response (HTTP ${res.status})`, { provider: 'serpapi' });
  }
  if (json.error) {
    if (NO_RESULTS.test(json.error)) return normalizeSerpApi({}, q);
    const status = res.status === 401 ? 401 : res.status === 429 ? 429 : 502;
    throw new ProviderError(`SerpApi: ${json.error}`, { status, provider: 'serpapi' });
  }
  if (!res.ok) throw new ProviderError(`SerpApi HTTP ${res.status}`, { provider: 'serpapi' });
  return normalizeSerpApi(json, q);
}

const airportOf = (a = {}) => ({ code: a.id || '', name: a.name || '', time: a.time || '' });

export function normalizeSerpApi(json, q) {
  const groups = [
    ...(json.best_flights || []).map((f) => [f, true]),
    ...(json.other_flights || []).map((f) => [f, false]),
  ];
  let unpriced = 0;
  const flights = [];
  groups.forEach(([f, isBest], i) => {
    if (typeof f.price !== 'number') {
      unpriced++;
      return;
    }
    const segments = (f.flights || []).map((s) => ({
      from: airportOf(s.departure_airport),
      to: airportOf(s.arrival_airport),
      airline: s.airline || '',
      airlineLogo: s.airline_logo || null,
      flightNumber: s.flight_number || '',
      aircraft: s.airplane || '',
      durationMin: s.duration ?? null,
      cabin: s.travel_class || '',
      legroom: s.legroom || '',
      overnight: !!s.overnight,
      oftenDelayed: !!s.often_delayed_by_over_30_min,
      extensions: s.extensions || [],
    }));
    if (!segments.length) return;
    const layovers = (f.layovers || []).map((l) => ({
      code: l.id || '',
      name: l.name || '',
      durationMin: l.duration ?? 0,
      overnight: !!l.overnight,
    }));
    const airlines = [...new Set(segments.map((s) => s.airline).filter(Boolean))];
    flights.push({
      id: `s${i}-${segments.map((s) => s.flightNumber).join('_')}`,
      price: f.price,
      currency: q.currency,
      isBest,
      airlines,
      primaryAirline: airlines[0] || '',
      logo: f.airline_logo || segments[0].airlineLogo,
      separateTickets: /separate/i.test(f.type || '') || (f.extensions || []).some((e) => /separate tickets/i.test(e)),
      leg: {
        segments,
        layovers,
        stops: segments.length - 1,
        durationMin: f.total_duration ?? segments.reduce((t, s) => t + (s.durationMin || 0), 0) +
          layovers.reduce((t, l) => t + l.durationMin, 0),
        departTime: segments[0].from.time,
        arriveTime: segments[segments.length - 1].to.time,
      },
      carbon: f.carbon_emissions
        ? {
            grams: f.carbon_emissions.this_flight ?? null,
            typical: f.carbon_emissions.typical_for_this_route ?? null,
            diffPercent: f.carbon_emissions.difference_percent ?? null,
          }
        : null,
      departureToken: f.departure_token || null,
      bookingToken: f.booking_token || null,
    });
  });

  const pi = json.price_insights;
  return {
    flights,
    unpriced,
    insights: pi
      ? {
          lowest: pi.lowest_price ?? null,
          level: pi.price_level || null,
          typicalRange: pi.typical_price_range || null,
          history: (pi.price_history || []).map(([ts, price]) => ({ ts: ts * 1000, price })),
        }
      : null,
    googleFlightsUrl: json.search_metadata?.google_flights_url || null,
  };
}
