import { Moon, Sun, Laptop, Plane } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useApp } from '@/state/app';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-teal-300 to-emerald-500 text-teal-950 shadow-lg shadow-teal-500/30', className)}>
      <Plane className="size-4.5" strokeWidth={2.4} />
    </span>
  );
}

function StatusPill() {
  const { status } = useApp();
  if (!status) return null;
  const live = status.liveProvider === 'serpapi';
  const q = status.quota;
  const text = live ? `Live · ${q?.usedThisMonth ?? 0}/${q?.monthlyLimit ?? 0}` : status.hosted ? 'Hosted demo' : 'Demo data';
  const tip = live
    ? `Live Google Flights prices via SerpApi. ${q?.usedThisMonth}/${q?.monthlyLimit} searches used this month (${q?.usedThisHour}/${q?.hourlyLimit} this hour). Results are reused for ${status.cacheMinutes.live} min.`
    : status.hosted
      ? 'This hosted copy only has synthetic prices. Run FareScope yourself with a SerpApi key for live fares.'
      : 'No SERPAPI_KEY configured, so prices are synthetic.';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn(
          'inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-white/30',
          live ? 'border-white/15 bg-white/10 text-teal-50' : 'border-amber-300/40 bg-amber-300/15 text-amber-100',
        )}>
          <span className="relative flex size-2">
            {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className={cn('relative inline-flex size-2 rounded-full', live ? 'bg-emerald-400' : 'bg-amber-300')} />
          </span>
          <span className="num">{text}</span>
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
        <Button variant="ghost" size="icon" aria-label="Theme" className="text-white/80 hover:bg-white/10 hover:text-white">
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand/95 backdrop-blur-xl supports-[backdrop-filter]:bg-brand/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <button type="button" onClick={reset} className="flex items-center gap-2.5 rounded-lg text-white outline-none focus-visible:ring-3 focus-visible:ring-white/30" aria-label="FareScope home">
          <Logo />
          <span className="text-[17px] font-semibold tracking-tight">Fare<span className="text-teal-300">Scope</span></span>
        </button>
        <div className="flex items-center gap-1.5">
          <StatusPill />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
