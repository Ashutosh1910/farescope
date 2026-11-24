const fmtCache = new Map();
export function money(n, currency = 'INR') {
  if (n == null || Number.isNaN(n)) return '—';
  const key = currency;
  if (!fmtCache.has(key)) {
    fmtCache.set(key, new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }));
  }
  return fmtCache.get(key).format(n);
}

export function shortMoney(n, currency = 'INR') {
  if (n == null) return '—';
  const sym = money(0, currency).replace(/[\d.,\s]/g, '');
  if (n >= 100000 && currency === 'INR') return `${sym}${(n / 100000).toFixed(n >= 1e6 ? 0 : 1)}L`;
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${sym}${Math.round(n)}`;
}

export function duration(min) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** "2026-12-10 06:05" -> "06:05" */
export const clock = (t) => (/(\d{1,2}:\d{2})/.exec(t || '') || [])[1] || '—';
export const dateOf = (t) => String(t || '').slice(0, 10);

export function dayDiff(fromTime, toTime) {
  const a = Date.parse(`${dateOf(fromTime)}T00:00:00Z`);
  const b = Date.parse(`${dateOf(toTime)}T00:00:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.round((b - a) / 86400e3);
}

export function prettyDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}

export function timeAgo(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function airlineCode(f) {
  const fn = f?.leg?.segments?.[0]?.flightNumber || '';
  return fn.split(' ')[0] || (f?.primaryAirline || '?').slice(0, 2).toUpperCase();
}
