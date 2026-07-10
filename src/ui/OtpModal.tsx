'use client';

import { useEffect, useRef } from 'react';
import { X, ShieldCheck, Mail } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { OtpInput, type OtpInputHandle } from '@/ui/OtpInput';

type Step = 'email' | 'otp';

interface OtpModalProps {
  open: boolean;
  step: Step;
  email: string;
  code: string;
  loading?: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onEmailChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onRequestOtp: () => void | Promise<void>;
  onVerifyOtp: () => void | Promise<void>;
  emailLabel?: string;
  otpLabel?: string;
  otpHint?: string;
  confirmText?: string;
  requestText?: string;
  secondaryActionText?: string;
  onSecondaryAction?: () => void | Promise<void>;
}

export function OtpModal({
  open,
  step,
  email,
  code,
  loading = false,
  title = 'Verify your access',
  subtitle = 'A verification code will be sent to your registered email.',
  onClose,
  onEmailChange,
  onCodeChange,
  onRequestOtp,
  onVerifyOtp,
  emailLabel = 'Email address',
  otpLabel = 'Enter the 6-digit code',
  otpHint = 'Check your inbox for the code. It expires shortly.',
  confirmText = 'Verify & continue',
  requestText = 'Send code',
  secondaryActionText,
  onSecondaryAction,
}: OtpModalProps) {
  const isEmailStep = step === 'email';
  const emailInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<OtpInputHandle>(null);

  // Modal only autofocuses once on open; this step switches in place (no
  // remount), so refocus the newly-shown field whenever the step changes —
  // otherwise the code input appears without focus and requires a click.
  useEffect(() => {
    if (!open) return;
    const target = isEmailStep ? emailInputRef.current : otpInputRef.current;
    target?.focus();
  }, [open, isEmailStep]);

  const handleOtpComplete = () => {
    if (loading) return;
    void onVerifyOtp();
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="otp-modal-title">
      <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">Two-factor check</p>
          <h3 id="otp-modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 hover:bg-[var(--color-background-hover)]"
          aria-label="Close"
          disabled={loading}
        >
          <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
        </button>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
          {isEmailStep ? <Mail className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">{subtitle}</p>

          {isEmailStep ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">{emailLabel}</label>
              <Input
                ref={emailInputRef}
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                type="email"
                placeholder="you@example.com"
                autoComplete="off"
                inputMode="email"
                autoCapitalize="none"
                disabled={loading}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">{otpLabel}</label>
              <OtpInput
                ref={otpInputRef}
                value={code}
                onChange={onCodeChange}
                onComplete={handleOtpComplete}
                disabled={loading}
              />
              <p className="text-xs text-[var(--color-text-tertiary)]">{otpHint}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="sm:min-w-[120px]"
            >
              Cancel
            </Button>
            {isEmailStep ? (
              <Button
                onClick={onRequestOtp}
                loading={loading}
                className="sm:min-w-[160px]"
              >
                {requestText}
              </Button>
            ) : (
              <>
                {secondaryActionText && onSecondaryAction ? (
                  <Button
                    variant="outline"
                    onClick={onSecondaryAction}
                    disabled={loading}
                    className="sm:min-w-[160px]"
                  >
                    {secondaryActionText}
                  </Button>
                ) : null}
                <Button
                  onClick={onVerifyOtp}
                  loading={loading}
                  className="sm:min-w-[180px]"
                >
                  {confirmText}
                </Button>
              </>
            )}
          </div>
        </div>
    </Modal>
  );
}
