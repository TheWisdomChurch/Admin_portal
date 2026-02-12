'use client';

import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/ui/Button';

interface SuccessAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  loading?: boolean;
}

interface SuccessModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  details?: Array<{ label: string; value: string }>;
  onClose: () => void;
  primaryAction?: SuccessAction;
  secondaryAction?: SuccessAction;
}

export function SuccessModal({
  open,
  title,
  subtitle,
  description,
  badge = 'Registration received',
  details,
  onClose,
  primaryAction,
  secondaryAction,
}: SuccessModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
        <div className="relative px-6 pt-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 hover:bg-[var(--color-background-hover)]"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </button>

          {badge ? (
            <span className="inline-flex items-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-tertiary)] px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-tertiary)]">
              {badge}
            </span>
          ) : null}

          <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)] text-[var(--color-accent-success)]">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-2xl font-semibold text-[var(--color-text-primary)]">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
          ) : null}
          {description ? (
            <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">{description}</p>
          ) : null}

          {details && details.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-tertiary)]/40 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {details.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                      {item.label}
                    </p>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] break-words">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col gap-2 border-t border-[var(--color-border-secondary)] px-6 py-5 sm:flex-row sm:justify-end sm:gap-3">
            {secondaryAction && (
              <Button
                variant={secondaryAction.variant ?? 'outline'}
                onClick={secondaryAction.onClick}
                className="sm:min-w-[140px]"
                loading={secondaryAction.loading}
              >
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                variant={primaryAction.variant ?? 'primary'}
                onClick={primaryAction.onClick}
                className="sm:min-w-[160px]"
                loading={primaryAction.loading}
              >
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
