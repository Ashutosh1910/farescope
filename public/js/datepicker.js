// Fare-calendar date picker: two months side by side (a scrolling sheet on phones), the lowest
// cached one-way fare under each day, and departure/return chosen as one range.
// Pure date helpers are exported for tests; createDatePicker needs a DOM.
import { money, shortMoney, esc } from './format.js';

const DAY_MS = 86400e3;
const MAX_DAYS_AHEAD = 360;

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

const fmt = (s, o) => parseIso(s).toLocaleDateString('en-GB', { timeZone: 'UTC', ...o });
const longDate = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function createDatePicker({ host, departInput, retInput, departBtn, retBtn, isReturn, setTrip, getRoute, fetchFares, onChange }) {
  let pop = null;
  let active = 'depart';
  let view = null; // first visible month (desktop)
  let focusDate = null;
  let mobile = false;
  let opener = null;
  let renderSeq = 0;
  let observer = null;
  const fareCache = new Map();

  const today = () => new Date().toISOString().slice(0, 10);
  const maxDate = () => addDaysIso(today(), MAX_DAYS_AHEAD);
  const clamp = (s) => (s < today() ? today() : s > maxDate() ? maxDate() : s);
  const isOpen = () => !!pop && !pop.hidden;

  // ---------- the two field buttons ----------
  function renderButtons() {
    const d = departInput.value;
    departBtn.innerHTML = d
      ? `<strong>${esc(fmt(d, { day: 'numeric', month: 'short' }))}</strong><small>${esc(fmt(d, { weekday: 'long' }))}</small>`
      : '<strong class="ph">Select date</strong><small>&nbsp;</small>';
    departBtn.setAttribute('aria-label', `Departure date: ${d ? longDate(d) : 'not set'}. Open calendar`);
    if (!isReturn()) {
      retBtn.innerHTML = '<strong class="ph">One way</strong><small>Add a return</small>';
      retBtn.setAttribute('aria-label', 'One way. Open calendar to add a return date');
    } else {
      const r = retInput.value;
      retBtn.innerHTML = r
        ? `<strong>${esc(fmt(r, { day: 'numeric', month: 'short' }))}</strong><small>${esc(fmt(r, { weekday: 'long' }))}</small>`
        : '<strong class="ph">Add return</strong><small>&nbsp;</small>';
      retBtn.setAttribute('aria-label', `Return date: ${r ? longDate(r) : 'not set'}. Open calendar`);
    }
    for (const [btn, which] of [[departBtn, 'depart'], [retBtn, 'return']]) {
      btn.setAttribute('aria-expanded', String(isOpen() && active === which));
    }
  }

  // ---------- fares ----------
  function routeFor(which) {
    const r = getRoute();
    if (!r.from || !r.to || r.to === 'ANY' || r.from === r.to) return null;
    return which === 'return' ? { ...r, from: r.to, to: r.from } : r;
  }
  function faresFor(route, month) {
    const key = `${route.from}|${route.to}|${month}|${route.currency}|${route.cabin}`;
    if (!fareCache.has(key)) {
      fareCache.set(key, fetchFares({ ...route, month }).catch(() => {
        fareCache.delete(key); // allow a retry next time
        return null;
      }));
    }
    return fareCache.get(key);
  }
  function loadMonthFares(month, seq) {
    const route = routeFor(active);
    if (!route || month < monthOf(today())) return;
    faresFor(route, month).then((days) => {
      if (seq !== renderSeq || !days || !pop) return;
      applyFares(month, days, route.currency);
    });
  }
  function applyFares(month, days, currency) {
    const level = fareLevels(days);
    const min = Math.min(...Object.values(days).map((d) => d.price));
    for (const cell of pop.querySelectorAll(`.dp-day[data-date^="${month}-"]`)) {
      const info = days[cell.dataset.date];
      const f = cell.querySelector('.f');
      cell.classList.remove('lvl-low', 'lvl-mid', 'lvl-high', 'is-cheapest');
      if (!info || cell.disabled) {
        f.textContent = '';
        cell.setAttribute('aria-label', cell.dataset.label);
        continue;
      }
      f.textContent = shortMoney(info.price, currency);
      cell.classList.add(level(info.price));
      if (info.price === min) cell.classList.add('is-cheapest');
      cell.setAttribute('aria-label', `${cell.dataset.label}, from ${money(info.price, currency)}${info.price === min ? ', cheapest this month' : ''}`);
    }
    pop.querySelector(`.dp-month[data-month="${month}"]`)?.classList.add('has-fares');
  }

  // ---------- rendering ----------
  function visibleMonths() {
    if (!mobile) return [view, addMonths(view, 1)];
    const out = [];
    for (let m = monthOf(today()); m <= monthOf(maxDate()); m = addMonths(m, 1)) out.push(m);
    return out;
  }

  function dayCell(ds) {
    if (!ds) return '<span class="dp-blank" aria-hidden="true"></span>';
    const d = departInput.value;
    const r = isReturn() ? retInput.value : '';
    const disabled = ds < today() || ds > maxDate();
    const cls = ['dp-day'];
    if (ds === d) cls.push('is-start');
    if (ds === r) cls.push('is-end');
    if (d && r && r > d && (ds === d || ds === r)) cls.push('has-range');
    if (d && r && ds > d && ds < r) cls.push('in-range');
    if (ds === today()) cls.push('is-today');
    const role = ds === d ? ', departure' : ds === r ? ', return' : '';
    const label = `${longDate(ds)}${role}`;
    return `<button type="button" class="${cls.join(' ')}" data-date="${ds}" data-label="${esc(label)}" aria-label="${esc(label)}"
      aria-pressed="${ds === d || ds === r}" tabindex="${ds === focusDate ? 0 : -1}" ${disabled ? 'disabled' : ''}>
      <span class="n">${Number(ds.slice(8))}</span><span class="f" aria-hidden="true"></span></button>`;
  }

  function monthBlock(month) {
    return `<div class="dp-month" data-month="${month}" role="group" aria-label="${esc(fmt(`${month}-01`, { month: 'long', year: 'numeric' }))}">
      <div class="dp-month-title" aria-hidden="true">${esc(fmt(`${month}-01`, { month: 'long', year: 'numeric' }))}</div>
      <div class="dp-grid">
        ${WEEKDAYS.map((w, i) => `<span class="dp-wd ${i > 4 ? 'we' : ''}" aria-hidden="true">${w}</span>`).join('')}
        ${monthCells(month).map(dayCell).join('')}
      </div></div>`;
  }

  function tab(which, label) {
    const v = which === 'depart' ? departInput.value : isReturn() ? retInput.value : '';
    const text = v ? fmt(v, { weekday: 'short', day: 'numeric', month: 'short' }) : which === 'return' ? (isReturn() ? 'Add return' : 'One way') : 'Select date';
    return `<button type="button" class="dp-tab" data-tab="${which}" aria-pressed="${active === which}">
      <small>${label}</small><strong class="${v ? '' : 'ph'}">${esc(text)}</strong></button>`;
  }

  function summary() {
    const d = departInput.value;
    const r = retInput.value;
    if (!isReturn()) return 'One-way trip';
    if (!r) return active === 'return' ? 'Now pick your return date' : '';
    const n = nightsBetween(d, r);
    return n === 0 ? 'Same-day return' : `${n} night${n > 1 ? 's' : ''}`;
  }

  function render() {
    const seq = ++renderSeq;
    const route = routeFor(active);
    const months = visibleMonths();
    const minMonth = monthOf(today());
    pop.classList.toggle('sheet', mobile);
    pop.setAttribute('aria-modal', String(mobile));
    pop.innerHTML = `
      <div class="dp-head">
        <div class="dp-tabs">${tab('depart', 'Departure')}${tab('return', 'Return')}</div>
        <button type="button" class="icon-btn dp-close" aria-label="Close calendar">✕</button>
      </div>
      <p class="dp-note">${route
        ? `<strong>${esc(route.from)} → ${esc(route.to)}</strong> · lowest one-way fare per adult, from recent searches`
        : 'Choose From and To to see the lowest fare on each day.'}</p>
      <div class="dp-body">
        ${mobile ? '' : `<button type="button" class="icon-btn dp-nav prev" data-nav="-1" aria-label="Previous month" ${view <= minMonth ? 'disabled' : ''}>‹</button>`}
        <div class="dp-months">${months.map(monthBlock).join('')}</div>
        ${mobile ? '' : `<button type="button" class="icon-btn dp-nav next" data-nav="1" aria-label="Next month" ${addMonths(view, 1) >= monthOf(maxDate()) ? 'disabled' : ''}>›</button>`}
      </div>
      <div class="dp-foot">
        <span class="dp-summary" aria-live="polite">${esc(summary())}</span>
        ${route ? '<span class="dp-legend"><i></i>Lowest fares</span>' : ''}
        ${isReturn() ? '<button type="button" class="link" data-oneway>Make it one way</button>' : ''}
        <button type="button" class="btn primary sm" data-done>Done</button>
      </div>`;

    observer?.disconnect();
    if (mobile && route && 'IntersectionObserver' in window) {
      const scroller = pop.querySelector('.dp-months');
      observer = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          loadMonthFares(e.target.dataset.month, seq);
          observer.unobserve(e.target);
        }
      }, { root: scroller, rootMargin: '200px 0px' });
      scroller.querySelectorAll('.dp-month').forEach((m) => observer.observe(m));
    } else {
      months.forEach((m) => loadMonthFares(m, seq));
    }
    renderButtons();
  }

  function focusCell(ds, { scroll = false } = {}) {
    const cell = pop.querySelector(`.dp-day[data-date="${ds}"]`);
    if (!cell) return;
    pop.querySelectorAll('.dp-day[tabindex="0"]').forEach((c) => c.setAttribute('tabindex', '-1'));
    cell.setAttribute('tabindex', '0');
    cell.focus({ preventScroll: !scroll });
    if (scroll && mobile) cell.closest('.dp-month').scrollIntoView({ block: 'start' });
  }

  function position() {
    if (mobile) {
      pop.style.left = pop.style.top = '';
      return;
    }
    const hostRect = host.getBoundingClientRect();
    const fieldRect = departBtn.closest('.field').getBoundingClientRect();
    pop.style.top = `${fieldRect.bottom - hostRect.top + 8}px`;
    const left = fieldRect.left - hostRect.left;
    pop.style.left = `${Math.max(0, Math.min(left, host.clientWidth - pop.offsetWidth))}px`;
  }

  // ---------- behaviour ----------
  function changed() {
    renderButtons();
    onChange?.();
  }

  function pick(ds) {
    focusDate = ds;
    if (active === 'depart') {
      departInput.value = ds;
      if (retInput.value && retInput.value < ds) retInput.value = '';
      changed();
      if (isReturn()) {
        active = 'return';
        focusDate = retInput.value || ds;
        render();
        focusCell(focusDate);
      } else {
        render();
        setTimeout(() => close(true), 160);
      }
      return;
    }
    if (ds < departInput.value) { // earlier than departure: treat it as a new departure
      departInput.value = ds;
      changed();
      render();
      focusCell(ds);
      return;
    }
    retInput.value = ds;
    changed();
    render();
    setTimeout(() => close(true), 200);
  }

  function setView(month) {
    const min = monthOf(today());
    const max = addMonths(monthOf(maxDate()), -1);
    view = month < min ? min : month > max ? max : month;
  }

  function moveFocus(ds) {
    ds = clamp(ds);
    focusDate = ds;
    const m = monthOf(ds);
    if (!mobile && m !== view && m !== addMonths(view, 1)) {
      setView(m < view ? m : addMonths(m, -1));
      render();
    }
    focusCell(ds, { scroll: mobile });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    const cell = e.target.closest?.('.dp-day');
    if (!cell) return;
    const ds = cell.dataset.date;
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next = null;
    if (e.key in steps) next = addDaysIso(ds, steps[e.key]);
    else if (e.key === 'PageUp') next = shiftByMonths(ds, -1);
    else if (e.key === 'PageDown') next = shiftByMonths(ds, 1);
    else if (e.key === 'Home') next = addDaysIso(ds, -weekdayMon(ds));
    else if (e.key === 'End') next = addDaysIso(ds, 6 - weekdayMon(ds));
    if (!next) return;
    e.preventDefault();
    moveFocus(next);
  }

  function onClick(e) {
    const cell = e.target.closest('.dp-day');
    if (cell && !cell.disabled) return pick(cell.dataset.date);
    const t = e.target.closest('[data-tab]');
    if (t) return switchTab(t.dataset.tab);
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      setView(addMonths(view, Number(nav.dataset.nav)));
      render();
      return;
    }
    if (e.target.closest('.dp-close, [data-done]')) return close(true);
    if (e.target.closest('[data-oneway]')) {
      retInput.value = '';
      setTrip('oneway');
      active = 'depart';
      changed();
      render();
    }
  }

  function switchTab(which) {
    if (which === 'return' && !isReturn()) {
      setTrip('return');
      changed();
    }
    active = which;
    focusDate = (which === 'return' ? retInput.value || departInput.value : departInput.value) || today();
    render();
    focusCell(focusDate);
  }

  // Preview the range while hovering return dates.
  function onHover(e) {
    if (active !== 'return' || !departInput.value) return;
    const cell = e.target.closest('.dp-day');
    const end = cell && !cell.disabled && cell.dataset.date > departInput.value ? cell.dataset.date : null;
    pop.classList.toggle('previewing', !!end);
    for (const c of pop.querySelectorAll('.dp-day')) {
      const ds = c.dataset.date;
      c.classList.toggle('in-preview', !!end && ds > departInput.value && ds < end);
      c.classList.toggle('preview-end', ds === end);
    }
  }

  function onOutside(e) {
    if (!pop.contains(e.target) && !departBtn.contains(e.target) && !retBtn.contains(e.target)) close(false);
  }
  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const nowMobile = matchMedia('(max-width: 620px)').matches;
      if (nowMobile !== mobile) {
        mobile = nowMobile;
        render();
      }
      position();
    }, 120);
  }

  function open(which, btn) {
    opener = btn;
    if (which === 'return' && !isReturn()) {
      setTrip('return');
      changed();
    }
    active = which;
    mobile = matchMedia('(max-width: 620px)').matches;
    focusDate = clamp((which === 'return' ? retInput.value || departInput.value : departInput.value) || today());
    // Keep the departure visible while choosing the return, when both fit on screen.
    const d = departInput.value;
    setView(which === 'return' && d && monthOf(focusDate) <= addMonths(monthOf(d), 1) ? monthOf(d) : monthOf(focusDate));
    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'dp';
      pop.id = 'date-picker';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-label', 'Choose travel dates');
      pop.addEventListener('click', onClick);
      pop.addEventListener('keydown', onKey);
      pop.addEventListener('pointerover', onHover);
      pop.addEventListener('pointerleave', () => onHover({ target: pop }));
      host.appendChild(pop);
    }
    pop.hidden = false;
    document.body.classList.toggle('dp-lock', mobile);
    render();
    position();
    focusCell(focusDate, { scroll: true });
    document.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('resize', onResize);
  }

  function close(returnFocus) {
    if (!isOpen()) return;
    pop.hidden = true;
    observer?.disconnect();
    document.body.classList.remove('dp-lock');
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', onResize);
    renderButtons();
    if (returnFocus) opener?.focus();
  }

  departBtn.addEventListener('click', () => (isOpen() && active === 'depart' ? close(true) : open('depart', departBtn)));
  retBtn.addEventListener('click', () => (isOpen() && active === 'return' ? close(true) : open('return', retBtn)));
  renderButtons();

  return {
    /** Call after dates or trip type change from outside the picker. */
    refresh() {
      renderButtons();
      if (isOpen()) render();
    },
    close,
    isOpen,
  };
}
