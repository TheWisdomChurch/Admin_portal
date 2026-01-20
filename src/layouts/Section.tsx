import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SectionSpacing = 'sm' | 'md' | 'lg';

interface SectionProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  spacing?: SectionSpacing;
}

const spacingClasses: Record<SectionSpacing, string> = {
  sm: 'space-y-4',
  md: 'space-y-6',
  lg: 'space-y-8',
};

export function Section({
  children,
  title,
  subtitle,
  actions,
  className,
  spacing = 'md',
}: SectionProps) {
  return (
    <section className={cn('relative', spacingClasses[spacing], className)}>
      {(title || subtitle || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {title && (
              <h2 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
