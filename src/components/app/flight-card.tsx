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
  return `${f.leg.stops} stop${f.leg.stops > 1 ? 's' : ''} in ${f.leg.layovers.map((l) => l.code).join(', ')}`;
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
                  <div className="font-data text-sm font-bold">{clock(s.from.time)}</div>
                  <div className="text-[11px] text-muted-foreground">{prettyDate(dateOf(s.from.time), { day: 'numeric', month: 'short' })}</div>
                </div>
                <div className="relative border-l-2 border-dashed border-border pb-4 pl-4">
                  <span className="absolute -left-[7px] top-1 size-3 rounded-full border-2 border-foreground bg-card" />
                  <div className="text-sm"><strong>{s.from.code}</strong> <span className="text-muted-foreground">{s.from.name}</span></div>
                  <div className="my-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                    <Plane className="size-3.5 rotate-45" />
                    <span className="font-medium text-foreground">{s.airline} <span className="font-data">{s.flightNumber}</span></span>
                    <span>{s.aircraft || 'Aircraft n/a'}</span>
                    <span>{duration(s.durationMin)}</span>
                    {s.cabin && <span>{s.cabin}</span>}
                    {s.legroom && <span>Legroom {s.legroom}</span>}
                    {s.oftenDelayed && <span className="font-medium text-warning-foreground">Often delayed 30+ min</span>}
                  </div>
                  {s.extensions.length > 0 && <div className="mb-2 text-xs text-muted-foreground">{s.extensions.join(', ')}</div>}
                  <div className="text-sm"><strong>{s.to.code}</strong> <span className="text-muted-foreground">{s.to.name}, arrives {clock(s.to.time)}{s.overnight ? ' (next day)' : ''}</span></div>
                  <span className="absolute -left-[7px] bottom-3 size-3 rounded-full bg-foreground" />
                </div>
              </div>
              {l && (
                <div className="my-2 ml-[76px] inline-flex items-center gap-1.5 rounded-[4px] bg-warning-soft px-3 py-1 text-xs font-medium text-warning-foreground">
                  <Clock className="size-3.5" />{duration(l.durationMin)} layover in {l.name || l.code}{l.overnight ? ', overnight' : ''}
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

export function FlightCard({ flight: f, query, showEst, cheapest, fastest, actionLabel, onSelect }: {
  flight: Flight; query: Query; showEst: boolean; cheapest: number; fastest: number; actionLabel: string;
  onSelect: () => void; index?: number;
}) {
  const [open, setOpen] = useState(false);
  const leg = f.leg;
  const plus = dayDiff(leg.departTime, leg.arriveTime);
  const price = priceOf(f, showEst);
  const isCheapest = price === cheapest;
  const isFastest = leg.durationMin === fastest;
  const e = f.estimate;
  const pax = query.adults + query.children + query.infantsSeat + query.infantsLap;
  const scope = `${pax > 1 ? `total for ${pax}` : 'per traveller'}${query.return ? ', return' : ''}`;
  const flightNos = [...new Set(leg.segments.map((s) => s.flightNumber))].join(', ');
  const tags: React.ReactNode[] = [];
  if (f.isBest) tags.push(<Badge key="best" className="gap-1 rounded-[4px] bg-signal-soft text-foreground"><Trophy />Top pick</Badge>);
  if (isCheapest) tags.push(<Badge key="cheap" className="gap-1 rounded-[4px] bg-success-soft text-success"><Sparkles />Cheapest</Badge>);
  if (isFastest) tags.push(<Badge key="fast" variant="secondary" className="gap-1 rounded-[4px]"><Zap />Fastest</Badge>);
  if (f.separateTickets) tags.push(<Badge key="sep" className="gap-1 rounded-[4px] bg-warning-soft text-warning-foreground"><Ticket />Separate tickets</Badge>);
  if (leg.layovers.some((l) => l.overnight)) tags.push(<Badge key="night" className="gap-1 rounded-[4px] bg-warning-soft text-warning-foreground"><Moon />Overnight layover</Badge>);
  if (leg.segments.some((s) => s.oftenDelayed)) tags.push(<Badge key="late" className="gap-1 rounded-[4px] bg-warning-soft text-warning-foreground"><AlertTriangle />Often delayed</Badge>);
  if (f.carbon?.diffPercent != null && f.carbon.diffPercent <= -10) tags.push(<Badge key="eco" className="gap-1 rounded-[4px] bg-success-soft text-success"><Leaf />{f.carbon.diffPercent}% CO₂</Badge>);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <article className="relative transition-colors hover:bg-muted/35">
        {f.isBest && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-signal" />}
        <div className="grid items-center gap-x-6 gap-y-2.5 px-4 py-4 [grid-template-areas:'t_p''a_a''d_x'] grid-cols-[minmax(0,1fr)_auto] sm:px-5 md:grid-cols-[10.5rem_minmax(0,1fr)_7.5rem_minmax(11rem,auto)] md:[grid-template-areas:'t_a_d_p''t_a_d_x']">
          <div className="[grid-area:t]">
            <div className="whitespace-nowrap font-data text-lg font-bold leading-tight sm:text-[21px]">
              {clock(leg.departTime)}<span className="px-1 font-normal text-muted-foreground sm:px-1.5">–</span>{clock(leg.arriveTime)}
              {plus > 0 && <sup className="ml-0.5 text-xs font-bold text-destructive" title={`Arrives ${plus} day${plus > 1 ? 's' : ''} later`}>+{plus}</sup>}
            </div>
            <div className="text-sm text-muted-foreground">{leg.segments[0].from.code} to {leg.segments[leg.segments.length - 1].to.code}</div>
          </div>
          <div className="flex min-w-0 items-center gap-3 [grid-area:a]">
            <AirlineLogo flight={f} size={30} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{f.airlines.join(' + ')}</div>
              <div className="truncate font-data text-sm text-muted-foreground">{flightNos}</div>
            </div>
          </div>
          <div className="[grid-area:d]">
            <div className="font-data">{duration(leg.durationMin)}</div>
            <div className={cn('text-sm font-semibold', leg.stops ? 'text-warning-foreground dark:text-warning' : 'text-success')}>{stopsText(f)}</div>
          </div>
          <div className="text-right [grid-area:p]">
            <div className="whitespace-nowrap font-data text-lg font-bold leading-tight sm:text-[21px]">{money(price, query.currency)}</div>
            <div className="text-sm text-muted-foreground">{showEst ? `estimated, ${scope}` : scope}</div>
            {showEst ? (
              <div className={cn('text-sm', e.applied ? 'text-foreground' : 'text-muted-foreground')}>
                {e.applied ? `${money(e.fare, query.currency)} fare + ${money(e.fee, query.currency)} fee` : e.status === 'currency-mismatch' ? 'Fees are set in INR' : 'No fee set for this airline'}
              </div>
            ) : e.applied ? (
              <div className="text-sm">{money(e.total, query.currency)} with fees</div>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-1 [grid-area:x]">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 text-sm text-muted-foreground" aria-label={open ? 'Hide flight details' : 'Show flight details'}>
                Details<ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <Button onClick={onSelect} className="h-9 px-4 text-sm" variant={f.isBest || isCheapest ? 'default' : 'outline'}>{actionLabel}</Button>
          </div>
        </div>
        {tags.length > 0 && <div className="-mt-1 flex flex-wrap gap-1.5 px-4 pb-3.5 sm:px-5">{tags}</div>}
        <CollapsibleContent>
          <div className="border-t bg-muted/30 px-4 py-4 sm:px-5"><Itinerary flight={f} /></div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}
