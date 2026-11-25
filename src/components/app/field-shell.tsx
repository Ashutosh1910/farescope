import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A field on the signboard: pictogram + label, a large value, a hint underneath.
 * `size="code"` gives the oversized airport-code treatment.
 */
export const FieldShell = forwardRef<HTMLButtonElement, ComponentProps<'button'> & {
  label: string; icon?: ReactNode; display: ReactNode; hint?: ReactNode; placeholder?: boolean; active?: boolean; size?: 'code' | 'date';
}>(function FieldShell({ label, icon, display, hint, placeholder, active, size = 'date', className, ...props }, ref) {
  return (
    <button ref={ref} type="button" data-active={active || undefined}
      className={cn(
        'group/field relative flex w-full min-w-0 flex-col justify-center rounded-lg border border-signboard-line bg-signboard-raised px-4 text-left text-signboard-foreground outline-none transition-colors',
        size === 'code' ? 'h-[104px] gap-0' : 'h-[104px] gap-1',
        'disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:border-signboard-muted',
        'focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/40',
        'data-[active]:border-signal data-[state=open]:border-signal',
        className,
      )} {...props}>
      <span className="flex items-center gap-1.5 text-sm text-signboard-muted [&_svg]:size-4">{icon}{label}</span>
      <span className={cn('truncate',
        size === 'code' ? 'font-data text-[40px] font-bold leading-[1.05] text-signal' : 'font-data text-[21px] font-bold leading-tight',
        placeholder && (size === 'code' ? 'text-signboard-line' : 'font-sans text-base font-normal text-signboard-muted'))}>
        {display}
      </span>
      {hint != null && <span className="truncate text-sm text-signboard-muted">{hint}</span>}
    </button>
  );
});
