import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { addDays } from '@/lib/format';
import { emptyFilters } from '@/lib/filters';
import { store } from '@/lib/store';
import type {
  Airport, Cabin, CalendarResult, ExploreDest, ExploreResult, Filters, Flight, HistoryPoint, Pax, Query,
  SearchResult, SortKey, Status,
} from '@/lib/types';

export const PAGE = 20;
export const ANYWHERE: Airport = { code: 'ANY', city: 'Anywhere', name: 'Cheapest destinations this month', country: '' };
export const today = () => new Date().toISOString().slice(0, 10);

export type Trip = 'return' | 'oneway';
export interface FormState {
  trip: Trip;
  from: Airport | null;
  to: Airport | null;
  depart: string;
  ret: string;
  pax: Pax;
  cabin: Cabin;
  currency: string;
}
export interface ListState { res: SearchResult; filters: Filters; sort: SortKey; shown: number }
interface Loadable<T> { month: string; res: T | null; loading: boolean; error: string | null }
export interface TripSelection { legs: Flight[]; priced: Flight }

function initialForm(): FormState {
  const d = addDays(today(), 14);
  return {
    trip: 'return', from: null, to: null, depart: d, ret: addDays(d, 7),
    pax: { adults: 1, children: 0, infantsSeat: 0, infantsLap: 0 }, cabin: 'economy',
    currency: store.get('currency', 'INR'),
  };
}

export function validateForm(f: FormState): string {
  if (!f.from) return 'Choose where you are flying from.';
  if (!f.to) return 'Choose a destination, or pick Anywhere.';
  if (f.from.code === f.to.code) return 'Origin and destination are the same.';
  if (!f.depart) return 'Pick a departure date.';
  if (f.depart < today()) return 'That departure date has passed.';
  if (f.to.code !== 'ANY' && f.trip === 'return' && !f.ret) return 'Pick a return date, or switch to one way.';
  if (f.trip === 'return' && f.ret && f.ret < f.depart) return 'Return date is before departure.';
  return '';
}

const toQuery = (f: FormState): Query => ({
  from: f.from!.code, to: f.to!.code, depart: f.depart,
  return: f.trip === 'return' && f.to!.code !== 'ANY' ? f.ret || null : null,
  ...f.pax, cabin: f.cabin, currency: f.currency,
});

function queryString(q: Query) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === '' || v == null || (typeof v === 'number' && v === 0 && k !== 'adults')) continue;
    p.set(k, String(v));
  }
  return `?${p}`;
}

async function lookupAirport(code: string): Promise<Airport> {
  if (code === 'ANY') return ANYWHERE;
  try {
    const r = await api<{ airports: Airport[] }>('airports', { q: code });
    return r.airports.find((a) => a.code === code) || { code, city: code, name: code, country: '' };
  } catch {
    return { code, city: code, name: code, country: '' };
  }
}

async function formFromUrl(base: FormState): Promise<FormState | null> {
  const p = new URLSearchParams(location.search);
  const from = p.get('from')?.toUpperCase();
  if (!from) return null;
  const to = p.get('to')?.toUpperCase();
  const [a, b] = await Promise.all([lookupAirport(from), to ? lookupAirport(to) : Promise.resolve(null)]);
  const num = (k: string, min: number) => Math.max(min, Number(p.get(k)) || 0);
  const ret = p.get('return') || '';
  return {
    ...base,
    from: a,
    to: b,
    depart: p.get('depart') || base.depart,
    ret: ret || (to === 'ANY' ? base.ret : ''),
    trip: ret || to === 'ANY' ? base.trip : 'oneway',
    pax: { adults: num('adults', 1), children: num('children', 0), infantsSeat: num('infantsSeat', 0), infantsLap: num('infantsLap', 0) },
    cabin: (p.get('cabin') as Cabin) || 'economy',
    currency: p.get('currency') || base.currency,
  };
}

