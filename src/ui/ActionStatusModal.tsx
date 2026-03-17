'use client';

import { AlertTriangle, CheckCircle2, Info, Loader2, Sparkles, X } from 'lucide-react';
import { Button } from '@/ui/Button';

export type ActionStatusMode = 'progress' | 'success' | 'error' | 'info';

export type ActionStatusDetail = {
  label: string;
  value: string;
};

type ActionStatusAction = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'warning';
  loading?: boolean;
};

interface ActionStatusModalProps {
  open: boolean;
  mode: ActionStatusMode;
  title: string;
  description: string;
  badge?: string;
  details?: ActionStatusDetail[];
  onClose: () => void;
  primaryAction?: ActionStatusAction;
  secondaryAction?: ActionStatusAction;
}

const modeConfig: Record<
  ActionStatusMode,
  {
    icon: typeof Loader2;
    iconClassName: string;
    badge: string;
    panelClassName: string;
  }
> = {
  progress: {
    icon: Loader2,
    iconClassName: 'text-[var(--color-accent-primary)] animate-spin',
    badge: 'Processing',
    panelClassName: 'border-[var(--color-border-secondary)]',
  },
  success: {
    icon: CheckCircle2,
    iconClassName: 'text-[var(--color-accent-success)]',
    badge: 'Completed',
    panelClassName: 'border-emerald-200',
  },
  error: {
    icon: AlertTriangle,
    iconClassName: 'text-[var(--color-accent-danger)]',
    badge: 'Action failed',
    panelClassName: 'border-rose-200',
  },
  info: {
    icon: Info,
    iconClassName: 'text-[var(--color-accent-primary)]',
    badge: 'Update',
    panelClassName: 'border-[var(--color-border-secondary)]',
  },
};

export function ActionStatusModal({
  open,
  mode,
  title,
  description,
  badge,
  details,
  onClose,
  primaryAction,
  secondaryAction,
}: ActionStatusModalProps) {
  if (!open) return null;

  const config = modeConfig[mode];
  const Icon = config.icon;
  const normalizedDetails = (details || []).filter(
    (detail) => String(detail?.label ?? '').trim() && String(detail?.value ?? '').trim()
  );
  const showActions = mode !== 'progress';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div
        className={`w-full max-w-lg overflow-hidden rounded-[28px] border bg-[var(--color-background-primary)] shadow-[0_32px_90px_rgba(15,23,42,0.26)] ${config.panelClassName}`}
      >
        <div className="relative overflow-hidden border-b border-[var(--color-border-secondary)] px-6 pb-6 pt-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_58%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_46%)]" />
          {mode !== 'progress' ? (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
              <Sparkles className="h-3.5 w-3.5" />
              {badge || config.badge}
            </span>
            <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--color-background-secondary)]">
              <Icon className={`h-7 w-7 ${config.iconClassName}`} />
            </div>
            <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              {title}
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--color-text-secondary)]">
              {description}
            </p>
          </div>
        </div>

        {normalizedDetails.length > 0 ? (
          <div className="border-b border-[var(--color-border-secondary)] px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {normalizedDetails.map((detail) => (
                <div
                  key={`${detail.label}-${detail.value}`}
                  className="rounded-[20px] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                    {detail.label}
                  </div>
                  <div className="mt-1 break-words text-sm font-semibold text-[var(--color-text-primary)]">
                    {detail.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showActions ? (
          <div className="flex flex-col gap-2 px-6 py-5 sm:flex-row sm:justify-end sm:gap-3">
            {secondaryAction ? (
              <Button
                variant={secondaryAction.variant ?? 'outline'}
                onClick={secondaryAction.onClick}
                loading={secondaryAction.loading}
                className="sm:min-w-[140px]"
              >
                {secondaryAction.label}
              </Button>
            ) : null}
            <Button
              variant={primaryAction?.variant ?? 'primary'}
              onClick={primaryAction?.onClick ?? onClose}
              loading={primaryAction?.loading}
              className="sm:min-w-[160px]"
            >
              {primaryAction?.label ?? 'Close'}
            </Button>
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="rounded-[18px] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3 text-sm text-[var(--color-text-tertiary)]">
              Please wait while we complete this action.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
