// Pure date helpers for the fare calendar (UTC, ISO yyyy-mm-dd). Unit-tested in test/datepicker.test.js.
const DAY_MS = 86400e3;
export const MAX_DAYS_AHEAD = 360;

export const iso = (d) => d.toISOString().slice(0, 10);
export const parseIso = (s) => new Date(`${s}T00:00:00Z`);
export const addDaysIso = (s, n) => iso(new Date(parseIso(s).getTime() + n * DAY_MS));
export const monthOf = (s) => s.slice(0, 7);
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  return iso(new Date(Date.UTC(y, m - 1 + n, 1))).slice(0, 7);
}
export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
/** Same day-of-month one month away, clamped (31 Jan + 1 month -> 28/29 Feb). */
export function shiftByMonths(s, n) {
  const m = addMonths(monthOf(s), n);
  const d = Math.min(Number(s.slice(8, 10)), daysInMonth(m));
  return `${m}-${String(d).padStart(2, '0')}`;
}
/** Monday-first weekday index: Mon=0 … Sun=6. */
export const weekdayMon = (s) => (parseIso(s).getUTCDay() + 6) % 7;
export const nightsBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / DAY_MS);
/** Leading blank cells + the month's dates, Monday-first. */
export function monthCells(month) {
  const lead = weekdayMon(`${month}-01`);
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  return [...Array(lead).fill(null), ...days];
}
/** Split one month's fares into cheaper / average / pricier thirds. */
export function fareLevels(days) {
  const prices = Object.values(days).map((d) => d.price).sort((a, b) => a - b);
  if (!prices.length) return () => '';
  const t1 = prices[Math.floor((prices.length - 1) / 3)];
  const t2 = prices[Math.floor(((prices.length - 1) * 2) / 3)];
  return (p) => (p <= t1 ? 'lvl-low' : p <= t2 ? 'lvl-mid' : 'lvl-high');
}

