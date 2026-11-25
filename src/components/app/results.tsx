import { useMemo, useRef, useEffect } from 'react';
import {
  CalendarRange, Check, ChevronLeft, ChevronRight, Clock, FlaskConical, History, LineChart, Pencil,
  RefreshCw, SearchX, SlidersHorizontal, TriangleAlert,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FiltersPanel } from './filters-panel';
import { FlightCard, stopsText } from './flight-card';
import { Plane } from 'lucide-react';
import { Sparkline } from './sparkline';
import { cn } from '@/lib/utils';
import { clock, duration, money, prettyDate, shortMoney, timeAgo } from '@/lib/format';
import { addMonths, daysInMonth } from '@/lib/dates';
import { SORTS, applyFilters, emptyFilters, isFiltered, priceOf, sortFlights, sortSummary } from '@/lib/filters';
import type { SortKey } from '@/lib/types';
import { PAGE, today, useApp } from '@/state/app';

function monthLabel(m: string) {
  return prettyDate(`${m}-01`, { month: 'long', year: 'numeric' });
}

function ResultsHeader() {
  const { query, list, status, runSearch, phase, loading, out } = useApp();
  if (!query) return null;
  const res = out?.res;
  const pax = query.adults + query.children + query.infantsSeat + query.infantsLap;
  const cabin = { economy: 'Economy', premium: 'Premium economy', business: 'Business', first: 'First' }[query.cabin];
  const live = status?.liveProvider === 'serpapi';
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-x-3 font-data text-[28px] font-bold leading-tight sm:text-[36px]">
          {query.from}<Plane className="size-6 text-muted-foreground" />{query.to}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {res ? `${res.airports.from.city} to ${res.airports.to.city}, ` : ''}{prettyDate(query.depart)}{query.return ? ` to ${prettyDate(query.return)}` : ', one way'}.{' '}
          {pax} traveller{pax > 1 ? 's' : ''}, {cabin.toLowerCase()}.
        </p>
      </div>
      {list && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-sm"><Clock className="size-4" />Prices checked {timeAgo(list.res.fetchedAt)}{list.res.cached ? ' (saved copy)' : ''}</span>
          {list.res.unpriced > 0 && <span className="text-sm">{list.res.unpriced} without a price hidden</span>}
          {phase === 'outbound' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" disabled={loading} onClick={() => runSearch(query, { refresh: true })}>
                  <RefreshCw className={cn(loading && 'animate-spin')} />Check again
                </Button>
              </TooltipTrigger>
              <TooltipContent>{live ? 'Get fresh prices. Uses 1 SerpApi search.' : 'Get fresh prices'}</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}

export function DemoNotice() {
  const { status } = useApp();
  if (!status || status.liveProvider !== 'demo') return null;
  return (
    <Alert className="border-warning/40 bg-warning-soft text-warning-foreground [&>svg]:text-warning-foreground">
      <FlaskConical />
      <AlertTitle>These are made-up prices</AlertTitle>
      <AlertDescription className="text-warning-foreground/90">
        {status.hosted
          ? 'This hosted copy runs on demo data. Run FareScope on your own computer with a SerpApi key to see live Google Flights prices.'
          : <>FareScope is running without a SerpApi key, so it shows demo data. Add <code>SERPAPI_KEY</code> to <code>.env</code> to see live Google Flights prices.</>}
      </AlertDescription>
    </Alert>
  );
}

function CalendarStrip() {
  const { calendar, query, loadCalendar, pickCalendarDay, status } = useApp();
  const scroller = useRef<HTMLDivElement>(null);
  // Centre the selected day by scrolling the strip only (scrollIntoView would also scroll the page).
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>('[data-selected=true]');
    if (box && el) box.scrollLeft = el.offsetLeft - (box.clientWidth - el.clientWidth) / 2;
  }, [calendar?.res, query?.depart]);
  if (!calendar || !query) return null;
  const { month, res } = calendar;
  const n = daysInMonth(month);
  const prices = res ? Object.values(res.days).map((d) => d.price).sort((a, b) => a - b) : [];
  const t1 = prices[Math.floor(prices.length / 3)] ?? Infinity;
  const t2 = prices[Math.floor((prices.length * 2) / 3)] ?? Infinity;
  const min = prices[0];
  const src = res?.source === 'demo' || (!res && status?.calendarProvider === 'demo') ? 'Made-up demo fares' : 'Fares other travellers found in the last few days (Travelpayouts)';
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><CalendarRange className="size-4" />Cheapest days in {monthLabel(month)}</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous month" disabled={month <= today().slice(0, 7)} onClick={() => loadCalendar(query, addMonths(month, -1))}><ChevronLeft /></Button>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => loadCalendar(query, addMonths(month, 1))}><ChevronRight /></Button>
        </div>
      </div>
      <div ref={scroller} className="scrollbar-none relative -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 py-1.5" role="list">
        {Array.from({ length: n }, (_, i) => {
          const ds = `${month}-${String(i + 1).padStart(2, '0')}`;
          const info = res?.days[ds];
          const past = ds < today();
          const lvl = !info ? '' : info.price <= t1 ? 'low' : info.price <= t2 ? 'mid' : 'high';
          const selected = ds === query.depart;
          if (calendar.loading) return <Skeleton key={ds} className="h-[74px] w-[62px] shrink-0 rounded-xl" />;
          return (
            <button key={ds} type="button" role="listitem" data-selected={selected} disabled={past}
              onClick={() => pickCalendarDay(ds)}
              aria-label={`${prettyDate(ds)}${info ? `, from ${money(info.price, query.currency)}, ${lvl === 'low' ? 'cheaper' : lvl === 'mid' ? 'average' : 'pricier'}` : ', no cached fare'}`}
              className={cn('flex w-[62px] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-center transition-all disabled:opacity-35',
                'enabled:hover:border-foreground/40',
                lvl === 'low' && 'border-transparent bg-success-soft', lvl === 'mid' && 'border-transparent bg-muted', lvl === 'high' && 'border-transparent bg-muted/40',
                selected && 'border-signal bg-signal text-signal-foreground')}>
              <span className={cn('text-xs', selected ? 'text-signal-foreground/75' : 'text-muted-foreground')}>{prettyDate(ds, { weekday: 'short' })}</span>
              <span className="font-data text-base font-bold leading-tight">{i + 1}</span>
              <span className={cn('font-data text-[11px]', selected ? 'text-signal-foreground' : lvl === 'low' ? 'font-bold text-success' : 'text-muted-foreground')}>
                {info ? `${info.price === min ? '★' : ''}${shortMoney(info.price, query.currency)}` : '·'}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-success-soft ring-1 ring-success/40" />Cheaper</span>
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-muted ring-1 ring-border" />Average</span>
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-muted/40 ring-1 ring-border" />Pricier</span>
        </span>
        <span>{calendar.error ? `The calendar didn’t load: ${calendar.error}` : `${src}. One-way, per adult${query.return ? ', for the outbound day' : ''}. Choose a day to search it.`}</span>
      </div>
    </section>
  );
}

function Insights() {
  const { out, priceHistory, query } = useApp();
  if (!query || !out) return null;
  const ins = out.res.insights;
  const pts = priceHistory;
  if (!ins && !pts.length) return null;
  const cur = query.currency;
  const level = ins?.level?.toLowerCase();
  const levelCls = level === 'low' ? 'bg-success-soft text-success' : level === 'high' ? 'bg-warning-soft text-warning-foreground' : 'bg-secondary text-secondary-foreground';
  const low = pts.length ? pts.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  const last = pts[pts.length - 1];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {ins && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold">
            <LineChart className="size-4" />
            {level ? <>Prices are <span className={cn('rounded-md px-1.5 py-0.5 capitalize', levelCls)}>{level}</span> for these dates</> : 'Price insight'}
          </h2>
          <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
            {ins.typicalRange && <p>Usually <span className="num font-medium text-foreground">{money(ins.typicalRange[0], cur)}–{money(ins.typicalRange[1], cur)}</span> for this trip.</p>}
            {ins.lowest != null && <p>Lowest right now: <span className="num font-semibold text-foreground">{money(ins.lowest, cur)}</span></p>}
          </div>
          {ins.history.length > 2 && <Sparkline points={ins.history} currency={cur} label="Price trend for these dates" />}
          <p className="mt-2 text-[11px] text-muted-foreground">{out.res.source === 'demo' ? 'Made-up demo data.' : 'From Google Flights, through SerpApi.'}</p>
        </section>
      )}
      {pts.length > 0 && low && last && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold"><History className="size-4" />Your checks</h2>
          <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
            <p>Searched {pts.length} time{pts.length > 1 ? 's' : ''}, latest <span className="num font-medium text-foreground">{money(last.price, cur)}</span> ({timeAgo(last.checkedAt)})</p>
            <p>Lowest you've seen: <span className="num font-semibold text-foreground">{money(low.price, cur)}</span>{low.airline ? ` on ${low.airline}` : ''}</p>
          </div>
          {pts.length > 2
            ? <Sparkline points={pts.map((p) => ({ ts: p.checkedAt, price: p.price }))} currency={cur} label="Your price checks" />
            : <p className="mt-3 text-xs text-muted-foreground">Search again later to build a price history for this trip.</p>}
        </section>
      )}
    </div>
  );
}

