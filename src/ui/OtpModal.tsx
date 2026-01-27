'use client';

import { X, ShieldCheck, Mail, KeyRound } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';

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
  confirmText?: string;
  requestText?: string;
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
  confirmText = 'Verify & continue',
  requestText = 'Send code',
}: OtpModalProps) {
  if (!open) return null;

  const isEmailStep = step === 'email';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">Two-factor check</p>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">{otpLabel}</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                <Input
                  value={code}
                  onChange={(e) => onCodeChange(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="pl-10 text-center tracking-[0.4em]"
                  placeholder="••••••"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)]">Check your inbox for the code. It expires shortly.</p>
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
              <Button
                onClick={onVerifyOtp}
                loading={loading}
                className="sm:min-w-[180px]"
              >
                {confirmText}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
