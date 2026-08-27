// src/components/ui/Card.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  actions?: ReactNode;
  headerClassName?: string;
  contentClassName?: string;
}

export function Card({ children, className, title, actions, headerClassName, contentClassName }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-200',
        className
      )}
    >
      {(title || actions) && (
        <div
          className={cn(
            'flex min-w-0 flex-col gap-3 border-b border-[var(--color-border-secondary)] p-4 sm:p-5 md:flex-row md:items-center md:justify-between',
            headerClassName
          )}
        >
          {title && <h3 className="text-sm md:text-base font-medium text-[var(--color-text-primary)]">{title}</h3>}
          {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('min-w-0 p-4 sm:p-5', contentClassName)}>{children}</div>
    </div>
  );
}
