import { useId, useState } from 'react';
import { money, shortMoney } from '@/lib/format';

/** Single-series price line with a crosshair tooltip. */
export function Sparkline({ points, currency, label }: { points: { ts: number; price: number }[]; currency: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId();
  if (points.length < 2) return null;
  const W = 320, H = 76, P = 6;
  const xs = points.map((p) => p.ts), ys = points.map((p) => p.price);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x: number) => P + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * P);
  const sy = (y: number) => H - P - ((y - y0) / (y1 - y0 || 1)) * (H - 2 * P);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.ts).toFixed(1)},${sy(p.price).toFixed(1)}`).join('');
  const area = `${line}L${sx(x1).toFixed(1)},${H}L${sx(x0).toFixed(1)},${H}Z`;
  const last = points[points.length - 1];
  const h = hover == null ? null : points[hover];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(sx(p.ts) - x) < Math.abs(sx(points[best].ts) - x)) best = i; });
    setHover(best);
  };

  return (
    <figure className="relative mt-3 max-w-[360px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full cursor-crosshair overflow-visible" onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        role="img" aria-label={`${label}: from ${money(points[0].price, currency)} to ${money(last.price, currency)}, low ${money(y0, currency)}, high ${money(y1, currency)}`}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {h ? (
          <>
            <line x1={sx(h.ts)} x2={sx(h.ts)} y1="0" y2={H} stroke="var(--border)" strokeWidth="1" />
            <circle cx={sx(h.ts)} cy={sy(h.price)} r="4.5" fill="var(--chart-1)" stroke="var(--card)" strokeWidth="2" />
          </>
        ) : (
          <circle cx={sx(last.ts)} cy={sy(last.price)} r="4.5" fill="var(--chart-1)" stroke="var(--card)" strokeWidth="2" />
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute -top-2 z-10 flex -translate-x-1/2 -translate-y-full gap-1.5 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md"
          style={{ left: `${Math.min(Math.max((sx(h.ts) / W) * 100, 12), 88)}%` }}>
          <strong className="num">{money(h.price, currency)}</strong>
          <span className="opacity-75">{new Date(h.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        </div>
      )}
      <figcaption className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="num">low {shortMoney(y0, currency)} · high {shortMoney(y1, currency)}</span>
      </figcaption>
    </figure>
  );
}
