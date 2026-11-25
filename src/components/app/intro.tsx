import { ArrowRight, BadgeIndianRupee, CalendarRange, Globe2, Store, Zap } from 'lucide-react';
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

const FEATURES = [
  { icon: Zap, title: 'Live prices', text: 'Straight from Google Flights through SerpApi — IndiGo, Air India, Akasa, SpiceJet and international carriers in one list.' },
  { icon: CalendarRange, title: 'Fare calendar', text: 'Every date shows its lowest cached fare, so the cheap days jump out before you spend a live search.' },
  { icon: Store, title: 'Every seller', text: 'Compare the airline’s own price with Goibibo, Cleartrip, EaseMyTrip and more for the exact flight you picked.' },
  { icon: BadgeIndianRupee, title: 'Honest totals', text: 'Add each airline’s and travel site’s convenience fee in fees.json and see what you’ll really pay.' },
];

export function Intro() {
  const { form, submitForm } = useApp();
  const go = (from: Airport, to: Airport) => {
    const d = form.depart >= today() ? form.depart : addDays(today(), 14);
    submitForm({ ...form, from, to, depart: d, ret: form.trip === 'return' ? form.ret > d ? form.ret : addDays(d, 5) : form.ret });
  };
  return (
    <div className="space-y-10">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Popular routes</h2>
          {form.from && (
            <button type="button" onClick={() => go(form.from!, ANYWHERE)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              <Globe2 className="size-4" />Anywhere from {form.from.city}
            </button>
          )}
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {ROUTES.map(([a, b]) => (
            <button key={a.code + b.code} type="button" onClick={() => go(a, b)}
              className="group flex items-center justify-between rounded-2xl border bg-card px-4 py-3.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/40 outline-none">
              <span>
                <span className="flex items-center gap-2 font-semibold">{a.city}<ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />{b.city}</span>
                <span className="text-xs text-muted-foreground">{a.code} – {b.code}</span>
              </span>
              <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground opacity-0 transition-opacity group-hover:opacity-100">Search</span>
            </button>
          ))}
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border bg-card p-5 shadow-xs">
            <span className="mb-3 grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" /></span>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
