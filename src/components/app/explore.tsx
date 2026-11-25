import { useState } from 'react';
import { ChevronLeft, ChevronRight, Compass, Globe2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DemoNotice } from './results';
import { money, prettyDate } from '@/lib/format';
import { addMonths } from '@/lib/dates';
import { today, useApp } from '@/state/app';

export function Explore() {
  const { explore, query, runExplore, pickDestination, form } = useApp();
  const [scope, setScope] = useState<'all' | 'home' | 'abroad'>('all');
  if (!explore || !query) return null;
  const { month, res, loading, error } = explore;
  const home = form.from?.country;
  const list = (res?.destinations ?? []).filter((d) =>
    scope === 'all' || !home || !d.airport.country ? true : scope === 'home' ? d.airport.country === home : d.airport.country !== home);
  const fromCity = form.from?.city ?? query.from;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-[28px] font-bold leading-tight sm:text-[36px]"><Compass className="size-7" />Anywhere from {fromCity}</h1>
          <p className="mt-1 max-w-[60ch] text-muted-foreground">
            The cheapest {form.trip === 'oneway' ? 'one-way' : 'return'} fares per adult in {prettyDate(`${month}-01`, { month: 'long', year: 'numeric' })}.
            {res?.source === 'demo' ? ' These are made-up demo fares.' : ' Other travellers found these in the last few days; choose one to check live prices.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {home && (
            <ToggleGroup type="single" value={scope} onValueChange={(v) => v && setScope(v as typeof scope)} variant="outline" spacing={0} size="sm">
              <ToggleGroupItem value="all">All</ToggleGroupItem>
              <ToggleGroupItem value="home">{home}</ToggleGroupItem>
              <ToggleGroupItem value="abroad">Abroad</ToggleGroupItem>
            </ToggleGroup>
          )}
          <Button variant="outline" size="icon" aria-label="Previous month" disabled={month <= today().slice(0, 7)} onClick={() => runExplore(query, addMonths(month, -1))}><ChevronLeft /></Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => runExplore(query, addMonths(month, 1))}><ChevronRight /></Button>
        </div>
      </div>
      <DemoNotice />
      {error ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <TriangleAlert className="mb-2 size-6 text-destructive" /><p className="font-semibold">Explore didn't work</p><p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : !list.length ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <Globe2 className="mb-2 size-6 text-muted-foreground" /><p className="font-semibold">No cached fares for this month</p><p className="text-sm text-muted-foreground">Try another month.</p>
        </div>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((d, i) => (
            <li key={d.destination}>
              <button type="button" onClick={() => pickDestination(d)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card text-left outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/50">
                {/* Only the cheapest destination gets the full sign; the rest stay quiet. */}
                <span className={i === 0 ? 'signboard flex items-center justify-between px-4 py-3' : 'flex items-center justify-between border-b bg-muted/60 px-4 py-3'}>
                  <span className={i === 0 ? 'font-data text-[28px] font-bold leading-none text-signal' : 'font-data text-[28px] font-bold leading-none'}>{d.destination}</span>
                  <span className={i === 0 ? 'text-sm font-semibold text-signal' : 'text-sm text-muted-foreground'}>{i === 0 ? 'Cheapest' : `No. ${i + 1}`}</span>
                </span>
                <span className="flex flex-1 flex-col gap-0.5 p-4">
                  <span className="truncate text-base font-semibold">{d.airport.city}</span>
                  <span className="truncate text-sm text-muted-foreground">{d.airport.country || d.destination}</span>
                  <span className="mt-3 font-data text-[21px] font-bold">{money(d.price, query.currency)}</span>
                  <span className="text-sm text-muted-foreground">
                    {d.departAt ? prettyDate(d.departAt.slice(0, 10)) : ''}{d.transfers != null ? `, ${d.transfers === 0 ? 'direct' : `${d.transfers} stop${d.transfers > 1 ? 's' : ''}`}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