function TripSteps() {
  const { query, phase, selectedOut, backToOutbound } = useApp();
  if (!query?.return) return null;
  const step = (n: number, title: string, date: string, state: 'current' | 'done' | 'todo', extra?: React.ReactNode) => (
    <li className={cn('relative flex gap-3 overflow-hidden rounded-xl border bg-card p-3.5', state === 'current' && 'border-foreground/40')}>
      {state === 'current' && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-signal" />}
      <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
        state === 'todo' ? 'bg-muted text-muted-foreground' : state === 'current' ? 'bg-signal text-signal-foreground' : 'bg-primary text-primary-foreground')}>
        {state === 'done' ? <Check className="size-4" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{prettyDate(date)}</div>
        {extra}
      </div>
    </li>
  );
  return (
    <div className="space-y-2">
      <ol className="grid gap-2 sm:grid-cols-2">
        {step(1, `Outbound, ${query.from} to ${query.to}`, query.depart, phase === 'outbound' ? 'current' : 'done',
          selectedOut && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs">
              <span className="font-data font-bold">{clock(selectedOut.leg.departTime)}–{clock(selectedOut.leg.arriveTime)}</span>
              <span className="text-muted-foreground">{selectedOut.primaryAirline}, {stopsText(selectedOut).toLowerCase()}</span>
              <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={backToOutbound}><Pencil className="size-3" />Change</Button>
            </div>
          ))}
        {step(2, `Return, ${query.to} to ${query.from}`, query.return, phase === 'return' ? 'current' : 'todo')}
      </ol>
      <p className="px-1 text-xs text-muted-foreground">
        {phase === 'outbound' ? 'Prices are the total for the whole return trip, starting from the cheapest return flight.' : 'Prices are the round-trip total with this return flight.'}
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3"><Skeleton className="size-8 rounded-lg" /><Skeleton className="h-4 w-32" /></div>
          <div className="mt-4 flex items-center gap-4"><Skeleton className="h-8 w-16" /><Skeleton className="h-2 flex-1" /><Skeleton className="h-8 w-16" /><Skeleton className="ml-6 h-9 w-24" /></div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-6">{icon}</span>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function FlightList() {
  const { list, query, showEst, updateList, chooseFlight, phase, loading, error, runSearch } = useApp();
  const filtered = useMemo(() => (list ? applyFilters(list.res.flights, list.filters, showEst) : []), [list, showEst]);
  const sorted = useMemo(() => (list ? sortFlights(filtered, list.sort, showEst) : []), [filtered, list, showEst]);
  const summary = useMemo(() => sortSummary(filtered, showEst), [filtered, showEst]);

  if (error) {
    return (
      <EmptyState icon={<TriangleAlert />} title="Search didn't work">
        <p>{error}</p>
        {query && <Button variant="outline" size="sm" className="mt-3" onClick={() => runSearch(query)}><RefreshCw />Try again</Button>}
      </EmptyState>
    );
  }
  if (loading || !list || !query) return <ListSkeleton />;
  if (!list.res.flights.length) {
    return <EmptyState icon={<SearchX />} title="No flights found">Try nearby dates — the calendar above shows which days have fares.</EmptyState>;
  }
  const cheapest = filtered.length ? Math.min(...filtered.map((f) => priceOf(f, showEst))) : 0;
  const fastest = filtered.length ? Math.min(...filtered.map((f) => f.leg.durationMin)) : 0;
  const tabs = ['best', 'cheapest', 'fastest'] as const;
  const action = query.return && phase === 'outbound' ? 'Select outbound' : 'Select';

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div role="tablist" aria-label="Sort" className="grid flex-1 grid-cols-3 overflow-hidden rounded-xl border bg-card">
          {tabs.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={list.sort === k} onClick={() => updateList((l) => ({ ...l, sort: k }))}
              className={cn('relative flex flex-col items-start px-3 py-2.5 text-left transition-colors sm:px-4 [&+&]:border-l',
                list.sort === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/60')}>
              <span className={cn('text-sm', list.sort === k ? 'font-semibold' : 'text-muted-foreground')}>{SORTS[k]}</span>
              {summary ? (
                <>
                  <span className="font-data text-base font-bold sm:text-lg">{money(summary[k].price, query.currency)}</span>
                  <span className={cn('font-data text-xs', list.sort === k ? 'opacity-75' : 'text-muted-foreground')}>{duration(summary[k].durationMin)}</span>
                </>
              ) : <span className="text-sm text-muted-foreground">—</span>}
              {list.sort === k && <span className="absolute inset-x-0 bottom-0 h-1 bg-signal" />}
            </button>
          ))}
        </div>
        <Select value={list.sort} onValueChange={(v) => updateList((l) => ({ ...l, sort: v as SortKey }))}>
          <SelectTrigger className="h-auto min-h-11 rounded-xl bg-card sm:w-52" aria-label="Sort by"><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.entries(SORTS) as [SortKey, string][]).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
        {filtered.length} of {list.res.flights.length} flights{isFiltered(list.filters) ? ' match your filters' : ''}
      </p>
      {!sorted.length ? (
        <EmptyState icon={<SlidersHorizontal />} title="Nothing matches these filters">
          <Button variant="link" onClick={() => updateList((l) => ({ ...l, filters: emptyFilters() }))}>Clear all filters</Button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div aria-hidden className="hidden grid-cols-[10.5rem_minmax(0,1fr)_7.5rem_minmax(11rem,auto)] gap-x-6 border-b bg-muted/50 px-5 py-2 text-sm text-muted-foreground md:grid">
              <span>Departs – arrives</span><span>Airline</span><span>Duration</span><span className="text-right">{showEst ? 'Estimated total' : 'Price'}</span>
            </div>
            <div className="divide-y">
              {sorted.slice(0, list.shown).map((f, i) => (
                <FlightCard key={f.id} flight={f} query={query} showEst={showEst} cheapest={cheapest} fastest={fastest}
                  actionLabel={action} onSelect={() => chooseFlight(f)} index={i} />
              ))}
            </div>
          </div>
          {sorted.length > list.shown && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => updateList((l) => ({ ...l, shown: l.shown + PAGE }))}>
                Show {Math.min(PAGE, sorted.length - list.shown)} more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function activeFilterCount(f: NonNullable<ReturnType<typeof useApp>['list']>['filters']) {
  return [f.stops.size > 0, f.excludedAirlines.size > 0, f.departWindows.size > 0, f.arriveWindows.size > 0,
    f.maxPrice != null, f.maxDuration != null, f.maxLayover != null, f.noOvernightLayovers, f.noSeparateTickets].filter(Boolean).length;
}

export function Results() {
  const { list, showEst, updateList, query, loading } = useApp();
  const ready = !!(list && list.res.flights.length > 0 && query);
  const panel = (inSheet: boolean) => ready && (
    <FiltersPanel flights={list!.res.flights} filters={list!.filters} showEst={showEst} currency={query!.currency} inSheet={inSheet}
      onChange={(filters) => updateList((l) => ({ ...l, filters, shown: PAGE }))} />
  );
  const matching = list ? applyFilters(list.res.flights, list.filters, showEst).length : 0;
  const count = list ? activeFilterCount(list.filters) : 0;
  return (
    <div id="results" className="scroll-mt-20 space-y-5">
      <ResultsHeader />
      <DemoNotice />
      <CalendarStrip />
      <Insights />
      <TripSteps />
      <div className="grid items-start gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border bg-card p-4 lg:block" aria-label="Filters">
          {panel(false) || (loading ? <div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div> : null)}
        </aside>
        <div className="min-w-0 space-y-3">
          {ready && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden"><SlidersHorizontal />Filters{count > 0 && <Badge className="ml-1 h-5 min-w-5 px-1">{count}</Badge>}</Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[88vw] max-w-sm gap-0 p-0">
                <SheetHeader className="sr-only p-0"><SheetTitle>Filters</SheetTitle><SheetDescription>Narrow down the flight list</SheetDescription></SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">{panel(true)}</div>
                <div className="border-t p-4">
                  <SheetClose asChild><Button className="h-11 w-full">Show {matching} flight{matching === 1 ? '' : 's'}</Button></SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          )}
          <FlightList />
        </div>
      </div>
    </div>
  );
}
