import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateTotal } from '../server/fees.js';

const fees = {
  currency: 'INR', countLapInfants: false,
  airlines: {
    IndiGo: { convenienceFee: 249, per: 'passenger', verified: '2026-11-01' },
    SectorAir: { convenienceFee: 100, per: 'passenger_sector', verified: null },
    BookAir: { convenienceFee: 300, per: 'booking', verified: null },
    Unknown: { convenienceFee: null, per: 'passenger' },
  },
};
const pax = { adults: 2, children: 1, infantsSeat: 0, infantsLap: 1 };

test('per-passenger fee skips lap infants', () => {
  const e = estimateTotal(fees, { price: 10000, currency: 'INR', airline: 'IndiGo', pax });
  assert.deepEqual([e.fee, e.total, e.status], [747, 10747, 'verified']);
});
test('per-sector fee multiplies by directions; per-booking is flat', () => {
  assert.equal(estimateTotal(fees, { price: 1, currency: 'INR', airline: 'SectorAir', pax, directions: 2 }).fee, 600);
  assert.equal(estimateTotal(fees, { price: 1, currency: 'INR', airline: 'BookAir', pax, directions: 2 }).fee, 300);
});
test('missing or mismatched fee data never invents a number', () => {
  assert.equal(estimateTotal(fees, { price: 5, currency: 'INR', airline: 'Unknown', pax }).status, 'not-configured');
  assert.equal(estimateTotal(fees, { price: 5, currency: 'INR', airline: 'Nobody', pax }).fee, 0);
  const usd = estimateTotal(fees, { price: 5, currency: 'USD', airline: 'IndiGo', pax });
  assert.deepEqual([usd.applied, usd.status], [false, 'currency-mismatch']);
});
test('airline name lookup is case-insensitive', () => {
  assert.equal(estimateTotal(fees, { price: 1, currency: 'inr', airline: 'indigo', pax }).applied, true);
});

test('travel-site offers use the seller fee table', () => {
  const f = { ...fees, sellers: { Goibibo: { convenienceFee: 300, per: 'booking', verified: null } } };
  const e = estimateTotal(f, { price: 7000, currency: 'INR', seller: 'goibibo', pax });
  assert.deepEqual([e.fee, e.total, e.applied], [300, 7300, true]);
  assert.equal(estimateTotal(f, { price: 7000, currency: 'INR', seller: 'Cleartrip', pax }).status, 'not-configured');
  assert.equal(estimateTotal(f, { price: 7000, currency: 'INR', seller: 'IndiGo', pax }).applied, false, 'airline names are not looked up as sellers');
});
