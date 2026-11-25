import { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink, Loader2, Luggage, Plane, RefreshCw, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { AirlineLogo } from './airline-logo';
import { Itinerary, stopsText } from './flight-card';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { clock, dateOf, duration, money, prettyDate, timeAgo } from '@/lib/format';
import type { BookingResult, Flight, Query, SellerOption } from '@/lib/types';
import { useApp } from '@/state/app';

function googleFlightsUrl(q: Query) {
  const text = `Flights to ${q.to} from ${q.from} on ${q.depart}${q.return ? ` through ${q.return}` : ' one way'}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(text)}&curr=${q.currency}`;
}

function SellerRow({ o, shown, best, currency, showEst, demo }: { o: SellerOption; shown: number | null; best: boolean; currency: string; showEst: boolean; demo: boolean }) {
  const e = o.estimate;
  const feeText = !e ? '' : e.applied
    ? (showEst ? `fare ${money(o.price, currency)} + fee ${money(e.fee, currency)}` : `≈ ${money(e.total, currency)} with fees`)
    : showEst && e.status === 'not-configured' ? 'fee not set' : '';
  const meta = [o.title, ...o.extensions].filter(Boolean).join(', ');
  return (
    <li className={cn('relative grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 px-4 py-3', best && 'bg-success-soft/50')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{o.seller}</span>
          {o.isAirline && <Badge variant="secondary" className="rounded-[4px]">Airline</Badge>}
          {best && <Badge className="bg-success-soft text-success">Cheapest</Badge>}
          {o.separateTickets && <Badge className="bg-warning-soft text-warning-foreground">Separate tickets</Badge>}
        </div>
        {meta && <div className="truncate text-xs text-muted-foreground">{meta}</div>}
      </div>
      <div className="text-right">
        <div className="font-data text-[15px] font-bold">{shown == null ? 'See site' : money(shown, currency)}</div>
        {feeText && <div className={cn('text-xs', e?.applied ? 'text-foreground' : 'text-muted-foreground')}>{feeText}</div>}
      </div>
      <div className="flex flex-col gap-1">
        {o.requests.length ? o.requests.map((r, k) => (
          <form key={k} method="post" action={r.url} target="_blank" rel="noopener noreferrer">
            {[...new URLSearchParams(r.postData)].map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            <Button type="submit" size="sm" variant={best ? 'default' : 'outline'}
              aria-label={`Book with ${o.seller}${o.requests.length > 1 ? (k ? ', return ticket' : ', outbound ticket') : ''}`}>
              {o.requests.length > 1 ? (k ? 'Return' : 'Outbound') : 'Book'}<ExternalLink className="size-3" />
            </Button>
          </form>
        )) : <span className="text-xs text-muted-foreground">{demo ? 'Demo' : 'No link'}</span>}
      </div>
    </li>
  );
}

function Sellers({ flight, query, live }: { flight: Flight; query: Query; live: boolean }) {
  const { showEst, refreshStatus } = useApp();
  const [res, setRes] = useState<BookingResult | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [err, setErr] = useState('');

  const load = async () => {
    setState('loading');
    try {
      const r = await api<BookingResult>('booking', { ...query, token: flight.bookingToken });
      setRes(r);
      setState('idle');
      refreshStatus();
    } catch (e) {
      setErr((e as Error).message);
      setState('error');
    }
  };
  // Demo data costs nothing, so load straight away; live lookups wait for a click.
  useEffect(() => {
    setRes(null);
    setState('idle');
    if (!live) load();
  }, [flight.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = (o: SellerOption) => (showEst && o.estimate?.applied ? o.estimate.total : o.price);
  const priced = res?.options.filter((o) => o.price != null) ?? [];
  const best = priced.length ? Math.min(...priced.map((o) => shown(o)!)) : null;
  const airline = res?.options.find((o) => o.isAirline);
  const sorted = res ? [...res.options].sort((a, b) => (shown(a) ?? Infinity) - (shown(b) ?? Infinity)) : [];
  const diff = airline?.price != null && best != null ? shown(airline)! - best : 0;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-start gap-3 border-b px-4 py-3.5">
        <span className="grid size-9 place-items-center rounded-md bg-muted"><Store className="size-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Compare sellers</h3>
          <p className="text-xs text-muted-foreground">
            {res ? <>{res.options.length} seller{res.options.length === 1 ? '' : 's'}, cheapest <strong className="font-data text-foreground">{best == null ? '—' : money(best, query.currency)}</strong>.
              {airline ? (diff > 0 ? ` That’s ${money(diff, query.currency)} less than ${airline.seller}’s own site.` : ` ${airline.seller}’s own site is the cheapest.`) : ''}</>
              : 'The airline and travel sites selling this exact trip'}
          </p>
        </div>
      </div>
      {!res && state === 'idle' && live && (
        <div className="space-y-2 p-4">
          <Button variant="outline" className="w-full" onClick={load}><Store />Show prices from travel sites</Button>
          <p className="text-center text-xs text-muted-foreground">Uses 1 SerpApi search, then it's cached for a few hours.</p>
        </div>
      )}
      {state === 'loading' && (
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
          <p className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Asking Google Flights who sells this trip…</p>
        </div>
      )}
      {state === 'error' && (
        <div className="space-y-2 p-4 text-sm">
          <p className="text-destructive">Couldn't load sellers: {err}</p>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw />Try again</Button>
        </div>
      )}
      {res && (
        res.options.length ? (
          <>
            <ul className="divide-y">{sorted.map((o, i) => <SellerRow key={`${o.seller}-${i}`} o={o} shown={shown(o)} best={shown(o) != null && shown(o) === best} currency={query.currency} showEst={showEst} demo={res.source === 'demo'} />)}</ul>
            <div className="space-y-1.5 border-t bg-muted/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              {res.baggage.length > 0 && <p className="flex items-center gap-1.5"><Luggage className="size-3.5" />{res.baggage.join(', ')}</p>}
              <p>
                {res.source === 'demo' && <strong className="text-warning-foreground">These sellers and prices are made up. </strong>}
                Only sellers that partner with Google Flights appear, so some (e.g. MakeMyTrip, HappyFares) may be missing. Prices are totals for all travellers including taxes; a site's own fee is added only where set in <code>data/fees.json</code>. Checked {timeAgo(res.fetchedAt)}.
              </p>
            </div>
          </>
        ) : <p className="p-4 text-sm text-muted-foreground">Google Flights lists no sellers for this trip right now. Try the links below.</p>
      )}
    </section>
  );
}

function LegSummary({ flight, label }: { flight: Flight; label: string }) {
  return (
    <Collapsible className="rounded-xl border bg-card">
      <div className="p-4">
        <div className="mb-2.5 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{label}</span>, {prettyDate(dateOf(flight.leg.departTime))}</div>
        <div className="flex items-center gap-3">
          <AirlineLogo flight={flight} size={38} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-data font-bold">
              {clock(flight.leg.departTime)} {flight.leg.segments[0].from.code}
              <ArrowRight className="size-3.5 text-muted-foreground" />
              {clock(flight.leg.arriveTime)} {flight.leg.segments[flight.leg.segments.length - 1].to.code}
            </div>
            <div className="truncate text-xs text-muted-foreground">{flight.airlines.join(' + ')}, {duration(flight.leg.durationMin)}, {stopsText(flight).toLowerCase()}</div>
          </div>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="link" size="sm" className="mt-1 h-6 px-0 text-xs">Itinerary</Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent><div className="border-t p-4"><Itinerary flight={flight} /></div></CollapsibleContent>
    </Collapsible>
  );
}

export function TripSheet() {
  const { trip, setTrip, query, list, status } = useApp();
  const open = !!trip && !!query;
  const priced = trip?.priced;
  const e = priced?.estimate;
  const cur = query?.currency ?? 'INR';
  const res = list?.res;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && setTrip(null)}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-lg"><Plane className="size-5 rotate-45 text-primary" />Your trip</SheetTitle>
          <SheetDescription>{query ? `${query.from} to ${query.to}, ${query.return ? 'return' : 'one way'}` : ''}</SheetDescription>
        </SheetHeader>
        {trip && query && priced && e && (
          <>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-5">
                {trip.legs.map((f, i) => <LegSummary key={f.id + i} flight={f} label={trip.legs.length > 1 ? (i ? 'Return' : 'Outbound') : 'Flight'} />)}
                <div className="space-y-2 rounded-xl bg-muted/60 p-4 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Fare incl. taxes (all travellers)</span><strong className="font-data">{money(e.fare, cur)}</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Convenience fee (est.)</span><strong className="font-data">{e.applied ? money(e.fee, cur) : '—'}</strong></div>
                  <div className="flex items-baseline justify-between border-t pt-2 text-base"><span className="font-semibold">Estimated total</span><strong className="font-data text-[21px]">{money(e.total, cur)}</strong></div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {e.note}{e.applied && e.status === 'unverified' ? ' — not yet verified in fees.json' : ''}{e.note ? '. ' : ''}
                    Bags, seats and meals are extra. Prices checked {res ? timeAgo(res.fetchedAt) : 'recently'}{res?.source === 'demo' ? ' (demo data — not a real fare)' : ''}.
                  </p>
                </div>
                {priced.bookingToken && <Sellers flight={priced} query={query} live={status?.liveProvider === 'serpapi'} />}
              </div>
            </ScrollArea>
            <div className="space-y-2 border-t bg-card p-4">
              <div className={cn('grid gap-2', priced.bookUrl && 'grid-cols-2')}>
                <Button asChild><a href={res?.googleFlightsUrl || googleFlightsUrl(query)} target="_blank" rel="noopener">Google Flights<ExternalLink className="size-3.5" /></a></Button>
                {priced.bookUrl && <Button asChild variant="outline"><a href={priced.bookUrl} target="_blank" rel="noopener">Airline website<ExternalLink className="size-3.5" /></a></Button>}
              </div>
              <p className="text-center text-[11px] text-muted-foreground">The airline's payment page shows the exact final amount.</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
