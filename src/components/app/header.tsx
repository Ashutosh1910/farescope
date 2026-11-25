import { Moon, Sun, Laptop, Plane } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useApp } from '@/state/app';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-8 place-items-center rounded-[5px] bg-signal text-signal-foreground', className)}>
      <Plane className="size-[18px]" strokeWidth={2.4} />
    </span>
  );
}

function StatusPill() {
  const { status } = useApp();
  if (!status) return null;
  const live = status.liveProvider === 'serpapi';
  const q = status.quota;
  const text = live ? `Live prices, ${q?.usedThisMonth ?? 0} of ${q?.monthlyLimit ?? 0} searches used` : status.hosted ? 'Demo prices (hosted copy)' : 'Demo prices';
  const short = live ? `Live, ${q?.usedThisMonth ?? 0}/${q?.monthlyLimit ?? 0}` : 'Demo prices';
  const tip = live
    ? `Live Google Flights prices through SerpApi. ${q?.usedThisHour} of ${q?.hourlyLimit} searches used this hour. Results are reused for ${status.cacheMinutes.live} minutes.`
    : status.hosted
      ? 'This hosted copy only has made-up prices. Run FareScope yourself with a SerpApi key for live fares.'
      : 'No SERPAPI_KEY is set, so prices are made up.';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-signboard-foreground outline-none hover:bg-signboard-raised focus-visible:ring-2 focus-visible:ring-signal/50">
          <span className={cn('size-2 rounded-full', live ? 'bg-[#4cc38a]' : 'bg-signal')} />
          <span className="font-data max-sm:hidden">{text}</span>
          <span className="font-data sm:hidden">{short}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{tip}</TooltipContent>
    </Tooltip>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Theme" className="text-signboard-muted hover:bg-signboard-raised hover:text-signboard-foreground">
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light"><Sun />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon />Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Laptop />System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const { reset } = useApp();
  return (
    <header className="signboard sticky top-0 z-40 border-b border-signboard-line/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <button type="button" onClick={reset} className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-signal/50" aria-label="FareScope home">
          <Logo />
          <span className="font-data text-lg font-bold">FareScope</span>
        </button>
        <div className="flex items-center gap-1">
          <StatusPill />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
