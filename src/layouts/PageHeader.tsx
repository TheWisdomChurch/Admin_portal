import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { textStyles } from '@/styles/text';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0 max-w-3xl">
        <h1 className={`${textStyles.pageTitle} leading-tight`}>{title}</h1>
        {subtitle && <p className={`${textStyles.subtitle} mt-1`}>{subtitle}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 md:shrink-0 md:justify-end">{actions}</div>}
    </div>
  );
}
