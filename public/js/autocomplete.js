import { esc } from './format.js';
import { api } from './api.js';

export const ANYWHERE = { code: 'ANY', city: 'Anywhere', name: 'Cheapest destinations this month', country: '' };

export function labelFor(a) {
  return a.code === 'ANY' ? 'Anywhere' : `${a.city} (${a.code})`;
}

export function setAirport(input, a) {
  if (!a) {
    input.value = '';
    input.dataset.code = '';
    return;
  }
  input.value = labelFor(a);
  input.dataset.code = a.code;
}

/** Best-effort code from whatever the user typed. */
export function resolveCode(input) {
  if (input.dataset.code) return input.dataset.code;
  const v = input.value.trim();
  if (!v) return '';
  if (/^anywhere$/i.test(v)) return 'ANY';
  const paren = /\(([A-Za-z]{3})\)\s*$/.exec(v);
  if (paren) return paren[1].toUpperCase();
  if (/^[A-Za-z]{3}$/.test(v)) return v.toUpperCase();
  return '';
}

export function attachAutocomplete(input, list, { allowAnywhere = false, onSelect } = {}) {
  let items = [];
  let active = -1;
  let timer;
  let seq = 0;

  const open = () => {
    list.hidden = items.length === 0 || document.activeElement !== input;
    input.setAttribute('aria-expanded', String(!list.hidden));
  };
  const close = () => {
    seq++; // drop any lookup still in flight
    clearTimeout(timer);
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };

  function render() {
    list.innerHTML = items
      .map(
        (a, i) => `<li role="option" id="${list.id}-${i}" data-i="${i}" aria-selected="${i === active}" class="${i === active ? 'active' : ''}">
          <span class="ac-code">${a.code === 'ANY' ? '✦' : esc(a.code)}</span>
          <span class="ac-text"><strong>${esc(a.city)}</strong><small>${esc(a.name)}${a.country ? ` · ${esc(a.country)}` : ''}</small></span>
        </li>`
      )
      .join('');
    if (active >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${active}`);
    open();
  }

  async function load() {
    // When a value was already picked, search by its code so the dropdown shows it again.
    const picked = input.dataset.code;
    const q = picked === 'ANY' ? '' : picked || input.value.trim();
    const mine = ++seq;
    let found = [];
    if (q) {
      try {
        found = (await api('airports', { q })).airports || [];
      } catch {
        found = [];
      }
    }
    if (mine !== seq) return;
    const wantsAny = allowAnywhere && (!q || 'anywhere'.startsWith(q.toLowerCase()) || q.toLowerCase() === 'anywhere');
    items = wantsAny ? [ANYWHERE, ...found] : found;
    active = items.length ? 0 : -1;
    render();
  }

  function choose(i) {
    const a = items[i];
    if (!a) return;
    setAirport(input, a);
    close();
    onSelect?.(a);
  }

  input.addEventListener('input', () => {
    input.dataset.code = '';
    clearTimeout(timer);
    timer = setTimeout(load, 120);
  });
  input.addEventListener('focus', () => {
    input.select();
    load();
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', (e) => {
    if (list.hidden && e.key === 'ArrowDown') return load();
    if (list.hidden) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % items.length;
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + items.length) % items.length;
      render();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (active >= 0) {
        if (e.key === 'Enter') e.preventDefault();
        choose(active);
      }
    } else if (e.key === 'Escape') {
      close();
    }
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) {
      e.preventDefault();
      choose(Number(li.dataset.i));
    }
  });
}
