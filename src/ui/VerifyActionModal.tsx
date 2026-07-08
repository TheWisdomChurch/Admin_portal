// src/ui/VerifyActionModal.tsx
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';

interface VerifyActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  verifyText: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  hint?: string;
  children?: ReactNode;
}

export function VerifyActionModal(props: VerifyActionModalProps) {
  const normalizedVerifyText = useMemo(() => props.verifyText.trim(), [props.verifyText]);

  if (!props.isOpen) return null;

  return (
    <VerifyActionModalContent
      key={normalizedVerifyText || props.title}
      {...props}
      normalizedVerifyText={normalizedVerifyText}
    />
  );
}

function VerifyActionModalContent({
  onClose,
  onConfirm,
  title,
  description,
  normalizedVerifyText,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  loading = false,
  hint,
  children,
}: VerifyActionModalProps & { normalizedVerifyText: string }) {
  const [inputValue, setInputValue] = useState('');
  const [copied, setCopied] = useState(false);

  const canConfirm =
    normalizedVerifyText.length === 0 || inputValue.trim() === normalizedVerifyText;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(normalizedVerifyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal open onClose={onClose} labelledBy="verify-action-modal-title">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="verify-action-modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
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

        <div className="mt-4 space-y-2">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {hint || 'Copy and paste the confirmation text below to proceed.'}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm font-mono text-[var(--color-text-secondary)]">
              {normalizedVerifyText}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!normalizedVerifyText}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Paste confirmation text here"
          />
        </div>

        <div className="flex items-center gap-3 mt-6">
          <Button
            onClick={onConfirm}
            variant={variant}
            loading={loading}
            disabled={!canConfirm || loading}
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
