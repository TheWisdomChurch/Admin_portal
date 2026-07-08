import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)] text-[var(--color-text-tertiary)]">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
        {description && <p className="text-sm text-[var(--color-text-tertiary)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
