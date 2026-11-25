import { Globe2, Plane, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addDays } from '@/lib/format';
import type { Airport } from '@/lib/types';
import { ANYWHERE, today, useApp } from '@/state/app';

const A = (code: string, city: string, name: string, country = 'India'): Airport => ({ code, city, name, country });
const ROUTES: [Airport, Airport][] = [
  [A('BOM', 'Mumbai', 'Chhatrapati Shivaji Maharaj International'), A('DEL', 'New Delhi', 'Indira Gandhi International')],
  [A('DEL', 'New Delhi', 'Indira Gandhi International'), A('BLR', 'Bengaluru', 'Kempegowda International')],
  [A('BLR', 'Bengaluru', 'Kempegowda International'), A('GOX', 'Goa', 'Manohar International (Mopa)')],
  [A('DEL', 'New Delhi', 'Indira Gandhi International'), A('DXB', 'Dubai', 'Dubai International', 'United Arab Emirates')],
  [A('BOM', 'Mumbai', 'Chhatrapati Shivaji Maharaj International'), A('SIN', 'Singapore', 'Changi', 'Singapore')],
  [A('HYD', 'Hyderabad', 'Rajiv Gandhi International'), A('BKK', 'Bangkok', 'Suvarnabhumi', 'Thailand')],
];

const SOURCES = [
  ['Live fares', 'Each search asks Google Flights through SerpApi, so IndiGo, Air India, Akasa, SpiceJet and international airlines appear in one list.'],
  ['The fare calendar', 'Every date shows the lowest fare other travellers found in the last few days, so you can spot cheap days before spending a live search.'],
  ['Every seller', 'For the flight you pick, see what the airline charges and what Goibibo, Cleartrip, EaseMyTrip and others charge for the same seats.'],
  ['Fees', 'Add each airline’s and travel site’s convenience fee to data/fees.json, then switch on “Show totals with fees” to compare what you’d really pay.'],
];

export function Intro() {
  const { form, submitForm } = useApp();
  const go = (from: Airport, to: Airport) => {
    const d = form.depart >= today() ? form.depart : addDays(today(), 14);
    submitForm({ ...form, from, to, depart: d, ret: form.trip === 'return' ? (form.ret > d ? form.ret : addDays(d, 5)) : form.ret });
  };
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14">
      <section aria-labelledby="popular" className="min-w-0">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="popular" className="text-[21px] font-bold">Popular routes</h2>
          {form.from && (
            <button type="button" onClick={() => go(form.from!, ANYWHERE)} className="inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline">
              <Globe2 className="size-4" />Anywhere from {form.from.city}
            </button>
          )}
        </div>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {ROUTES.map(([a, b]) => (
            <li key={a.code + b.code}>
              <button type="button" onClick={() => go(a, b)}
                className="group flex w-full items-center gap-4 px-4 py-3.5 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted/60 sm:gap-6 sm:px-5">
                <span className="flex shrink-0 items-center gap-2 font-data text-xl font-bold sm:w-36">
                  {a.code}<Plane className="size-4 text-muted-foreground" />{b.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.city} to {b.city}</span>
                <span className="hidden items-center gap-1.5 text-sm font-semibold opacity-70 group-hover:opacity-100 sm:inline-flex">
                  <Search className="size-4" />Search
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="sources" className="min-w-0">
        <h2 id="sources" className="mb-3 text-[21px] font-bold">Where the prices come from</h2>
        <dl className="space-y-5">
          {SOURCES.map(([t, d]) => (
            <div key={t} className="border-l-2 border-signal pl-4">
              <dt className="font-semibold">{t}</dt>
              <dd className="mt-0.5 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>
        <Button variant="link" className="mt-4 h-auto px-0 text-muted-foreground" asChild>
          <a href="https://github.com/Ashutosh1910/farescope#convenience-fees-datafeesjson" target="_blank" rel="noopener">How to set up your fee table</a>
        </Button>
      </section>
    </div>
  );
}
