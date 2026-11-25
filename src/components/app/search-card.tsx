import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, CalendarDays, Info, Loader2, Minus, Pencil, Plane, Plus, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AirportField } from './airport-field';
import { FareCalendar } from './fare-calendar';
import { FieldShell } from './field-shell';
import { useMediaQuery } from '@/hooks/use-media-query';
import { parseIso } from '@/lib/dates';
import type { Cabin, Pax } from '@/lib/types';
import { useApp, type Trip } from '@/state/app';

const CABINS: { value: Cabin; label: string }[] = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium', label: 'Premium economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
const fmt = (s: string, o: Intl.DateTimeFormatOptions) => parseIso(s).toLocaleDateString('en-GB', { timeZone: 'UTC', ...o });

type OpenField = 'from' | 'to' | 'dates' | null;

function Travellers({ pax, cabin, onChange }: { pax: Pax; cabin: Cabin; onChange: (p: { pax?: Pax; cabin?: Cabin }) => void }) {
  const total = pax.adults + pax.children + pax.infantsSeat + pax.infantsLap;
  const rows: { key: keyof Pax; label: string; hint: string }[] = [
    { key: 'adults', label: 'Adults', hint: '12+ years' },
    { key: 'children', label: 'Children', hint: '2–11 years' },
    { key: 'infantsSeat', label: 'Infants in seat', hint: 'Under 2' },
    { key: 'infantsLap', label: 'Infants on lap', hint: 'Under 2' },
  ];
  const step = (k: keyof Pax, d: number) => onChange({ pax: { ...pax, [k]: Math.max(k === 'adults' ? 1 : 0, pax[k] + d) } });
  const canDec = (k: keyof Pax) => pax[k] > (k === 'adults' ? 1 : 0) && !(k === 'adults' && pax.infantsLap >= pax.adults);
  const canInc = (k: keyof Pax) => total < 9 && !(k === 'infantsLap' && pax.infantsLap >= pax.adults);
  const cabinLabel = CABINS.find((c) => c.value === cabin)!.label;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-8 gap-2 rounded-md px-2.5 text-sm font-normal text-signboard-foreground hover:bg-signboard-raised hover:text-signboard-foreground aria-expanded:bg-signboard-raised aria-expanded:text-signboard-foreground">
          <Users className="size-4 text-signboard-muted" />
          {total} traveller{total > 1 ? 's' : ''}, {cabinLabel.toLowerCase()}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-4">
        <div className="space-y-3.5">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.hint}</div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="size-8 rounded-full" disabled={!canDec(r.key)} onClick={() => step(r.key, -1)} aria-label={`Fewer ${r.label.toLowerCase()}`}><Minus /></Button>
                <output className="num w-4 text-center font-semibold" aria-live="polite">{pax[r.key]}</output>
                <Button variant="outline" size="icon" className="size-8 rounded-full" disabled={!canInc(r.key)} onClick={() => step(r.key, 1)} aria-label={`More ${r.label.toLowerCase()}`}><Plus /></Button>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{pax.infantsLap ? 'Each lap infant must travel with an adult.' : 'Up to 9 travellers per search.'}</p>
          <div className="border-t pt-3">
            <div className="mb-2 text-sm font-medium">Cabin</div>
            <ToggleGroup type="single" value={cabin} onValueChange={(v) => v && onChange({ cabin: v as Cabin })} variant="outline" spacing={1} className="grid w-full grid-cols-2">
              {CABINS.map((c) => <ToggleGroupItem key={c.value} value={c.value} className="h-9 text-sm data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{c.label}</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SearchCard({ compact = false }: { compact?: boolean }) {
  const { form, updateForm, submit, formError, loading, showEst, setShowEst, status, query } = useApp();
  const [open, setOpen] = useState<OpenField>(null);
  const [expanded, setExpanded] = useState(false);
  // After each new search, fold the form back into its one-line summary on phones.
  useEffect(() => setExpanded(false), [query]);
  const [active, setActive] = useState<'depart' | 'return'>('depart');
  const [spin, setSpin] = useState(0);
  const opener = useRef<HTMLButtonElement | null>(null);
  const mobile = useMediaQuery('(max-width: 639px)');
  const anywhere = form.to?.code === 'ANY';
  const route = form.from && form.to && !anywhere && form.from.code !== form.to.code
    ? { from: form.from.code, to: form.to.code, currency: form.currency, cabin: form.cabin } : null;

  // "/" opens From, like a search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || el.closest('input, textarea, [contenteditable], [role=dialog]')) return;
      e.preventDefault();
      setOpen('from');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const openDates = (which: 'depart' | 'return') => {
    opener.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    setActive(which);
    setOpen('dates');
  };
  const dateText = (d: string) => d ? fmt(d, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const isReturn = form.trip === 'return' && !anywhere;
  const nights = isReturn && form.depart && form.ret ? Math.round((Date.parse(form.ret) - Date.parse(form.depart)) / 86400e3) : null;

  const calendar = (
    <FareCalendar
      depart={form.depart} ret={form.ret} trip={form.trip} active={active} onActiveChange={setActive}
      onChange={(v) => updateForm({ depart: v.depart, ret: v.ret, trip: v.trip })}
      route={route} onDone={() => setOpen(null)} mobile={mobile}
    />
  );

  if (compact && mobile && !expanded && !formError) {
    const pax = form.pax.adults + form.pax.children + form.pax.infantsSeat + form.pax.infantsLap;
    return (
      <button type="button" onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-4 rounded-lg border border-signboard-line bg-signboard-raised px-4 py-3 text-left text-signboard-foreground">
        <span className="font-data text-2xl font-bold text-signal">
          {form.from?.code ?? '———'}<Plane className="mx-1.5 inline size-4 text-signboard-muted" />{anywhere ? 'ANY' : form.to?.code ?? '———'}
        </span>
        <span className="min-w-0 flex-1 text-sm text-signboard-muted">
          <span className="block truncate">{dateText(form.depart)}{isReturn && form.ret ? ` to ${dateText(form.ret)}` : anywhere ? '' : ', one way'}</span>
          <span className="block truncate">{pax} traveller{pax > 1 ? 's' : ''}</span>
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-signal"><Pencil className="size-3.5" />Edit</span>
      </button>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setOpen(null); submit(); }} aria-label="Search flights">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <ToggleGroup type="single" value={form.trip} onValueChange={(v) => v && updateForm({ trip: v as Trip })} spacing={0}
          className="rounded-md border border-signboard-line p-0.5" aria-label="Trip type">
          {(['return', 'oneway'] as const).map((t) => (
            <ToggleGroupItem key={t} value={t}
              className="h-8 rounded-[4px] px-3.5 text-sm text-signboard-muted hover:bg-transparent hover:text-signboard-foreground data-[state=on]:bg-signal data-[state=on]:font-semibold data-[state=on]:text-signal-foreground">
              {t === 'return' ? 'Return' : 'One way'}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Travellers pax={form.pax} cabin={form.cabin} onChange={(p) => updateForm(p)} />
        <Select value={form.currency} onValueChange={(v) => updateForm({ currency: v })}>
          <SelectTrigger size="sm" className="h-8 rounded-md border-none bg-transparent text-sm text-signboard-foreground shadow-none hover:bg-signboard-raised dark:bg-transparent [&_svg]:text-signboard-muted" aria-label="Currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Switch id="show-est" checked={showEst} onCheckedChange={setShowEst}
            className="data-[state=checked]:bg-signal data-[state=unchecked]:bg-signboard-line" />
          <Label htmlFor="show-est" className="cursor-pointer text-sm font-normal text-signboard-foreground">Show totals with fees</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-signboard-muted hover:text-signboard-foreground" aria-label="About totals with fees"><Info className="size-4" /></button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Adds each airline's or travel site's convenience fee from data/fees.json to its price, and sorts and filters by that total.
              {status?.feesCurrency ? ` Fees apply to ${status.feesCurrency} searches.` : ''}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)_auto]">
        <div className="relative grid gap-2 sm:grid-cols-2 lg:col-span-2">
          <AirportField kind="from" value={form.from} exclude={form.to?.code}
            onChange={(a) => { updateForm({ from: a }); if (!form.to) setTimeout(() => setOpen('to'), 80); }}
            open={open === 'from'} onOpenChange={(o) => setOpen(o ? 'from' : null)} />
          <Button type="button" variant="outline" size="icon"
            className="absolute left-1/2 top-1/2 z-10 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-signboard-line bg-signboard text-signboard-foreground hover:bg-signboard hover:text-signal max-sm:left-auto max-sm:right-4 max-sm:translate-x-0 max-sm:rotate-90 dark:bg-signboard"
            aria-label="Swap origin and destination" disabled={anywhere}
            onClick={() => { setSpin((s) => s + 180); updateForm({ from: form.to, to: form.from }); }}>
            <ArrowLeftRight className="transition-transform duration-300" style={{ transform: `rotate(${spin}deg)` }} />
          </Button>
          <AirportField kind="to" value={form.to} exclude={form.from?.code}
            onChange={(a) => { updateForm({ to: a }); if (a.code !== 'ANY') setTimeout(() => openDates('depart'), 80); }}
            open={open === 'to'} onOpenChange={(o) => setOpen(o ? 'to' : null)} />
        </div>

        {mobile ? (
          <>
            <div className="grid grid-cols-2 gap-2">{dateFields(false)}</div>
            <Sheet open={open === 'dates'} onOpenChange={(o) => setOpen(o ? 'dates' : null)}>
              <SheetContent side="bottom" showCloseButton={false} className="gap-0 rounded-t-2xl p-4 data-[side=bottom]:h-[92dvh]">
                <SheetTitle className="sr-only">Choose travel dates</SheetTitle>
                <SheetDescription className="sr-only">The lowest fare is shown under each date.</SheetDescription>
                {open === 'dates' && calendar}
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <Popover open={open === 'dates'} onOpenChange={(o) => setOpen(o ? 'dates' : null)}>
            <PopoverAnchor asChild>
              <div className="grid grid-cols-2 gap-2">{dateFields(true)}</div>
            </PopoverAnchor>
            <PopoverContent align="end" sideOffset={10} className="w-auto max-w-[calc(100vw-2rem)] rounded-xl p-4"
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => { e.preventDefault(); opener.current?.focus(); }}
              onInteractOutside={(e) => { if ((e.target as HTMLElement).closest?.('[aria-haspopup=dialog]')) e.preventDefault(); }}>
              {calendar}
            </PopoverContent>
          </Popover>
        )}

        <Button type="submit" disabled={loading}
          className="h-[104px] rounded-lg bg-signal px-8 text-lg font-bold text-signal-foreground hover:bg-signal/90 focus-visible:ring-signal/50 max-lg:h-14 max-lg:w-full dark:bg-signal dark:text-signal-foreground">
          {loading ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" strokeWidth={2.5} />}
          {anywhere ? 'Explore' : 'Search'}
        </Button>
      </div>
      {formError && <p role="alert" className="mt-3 text-sm font-semibold text-[#ffb4a6]">{formError}</p>}
    </form>
  );

  function dateFields(desktop: boolean) {
    return (
      <>
        <FieldShell label="Depart" icon={<CalendarDays />} display={dateText(form.depart) || 'Choose a date'} placeholder={!form.depart}
          active={desktop && open === 'dates' && active === 'depart'} hint={form.depart ? fmt(form.depart, { year: 'numeric' }) : ' '}
          onClick={() => openDates('depart')} aria-haspopup="dialog" aria-expanded={open === 'dates'} />
        <FieldShell label="Return" icon={<CalendarDays />} placeholder={!isReturn || !form.ret} disabled={anywhere}
          active={desktop && open === 'dates' && active === 'return'}
          display={anywhere ? 'Flexible' : isReturn ? dateText(form.ret) || 'Add a return' : 'One way'}
          hint={anywhere ? 'Any dates' : nights != null ? `${nights} night${nights === 1 ? '' : 's'}` : isReturn ? ' ' : desktop ? 'Click to add' : 'Tap to add'}
          onClick={() => openDates('return')} aria-haspopup="dialog" aria-expanded={open === 'dates'} />
      </>
    );
  }
}
