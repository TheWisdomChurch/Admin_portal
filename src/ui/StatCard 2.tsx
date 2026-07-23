import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Panel } from '@/ui/Panel';

export type StatCardTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: StatCardTone;
  /** Optional trend/delta line rendered under the value, e.g. "+12% this month". */
  trend?: string;
  className?: string;
}

const toneStyles: Record<StatCardTone, string> = {
  default: 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]',
  success: 'bg-[var(--color-success-surface)] text-[var(--color-success-text)]',
  warning: 'bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]',
  danger: 'bg-[var(--color-danger-surface)] text-[var(--color-danger-text)]',
  info: 'bg-[var(--color-info-surface)] text-[var(--color-info-text)]',
};

/**
 * The KPI/metric tile pattern reimplemented ad hoc across a dozen dashboard
 * pages (StatCard, Metric, KPI, MetricPanel...) — this is the one shared
 * version everything should use instead.
 */
export function StatCard({ label, value, icon, tone = 'default', trend, className }: StatCardProps) {
  return (
    <Panel className={cn('transition duration-200 hover:-translate-y-0.5 hover:shadow-md', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
          {trend && <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{trend}</p>}
        </div>
        {icon && (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', toneStyles[tone])}>
            {icon}
          </div>
        )}
      </div>
    </Panel>
  );
}
