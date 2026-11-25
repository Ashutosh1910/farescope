import { useEffect, useState } from 'react';
import { Check, Clock, Globe2, MapPin, PlaneLanding, PlaneTakeoff, Sparkles, TrendingUp } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FieldShell } from './field-shell';
import { api } from '@/lib/api';
import { store } from '@/lib/store';
import type { Airport } from '@/lib/types';
import { ANYWHERE } from '@/state/app';

const POPULAR: Airport[] = [
  { code: 'DEL', city: 'New Delhi', name: 'Indira Gandhi International', country: 'India' },
  { code: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji Maharaj International', country: 'India' },
  { code: 'BLR', city: 'Bengaluru', name: 'Kempegowda International', country: 'India' },
  { code: 'GOX', city: 'Goa', name: 'Manohar International (Mopa)', country: 'India' },
  { code: 'HYD', city: 'Hyderabad', name: 'Rajiv Gandhi International', country: 'India' },
  { code: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'United Arab Emirates' },
  { code: 'SIN', city: 'Singapore', name: 'Changi', country: 'Singapore' },
  { code: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi', country: 'Thailand' },
];

function AirportRow({ a, selected, icon }: { a: Airport; selected: boolean; icon?: React.ReactNode }) {
  return (
    <>
      <span className="grid h-8 min-w-11 place-items-center rounded-md bg-muted px-1.5 text-xs font-bold tracking-wide text-muted-foreground group-data-selected/command-item:bg-background">
        {icon ?? a.code}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{a.city}</span>
        <span className="truncate text-xs text-muted-foreground">{a.name}{a.country ? ` · ${a.country}` : ''}</span>
      </span>
      {selected && <Check className="size-4 text-primary" />}
    </>
  );
}

export function AirportField({ kind, value, onChange, open, onOpenChange, exclude }: {
  kind: 'from' | 'to';
  value: Airport | null;
  onChange: (a: Airport) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exclude?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let live = true;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await api<{ airports: Airport[] }>('airports', { q: term });
        if (live) setResults(r.airports);
      } catch {
        if (live) setResults([]);
      } finally {
        if (live) setBusy(false);
      }
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const pick = (a: Airport) => {
    onChange(a);
    onOpenChange(false);
  };
  const recent = store.get<Airport[]>('recentAirports', []).filter((a) => a.code !== exclude);
  const popular = POPULAR.filter((a) => a.code !== exclude && !recent.some((r) => r.code === a.code)).slice(0, 8 - Math.min(recent.length, 4));
  const isAny = value?.code === 'ANY';
  const term = q.trim().toLowerCase();
  const showAnywhere = kind === 'to' && (!term || 'anywhere'.startsWith(term) || 'everywhere'.startsWith(term));
  const Icon = kind === 'from' ? PlaneTakeoff : PlaneLanding;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <FieldShell
          label={kind === 'from' ? 'From' : 'To'}
          icon={<Icon />}
          placeholder={!value}
          display={value ? (isAny ? <span className="inline-flex items-center gap-1.5"><Sparkles className="size-4 text-primary" />Anywhere</span> : <>{value.city} <span className="font-medium text-muted-foreground">{value.code}</span></>) : kind === 'from' ? 'Where from?' : 'Where to?'}
          hint={value ? (isAny ? 'Cheapest places this month' : value.name) : kind === 'from' ? 'City or airport' : 'City, airport or Anywhere'}
          aria-label={`${kind === 'from' ? 'From' : 'To'}: ${value ? (isAny ? 'Anywhere' : `${value.city} (${value.code})`) : 'not set'}`}
        />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[min(400px,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder={kind === 'from' ? 'Fly from…' : 'Fly to…'} />
          <CommandList className="max-h-[min(380px,60vh)]">
            {term && !busy && !results.length && !showAnywhere && <CommandEmpty>No airports match “{q}”.</CommandEmpty>}
            {showAnywhere && (
              <CommandGroup heading="Explore">
                <CommandItem value="ANY" onSelect={() => pick(ANYWHERE)}>
                  <AirportRow a={ANYWHERE} selected={isAny} icon={<Globe2 className="size-4 text-primary" />} />
                </CommandItem>
              </CommandGroup>
            )}
            {!term && recent.length > 0 && (
              <CommandGroup heading={<span className="inline-flex items-center gap-1"><Clock className="size-3" />Recent</span>}>
                {recent.slice(0, 4).map((a) => (
                  <CommandItem key={`r-${a.code}`} value={`r-${a.code}`} onSelect={() => pick(a)}>
                    <AirportRow a={a} selected={value?.code === a.code} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!term && (
              <CommandGroup heading={<span className="inline-flex items-center gap-1"><TrendingUp className="size-3" />Popular</span>}>
                {popular.map((a) => (
                  <CommandItem key={`p-${a.code}`} value={`p-${a.code}`} onSelect={() => pick(a)}>
                    <AirportRow a={a} selected={value?.code === a.code} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {term && results.length > 0 && (
              <CommandGroup heading={<span className="inline-flex items-center gap-1"><MapPin className="size-3" />Airports</span>}>
                {results.filter((a) => a.code !== exclude).map((a) => (
                  <CommandItem key={a.code} value={a.code} onSelect={() => pick(a)}>
                    <AirportRow a={a} selected={value?.code === a.code} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
