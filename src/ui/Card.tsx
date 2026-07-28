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
            'flex flex-col gap-3 border-b border-[var(--color-border-secondary)] p-5 sm:flex-row sm:items-center sm:justify-between',
            headerClassName
          )}
        >
          {title && <h3 className="text-sm md:text-base font-medium text-[var(--color-text-primary)]">{title}</h3>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('p-5', contentClassName)}>{children}</div>
    </div>
  );
}
