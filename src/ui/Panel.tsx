import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

/**
 * Lighter-weight surface than Card — a bordered, rounded container with no
 * built-in header/title row. Use this for grouping content that doesn't need
 * Card's title/actions bar (e.g. a chart wrapper, a stat grid section).
 */
export function Panel({ children, className, padded = true }: PanelProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] shadow-sm',
        padded && 'p-5',
        className
      )}
    >
      {children}
    </div>
  );
}
