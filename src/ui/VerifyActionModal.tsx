// src/ui/VerifyActionModal.tsx
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { Button } from '@/ui/Button';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-gray-600 mb-4">{description}</p>

          {children}

          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-500">
              {hint || 'Copy and paste the confirmation text below to proceed.'}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-700">
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
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Paste confirmation text here"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
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
      </div>
    </div>
  );
}
