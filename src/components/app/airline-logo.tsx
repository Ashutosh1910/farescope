import { useState } from 'react';
import { cn } from '@/lib/utils';
import { airlineCode } from '@/lib/format';
import type { Flight } from '@/lib/types';

/** Remote airline logo; falls back to an airline-code badge when it can't load. */
export function AirlineLogo({ flight, size = 36, className }: { flight: Flight; size?: number; className?: string }) {
  const src = flight.logo || flight.leg.segments[0]?.airlineLogo;
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (src && !failed) {
    return (
      <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} style={box}
        className={cn('shrink-0 rounded-lg bg-white object-contain p-1 ring-1 ring-border', className)} />
    );
  }
  return (
    <span aria-hidden style={box}
      className={cn('grid shrink-0 place-items-center rounded-lg bg-accent text-[11px] font-bold tracking-wide text-accent-foreground', className)}>
      {airlineCode(flight)}
    </span>
  );
}
