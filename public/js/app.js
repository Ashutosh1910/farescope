import { money, shortMoney, duration, clock, dayDiff, prettyDate, timeAgo, addDays, esc, airlineCode, dateOf } from './format.js';
import { WINDOWS, emptyFilters, isFiltered, facets, applyFilters, sortFlights, sortSummary, priceOf, SORTS } from './filters.js';
import { attachAutocomplete, setAirport, resolveCode, ANYWHERE } from './autocomplete.js';
import { api } from './api.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const PAGE = 20;

const store = {
  get(k, d) { try { const v = localStorage.getItem(`fs:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`fs:${k}`, JSON.stringify(v)); } catch { /* private mode */ } },
};

const state = {
  status: null,
  trip: 'return',
  pax: { adults: 1, children: 0, infantsSeat: 0, infantsLap: 0 },
  showEst: store.get('showEst', false),
  query: null,
  phase: 'outbound', // 'outbound' | 'return'
  out: null, // { res, filters, sort, shown }
  ret: null,
  selectedOut: null,
  calendarMonth: null,
  exploreMonth: null,
};
const view = () => (state.phase === 'return' ? state.ret : state.out);

// ---------------------------------------------------------------- form
const el = {
  form: $('#search-form'), from: $('#from'), to: $('#to'), depart: $('#depart'), ret: $('#ret'),
  retField: $('#return-field'), currency: $('#currency'), cabin: $('#cabin'), showEst: $('#show-est'),
  paxBtn: $('#pax-btn'), paxPop: $('#pax-pop'), formError: $('#form-error'),
};

function today() { return new Date().toISOString().slice(0, 10); }

function setTrip(t) {
  state.trip = t;
  $$('[data-trip]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.trip === t)));
  el.retField.classList.toggle('disabled', t === 'oneway');
  el.ret.disabled = t === 'oneway';
}

function paxSummary() {
  const p = state.pax;
  const n = p.adults + p.children + p.infantsSeat + p.infantsLap;
  const cabin = el.cabin.options[el.cabin.selectedIndex].text;
  return `${n} traveller${n > 1 ? 's' : ''} · ${cabin}`;
}
function renderPax() {
  for (const row of $$('.stepper', el.paxPop)) {
    const k = row.dataset.key;
    $('output', row).textContent = state.pax[k];
    const [minus, plus] = $$('button', row);
    const total = Object.values(state.pax).reduce((a, b) => a + b, 0);
    minus.disabled = state.pax[k] <= (k === 'adults' ? 1 : 0) || (k === 'adults' && state.pax.infantsLap >= state.pax.adults);
    plus.disabled = total >= 9 || (k === 'infantsLap' && state.pax.infantsLap >= state.pax.adults);
  }
  $('#pax-note').textContent = state.pax.infantsLap ? 'Each lap infant must travel with an adult.' : 'Up to 9 travellers per search.';
  el.paxBtn.textContent = paxSummary();
}
function togglePax(open) {
  el.paxPop.hidden = !open;
  el.paxBtn.setAttribute('aria-expanded', String(open));
}

function readForm() {
  const from = resolveCode(el.from);
  const to = resolveCode(el.to) || (el.to.value.trim() ? '' : 'ANY');
  return {
    from, to,
    depart: el.depart.value,
    return: state.trip === 'return' ? el.ret.value : '',
    ...state.pax,
    cabin: el.cabin.value,
    currency: el.currency.value,
  };
}

function validate(q) {
  if (!q.from) return 'Choose where you are flying from.';
  if (!q.to) return 'Choose a destination from the list, or pick Anywhere.';
  if (q.from === q.to) return 'Origin and destination are the same.';
  if (!q.depart) return 'Pick a departure date.';
  if (q.depart < today()) return 'Departure date is in the past.';
  if (q.to !== 'ANY' && state.trip === 'return' && !q.return) return 'Pick a return date, or switch to One way.';
  if (q.return && q.return < q.depart) return 'Return date is before departure.';
  return '';
}

function syncUrl(q) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== '' && v != null && !(typeof v === 'number' && v === 0 && k !== 'adults')) p.set(k, v);
  history.replaceState(null, '', `?${p}`);
}

async function fillFromUrl() {
  const p = new URLSearchParams(location.search);
  if (!p.get('from')) return false;
  const lookup = async (code) => {
    if (code === 'ANY') return ANYWHERE;
    try { return (await api('airports', { q: code })).airports.find((a) => a.code === code) || { code, city: code, name: code, country: '' }; } catch { return { code, city: code, name: code, country: '' }; }
  };
  setAirport(el.from, await lookup(p.get('from').toUpperCase()));
  if (p.get('to')) setAirport(el.to, await lookup(p.get('to').toUpperCase()));
  if (p.get('depart')) el.depart.value = p.get('depart');
  if (p.get('return')) { el.ret.value = p.get('return'); setTrip('return'); } else setTrip('oneway');
  for (const k of Object.keys(state.pax)) if (p.get(k)) state.pax[k] = Math.max(k === 'adults' ? 1 : 0, Number(p.get(k)) || 0);
  if (p.get('cabin')) el.cabin.value = p.get('cabin');
  if (p.get('currency')) el.currency.value = p.get('currency');
  renderPax();
  return true;
}

// ---------------------------------------------------------------- search flow
async function onSubmit(e) {
  e?.preventDefault();
  togglePax(false);
  const q = readForm();
  const err = validate(q);
  el.formError.textContent = err;
  if (err) return;
  syncUrl(q);
  $('#intro').hidden = true;
  if (q.to === 'ANY') return runExplore(q);
  return runSearch(q);
}

async function runSearch(q, { refresh = false } = {}) {
  state.query = q;
  state.phase = 'outbound';
  state.selectedOut = null;
  state.ret = null;
  $('#explore').hidden = true;
  $('#results-area').hidden = false;
  renderSteps();
  showLoading();
  loadCalendar(q.depart.slice(0, 7));
  try {
    const res = await api('search', { ...q, refresh: refresh ? '1' : '' });
    state.out = { res, filters: emptyFilters(), sort: 'best', shown: PAGE };
    renderAll();
    loadInsights();
    refreshStatus();
  } catch (err) {
    showError(err.message);
  }
}

async function chooseOutbound(f) {
  state.selectedOut = f;
  state.phase = 'return';
  renderSteps();
  showLoading();
  window.scrollTo({ top: $('#results-area').offsetTop - 12, behavior: 'smooth' });
  try {
    const res = await api('return', { ...state.query, token: f.departureToken });
    state.ret = { res, filters: emptyFilters(), sort: 'best', shown: PAGE };
    renderAll();
    refreshStatus();
  } catch (err) {
    showError(err.message);
  }
}

function backToOutbound() {
  state.phase = 'outbound';
  state.selectedOut = null;
  renderSteps();
  renderAll();
}

function onSelect(id) {
  const v = view();
  const f = v.res.flights.find((x) => x.id === id);
  if (!f) return;
  if (state.query.return && state.phase === 'outbound' && f.departureToken) return chooseOutbound(f);
  openDrawer(state.phase === 'return' ? [state.selectedOut, f] : [f], f);
}

// ---------------------------------------------------------------- rendering: results
function renderAll() {
  renderBanner();
  renderFilters();
  renderList();
}

function showLoading() {
  $('#sort-tabs').innerHTML = '';
  $('#filters').innerHTML = '<div class="skeleton" style="height:320px"></div>';
  $('#list').innerHTML = Array.from({ length: 5 }, () => '<div class="card skeleton-card"><div class="skeleton" style="height:18px;width:40%"></div><div class="skeleton" style="height:28px;width:70%;margin-top:14px"></div></div>').join('');
}
function showError(msg) {
  $('#filters').innerHTML = '';
  $('#sort-tabs').innerHTML = '';
  $('#list').innerHTML = `<div class="empty error"><h3>Search didn't work</h3><p>${esc(msg)}</p></div>`;
}

function renderBanner() {
  const v = view();
  const parts = [];
  if (v?.res.source === 'demo' || state.status?.liveProvider === 'demo') {
    parts.push(state.status?.hosted
      ? `<div class="banner warn" role="note"><strong>Demo fares.</strong> This hosted copy only has synthetic prices — not real fares. Run FareScope on your own machine with a SerpApi key for live Google Flights prices.</div>`
      : `<div class="banner warn" role="note"><strong>Demo fares.</strong> These prices are synthetic, generated so the app works without keys — not real fares. Add <code>SERPAPI_KEY</code> to <code>.env</code> for live Google Flights prices.</div>`);
  }
  if (v) {
    const when = timeAgo(v.res.fetchedAt);
    parts.push(`<div class="banner info"><span>${v.res.cached ? 'Cached result' : 'Fresh result'} · checked ${esc(when)}</span>
      ${state.phase === 'outbound' ? `<button type="button" class="link" id="refresh-btn">Refresh${state.status?.liveProvider === 'serpapi' ? ' (uses 1 search)' : ''}</button>` : ''}
      ${v.res.unpriced ? `<span>${v.res.unpriced} option(s) without a price hidden</span>` : ''}</div>`);
  }
  $('#banner').innerHTML = parts.join('');
  $('#refresh-btn')?.addEventListener('click', () => runSearch(state.query, { refresh: true }));
}

function renderSteps() {
  const q = state.query;
  if (!q?.return) { $('#trip-steps').innerHTML = ''; return; }
  const sel = state.selectedOut;
  $('#trip-steps').innerHTML = `<ol class="steps">
    <li class="${state.phase === 'outbound' ? 'current' : 'done'}"><span class="n">1</span>
      <div><strong>Outbound · ${esc(q.from)} → ${esc(q.to)}</strong><small>${esc(prettyDate(q.depart))}</small>
      ${sel ? `<div class="picked">${esc(clock(sel.leg.departTime))}–${esc(clock(sel.leg.arriveTime))} · ${esc(sel.primaryAirline)} · ${esc(stopsText(sel))} <button type="button" class="link" id="change-out">Change</button></div>` : ''}</div></li>
    <li class="${state.phase === 'return' ? 'current' : ''}"><span class="n">2</span>
      <div><strong>Return · ${esc(q.to)} → ${esc(q.from)}</strong><small>${esc(prettyDate(q.return))}</small></div></li>
  </ol>
  ${state.phase === 'outbound' ? '<p class="hint">Prices shown are the total for the whole return trip, starting from the cheapest return flight.</p>' : '<p class="hint">Prices are the round-trip total with this return flight.</p>'}`;
  $('#change-out')?.addEventListener('click', backToOutbound);
}

function stopsText(f) {
  if (!f.leg.stops) return 'Direct';
  return `${f.leg.stops} stop${f.leg.stops > 1 ? 's' : ''} · ${f.leg.layovers.map((l) => l.code).join(', ')}`;
}

function renderFilters() {
  const v = view();
  const box = $('#filters');
  if (!v || !v.res.flights.length) { box.innerHTML = ''; return; }
  const fc = facets(v.res.flights, state.showEst);
  const cur = state.query.currency;
  const f = v.filters;
  const stopLabels = ['Direct', '1 stop', '2+ stops'];
  const windows = (key, title) => `<fieldset class="fgroup"><legend>${title}</legend><div class="chips">
    ${WINDOWS.map((w) => `<button type="button" class="chip-btn" data-win="${key}" data-id="${w.id}" aria-pressed="${f[key].has(w.id)}" title="${w.hint}">${w.label}<small>${w.hint.replace(/:00|:59/g, '')}</small></button>`).join('')}
  </div></fieldset>`;
  const slider = (key, label, min, max, step, fmt, value) => `<fieldset class="fgroup"><legend>${label}</legend>
    <input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${value ?? max}" aria-label="${label}">
    <div class="range-val" data-range-val="${key}">${value == null ? 'Any' : `Up to ${fmt(value)}`}</div></fieldset>`;

  box.innerHTML = `
    <div class="filters-head"><h2>Filters</h2><button type="button" class="link" id="reset-filters" ${isFiltered(f) ? '' : 'disabled'}>Reset</button></div>
    <fieldset class="fgroup"><legend>Stops</legend>
      ${[0, 1, 2].map((b) => `<label class="check ${fc.stops[b] == null ? 'muted' : ''}"><input type="checkbox" data-stop="${b}" ${fc.stops[b] != null && (f.stops.size === 0 || f.stops.has(b)) ? 'checked' : ''} ${fc.stops[b] == null ? 'disabled' : ''}><span>${stopLabels[b]}</span><em>${fc.stops[b] == null ? '—' : money(fc.stops[b], cur)}</em></label>`).join('')}
    </fieldset>
    ${windows('departWindows', 'Departure time')}
    ${windows('arriveWindows', 'Arrival time')}
    ${fc.price.max > fc.price.min ? slider('maxPrice', state.showEst ? 'Max est. total' : 'Max price', fc.price.min, fc.price.max, Math.max(1, Math.round((fc.price.max - fc.price.min) / 100)), (x) => money(x, cur), f.maxPrice) : ''}
    ${fc.duration.max > fc.duration.min ? slider('maxDuration', 'Max journey time', fc.duration.min, fc.duration.max, 5, duration, f.maxDuration) : ''}
    ${fc.maxLayover > 0 ? slider('maxLayover', 'Max layover', 30, fc.maxLayover, 5, duration, f.maxLayover) : ''}
    ${fc.hasOvernight || fc.hasSeparate ? `<fieldset class="fgroup"><legend>Connections</legend>
      ${fc.hasOvernight ? `<label class="check"><input type="checkbox" data-bool="noOvernightLayovers" ${f.noOvernightLayovers ? 'checked' : ''}><span>No overnight layovers</span></label>` : ''}
      ${fc.hasSeparate ? `<label class="check"><input type="checkbox" data-bool="noSeparateTickets" ${f.noSeparateTickets ? 'checked' : ''}><span>No separate tickets</span></label>` : ''}
    </fieldset>` : ''}
    <fieldset class="fgroup"><legend>Airlines <span class="legend-actions"><button type="button" class="link" data-airlines="all">All</button> · <button type="button" class="link" data-airlines="none">None</button></span></legend>
      ${fc.airlines.map((a) => `<label class="check"><input type="checkbox" data-airline="${esc(a.name)}" ${f.excludedAirlines.has(a.name) ? '' : 'checked'}><span>${esc(a.name)}</span><em>${money(a.minPrice, cur)}</em></label>`).join('')}
    </fieldset>`;
}

function onFilterInput(e) {
  const v = view();
  if (!v) return;
  const f = v.filters;
  const t = e.target;
  if (t.dataset.stop != null) {
    const all = $$('[data-stop]').filter((x) => !x.disabled);
    const checked = all.filter((x) => x.checked).map((x) => Number(x.dataset.stop));
    f.stops = checked.length === all.length ? new Set() : new Set(checked);
  } else if (t.dataset.airline != null) {
    t.checked ? f.excludedAirlines.delete(t.dataset.airline) : f.excludedAirlines.add(t.dataset.airline);
  } else if (t.dataset.bool) {
    f[t.dataset.bool] = t.checked;
  } else if (t.dataset.range) {
    const key = t.dataset.range;
    const val = Number(t.value);
    f[key] = val >= Number(t.max) ? null : val;
    const fmt = key === 'maxPrice' ? (x) => money(x, state.query.currency) : duration;
    $(`[data-range-val="${key}"]`).textContent = f[key] == null ? 'Any' : `Up to ${fmt(f[key])}`;
  } else return;
  v.shown = PAGE;
  $('#reset-filters').disabled = !isFiltered(f);
  renderList();
}

function onFilterClick(e) {
  const v = view();
  if (!v) return;
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.win) {
    const set = v.filters[b.dataset.win];
    set.has(b.dataset.id) ? set.delete(b.dataset.id) : set.add(b.dataset.id);
    b.setAttribute('aria-pressed', String(set.has(b.dataset.id)));
  } else if (b.id === 'reset-filters') {
    v.filters = emptyFilters();
    renderFilters();
  } else if (b.dataset.airlines) {
    v.filters.excludedAirlines = b.dataset.airlines === 'all' ? new Set() : new Set(v.res.flights.flatMap((x) => x.airlines));
    renderFilters();
  } else return;
  v.shown = PAGE;
  const reset = $('#reset-filters');
  if (reset) reset.disabled = !isFiltered(v.filters);
  renderList();
}

function renderList() {
  const v = view();
  if (!v) return;
  const { res } = v;
  const cur = state.query.currency;
  if (!res.flights.length) {
    $('#sort-tabs').innerHTML = '';
    $('#list').innerHTML = `<div class="empty"><h3>No flights found</h3><p>Try nearby dates — the calendar above shows which days have fares.</p></div>`;
    return;
  }
  const filtered = applyFilters(res.flights, v.filters, state.showEst);
  const sorted = sortFlights(filtered, v.sort, state.showEst);
  const sum = sortSummary(filtered, state.showEst);
  const tab = (k) => `<button type="button" role="tab" class="sort-tab" data-sort="${k}" aria-selected="${v.sort === k}">
      <span>${SORTS[k]}</span>${sum ? `<strong>${money(sum[k].price, cur)}</strong><small>${duration(sum[k].durationMin)}</small>` : '<small>—</small>'}</button>`;
  $('#sort-tabs').innerHTML = `<div class="sort-row"><div class="sort-tabs" role="tablist" aria-label="Sort">${['best', 'cheapest', 'fastest'].map(tab).join('')}</div>
    <label class="inline-field sort-more"><span>Sort</span><select id="sort-select">${Object.entries(SORTS).map(([k, l]) => `<option value="${k}" ${v.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <p class="count">${filtered.length} of ${res.flights.length} flights${isFiltered(v.filters) ? ' match your filters' : ''}</p>`;

  if (!sorted.length) {
    $('#list').innerHTML = `<div class="empty"><h3>Nothing matches these filters</h3><p><button type="button" class="link" id="clear-filters">Clear all filters</button></p></div>`;
    $('#clear-filters').addEventListener('click', () => { v.filters = emptyFilters(); renderFilters(); renderList(); });
    return;
  }
  const cheapest = Math.min(...filtered.map((f) => priceOf(f, state.showEst)));
  const fastest = Math.min(...filtered.map((f) => f.leg.durationMin));
  $('#list').innerHTML = sorted.slice(0, v.shown).map((f) => card(f, { cheapest, fastest })).join('') +
    (sorted.length > v.shown ? `<button type="button" class="btn ghost more" id="show-more">Show ${Math.min(PAGE, sorted.length - v.shown)} more</button>` : '');
}

function logo(f) {
  const src = f.logo || f.leg.segments[0].airlineLogo;
  if (src) return `<img class="logo" src="${esc(src)}" alt="" width="32" height="32" loading="lazy" data-code="${esc(airlineCode(f))}">`;
  return `<span class="logo badge" aria-hidden="true">${esc(airlineCode(f))}</span>`;
}

function priceBlock(f, cur) {
  const e = f.estimate;
  const pax = state.query.adults + state.query.children + state.query.infantsSeat + state.query.infantsLap;
  const who = pax > 1 ? `${pax} travellers` : '1 traveller';
  const trip = state.query.return ? ' · return' : '';
  if (state.showEst) {
    return `<div class="price">${money(e.total, cur)}</div><div class="sub">est. total, ${who}${trip}</div>
      <div class="est ${e.applied ? '' : 'missing'}">${e.applied ? `fare ${money(e.fare, cur)} + fee ${money(e.fee, cur)}` : esc(e.status === 'currency-mismatch' ? 'fees only in ' + state.status.feesCurrency : 'fee not configured')}</div>`;
  }
  return `<div class="price">${money(f.price, cur)}</div><div class="sub">${pax > 1 ? `total, ${who}` : who}${trip}</div>
    ${e.applied ? `<div class="est">≈ ${money(e.total, cur)} with fees</div>` : ''}`;
}

function card(f, { cheapest, fastest }) {
  const cur = state.query.currency;
  const leg = f.leg;
  const plus = dayDiff(leg.departTime, leg.arriveTime);
  const tags = [];
  if (f.isBest) tags.push('<span class="tag good">Top pick</span>');
  if (priceOf(f, state.showEst) === cheapest) tags.push('<span class="tag">Cheapest</span>');
  if (leg.durationMin === fastest) tags.push('<span class="tag">Fastest</span>');
  if (f.separateTickets) tags.push('<span class="tag warn">Separate tickets</span>');
  if (leg.layovers.some((l) => l.overnight)) tags.push('<span class="tag warn">Overnight layover</span>');
  if (leg.segments.some((s) => s.oftenDelayed)) tags.push('<span class="tag warn">Often delayed 30+ min</span>');
  if (f.carbon?.diffPercent != null && f.carbon.diffPercent <= -10) tags.push(`<span class="tag eco">${f.carbon.diffPercent}% CO₂</span>`);
  const actionLabel = state.query.return && state.phase === 'outbound' ? 'Select outbound' : 'Select';
  return `<article class="card" data-id="${esc(f.id)}">
    <div class="card-main">
      <div class="carrier">${logo(f)}<span>${esc(f.airlines.join(' + '))}</span></div>
      <div class="times">
        <div class="t"><strong>${esc(clock(leg.departTime))}</strong><span>${esc(leg.segments[0].from.code)}</span></div>
        <div class="mid">
          <span class="dur">${duration(leg.durationMin)}</span>
          <span class="line" aria-hidden="true">${leg.layovers.map(() => '<i></i>').join('')}</span>
          <span class="stops ${leg.stops ? '' : 'direct'}">${esc(stopsText(f))}</span>
        </div>
        <div class="t"><strong>${esc(clock(leg.arriveTime))}${plus ? `<sup title="Arrives ${plus} day(s) later">+${plus}</sup>` : ''}</strong><span>${esc(leg.segments.at(-1).to.code)}</span></div>
      </div>
      ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
    </div>
    <div class="card-price">
      ${priceBlock(f, cur)}
      <button type="button" class="btn primary sm" data-select="${esc(f.id)}">${actionLabel}</button>
      <button type="button" class="link" data-details="${esc(f.id)}" aria-expanded="false">Flight details</button>
    </div>
    <div class="details" hidden>${details(f)}</div>
  </article>`;
}

function details(f) {
  const rows = [];
  f.leg.segments.forEach((s, i) => {
    rows.push(`<li class="tl-seg">
      <div class="seg-time"><strong>${esc(clock(s.from.time))}</strong><small>${esc(prettyDate(dateOf(s.from.time)))}</small></div>
      <div class="seg-body">
        <div><strong>${esc(s.from.code)}</strong> ${esc(s.from.name)}</div>
        <div class="seg-meta">${esc(s.airline)} · ${esc(s.flightNumber)} · ${esc(s.aircraft || 'Aircraft n/a')} · ${duration(s.durationMin)}${s.cabin ? ` · ${esc(s.cabin)}` : ''}${s.legroom ? ` · legroom ${esc(s.legroom)}` : ''}</div>
        ${s.extensions.length ? `<div class="seg-ext">${s.extensions.map(esc).join(' · ')}</div>` : ''}
        <div><strong>${esc(s.to.code)}</strong> ${esc(s.to.name)} · arrives ${esc(clock(s.to.time))}${s.overnight ? ' (overnight)' : ''}</div>
      </div></li>`);
    const l = f.leg.layovers[i];
    if (l) rows.push(`<li class="layover">${duration(l.durationMin)} layover · ${esc(l.name || l.code)}${l.overnight ? ' · overnight' : ''}</li>`);
  });
  const c = f.carbon;
  return `<ol class="timeline">${rows.join('')}</ol>
    ${c?.grams ? `<p class="carbon">Estimated emissions ${Math.round(c.grams / 1000)} kg CO₂e${c.diffPercent != null ? ` (${c.diffPercent > 0 ? '+' : ''}${c.diffPercent}% vs typical for this route)` : ''}</p>` : ''}
    ${f.estimate.note ? `<p class="fee-note">Fee estimate: ${esc(f.estimate.note)}</p>` : ''}`;
}

function onListClick(e) {
  const sel = e.target.closest('[data-select]');
  if (sel) return onSelect(sel.dataset.select);
  const det = e.target.closest('[data-details]');
  if (det) {
    const d = det.closest('.card').querySelector('.details');
    d.hidden = !d.hidden;
    det.setAttribute('aria-expanded', String(!d.hidden));
    det.textContent = d.hidden ? 'Flight details' : 'Hide details';
    return;
  }
  if (e.target.id === 'show-more') {
    view().shown += PAGE;
    renderList();
  }
}

// ---------------------------------------------------------------- drawer
function googleFlightsUrl(q) {
  const text = `Flights to ${q.to} from ${q.from} on ${q.depart}${q.return ? ` through ${q.return}` : ' one way'}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(text)}&curr=${q.currency}`;
}

function openDrawer(legs, priced) {
  const q = state.query;
  const cur = q.currency;
  const e = priced.estimate;
  const v = view();
  const legHtml = legs.map((f, i) => `<div class="drawer-leg">
      <h3>${legs.length > 1 ? (i === 0 ? 'Outbound' : 'Return') : 'Flight'} · ${esc(prettyDate(dateOf(f.leg.departTime)))}</h3>
      <div class="drawer-leg-row">${logo(f)}<div><strong>${esc(clock(f.leg.departTime))} ${esc(f.leg.segments[0].from.code)} → ${esc(clock(f.leg.arriveTime))} ${esc(f.leg.segments.at(-1).to.code)}</strong>
      <small>${esc(f.airlines.join(' + '))} · ${duration(f.leg.durationMin)} · ${esc(stopsText(f))}</small></div></div>
      <details><summary>Itinerary</summary>${details(f)}</details></div>`).join('');
  const book = priced.bookUrl || legs[0].bookUrl;
  $('#drawer-body').innerHTML = `${legHtml}
    <div class="breakdown">
      <div><span>Fare incl. taxes (all travellers)</span><strong>${money(e.fare, cur)}</strong></div>
      <div><span>Convenience fee (est.)</span><strong>${e.applied ? money(e.fee, cur) : '—'}</strong></div>
      <div class="total"><span>Estimated total</span><strong>${money(e.total, cur)}</strong></div>
      <p class="fine">${esc(e.note || '')}${e.applied && e.status === 'unverified' ? ' — not yet verified in fees.json' : ''}${e.note ? '. ' : ''}Bags, seats and meals are extra. Prices checked ${esc(timeAgo(v.res.fetchedAt))}${v.res.source === 'demo' ? ' (demo data — not a real fare)' : ''}.</p>
    </div>
    <div class="drawer-actions">
      <a class="btn primary" href="${esc(v.res.googleFlightsUrl || googleFlightsUrl(q))}" target="_blank" rel="noopener">Check on Google Flights</a>
      ${book ? `<a class="btn ghost" href="${esc(book)}" target="_blank" rel="noopener">Airline website</a>` : ''}
    </div>
    <p class="fine">The airline's payment page shows the exact final amount.</p>`;
  $('#drawer').hidden = false;
  $('#drawer-backdrop').hidden = false;
  $('#drawer-close').focus();
}
function closeDrawer() {
  $('#drawer').hidden = true;
  $('#drawer-backdrop').hidden = true;
}

// ---------------------------------------------------------------- calendar
function monthLabel(m) { return prettyDate(`${m}-01`, { month: 'long', year: 'numeric' }); }
function shiftMonth(m, n) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

async function loadCalendar(month) {
  const q = state.query;
  state.calendarMonth = month;
  const box = $('#calendar');
  box.hidden = false;
  box.innerHTML = `<div class="panel-head"><h2>Cheapest days · ${esc(monthLabel(month))}</h2></div><div class="skeleton" style="height:76px"></div>`;
  try {
    const res = await api('calendar', { from: q.from, to: q.to, month, oneWay: String(!q.return), currency: q.currency, cabin: q.cabin });
    if (state.calendarMonth !== month) return;
    renderCalendar(res, month);
  } catch (err) {
    box.innerHTML = `<div class="panel-head"><h2>Cheapest days</h2></div><p class="muted-text">Calendar unavailable: ${esc(err.message)}</p>`;
  }
}

function renderCalendar(res, month) {
  const q = state.query;
  const [y, m] = month.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prices = Object.values(res.days).map((d) => d.price).sort((a, b) => a - b);
  const t1 = prices[Math.floor(prices.length / 3)] ?? Infinity;
  const t2 = prices[Math.floor((prices.length * 2) / 3)] ?? Infinity;
  const min = prices[0];
  const minMonth = today().slice(0, 7);
  const cells = [];
  for (let d = 1; d <= n; d++) {
    const ds = `${month}-${String(d).padStart(2, '0')}`;
    const info = res.days[ds];
    const past = ds < today();
    const lvl = !info ? '' : info.price <= t1 ? 'lvl-low' : info.price <= t2 ? 'lvl-mid' : 'lvl-high';
    const word = !info ? '' : lvl === 'lvl-low' ? 'cheaper' : lvl === 'lvl-mid' ? 'average' : 'pricier';
    cells.push(`<button type="button" class="day ${lvl} ${ds === q.depart ? 'selected' : ''} ${info?.price === min ? 'min' : ''}" data-day="${ds}" ${past ? 'disabled' : ''}
      aria-label="${esc(prettyDate(ds))}${info ? `, from ${money(info.price, q.currency)}, ${word}` : ', no cached fare'}">
      <small>${esc(prettyDate(ds, { weekday: 'short' }))}</small><strong>${d}</strong><span>${info ? shortMoney(info.price, q.currency) : '·'}</span></button>`);
  }
  const src = res.source === 'demo' ? 'Demo data' : `Cached fares from Travelpayouts · usually 2–7 days old`;
  $('#calendar').innerHTML = `<div class="panel-head">
      <h2>Cheapest days · ${esc(monthLabel(month))}</h2>
      <div class="month-nav"><button type="button" class="icon-btn" data-month="-1" aria-label="Previous month" ${month <= minMonth ? 'disabled' : ''}>‹</button><button type="button" class="icon-btn" data-month="1" aria-label="Next month">›</button></div>
    </div>
    <div class="days" role="list">${cells.join('')}</div>
    <div class="cal-foot"><span class="legend"><i class="lvl-low"></i>Cheaper <i class="lvl-mid"></i>Average <i class="lvl-high"></i>Pricier</span>
      <span>${esc(src)} · price per adult${q.return ? ', round trip, any return date' : ''} · tap a day to search it live</span></div>`;
  $('.day.selected')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function onCalendarClick(e) {
  const nav = e.target.closest('[data-month]');
  if (nav) return loadCalendar(shiftMonth(state.calendarMonth, Number(nav.dataset.month)));
  const day = e.target.closest('[data-day]');
  if (!day) return;
  const q = { ...state.query };
  const ds = day.dataset.day;
  if (q.return) {
    const len = Math.round((Date.parse(q.return) - Date.parse(q.depart)) / 86400e3);
    q.return = addDays(ds, len);
    el.ret.value = q.return;
  }
  q.depart = ds;
  el.depart.value = ds;
  syncUrl(q);
  runSearch(q);
}

// ---------------------------------------------------------------- insights + price history
async function loadInsights() {
  const q = state.query;
  const ins = state.out?.res.insights;
  let hist = { points: [] };
  try { hist = await api('history', q); } catch { /* optional */ }
  if (state.query !== q) return;
  const box = $('#insights');
  const cur = q.currency;
  const cards = [];
  if (ins) {
    const lvl = ins.level ? String(ins.level).toLowerCase() : null;
    cards.push(`<div class="insight">
      <h3>${lvl ? `Prices are <span class="lvl-word ${esc(lvl)}">${esc(lvl)}</span> for these dates` : 'Price insight'}</h3>
      ${ins.typicalRange ? `<p>Usually ${money(ins.typicalRange[0], cur)}–${money(ins.typicalRange[1], cur)} for this trip.</p>` : ''}
      ${ins.lowest != null ? `<p>Lowest right now: <strong>${money(ins.lowest, cur)}</strong></p>` : ''}
      ${ins.history?.length > 2 ? sparkline(ins.history, cur, 'Price trend for these dates') : ''}
      <p class="fine">${state.out.res.source === 'demo' ? 'Demo data.' : 'From Google Flights via SerpApi.'}</p></div>`);
  }
  const pts = hist.points;
  if (pts.length) {
    const low = pts.reduce((a, b) => (b.price < a.price ? b : a));
    const last = pts.at(-1);
    cards.push(`<div class="insight">
      <h3>Your checks</h3>
      <p>Searched ${pts.length} time${pts.length > 1 ? 's' : ''} · latest ${money(last.price, cur)} (${esc(timeAgo(last.checkedAt))})</p>
      <p>Lowest you've seen: <strong>${money(low.price, cur)}</strong>${low.airline ? ` on ${esc(low.airline)}` : ''}</p>
      ${pts.length > 2 ? sparkline(pts.map((p) => ({ ts: p.checkedAt, price: p.price })), cur, 'Your price checks') : '<p class="fine">Search again later to build a price history.</p>'}
    </div>`);
  }
  box.hidden = !cards.length;
  box.innerHTML = cards.join('');
}

function sparkline(points, cur, label) {
  const W = 280, H = 64, P = 6;
  const xs = points.map((p) => p.ts), ys = points.map((p) => p.price);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x) => P + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * P);
  const sy = (y) => H - P - ((y - y0) / (y1 - y0 || 1)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.ts).toFixed(1)},${sy(p.price).toFixed(1)}`).join('');
  const last = points.at(-1);
  const data = esc(JSON.stringify(points.map((p) => [p.ts, p.price])));
  return `<figure class="spark" data-points="${data}" data-cur="${esc(cur)}">
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(label)}: from ${money(points[0].price, cur)} to ${money(last.price, cur)}, low ${money(y0, cur)}, high ${money(y1, cur)}">
      <path d="${d}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${sx(last.ts)}" cy="${sy(last.price)}" r="4" fill="var(--series-1)" stroke="var(--card)" stroke-width="2"/>
      <line class="spark-x" x1="0" x2="0" y1="0" y2="${H}" stroke="var(--line)" stroke-width="1" visibility="hidden"/>
      <circle class="spark-dot" r="4" fill="var(--series-1)" stroke="var(--card)" stroke-width="2" visibility="hidden"/>
    </svg>
    <figcaption><span>${esc(label)}</span><span>low ${shortMoney(y0, cur)} · high ${shortMoney(y1, cur)}</span></figcaption>
    <div class="spark-tip" hidden></div>
  </figure>`;
}

function onSparkMove(e) {
  const fig = e.target.closest('.spark');
  if (!fig) return;
  const svg = $('svg', fig);
  const pts = JSON.parse(fig.dataset.points);
  const rect = svg.getBoundingClientRect();
  const W = 280, H = 64, P = 6;
  const rel = ((e.clientX - rect.left) / rect.width) * W;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x) => P + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * P);
  const sy = (y) => H - P - ((y - y0) / (y1 - y0 || 1)) * (H - 2 * P);
  let best = pts[0];
  for (const p of pts) if (Math.abs(sx(p[0]) - rel) < Math.abs(sx(best[0]) - rel)) best = p;
  const cx = sx(best[0]), cy = sy(best[1]);
  const line = $('.spark-x', svg), dot = $('.spark-dot', svg), tip = $('.spark-tip', fig);
  line.setAttribute('x1', cx); line.setAttribute('x2', cx); line.setAttribute('visibility', 'visible');
  dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('visibility', 'visible');
  tip.hidden = false;
  tip.innerHTML = `<strong>${money(best[1], fig.dataset.cur)}</strong><span>${esc(new Date(best[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}</span>`;
  tip.style.left = `${Math.min(Math.max((cx / W) * rect.width, 40), rect.width - 40)}px`;
}
function onSparkLeave(e) {
  const fig = e.target.closest?.('.spark');
  if (!fig) return;
  $('.spark-x', fig).setAttribute('visibility', 'hidden');
  $('.spark-dot', fig).setAttribute('visibility', 'hidden');
  $('.spark-tip', fig).hidden = true;
}

// ---------------------------------------------------------------- explore ("Anywhere")
async function runExplore(q, month = q.depart.slice(0, 7)) {
  state.query = q;
  state.exploreMonth = month;
  $('#results-area').hidden = true;
  $('#calendar').hidden = true;
  $('#insights').hidden = true;
  $('#banner').innerHTML = '';
  const box = $('#explore');
  box.hidden = false;
  box.innerHTML = `<div class="panel-head"><h2>Cheapest from ${esc(q.from)} · ${esc(monthLabel(month))}</h2></div><div class="explore-grid">${Array.from({ length: 8 }, () => '<div class="dest skeleton" style="height:120px"></div>').join('')}</div>`;
  try {
    const res = await api('explore', { from: q.from, month, oneWay: String(state.trip === 'oneway'), currency: q.currency, cabin: q.cabin });
    if (state.exploreMonth !== month) return;
    const src = res.source === 'demo' ? 'Demo data — synthetic prices.' : 'Cached fares from Travelpayouts (usually 2–7 days old). Pick one to check live prices.';
    box.innerHTML = `<div class="panel-head"><h2>Cheapest from ${esc(q.from)} · ${esc(monthLabel(month))}</h2>
        <div class="month-nav"><button type="button" class="icon-btn" data-xmonth="-1" aria-label="Previous month" ${month <= today().slice(0, 7) ? 'disabled' : ''}>‹</button><button type="button" class="icon-btn" data-xmonth="1" aria-label="Next month">›</button></div></div>
      <p class="muted-text">${esc(src)} ${state.trip === 'return' ? 'Round-trip' : 'One-way'} prices per adult.</p>
      ${res.destinations.length ? `<div class="explore-grid">${res.destinations.map((d) => `
        <button type="button" class="dest" data-dest="${esc(d.destination)}" data-date="${esc(dateOf(d.departAt))}" data-ret="${esc(dateOf(d.returnAt))}">
          <span class="dest-city">${esc(d.airport.city)}</span>
          <span class="dest-country">${esc(d.airport.country || d.destination)}</span>
          <span class="dest-price">from <strong>${money(d.price, q.currency)}</strong></span>
          <span class="dest-meta">${esc(prettyDate(dateOf(d.departAt)))} · ${d.transfers === 0 ? 'Direct' : d.transfers == null ? '' : `${d.transfers} stop${d.transfers > 1 ? 's' : ''}`}</span>
        </button>`).join('')}</div>` : '<div class="empty"><h3>No cached fares for this month</h3><p>Try another month.</p></div>'}`;
  } catch (err) {
    box.innerHTML = `<div class="empty error"><h3>Explore didn't work</h3><p>${esc(err.message)}</p></div>`;
  }
}

async function onExploreClick(e) {
  const nav = e.target.closest('[data-xmonth]');
  if (nav) return runExplore(state.query, shiftMonth(state.exploreMonth, Number(nav.dataset.xmonth)));
  const b = e.target.closest('[data-dest]');
  if (!b) return;
  const code = b.dataset.dest;
  const found = (await api('airports', { q: code }).catch(() => ({ airports: [] }))).airports.find((a) => a.code === code);
  setAirport(el.to, found || { code, city: code, name: code, country: '' });
  const depart = b.dataset.date && b.dataset.date >= today() ? b.dataset.date : el.depart.value;
  el.depart.value = depart;
  if (state.trip === 'return') el.ret.value = b.dataset.ret && b.dataset.ret >= depart ? b.dataset.ret : addDays(depart, 5);
  onSubmit();
}

// ---------------------------------------------------------------- status
async function refreshStatus() {
  try {
    state.status = await api('status');
  } catch {
    return;
  }
  const s = state.status;
  const chip = $('#status-chip');
  chip.hidden = false;
  if (s.liveProvider === 'demo') {
    chip.className = 'chip warn';
    chip.textContent = 'Demo data';
    chip.title = s.hosted ? 'Hosted demo — prices are synthetic' : 'No SERPAPI_KEY configured — prices are synthetic';
  } else {
    chip.className = 'chip live';
    chip.textContent = `Live · ${s.quota.usedThisMonth}/${s.quota.monthlyLimit} searches this month`;
    chip.title = `SerpApi Google Flights. ${s.quota.usedThisHour}/${s.quota.hourlyLimit} this hour. Results cached ${s.cacheMinutes.live} min.`;
  }
}

// ---------------------------------------------------------------- wire up
function init() {
  attachAutocomplete(el.from, $('#from-list'));
  attachAutocomplete(el.to, $('#to-list'), { allowAnywhere: true });

  const d = addDays(today(), 14);
  el.depart.min = today();
  el.ret.min = today();
  el.depart.value = d;
  el.ret.value = addDays(d, 7);
  el.depart.addEventListener('change', () => {
    el.ret.min = el.depart.value;
    if (el.ret.value && el.ret.value < el.depart.value) el.ret.value = addDays(el.depart.value, 7);
  });
  el.currency.value = store.get('currency', 'INR');
  el.currency.addEventListener('change', () => store.set('currency', el.currency.value));
  el.showEst.checked = state.showEst;
  el.showEst.addEventListener('change', () => {
    state.showEst = el.showEst.checked;
    store.set('showEst', state.showEst);
    if (view()) { renderFilters(); renderList(); }
  });

  $$('[data-trip]').forEach((b) => b.addEventListener('click', () => setTrip(b.dataset.trip)));
  setTrip('return');
  $('#swap').addEventListener('click', () => {
    const a = { v: el.from.value, c: el.from.dataset.code };
    if (el.to.dataset.code === 'ANY') return;
    el.from.value = el.to.value; el.from.dataset.code = el.to.dataset.code || '';
    el.to.value = a.v; el.to.dataset.code = a.c || '';
  });

  el.paxBtn.addEventListener('click', () => togglePax(el.paxPop.hidden));
  $('#pax-done').addEventListener('click', () => { togglePax(false); el.paxBtn.focus(); });
  el.paxPop.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b) return;
    const k = b.closest('.stepper').dataset.key;
    state.pax[k] = Math.max(k === 'adults' ? 1 : 0, state.pax[k] + Number(b.dataset.d));
    renderPax();
  });
  el.cabin.addEventListener('change', renderPax);
  document.addEventListener('click', (e) => {
    if (!el.paxPop.hidden && !e.target.closest('.pax')) togglePax(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#drawer').hidden) closeDrawer();
    else if (!el.paxPop.hidden) { togglePax(false); el.paxBtn.focus(); }
  });
  renderPax();

  el.form.addEventListener('submit', onSubmit);
  $('#filters').addEventListener('change', onFilterInput);
  $('#filters').addEventListener('input', (e) => { if (e.target.type === 'range') onFilterInput(e); });
  $('#filters').addEventListener('click', onFilterClick);
  $('#sort-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sort]');
    if (!b) return;
    view().sort = b.dataset.sort;
    renderList();
  });
  $('#sort-tabs').addEventListener('change', (e) => {
    if (e.target.id !== 'sort-select') return;
    view().sort = e.target.value;
    renderList();
  });
  $('#list').addEventListener('click', onListClick);
  $('#calendar').addEventListener('click', onCalendarClick);
  $('#explore').addEventListener('click', onExploreClick);
  $('#insights').addEventListener('pointermove', onSparkMove);
  $('#insights').addEventListener('pointerleave', onSparkLeave, true);
  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  $('#filters-toggle').addEventListener('click', (e) => {
    const open = $('#filters').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });

  // Airline logos are remote images; if one fails, show the airline-code badge instead of a broken icon.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('logo')) return;
    const badge = document.createElement('span');
    badge.className = 'logo badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = img.dataset.code || '✈';
    img.replaceWith(badge);
  }, true);

  refreshStatus();
  fillFromUrl().then((has) => { if (has) onSubmit(); });
}

init();
