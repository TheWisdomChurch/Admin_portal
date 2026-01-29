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
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-3xl">
        <h1 className={`${textStyles.pageTitle} leading-tight`}>{title}</h1>
        {subtitle && <p className={`${textStyles.subtitle} mt-1`}>{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">{actions}</div>}
    </div>
  );
}
