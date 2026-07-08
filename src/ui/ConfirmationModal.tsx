// src/ui/ConfirmationModal.tsx
'use client';

import { X } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  loading = false,
  children,
}: ConfirmationModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} labelledBy="confirmation-modal-title">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="confirmation-modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-[var(--color-text-secondary)] mb-4">{description}</p>

        {children}

        <div className="flex items-center gap-3 mt-6">
          <Button
            onClick={onConfirm}
            variant={variant}
            loading={loading}
            disabled={loading}
            className="flex-1"
          >
            {confirmText}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            disabled={loading}
            className="flex-1"
          >
            {cancelText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
