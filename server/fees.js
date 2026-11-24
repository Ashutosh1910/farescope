// Pure functions (also bundled for the browser). Loading fees.json from disk lives in fees-file.js.

function findEntry(fees, name, group = 'airlines') {
  if (!name) return null;
  const table = fees[group] || {};
  const direct = table[name];
  if (direct) return { name, ...direct };
  const lower = name.toLowerCase();
  for (const [n, v] of Object.entries(table)) {
    if (n.toLowerCase() === lower) return { name: n, ...v };
  }
  return null;
}

/**
 * Estimate what you'd actually pay: API fare + the airline's payment-page fee.
 * `directions` is 1 for one-way, 2 for a return trip (used by per-sector fees).
 */
export function estimateTotal(fees, { price, currency, airline, seller, pax, directions = 1 }) {
  const base = { fare: price, fee: 0, total: price, applied: false };
  if (price == null) return { ...base, status: 'no-price' };
  if (String(currency).toUpperCase() !== fees.currency) {
    return { ...base, status: 'currency-mismatch', note: `Fees are configured in ${fees.currency}` };
  }
  // A travel-site offer uses that site's fee; an airline's own offer (or a plain fare) uses the airline's.
  const name = seller || airline;
  const entry = seller ? findEntry(fees, seller, 'sellers') : findEntry(fees, airline);
  if (!entry || entry.convenienceFee == null) {
    return { ...base, status: 'not-configured', note: `No fee configured for ${name || 'this airline'}` };
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
  return findEntry(fees, airline)?.bookUrl || null;
}
