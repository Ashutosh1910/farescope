import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { money, shortMoney } from '@/lib/format';
import {
  MAX_DAYS_AHEAD, addDaysIso, addMonths, fareLevels, monthCells, monthOf, nightsBetween, parseIso, shiftByMonths, weekdayMon,
} from '@/lib/dates';
import type { CalendarDay, CalendarResult, Cabin } from '@/lib/types';
import { today, type Trip } from '@/state/app';

type Days = Record<string, CalendarDay>;
export interface FareRoute { from: string; to: string; currency: string; cabin: Cabin }

const fareCache = new Map<string, Promise<Days | null>>();
function faresFor(r: FareRoute, month: string) {
  const key = `${r.from}|${r.to}|${month}|${r.currency}|${r.cabin}`;
  if (!fareCache.has(key)) {
    fareCache.set(key, api<CalendarResult>('calendar', { ...r, month, oneWay: 'true' })
      .then((x) => x.days)
      .catch(() => {
        fareCache.delete(key);
        return null;
      }));
  }
  return fareCache.get(key)!;
}

const fmt = (s: string, o: Intl.DateTimeFormatOptions) => parseIso(s).toLocaleDateString('en-GB', { timeZone: 'UTC', ...o });
const longDate = (s: string) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function useMonthFares(route: FareRoute | null, month: string, enabled: boolean) {
  const [days, setDays] = useState<Days | null>(null);
  useEffect(() => {
    setDays(null);
    if (!route || !enabled || month < monthOf(today())) return;
    let live = true;
    faresFor(route, month).then((d) => live && setDays(d));
    return () => { live = false; };
  }, [route?.from, route?.to, route?.currency, route?.cabin, month, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return days;
}

interface MonthProps {
  month: string; route: FareRoute | null; lazy: boolean; depart: string; ret: string; focusDate: string;
  previewEnd: string | null; onPick: (d: string) => void; onHover: (d: string | null) => void;
}

function Month({ month, route, lazy, depart, ret, focusDate, previewEnd, onPick, onHover }: MonthProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!lazy);
  useEffect(() => {
    if (!lazy || visible || !ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '200px 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [lazy, visible]);
  const days = useMonthFares(route, month, visible);
  const level = days ? fareLevels(days) : () => '';
  const min = days && Object.keys(days).length ? Math.min(...Object.values(days).map((d) => d.price)) : null;
  const max = addDaysIso(today(), MAX_DAYS_AHEAD);
  const t = today();
  const previewing = !!previewEnd;
  const title = fmt(`${month}-01`, { month: 'long', year: 'numeric' });

  return (
    <div ref={ref} role="group" aria-label={title} className="w-full sm:w-[322px]">
      <div className="sticky top-0 z-[1] bg-popover pb-2 pt-1 text-center font-semibold max-sm:text-left">{title}</div>
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((w, i) => (
          <span key={w} aria-hidden className={cn('pb-1 text-center text-xs text-muted-foreground', i > 4 && 'font-semibold text-foreground')}>{w}</span>
        ))}
        {monthCells(month).map((ds: string | null, i: number) => {
          if (!ds) return <span key={`b${i}`} aria-hidden />;
          const disabled = ds < t || ds > max;
          const info = days?.[ds];
          const isStart = ds === depart;
          const isEnd = ds === ret && !previewing;
          const isPreviewEnd = ds === previewEnd;
          const hasRange = !!(depart && (previewEnd || ret) && (previewEnd || ret) > depart);
          const inRange = previewing ? ds > depart && ds < previewEnd! : !!(depart && ret && ds > depart && ds < ret);
          const lvl = info && !disabled ? level(info.price) : '';
          const cheapest = !!info && info.price === min;
          const label = `${longDate(ds)}${isStart ? ', departure' : ds === ret ? ', return' : ''}${info ? `, from ${money(info.price, route?.currency)}${cheapest ? ', cheapest this month' : ''}` : ''}`;
          return (
            <button key={ds} type="button" data-date={ds} disabled={disabled} tabIndex={ds === focusDate ? 0 : -1}
              aria-label={label} aria-pressed={isStart || ds === ret}
              onClick={() => onPick(ds)} onPointerEnter={() => onHover(ds)}
              className={cn(
                'relative flex h-[52px] flex-col items-center justify-center gap-0.5 font-data text-[15px] outline-none transition-colors max-sm:h-14',
                'rounded-md focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-foreground/60 disabled:cursor-default disabled:opacity-30',
                !isStart && !isEnd && !isPreviewEnd && !inRange && '[@media(hover:hover)]:hover:bg-muted',
                inRange && 'rounded-none bg-signal-soft',
                (isStart || isEnd || isPreviewEnd) && 'bg-signal font-bold text-signal-foreground',
                isStart && hasRange && 'rounded-r-none',
                (isEnd || isPreviewEnd) && hasRange && 'rounded-l-none',
                ds === t && 'underline decoration-foreground/50 decoration-2 underline-offset-4',
              )}>
              <span className="leading-none">{Number(ds.slice(8))}</span>
              <span className={cn('min-h-3 text-[10px] leading-none text-muted-foreground',
                lvl === 'lvl-low' && 'font-bold text-success',
                (isStart || isEnd || isPreviewEnd) && 'text-signal-foreground/80',
                !days && visible && route && !disabled && 'mx-auto h-2 w-6 animate-pulse rounded bg-muted')}>
                {info && !disabled ? <>{cheapest ? '★ ' : ''}{shortMoney(info.price, route?.currency)}</> : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface FareCalendarProps {
  depart: string;
  ret: string;
  trip: Trip;
  active: 'depart' | 'return';
  onActiveChange: (a: 'depart' | 'return') => void;
  onChange: (v: { depart: string; ret: string; trip: Trip }) => void;
  route: FareRoute | null;
  onDone: () => void;
  mobile: boolean;
}

export function FareCalendar({ depart, ret, trip, active, onActiveChange, onChange, route, onDone, mobile }: FareCalendarProps) {
  const t = today();
  const max = addDaysIso(t, MAX_DAYS_AHEAD);
  const clamp = (s: string) => (s < t ? t : s > max ? max : s);
  const isReturn = trip === 'return';
  const r = isReturn ? ret : '';
  const shownRoute = route && active === 'return' ? { ...route, from: route.to, to: route.from } : route;
  const initialFocus = clamp((active === 'return' ? r || depart : depart) || t);
  const [focusDate, setFocusDate] = useState(initialFocus);
  const firstMonth = monthOf(t);
  const lastMonth = addMonths(monthOf(max), -1);
  const clampView = (m: string) => (m < firstMonth ? firstMonth : m > lastMonth ? lastMonth : m);
  const [view, setView] = useState(() =>
    clampView(active === 'return' && depart && monthOf(initialFocus) <= addMonths(monthOf(depart), 1) ? monthOf(depart) : monthOf(initialFocus)));
  const [hover, setHover] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(true);

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`);
    el?.focus({ preventScroll: !mobile });
    if (mobile) el?.scrollIntoView({ block: 'center' });
  });

  const moveFocus = useCallback((ds: string) => {
    const d = clamp(ds);
    setFocusDate(d);
    const m = monthOf(d);
    if (!mobile && m !== view && m !== addMonths(view, 1)) setView(clampView(m < view ? m : addMonths(m, -1)));
    wantFocus.current = true;
  }, [view, mobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (ds: string) => {
    setFocusDate(ds);
    if (active === 'depart') {
      onChange({ depart: ds, ret: r && r < ds ? '' : ret, trip });
      if (isReturn) {
        setFocusDate(r && r >= ds ? r : ds);
        onActiveChange('return');
        wantFocus.current = true;
      } else {
        setTimeout(onDone, 160);
      }
      return;
    }
    if (ds < depart) {
      onChange({ depart: ds, ret, trip });
      wantFocus.current = true;
      return;
    }
    onChange({ depart, ret: ds, trip: 'return' });
    setTimeout(onDone, 220);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');
    if (!cell) return;
    const ds = cell.dataset.date!;
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: string | null = null;
    if (e.key in steps) next = addDaysIso(ds, steps[e.key]);
    else if (e.key === 'PageUp') next = shiftByMonths(ds, -1);
    else if (e.key === 'PageDown') next = shiftByMonths(ds, 1);
    else if (e.key === 'Home') next = addDaysIso(ds, -weekdayMon(ds));
    else if (e.key === 'End') next = addDaysIso(ds, 6 - weekdayMon(ds));
    if (!next) return;
    e.preventDefault();
    moveFocus(next);
  };

  const previewEnd = active === 'return' && depart && hover && hover > depart ? hover : null;
  const months: string[] = [];
  if (mobile) for (let m = firstMonth; m <= monthOf(max); m = addMonths(m, 1)) months.push(m);
  else months.push(view, addMonths(view, 1));

  const nights = isReturn && depart && r ? nightsBetween(depart, r) : null;
  const summary = !isReturn ? 'One-way trip' : nights == null ? (active === 'return' ? 'Now pick your return date' : '') : nights === 0 ? 'Same-day return' : `${nights} night${nights > 1 ? 's' : ''}`;

  const tab = (which: 'depart' | 'return', label: string) => {
    const v = which === 'depart' ? depart : r;
    const text = v ? fmt(v, { weekday: 'short', day: 'numeric', month: 'short' }) : which === 'return' ? (isReturn ? 'Add return' : 'One way') : 'Select date';
    return (
      <button type="button" aria-pressed={active === which}
        onClick={() => {
          if (which === 'return' && !isReturn) onChange({ depart, ret: '', trip: 'return' });
          onActiveChange(which);
          setFocusDate(clamp((which === 'return' ? r || depart : depart) || t));
          wantFocus.current = true;
        }}
        className={cn('relative flex flex-1 flex-col overflow-hidden rounded-lg border px-3.5 py-2 text-left transition-colors sm:min-w-44 sm:flex-none',
          active === which ? 'border-foreground/40 bg-muted/60' : 'border-transparent hover:bg-muted')}>
        {active === which && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-signal" />}
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn('font-data text-[15px] font-bold', !v && 'font-sans font-normal text-muted-foreground')}>{text}</span>
      </button>
    );
  };

  return (
    <div className={cn('flex flex-col', mobile && 'min-h-0 flex-1')} onPointerLeave={() => setHover(null)}>
      <div className="flex items-start gap-2">
        <div className="flex flex-1 gap-1.5">{tab('depart', 'Departure')}{tab('return', 'Return')}</div>
        {mobile && <Button variant="ghost" size="icon" onClick={onDone} aria-label="Close calendar"><X /></Button>}
      </div>
      <p className="mb-2 mt-2.5 px-1 text-sm text-muted-foreground">
        {shownRoute
          ? <><strong className="font-data text-foreground">{shownRoute.from} to {shownRoute.to}</strong>: the lowest one-way fare per adult that travellers found recently.</>
          : 'Choose From and To to see the lowest fare on each day.'}
      </p>
      <div className={cn('relative flex gap-2', mobile && 'min-h-0 flex-1')}>
        {!mobile && (
          <Button variant="ghost" size="icon" className="absolute -left-1 top-0 z-[2]" aria-label="Previous month" disabled={view <= firstMonth}
            onClick={() => setView(clampView(addMonths(view, -1)))}><ChevronLeft /></Button>
        )}
        <div ref={gridRef} onKeyDown={onKeyDown}
          className={cn('flex gap-8', mobile && 'flex-1 flex-col gap-6 overflow-y-auto overscroll-contain pb-4')}>
          {months.map((m) => (
            <Month key={m} month={m} route={shownRoute} lazy={mobile} depart={depart} ret={r} focusDate={focusDate}
              previewEnd={previewEnd} onPick={pick} onHover={setHover} />
          ))}
        </div>
        {!mobile && (
          <Button variant="ghost" size="icon" className="absolute -right-1 top-0 z-[2]" aria-label="Next month" disabled={view >= lastMonth}
            onClick={() => setView(clampView(addMonths(view, 1)))}><ChevronRight /></Button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-sm">
        <span aria-live="polite" className="min-w-24 font-semibold">{summary}</span>
        {shownRoute && <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><span className="size-2.5 rounded-sm bg-success" />Cheaper days</span>}
        {isReturn && (
          <button type="button" className="text-sm font-semibold underline underline-offset-4 hover:no-underline" onClick={() => { onChange({ depart, ret: '', trip: 'oneway' }); onActiveChange('depart'); }}>
            Make it one way
          </button>
        )}
        <Button className={cn('ml-auto', mobile && 'h-11 w-full')} onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
