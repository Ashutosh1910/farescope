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
      <section className={cn('signboard', idle ? 'pb-12 pt-10 sm:pb-16 sm:pt-14' : 'pb-6 pt-5')}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {idle && (
            <div className="mb-8 max-w-[34rem]">
              <h1 className="text-[36px] font-bold leading-[1.1] text-balance sm:text-[48px]">Find the cheapest flight, fees included.</h1>
              <p className="mt-3 text-lg leading-relaxed text-signboard-muted">
                Live Google Flights fares, the lowest fare on every date, and every seller’s price for the flight you pick.
              </p>
            </div>
          )}
          <SearchCard compact={!idle} />
          {idle && (
            <p className="mt-4 hidden text-sm text-signboard-muted sm:block">
              Press <kbd className="rounded-[3px] border border-signboard-line px-1.5 py-0.5 font-data text-xs text-signboard-foreground">/</kbd> to choose where you’re flying from.
            </p>
          )}
        </div>
      </section>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {mode === 'idle' && <Intro />}
        {mode === 'search' && <Results />}
        {mode === 'explore' && <Explore />}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p>Prices are estimates. The airline’s payment page shows the final price.</p>
          <p>FareScope is a personal tool and doesn’t sell tickets.</p>
        </div>
      </footer>
      <TripSheet />
    </div>
  );
}
