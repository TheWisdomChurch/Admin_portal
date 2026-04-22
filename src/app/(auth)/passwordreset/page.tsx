'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, type SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ArrowRight, CheckCircle, Lock, Mail, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

function PasswordResetInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
    const queryEmail = (searchParams.get('email') || '').trim().toLowerCase();
    const queryCode = (searchParams.get('code') || '').trim();
    const queryPurpose = (searchParams.get('purpose') || 'password_reset').trim();

    if (queryEmail) setEmail(queryEmail);
    if (queryCode) setCode(queryCode);
    if (queryPurpose) setPurpose(queryPurpose);

    setStep(queryEmail && queryCode ? 'reset' : 'verify');
  }, [searchParams]);

  const handleVerifyOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    if (!trimmedEmail) {
      toast.error('Enter your email address.');
      return;
    }
    if (trimmedCode.length < 6) {
      toast.error('Enter the 6-digit verification code.');
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

      router.replace(
        `/passwordreset?email=${encodeURIComponent(trimmedEmail)}&code=${encodeURIComponent(trimmedCode)}&purpose=password_reset`
      );

      setStep('reset');
      toast.success('Code verified. Set your new password.');
    } catch (err) {
      const fieldErrors = extractServerFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        toast.error(getFirstServerFieldError(fieldErrors) || 'Check the code and try again.');
        return;
      }

      const message = getServerErrorMessage(err, 'Failed to verify code.');
      setServerError(message);
      toast.error(message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast.error('Enter your email address to resend code.');
      return;
    }

    try {
      setVerifyLoading(true);
      await apiClient.requestPasswordReset({ email: trimmedEmail });
      toast.success('A new code has been sent to your email.');
    } catch (err) {
      toast.error(getServerErrorMessage(err, 'Failed to resend code.'));
    } finally {
      setVerifyLoading(false);
    }
  };

  const onSubmit: SubmitHandler<ResetFormData> = async (data: ResetFormData) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    if (!trimmedEmail || !trimmedCode) {
      toast.error('Verify your code before setting a new password.');
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

      const message = getServerErrorMessage(err, 'Failed to update password.');
      setServerError(message);
      if (message.toLowerCase().includes('otp')) setStep('verify');
      toast.error(message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const stepLabel = useMemo(() => {
    if (step === 'verify') return 'Verify reset code';
    if (step === 'reset') return 'Set new password';
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

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
        <section className="auth-glass rounded-3xl p-8 sm:p-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">Recovery</p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text-primary)] sm:text-4xl">Secure password recovery</h1>
          <p className="mt-4 max-w-xl text-sm text-[var(--color-text-secondary)] sm:text-base">
            Complete verification, then set a strong password to restore account access.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Step 1</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Verify the one-time code sent to your email.</p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Step 2</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Set a new password and continue to login.</p>
            </div>
          </div>
        </section>

        <Card className="auth-glass rounded-3xl p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)]">
              {step === 'success' ? (
                <CheckCircle className="h-7 w-7 text-[var(--color-accent-success)]" />
              ) : (
                <Lock className="h-7 w-7 text-[var(--color-accent-primary)]" />
              )}
            </div>
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">{stepLabel}</h2>
            <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
              {step === 'verify' && 'Enter your email and 6-digit code.'}
              {step === 'reset' && 'Choose a strong new password.'}
              {step === 'success' && 'Password updated successfully.'}
            </p>
          </div>

          {serverError ? (
            <div className="mt-5 rounded-[var(--radius-button)] border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          ) : null}

          {step === 'verify' ? (
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <Input
                    type="email"
                    className="pl-10"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={verifyLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <Input
                label="Verification code"
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={verifyLoading}
                inputMode="numeric"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" onClick={handleResendOtp} disabled={verifyLoading}>
                  Resend code
                </Button>
                <Button onClick={handleVerifyOtp} loading={verifyLoading} disabled={verifyLoading}>
                  Verify code
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {step === 'reset' ? (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs text-[var(--color-text-tertiary)]">Resetting account</p>
                <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">{email || 'Verified email'}</p>
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

              <Button type="submit" className="w-full" loading={submitLoading} disabled={submitLoading}>
                Update password
              </Button>
            </form>
          ) : null}

          {step === 'success' ? (
            <div className="mt-6 space-y-3">
              <Button className="w-full" onClick={() => router.push('/login')}>
                Back to login
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEmail('');
                  setCode('');
                  setServerError('');
                  setStep('verify');
                }}
              >
                Reset another account
              </Button>
            </div>
          ) : null}
        </Card>
      </main>

      <Footer />
    </div>
  );
}

export default function PasswordResetPage() {
  return (
    <Suspense fallback={null}>
      <PasswordResetInner />
    </Suspense>
  );
}
