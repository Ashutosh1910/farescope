import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The big two-line field used across the search card (label + value + hint). */
export const FieldShell = forwardRef<HTMLButtonElement, ComponentProps<'button'> & {
  label: string; icon?: ReactNode; display: ReactNode; hint?: ReactNode; placeholder?: boolean; active?: boolean;
}>(function FieldShell({ label, icon, display, hint, placeholder, active, className, ...props }, ref) {
  return (
    <button ref={ref} type="button" data-active={active || undefined}
      className={cn(
        'group/field relative flex h-[68px] w-full min-w-0 flex-col justify-center gap-0.5 rounded-xl border border-input bg-card px-4 text-left outline-none transition-all',
        'disabled:cursor-not-allowed disabled:opacity-55 enabled:hover:border-primary/40 enabled:hover:bg-accent/40 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30',
        'data-[active]:border-primary data-[active]:bg-accent/40 data-[active]:ring-3 data-[active]:ring-ring/25 data-[state=open]:border-primary data-[state=open]:ring-3 data-[state=open]:ring-ring/25',
        className,
      )} {...props}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground [&_svg]:size-3.5">
        {icon}{label}
      </span>
      <span className={cn('truncate text-[15px] font-semibold leading-tight', placeholder && 'font-normal text-muted-foreground')}>{display}</span>
      {hint != null && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
});
