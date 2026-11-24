import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, daysInMonth, shiftByMonths, weekdayMon, monthCells, nightsBetween, fareLevels, addDaysIso } from '../public/js/datepicker.js';

test('month and day arithmetic', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2027-01', -1), '2026-12');
  assert.equal(daysInMonth('2028-02'), 29);
  assert.equal(shiftByMonths('2027-01-31', 1), '2027-02-28');
  assert.equal(shiftByMonths('2027-03-31', -1), '2027-02-28');
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01');
  assert.equal(nightsBetween('2026-12-15', '2026-12-21'), 6);
});

test('Monday-first month grid', () => {
  assert.equal(weekdayMon('2026-12-14'), 0); // a Monday
  assert.equal(weekdayMon('2026-12-20'), 6); // a Sunday
  const cells = monthCells('2026-12'); // 1 Dec 2026 is a Tuesday
  assert.equal(cells[0], null);
  assert.equal(cells[1], '2026-12-01');
  assert.equal(cells.filter(Boolean).length, 31);
});

test('fare levels split a month into thirds', () => {
  const lvl = fareLevels({ a: { price: 100 }, b: { price: 200 }, c: { price: 300 }, d: { price: 400 }, e: { price: 500 }, f: { price: 600 } });
  assert.deepEqual([100, 200, 300, 400, 500, 600].map(lvl), ['lvl-low', 'lvl-low', 'lvl-mid', 'lvl-mid', 'lvl-high', 'lvl-high']);
  assert.equal(fareLevels({})(5), '');
});
