import { useState } from 'react';
import { AlertTriangle, ChevronDown, Clock, Leaf, Moon, Plane, Sparkles, Ticket, Trophy, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AirlineLogo } from './airline-logo';
import { cn } from '@/lib/utils';
import { clock, dateOf, dayDiff, duration, money, prettyDate } from '@/lib/format';
import { priceOf } from '@/lib/filters';
import type { Flight, Query } from '@/lib/types';

export function stopsText(f: Flight) {
  if (!f.leg.stops) return 'Direct';
  return `${f.leg.stops} stop${f.leg.stops > 1 ? 's' : ''} · ${f.leg.layovers.map((l) => l.code).join(', ')}`;
}

export function Itinerary({ flight }: { flight: Flight }) {
  const c = flight.carbon;
  return (
    <div className="space-y-3">
      <ol className="relative space-y-0">
        {flight.leg.segments.map((s, i) => {
          const l = flight.leg.layovers[i];
          return (
            <li key={i}>
              <div className="grid grid-cols-[64px_1fr] gap-3">
                <div className="pt-0.5 text-right">
                  <div className="num text-sm font-semibold">{clock(s.from.time)}</div>
                  <div className="text-[11px] text-muted-foreground">{prettyDate(dateOf(s.from.time), { day: 'numeric', month: 'short' })}</div>
                </div>
                <div className="relative border-l-2 border-dashed border-primary/30 pb-4 pl-4">
                  <span className="absolute -left-[7px] top-1 size-3 rounded-full border-2 border-primary bg-card" />
                  <div className="text-sm"><strong>{s.from.code}</strong> <span className="text-muted-foreground">{s.from.name}</span></div>
                  <div className="my-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                    <Plane className="size-3.5 rotate-45 text-primary" />
                    <span className="font-medium text-foreground">{s.airline} · {s.flightNumber}</span>
                    <span>{s.aircraft || 'Aircraft n/a'}</span>
                    <span>{duration(s.durationMin)}</span>
                    {s.cabin && <span>{s.cabin}</span>}
                    {s.legroom && <span>Legroom {s.legroom}</span>}
                    {s.oftenDelayed && <span className="font-medium text-warning-foreground">Often delayed 30+ min</span>}
                  </div>
                  {s.extensions.length > 0 && <div className="mb-2 text-xs text-muted-foreground">{s.extensions.join(' · ')}</div>}
                  <div className="text-sm"><strong>{s.to.code}</strong> <span className="text-muted-foreground">{s.to.name} · arrives {clock(s.to.time)}{s.overnight ? ' (overnight)' : ''}</span></div>
                  <span className="absolute -left-[7px] bottom-3 size-3 rounded-full bg-primary" />
                </div>
              </div>
              {l && (
                <div className="my-2 ml-[76px] inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-medium text-warning-foreground">
                  <Clock className="size-3.5" />{duration(l.durationMin)} layover · {l.name || l.code}{l.overnight ? ' · overnight' : ''}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {c?.grams ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Leaf className="size-3.5 text-success" />
          About {Math.round(c.grams / 1000)} kg CO₂e{c.diffPercent != null ? ` (${c.diffPercent > 0 ? '+' : ''}${c.diffPercent}% vs typical for this route)` : ''}
        </p>
      ) : null}
      {flight.estimate.note && <p className="text-xs text-muted-foreground">Fee estimate: {flight.estimate.note}</p>}
    </div>
  );
}

export function FlightCard({ flight: f, query, showEst, cheapest, fastest, actionLabel, onSelect, index }: {
  flight: Flight; query: Query; showEst: boolean; cheapest: number; fastest: number; actionLabel: string;
  onSelect: () => void; index: number;
}) {
  const [open, setOpen] = useState(false);
  const leg = f.leg;
  const plus = dayDiff(leg.departTime, leg.arriveTime);
  const price = priceOf(f, showEst);
  const isCheapest = price === cheapest;
  const isFastest = leg.durationMin === fastest;
  const e = f.estimate;
  const pax = query.adults + query.children + query.infantsSeat + query.infantsLap;
  const who = pax > 1 ? `total · ${pax} travellers` : '1 traveller';
  const tags: React.ReactNode[] = [];
  if (f.isBest) tags.push(<Badge key="best" className="gap-1 bg-primary/12 text-primary"><Trophy />Top pick</Badge>);
  if (isCheapest) tags.push(<Badge key="cheap" className="gap-1 bg-success-soft text-success"><Sparkles />Cheapest</Badge>);
  if (isFastest) tags.push(<Badge key="fast" variant="secondary" className="gap-1"><Zap />Fastest</Badge>);
  if (f.separateTickets) tags.push(<Badge key="sep" className="gap-1 bg-warning-soft text-warning-foreground"><Ticket />Separate tickets</Badge>);
  if (leg.layovers.some((l) => l.overnight)) tags.push(<Badge key="night" className="gap-1 bg-warning-soft text-warning-foreground"><Moon />Overnight layover</Badge>);
  if (leg.segments.some((s) => s.oftenDelayed)) tags.push(<Badge key="late" className="gap-1 bg-warning-soft text-warning-foreground"><AlertTriangle />Often delayed</Badge>);
  if (f.carbon?.diffPercent != null && f.carbon.diffPercent <= -10) tags.push(<Badge key="eco" className="gap-1 bg-success-soft text-success"><Leaf />{f.carbon.diffPercent}% CO₂</Badge>);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <article
        className={cn('group/card overflow-hidden rounded-2xl border bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
          f.isBest && 'border-primary/25', 'animate-in fade-in slide-in-from-bottom-2 fill-mode-both')}
        style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}>
        <div className="grid sm:grid-cols-[1fr_auto]">
          <div className="min-w-0 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <AirlineLogo flight={f} size={30} />
              <span className="truncate text-sm font-medium text-muted-foreground">{f.airlines.join(' + ')}</span>
            </div>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-5">
              <div className="text-center">
                <div className="num text-2xl font-semibold tracking-tight">{clock(leg.departTime)}</div>
                <div className="text-xs font-semibold text-muted-foreground">{leg.segments[0].from.code}</div>
              </div>
              <div className="flex min-w-0 flex-col items-center gap-1">
                <span className="num text-xs text-muted-foreground">{duration(leg.durationMin)}</span>
                <div className="relative flex h-3 w-full items-center">
                  <div className="h-px w-full bg-gradient-to-r from-border via-primary/40 to-border" />
                  <div className="absolute inset-x-0 flex justify-evenly">
                    {leg.layovers.map((l, i) => <span key={i} title={l.code} className="size-2.5 rounded-full border-2 border-warning bg-card" />)}
                  </div>
                  <Plane className="absolute -right-1 size-3.5 rotate-45 fill-primary text-primary" />
                </div>
                <span className={cn('max-w-full truncate text-xs font-medium', leg.stops ? 'text-warning-foreground dark:text-warning' : 'text-success')}>{stopsText(f)}</span>
              </div>
              <div className="text-center">
                <div className="num text-2xl font-semibold tracking-tight">
                  {clock(leg.arriveTime)}
                  {plus > 0 && <sup className="ml-0.5 text-[11px] font-semibold text-destructive" title={`Arrives ${plus} day(s) later`}>+{plus}</sup>}
                </div>
                <div className="text-xs font-semibold text-muted-foreground">{leg.segments[leg.segments.length - 1].to.code}</div>
              </div>
            </div>
            {tags.length > 0 && <div className="mt-3.5 flex flex-wrap gap-1.5">{tags}</div>}
          </div>
          <div className="flex items-center justify-between gap-3 border-t bg-muted/30 p-4 sm:w-52 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:p-5 sm:text-right">
            <div>
              <div className="num text-2xl font-bold tracking-tight">{money(price, query.currency)}</div>
              <div className="text-xs text-muted-foreground">{showEst ? 'est. ' : ''}{who}{query.return ? ' · return' : ''}</div>
              {showEst ? (
                <div className={cn('text-xs', e.applied ? 'font-medium text-primary' : 'text-muted-foreground')}>
                  {e.applied ? `fare ${money(e.fare, query.currency)} + fee ${money(e.fee, query.currency)}` : e.status === 'currency-mismatch' ? 'fees only in INR' : 'fee not configured'}
                </div>
              ) : e.applied ? (
                <div className="text-xs font-medium text-primary">≈ {money(e.total, query.currency)} with fees</div>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1 sm:w-full">
              <Button onClick={onSelect} className="sm:w-full" variant={f.isBest || isCheapest ? 'default' : 'outline'}>{actionLabel}</Button>
              <CollapsibleTrigger asChild>
                <Button variant="link" size="sm" className="h-6 px-0 text-xs">
                  {open ? 'Hide details' : 'Flight details'}
                  <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </div>
        <CollapsibleContent className="data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out">
          <div className="border-t bg-muted/20 p-4 sm:p-5"><Itinerary flight={f} /></div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}
