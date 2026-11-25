import { useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Compass, Globe2, MapPin, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DemoNotice } from './results';
import { cn } from '@/lib/utils';
import { money, prettyDate } from '@/lib/format';
import { addMonths } from '@/lib/dates';
import { today, useApp } from '@/state/app';

// A soft, stable gradient per destination so the grid feels like a travel board.
const HUES = [178, 205, 250, 290, 25, 60, 150];
const hueFor = (code: string) => HUES[[...code].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];

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
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight sm:text-3xl"><Compass className="size-6 text-primary" />Anywhere from {fromCity}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cheapest {form.trip === 'oneway' ? 'one-way' : 'round-trip'} fares per adult in {prettyDate(`${month}-01`, { month: 'long', year: 'numeric' })}.
            {res?.source === 'demo' ? ' Demo data.' : ' Cached fares from Travelpayouts, usually 2–7 days old — pick one to check live prices.'}
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
        <div className="flex flex-col items-center rounded-2xl border border-dashed p-10 text-center">
          <TriangleAlert className="mb-2 size-6 text-destructive" /><p className="font-semibold">Explore didn't work</p><p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : !list.length ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed p-10 text-center">
          <Globe2 className="mb-2 size-6 text-muted-foreground" /><p className="font-semibold">No cached fares for this month</p><p className="text-sm text-muted-foreground">Try another month.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((d, i) => {
            const h = hueFor(d.destination);
            return (
              <button key={d.destination} type="button" onClick={() => pickDestination(d)}
                className="group relative overflow-hidden rounded-2xl border bg-card text-left shadow-xs transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 fill-mode-both hover:-translate-y-1 hover:shadow-xl focus-visible:ring-3 focus-visible:ring-ring/40 outline-none"
                style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <div className="relative h-20 overflow-hidden"
                  style={{ background: `linear-gradient(135deg, oklch(0.62 0.12 ${h}), oklch(0.45 0.1 ${h + 30}))` }}>
                  <div className="hero-grid absolute inset-0 opacity-60" />
                  <span className="absolute bottom-2 left-3 font-mono text-3xl font-bold tracking-tight text-white/25">{d.destination}</span>
                  {i < 3 && <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-900">#{i + 1} cheapest</span>}
                  <ArrowUpRight className="absolute bottom-2.5 right-3 size-5 text-white/0 transition-all group-hover:text-white" />
                </div>
                <div className="space-y-0.5 p-3.5">
                  <div className="truncate text-base font-semibold">{d.airport.city}</div>
                  <div className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3" />{d.airport.country || d.destination}</div>
                  <div className="pt-2 text-xs text-muted-foreground">from <span className="num text-lg font-bold text-foreground">{money(d.price, query.currency)}</span></div>
                  <div className={cn('text-xs text-muted-foreground')}>
                    {d.departAt ? prettyDate(d.departAt.slice(0, 10)) : ''}{d.transfers != null ? ` · ${d.transfers === 0 ? 'Direct' : `${d.transfers} stop${d.transfers > 1 ? 's' : ''}`}` : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
