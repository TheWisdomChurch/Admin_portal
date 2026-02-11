// src/app/(auth)/passwordreset/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, type SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ArrowRight, CheckCircle, Lock, Mail, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import { Footer } from '@/components/Footer';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { PasswordStrengthMeter } from '@/ui/PasswordStrengthMeter';
import { apiClient } from '@/lib/api';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';

type ResetFormData = {
  newPassword: string;
  confirmPassword: string;
};

const schema = yup
  .object({
    newPassword: yup.string().min(8, 'Password must be at least 8 characters').required('New password is required'),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref('newPassword')], 'Passwords must match')
      .required('Confirm password is required'),
  })
  .required();

const RESET_STORAGE = {
  email: 'reset_email',
  code: 'reset_otp',
  purpose: 'reset_purpose',
};

export default function PasswordResetPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [purpose, setPurpose] = useState('password_reset');
  const [step, setStep] = useState<'verify' | 'reset' | 'success'>('verify');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onSubmit',
  });

  const newPassword = useWatch({ control, name: 'newPassword' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedEmail = sessionStorage.getItem(RESET_STORAGE.email) || '';
    const storedCode = sessionStorage.getItem(RESET_STORAGE.code) || '';
    const storedPurpose = sessionStorage.getItem(RESET_STORAGE.purpose) || 'password_reset';

    if (storedEmail) setEmail(storedEmail);
    if (storedCode) setCode(storedCode);
    if (storedPurpose) setPurpose(storedPurpose);

    setStep(storedEmail && storedCode ? 'reset' : 'verify');
  }, []);

  const clearResetSession = () => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(RESET_STORAGE.email);
    sessionStorage.removeItem(RESET_STORAGE.code);
    sessionStorage.removeItem(RESET_STORAGE.purpose);
  };

  const handleVerifyOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    if (!trimmedEmail) {
      toast.error('Enter your email address.');
      return;
    }
    if (trimmedCode.length < 6) {
      toast.error('Enter the 6-digit code sent to your email.');
      return;
    }

    setServerError('');
    try {
      setVerifyLoading(true);
      await apiClient.verifyOtp({
        email: trimmedEmail,
        code: trimmedCode,
        purpose: 'password_reset',
      });

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(RESET_STORAGE.email, trimmedEmail);
        sessionStorage.setItem(RESET_STORAGE.code, trimmedCode);
        sessionStorage.setItem(RESET_STORAGE.purpose, 'password_reset');
      }

      toast.success('Code verified. Set your new password.');
      setStep('reset');
    } catch (err) {
      const fieldErrors = extractServerFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        toast.error(getFirstServerFieldError(fieldErrors) || 'Check the code and try again.');
        return;
      }
      const message = getServerErrorMessage(err, 'Failed to verify code');
      setServerError(message);
      toast.error(message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast.error('Enter your email address to resend a code.');
      return;
    }

    try {
      setVerifyLoading(true);
      await apiClient.requestPasswordReset({ email: trimmedEmail });
      toast.success('A new code has been sent to your email.');
    } catch (err) {
      toast.error(getServerErrorMessage(err, 'Failed to resend code'));
    } finally {
      setVerifyLoading(false);
    }
  };

  const onSubmit: SubmitHandler<ResetFormData> = async (data) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    if (!trimmedEmail || !trimmedCode) {
      toast.error('Please verify your code before setting a new password.');
      setStep('verify');
      return;
    }

    setServerError('');
    try {
      setSubmitLoading(true);
      await apiClient.confirmPasswordReset({
        email: trimmedEmail,
        code: trimmedCode,
        purpose: purpose || 'password_reset',
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });

      clearResetSession();
      reset();
      setStep('success');
      toast.success('Password updated successfully.');
    } catch (err) {
      const fieldErrors = extractServerFieldErrors(err);
      const mapped: Record<string, keyof ResetFormData> = {
        newPassword: 'newPassword',
        new_password: 'newPassword',
        password: 'newPassword',
        confirmPassword: 'confirmPassword',
        confirm_password: 'confirmPassword',
      };

      Object.entries(fieldErrors).forEach(([field, message]) => {
        const target = mapped[field];
        if (target) setError(target, { type: 'server', message });
      });

      const message = getServerErrorMessage(err, 'Failed to update password');
      setServerError(message);

      if (message.toLowerCase().includes('otp')) {
        setStep('verify');
      }

      toast.error(message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const stepLabel = useMemo(() => {
    if (step === 'verify') return 'Verify your code';
    if (step === 'reset') return 'Set a new password';
    return 'Password updated';
  }, [step]);

  return (
    <div className="auth-shell">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-white bg-black shadow-sm">
            <Image src="/OIP.webp" alt="Wisdom Church logo" width={40} height={40} className="rounded-full object-cover" />
          </div>
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">The Wisdom Church</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Administration Portal</p>
          </div>
        </Link>
        <Link href="/login">
          <Button variant="outline">Back to Login</Button>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden lg:block">
            <div className="auth-glass h-full rounded-3xl p-10 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)]">
                <ShieldCheck className="h-7 w-7 text-[var(--color-accent-primary)]" />
              </div>
              <h1 className="mt-6 text-3xl font-semibold text-[var(--color-text-primary)]">Secure password reset</h1>
              <p className="mt-3 text-[var(--color-text-secondary)]">
                Verify your code, set a strong password, and regain access to your admin account.
              </p>
              <div className="mt-6 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 text-xs text-[var(--color-text-tertiary)]">
                <p>Step 1: Confirm the one-time code</p>
                <p>Step 2: Set your new password</p>
              </div>
            </div>
          </div>

          <Card className="auth-glass w-full rounded-3xl p-8 shadow-lg">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)]">
                {step === 'success' ? (
                  <CheckCircle className="h-8 w-8 text-[var(--color-accent-success)]" />
                ) : (
                  <Lock className="h-8 w-8 text-[var(--color-accent-primary)]" />
                )}
              </div>
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">{stepLabel}</h2>
              <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                {step === 'verify' && 'Enter the code sent to your inbox to continue.'}
                {step === 'reset' && 'Choose a strong password you have not used before.'}
                {step === 'success' && 'Your password has been updated. You can sign in again.'}
              </p>
            </div>

            {serverError && (
              <div className="mt-6 rounded-[var(--radius-button)] border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700 whitespace-pre-line">{serverError}</p>
              </div>
            )}

            {step === 'verify' && (
              <div className="mt-6 space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={verifyLoading}
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <Input
                  label="Verification code"
                  type="text"
                  placeholder="Enter the 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={verifyLoading}
                  inputMode="numeric"
                />
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Button variant="outline" onClick={handleResendOtp} disabled={verifyLoading}>
                    Resend code
                  </Button>
                  <Button onClick={handleVerifyOtp} loading={verifyLoading} disabled={verifyLoading}>
                    Verify code
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 'reset' && (
              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
                <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    <span className="font-medium text-[var(--color-text-primary)]">{email || 'Verified email'}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Resetting password for this account.</p>
                </div>

                <Input
                  label="New password"
                  type="password"
                  placeholder="Enter a strong password"
                  autoComplete="new-password"
                  {...register('newPassword')}
                  error={errors.newPassword?.message}
                  disabled={submitLoading}
                />
                <PasswordStrengthMeter password={newPassword || ''} />

                <Input
                  label="Confirm password"
                  type="password"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  error={errors.confirmPassword?.message}
                  disabled={submitLoading}
                />

                <Button type="submit" loading={submitLoading} disabled={submitLoading} className="w-full">
                  Update Password
                </Button>
              </form>
            )}

            {step === 'success' && (
              <div className="mt-6 space-y-4">
                <Button className="w-full" onClick={() => router.push('/login')}>
                  Back to Login
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    clearResetSession();
                    setEmail('');
                    setCode('');
                    setStep('verify');
                  }}
                >
                  Reset another account
                </Button>
              </div>
            )}
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
