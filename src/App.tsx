import { Header } from '@/components/app/header';
import { SearchCard } from '@/components/app/search-card';
import { Results } from '@/components/app/results';
import { Explore } from '@/components/app/explore';
import { Intro } from '@/components/app/intro';
import { TripSheet } from '@/components/app/trip-sheet';
import { cn } from '@/lib/utils';
import { useApp } from '@/state/app';

export default function App() {
  const { mode } = useApp();
  const idle = mode === 'idle';
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <section className={cn('hero-bg relative isolate overflow-hidden text-white', idle ? 'pb-14 pt-12 sm:pb-20 sm:pt-16' : 'pb-8 pt-6')}>
        <div className="hero-grid absolute inset-0 -z-10" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {idle && (
            <div className="mb-8 max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-500">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-teal-100 backdrop-blur">
                <span className="size-1.5 rounded-full bg-teal-300" />Every airline · every seller · real totals
              </p>
              <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
                Find the cheapest way <span className="bg-gradient-to-r from-teal-200 via-emerald-200 to-amber-100 bg-clip-text text-transparent">there.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base text-teal-50/80 sm:text-lg">
                Live fares, a fare calendar and honest totals — including the fees that only show up at checkout.
                <span className="hidden sm:inline"> Press <kbd className="rounded border border-white/25 bg-white/10 px-1.5 py-0.5 font-mono text-xs">/</kbd> to start.</span>
              </p>
            </div>
          )}
          <SearchCard compact={!idle} />
        </div>
      </section>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {mode === 'idle' && <Intro />}
        {mode === 'search' && <Results />}
        {mode === 'explore' && <Explore />}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <p>Prices are estimates. The airline's payment page is the final price.</p>
          <p>FareScope is a personal tool and doesn't sell tickets.</p>
        </div>
      </footer>
      <TripSheet />
    </div>
  );
}
