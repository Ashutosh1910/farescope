import { Moon, RotateCcw, Sun, Sunrise, Sunset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { duration, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { WINDOWS, emptyFilters, facets as getFacets, isFiltered } from '@/lib/filters';
import type { Filters, Flight } from '@/lib/types';

const WINDOW_ICONS: Record<string, React.ReactNode> = {
  night: <Moon />, morning: <Sunrise />, afternoon: <Sun />, evening: <Sunset />,
};
const STOP_LABELS = ['Direct', '1 stop', '2+ stops'];

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3 py-4 first:pt-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function RangeFilter({ title, min, max, step, value, fmt, onChange }: {
  title: string; min: number; max: number; step: number; value: number | null; fmt: (n: number) => string; onChange: (v: number | null) => void;
}) {
  const v = value ?? max;
  return (
    <Section title={title} action={<span className="num text-xs font-medium text-muted-foreground">{value == null ? 'Any' : `Up to ${fmt(v)}`}</span>}>
      <Slider min={min} max={max} step={step} value={[v]} aria-label={title}
        onValueChange={([n]) => onChange(n >= max ? null : n)} className="py-1" />
      <div className="num flex justify-between text-[11px] text-muted-foreground"><span>{fmt(min)}</span><span>{fmt(max)}</span></div>
    </Section>
  );
}

export function FiltersPanel({ flights, filters, onChange, showEst, currency, inSheet = false }: {
  flights: Flight[]; filters: Filters; onChange: (f: Filters) => void; showEst: boolean; currency: string; inSheet?: boolean;
}) {
  const fc = getFacets(flights, showEst);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const windows = (key: 'departWindows' | 'arriveWindows', title: string) => (
    <Section title={title}>
      <ToggleGroup type="multiple" variant="outline" spacing={1.5} className="grid w-full grid-cols-2"
        value={[...filters[key]]} onValueChange={(v) => set({ [key]: new Set(v) } as Partial<Filters>)}>
        {WINDOWS.map((w: { id: string; label: string; hint: string }) => (
          <ToggleGroupItem key={w.id} value={w.id} aria-label={`${w.label} ${w.hint}`}
            className="h-auto flex-col gap-0.5 rounded-md py-2 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&[data-state=on]_.text-muted-foreground]:text-primary-foreground/70">
            <span className="flex items-center gap-1.5 text-xs font-medium [&_svg]:size-3.5">{WINDOW_ICONS[w.id]}{w.label}</span>
            <span className="num text-[10px] font-normal text-muted-foreground">{w.hint.replace(/:00|:59/g, '')}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Section>
  );

  return (
    <div>
      <div className={cn('mb-3 flex items-center justify-between', inSheet && 'pr-9')}>
        <h2 className="text-base font-semibold">Filters</h2>
        <Button variant="ghost" size="sm" disabled={!isFiltered(filters)} onClick={() => onChange(emptyFilters())} className="text-primary">
          <RotateCcw />Reset
        </Button>
      </div>
      <Separator />
      <div className="divide-y">
        <Section title="Stops">
          <div className="space-y-2.5">
            {[0, 1, 2].map((b) => {
              const avail = fc.stops[b] != null;
              const checked = avail && (filters.stops.size === 0 || filters.stops.has(b));
              return (
                <div key={b} className="flex items-center gap-2.5">
                  <Checkbox id={`stop-${b}`} checked={checked} disabled={!avail}
                    onCheckedChange={(c) => {
                      const availAll = [0, 1, 2].filter((x) => fc.stops[x] != null);
                      const cur = new Set(filters.stops.size ? filters.stops : availAll);
                      if (c) cur.add(b); else cur.delete(b);
                      set({ stops: cur.size === availAll.length ? new Set() : cur });
                    }} />
                  <Label htmlFor={`stop-${b}`} className="flex-1 cursor-pointer font-normal">{STOP_LABELS[b]}</Label>
                  <span className="num text-xs text-muted-foreground">{avail ? money(fc.stops[b], currency) : '—'}</span>
                </div>
              );
            })}
          </div>
        </Section>
        {windows('departWindows', 'Departure time')}
        {windows('arriveWindows', 'Arrival time')}
        {fc.price && fc.price.max > fc.price.min && (
          <RangeFilter title={showEst ? 'Max est. total' : 'Max price'} min={fc.price.min} max={fc.price.max}
            step={Math.max(1, Math.round((fc.price.max - fc.price.min) / 100))} value={filters.maxPrice}
            fmt={(n) => money(n, currency)} onChange={(v) => set({ maxPrice: v })} />
        )}
        {fc.duration && fc.duration.max > fc.duration.min && (
          <RangeFilter title="Max journey time" min={fc.duration.min} max={fc.duration.max} step={5}
            value={filters.maxDuration} fmt={duration} onChange={(v) => set({ maxDuration: v })} />
        )}
        {fc.maxLayover > 30 && (
          <RangeFilter title="Max layover" min={30} max={fc.maxLayover} step={5}
            value={filters.maxLayover} fmt={duration} onChange={(v) => set({ maxLayover: v })} />
        )}
        {(fc.hasOvernight || fc.hasSeparate) && (
          <Section title="Connections">
            <div className="space-y-3">
              {fc.hasOvernight && (
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="no-overnight" className="font-normal">No overnight layovers</Label>
                  <Switch id="no-overnight" checked={filters.noOvernightLayovers} onCheckedChange={(c) => set({ noOvernightLayovers: c })} />
                </div>
              )}
              {fc.hasSeparate && (
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="no-separate" className="font-normal">No separate tickets</Label>
                  <Switch id="no-separate" checked={filters.noSeparateTickets} onCheckedChange={(c) => set({ noSeparateTickets: c })} />
                </div>
              )}
            </div>
          </Section>
        )}
        <Section title="Airlines" action={
          <span className="flex gap-1 text-xs">
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => set({ excludedAirlines: new Set() })}>All</button>
            <span className="text-muted-foreground">·</span>
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => set({ excludedAirlines: new Set(flights.flatMap((f) => f.airlines)) })}>None</button>
          </span>
        }>
          <div className="space-y-2.5">
            {fc.airlines.map((a: { name: string; minPrice: number; logo: string | null }) => {
              const id = `al-${a.name.replace(/\W+/g, '-')}`;
              return (
                <div key={a.name} className="flex items-center gap-2.5">
                  <Checkbox id={id} checked={!filters.excludedAirlines.has(a.name)}
                    onCheckedChange={(c) => {
                      const ex = new Set(filters.excludedAirlines);
                      if (c) ex.delete(a.name); else ex.add(a.name);
                      set({ excludedAirlines: ex });
                    }} />
                  {a.logo
                    ? <img src={a.logo} alt="" className="size-5 rounded bg-white object-contain p-px ring-1 ring-border" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    : null}
                  <Label htmlFor={id} className="min-w-0 flex-1 cursor-pointer truncate font-normal">{a.name}</Label>
                  <span className="num text-xs text-muted-foreground">{money(a.minPrice, currency)}</span>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}