function rememberAirports(...list: (Airport | null)[]) {
  const recent = store.get<Airport[]>('recentAirports', []);
  for (const a of list) {
    if (!a || a.code === 'ANY') continue;
    const i = recent.findIndex((x) => x.code === a.code);
    if (i >= 0) recent.splice(i, 1);
    recent.unshift(a);
  }
  store.set('recentAirports', recent.slice(0, 6));
}

function useAppState() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [showEst, setShowEstState] = useState<boolean>(() => store.get('showEst', false));
  const [mode, setMode] = useState<'idle' | 'search' | 'explore'>('idle');
  const [query, setQuery] = useState<Query | null>(null);
  const [phase, setPhase] = useState<'outbound' | 'return'>('outbound');
  const [out, setOut] = useState<ListState | null>(null);
  const [ret, setRet] = useState<ListState | null>(null);
  const [selectedOut, setSelectedOut] = useState<Flight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<Loadable<CalendarResult> | null>(null);
  const [explore, setExplore] = useState<Loadable<ExploreResult> | null>(null);
  const [priceHistory, setPriceHistory] = useState<HistoryPoint[]>([]);
  const [trip, setTrip] = useState<TripSelection | null>(null);
  const seq = useRef(0);
  const formRef = useRef(form);
  formRef.current = form;

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await api<Status>('status'));
    } catch {
      /* status is decorative */
    }
  }, []);

  const loadCalendar = useCallback(async (q: Query, month: string) => {
    setCalendar({ month, res: null, loading: true, error: null });
    try {
      // Always one-way: cached round-trip fares have random trip lengths, so they mislead when choosing a day.
      const res = await api<CalendarResult>('calendar', { from: q.from, to: q.to, month, oneWay: 'true', currency: q.currency, cabin: q.cabin });
      setCalendar((c) => (c && c.month === month ? { month, res, loading: false, error: null } : c));
    } catch (e) {
      setCalendar((c) => (c && c.month === month ? { month, res: null, loading: false, error: (e as Error).message } : c));
    }
  }, []);

  const runSearch = useCallback(async (q: Query, { refresh = false } = {}) => {
    const id = ++seq.current;
    setMode('search');
    setQuery(q);
    setPhase('outbound');
    setSelectedOut(null);
    setRet(null);
    setOut(null);
    setTrip(null);
    setError(null);
    setPriceHistory([]);
    setLoading(true);
    loadCalendar(q, q.depart.slice(0, 7));
    try {
      const res = await api<SearchResult>('search', { ...q, refresh: refresh ? '1' : '' });
      if (id !== seq.current) return;
      setOut({ res, filters: emptyFilters(), sort: 'best', shown: PAGE });
      if (refresh) toast.success('Prices refreshed', { description: `${res.flights.length} flights, checked just now.` });
      api<{ points: HistoryPoint[] }>('history', q).then((h) => id === seq.current && setPriceHistory(h.points)).catch(() => {});
      refreshStatus();
    } catch (e) {
      if (id !== seq.current) return;
      setError((e as Error).message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [loadCalendar, refreshStatus]);

  const runExplore = useCallback(async (q: Query, month: string) => {
    const id = ++seq.current;
    setMode('explore');
    setQuery(q);
    setOut(null);
    setRet(null);
    setTrip(null);
    setExplore({ month, res: null, loading: true, error: null });
    try {
      const res = await api<ExploreResult>('explore', {
        from: q.from, month, oneWay: String(formRef.current.trip === 'oneway'), currency: q.currency, cabin: q.cabin,
      });
      if (id !== seq.current) return;
      setExplore({ month, res, loading: false, error: null });
    } catch (e) {
      if (id !== seq.current) return;
      setExplore({ month, res: null, loading: false, error: (e as Error).message });
    }
  }, []);

  const submitForm = useCallback((f: FormState, { push = true } = {}) => {
    setForm(f);
    const err = validateForm(f);
    setFormError(err);
    if (err) return false;
    const q = toQuery(f);
    rememberAirports(f.from, f.to);
    const qs = queryString(q);
    if (push && location.search !== qs) window.history.pushState(null, '', qs);
    if (q.to === 'ANY') runExplore(q, q.depart.slice(0, 7));
    else runSearch(q);
    return true;
  }, [runExplore, runSearch]);

  const submit = useCallback(() => submitForm(formRef.current), [submitForm]);

  const updateForm = useCallback((patch: Partial<FormState>) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (patch.currency) store.set('currency', patch.currency);
      return next;
    });
    setFormError('');
  }, []);

  const chooseFlight = useCallback(async (f: Flight) => {
    if (!query) return;
    if (query.return && phase === 'outbound' && f.departureToken) {
      const id = ++seq.current;
      setSelectedOut(f);
      setPhase('return');
      setRet(null);
      setError(null);
      setLoading(true);
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      try {
        const res = await api<SearchResult>('return', { ...query, token: f.departureToken });
        if (id !== seq.current) return;
        setRet({ res, filters: emptyFilters(), sort: 'best', shown: PAGE });
        refreshStatus();
      } catch (e) {
        if (id === seq.current) setError((e as Error).message);
      } finally {
        if (id === seq.current) setLoading(false);
      }
      return;
    }
    setTrip({ legs: phase === 'return' && selectedOut ? [selectedOut, f] : [f], priced: f });
  }, [query, phase, selectedOut, refreshStatus]);

  const backToOutbound = useCallback(() => {
    seq.current++;
    setPhase('outbound');
    setSelectedOut(null);
    setRet(null);
    setLoading(false);
    setError(null);
  }, []);

  const updateList = useCallback((fn: (l: ListState) => ListState) => {
    (phase === 'return' ? setRet : setOut)((l) => (l ? fn(l) : l));
  }, [phase]);

  const pickCalendarDay = useCallback((ds: string) => {
    const f = formRef.current;
    let r = f.ret;
    if (f.trip === 'return' && f.ret && f.depart) {
      const len = Math.round((Date.parse(f.ret) - Date.parse(f.depart)) / 86400e3);
      r = addDays(ds, len);
    }
    submitForm({ ...f, depart: ds, ret: r });
  }, [submitForm]);

  const pickDestination = useCallback((d: ExploreDest) => {
    const f = formRef.current;
    const dd = d.departAt?.slice(0, 10);
    const depart = dd && dd >= today() ? dd : f.depart;
    const rr = d.returnAt?.slice(0, 10);
    const r = f.trip === 'return' ? (rr && rr >= depart ? rr : addDays(depart, 5)) : f.ret;
    submitForm({ ...f, to: d.airport, depart, ret: r });
  }, [submitForm]);

  const setShowEst = useCallback((v: boolean) => {
    setShowEstState(v);
    store.set('showEst', v);
  }, []);

  const reset = useCallback(() => {
    seq.current++;
    setMode('idle');
    setQuery(null);
    setOut(null);
    setRet(null);
    setTrip(null);
    setError(null);
    setLoading(false);
    window.history.pushState(null, '', location.pathname);
  }, []);

  // Load status once, then run whatever search the URL describes; follow Back/Forward too.
  useEffect(() => {
    refreshStatus();
    const fromUrl = async () => {
      const f = await formFromUrl(formRef.current);
      if (f) submitForm(f, { push: false });
      else {
        seq.current++;
        setMode('idle');
        setQuery(null);
        setOut(null);
        setTrip(null);
      }
    };
    fromUrl();
    addEventListener('popstate', fromUrl);
    return () => removeEventListener('popstate', fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = phase === 'return' ? ret : out;
  return {
    form, updateForm, formError, submit, submitForm, status, showEst, setShowEst, mode, query, phase, list, out,
    selectedOut, loading, error, calendar, loadCalendar, explore, runExplore, priceHistory, trip, setTrip, chooseFlight,
    backToOutbound, updateList, pickCalendarDay, pickDestination, runSearch, reset, refreshStatus,
  };
}

export type AppState = ReturnType<typeof useAppState>;
const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={useAppState()}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
