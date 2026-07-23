import { ReactNode } from 'react';
import { Card } from '@/ui/Card';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Card with an icon + title + subtitle header — the "bordered section with
 * a heading" shape that was being hand-rolled locally (as "Panel") across
 * several dashboard pages instead of shared.
 */
export function SectionCard({ title, subtitle, icon, actions, children, className }: SectionCardProps) {
  return (
    <Card
      className={className}
      title={
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
            {subtitle && <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-tertiary)]">{subtitle}</p>}
          </div>
        </div>
      }
      actions={actions}
    >
      {children}
    </Card>
  );
}
