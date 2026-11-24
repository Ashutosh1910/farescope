// Travelpayouts (Aviasales) Data API: free CACHED prices built from other users' searches
// (typically 2–7 days old). Good for "cheapest day this month" and "anywhere" — not for quotes.
// Docs: https://support.travelpayouts.com/hc/en-us/articles/203956163
import { ProviderError } from './errors.js';

const ENDPOINT = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';

async function call(params, { token, fetchImpl = fetch }) {
  const url = `${ENDPOINT}?${new URLSearchParams(params)}`;
  let res;
  try {
    res = await fetchImpl(url, { headers: { 'X-Access-Token': token }, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    throw new ProviderError(`Could not reach Travelpayouts: ${e.message}`, { provider: 'travelpayouts' });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new ProviderError(`Travelpayouts: ${json.error || `HTTP ${res.status}`}`, {
      status: res.status === 401 ? 401 : 502,
      provider: 'travelpayouts',
    });
  }
  return json.data || [];
}

const linkOf = (r) => (r.link ? `https://www.aviasales.com${r.link}` : null);

export async function tpCalendar({ from, to, month, oneWay, currency }, opts) {
  const rows = await call(
    {
      origin: from,
      destination: to,
      departure_at: month,
      one_way: String(oneWay),
      sorting: 'price',
      unique: 'false',
      limit: '1000',
      currency: currency.toLowerCase(),
    },
    opts
  );
  return groupByDay(rows);
}

export function groupByDay(rows) {
  const days = {};
  for (const r of rows) {
    const day = String(r.departure_at || '').slice(0, 10);
    if (!day) continue;
    if (!days[day] || r.price < days[day].price) {
      days[day] = {
        price: r.price,
        airline: r.airline || null,
        transfers: r.transfers ?? null,
        returnAt: r.return_at || null,
        link: linkOf(r),
      };
    }
  }
  return days;
}

export async function tpExplore({ from, month, oneWay, currency }, opts) {
  const rows = await call(
    {
      origin: from,
      departure_at: month,
      one_way: String(oneWay),
      sorting: 'price',
      unique: 'true',
      limit: '60',
      currency: currency.toLowerCase(),
    },
    opts
  );
  return rows.map((r) => ({
    destination: r.destination,
    price: r.price,
    airline: r.airline || null,
    departAt: r.departure_at || null,
    returnAt: r.return_at || null,
    transfers: r.transfers ?? null,
    link: linkOf(r),
  }));
}
