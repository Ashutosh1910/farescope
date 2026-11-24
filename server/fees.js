import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

export function loadFees(file = path.join(ROOT, 'data', 'fees.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function findAirline(fees, name) {
  if (!name) return null;
  const direct = fees.airlines[name];
  if (direct) return { name, ...direct };
  const lower = name.toLowerCase();
  for (const [n, v] of Object.entries(fees.airlines)) {
    if (n.toLowerCase() === lower) return { name: n, ...v };
  }
  return null;
}

/**
 * Estimate what you'd actually pay: API fare + the airline's payment-page fee.
 * `directions` is 1 for one-way, 2 for a return trip (used by per-sector fees).
 */
export function estimateTotal(fees, { price, currency, airline, pax, directions = 1 }) {
  const base = { fare: price, fee: 0, total: price, applied: false };
  if (price == null) return { ...base, status: 'no-price' };
  if (String(currency).toUpperCase() !== fees.currency) {
    return { ...base, status: 'currency-mismatch', note: `Fees are configured in ${fees.currency}` };
  }
  const entry = findAirline(fees, airline);
  if (!entry || entry.convenienceFee == null) {
    return { ...base, status: 'not-configured', note: `No fee configured for ${airline || 'this airline'}` };
  }
  const paying = pax.adults + pax.children + pax.infantsSeat + (fees.countLapInfants ? pax.infantsLap : 0);
  let units;
  switch (entry.per) {
    case 'booking': units = 1; break;
    case 'passenger_sector': units = paying * directions; break;
    default: units = paying;
  }
  const fee = entry.convenienceFee * units;
  return {
    fare: price,
    fee,
    total: price + fee,
    applied: true,
    status: entry.verified ? 'verified' : 'unverified',
    note: `${entry.name}: ${fees.currency} ${entry.convenienceFee} × ${units} (${entry.per.replace('_', ' per ')})`,
  };
}

export function bookUrlFor(fees, airline) {
  return findAirline(fees, airline)?.bookUrl || null;
}
