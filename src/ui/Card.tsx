// src/components/ui/Card.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  actions?: ReactNode;
}

export function Card({ children, className, title, actions }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-secondary-200 shadow-sm', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between p-6 border-b border-secondary-200">
          {title && <h3 className="text-lg font-semibold text-secondary-900">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}