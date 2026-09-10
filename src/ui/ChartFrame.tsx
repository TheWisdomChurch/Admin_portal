import { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';

import { Panel } from '@/ui/Panel';
import { EmptyState } from '@/ui/EmptyState';
import { cn } from '@/lib/utils';

interface ChartFrameProps {
  title: string;
  subtitle?: string;
  /** When false, an EmptyState is shown instead of the chart — never a zeroed axis. */
  hasData: boolean;
  emptyLabel?: string;
  emptyDescription?: string;
  /** Fixed chart height; the chart canvas must be `maintainAspectRatio: false`. */
  height?: number;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * The single wrapper for every dashboard chart. It guarantees that a chart with
 * no real data renders an explicit empty state rather than an axis full of
 * zeros or a flat line — the thing the church leadership kept seeing and
 * mistaking for "the page is broken".
 */
export function ChartFrame({
  title,
  subtitle,
  hasData,
  emptyLabel = 'No data yet',
  emptyDescription = 'This chart fills in once the underlying records exist.',
  height = 240,
  actions,
  className,
  children,
}: ChartFrameProps) {
  return (
    <Panel className={cn('flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{subtitle}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="mt-4" style={{ height }}>
        {hasData ? (
          children
        ) : (
          <div className="grid h-full place-items-center">
            <EmptyState
              icon={<BarChart3 className="h-5 w-5" />}
              title={emptyLabel}
              description={emptyDescription}
            />
          </div>
        )}
      </div>
    </Panel>
  );
}
