'use client';

import { X } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

interface AlertAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'warning';
  loading?: boolean;
}

interface AlertModalProps {
  open: boolean;
  title: string;
  description: string;
  icon?: React.ReactNode;
  onClose: () => void;
  primaryAction?: AlertAction;
  secondaryAction?: AlertAction;
}

export function AlertModal({
  open,
  title,
  description,
  icon,
  onClose,
  primaryAction,
  secondaryAction,
}: AlertModalProps) {
  return (
    <Modal open={open} onClose={onClose} overlayClassName="bg-black/45" labelledBy="alert-modal-title">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-secondary)]">
        <div className="flex items-center gap-3">
          {icon && <div className="h-10 w-10 rounded-xl bg-[var(--color-background-tertiary)] flex items-center justify-center text-[var(--color-accent-primary)]">{icon}</div>}
          <h3 id="alert-modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 hover:bg-[var(--color-background-hover)]"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
        </button>
      </div>

      <div className="px-5 py-5 space-y-4">
        <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant ?? 'outline'}
              onClick={secondaryAction.onClick}
              className="sm:min-w-[120px]"
              loading={secondaryAction.loading}
            >
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button
              variant={primaryAction.variant ?? 'primary'}
              onClick={primaryAction.onClick}
              className="sm:min-w-[140px]"
              loading={primaryAction.loading}
            >
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
