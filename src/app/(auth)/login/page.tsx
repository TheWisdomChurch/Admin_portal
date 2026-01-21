// src/app/(auth)/login/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { Checkbox } from '@/ui/Checkbox';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthContext } from '@/providers/AuthProviders';
import { Footer } from '@/components/Footer';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),

  // IMPORTANT: keep it REQUIRED to satisfy RHF resolver typing
  // default behavior is handled by useForm defaultValues
  rememberMe: z.boolean(),
});

type LoginFormData = z.infer<typeof loginSchema>;

function safeRedirect(raw: string | null): string {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/')) return '/dashboard';
  if (raw === '/login' || raw === '/register') return '/dashboard';
  return raw;
}

export default function LoginPage() {
  const { login, isLoading } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirm, setForgotConfirm] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [forgotLoading, setForgotLoading] = useState(false);

  const redirectPath = useMemo(
    () => safeRedirect(searchParams.get('redirect')),
    [searchParams]
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    mode: 'onSubmit',
  });

  const onSubmit: SubmitHandler<LoginFormData> = async (data) => {
    try {
      setServerError('');
      await login(data);

      toast.success('Login successful!');
      router.replace(redirectPath);
    } catch (err: any) {
      const errorMessage = err?.message || 'Login failed. Please try again.';
      setServerError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const resetForgotState = () => {
    setForgotEmail('');
    setForgotOtp('');
    setForgotPassword('');
    setForgotConfirm('');
    setForgotStep('email');
  };

  const handleForgotPassword = async () => {
    if (forgotStep === 'email') {
      if (!forgotEmail.trim()) {
        toast.error('Please enter your email address');
        return;
      }
      try {
        setForgotLoading(true);
        // TODO: hook to backend endpoint when available
        toast.success('OTP sent. Check your email.');
        setForgotStep('otp');
      } catch (err: any) {
        toast.error(err?.message || 'Failed to send OTP');
      } finally {
        setForgotLoading(false);
      }
      return;
    }

    if (forgotStep === 'otp') {
      if (!forgotOtp.trim()) {
        toast.error('Please enter the OTP code');
        return;
      }
      setForgotStep('reset');
      return;
    }

    if (!forgotPassword.trim() || !forgotConfirm.trim()) {
      toast.error('Please enter and confirm your new password');
      return;
    }
    if (forgotPassword !== forgotConfirm) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setForgotLoading(true);
      // TODO: hook to backend endpoint when available
      toast.success('Password updated successfully');
      setShowForgot(false);
      resetForgotState();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update password');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-white bg-black shadow-sm">
            <Image
              src="/OIP.webp"
              alt="Wisdom Church logo"
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          </div>
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">The Wisdom Church</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Administration Portal</p>
          </div>
        </Link>
        <Link href="/register">
          <Button variant="outline">Register as Admin</Button>
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="flex flex-col justify-center gap-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--color-text-tertiary)]">Secure Access</p>
          <h1 className="auth-hero-text font-display text-3xl font-semibold text-[var(--color-text-primary)] sm:text-4xl">
            The Wisdom Church Administration Portal
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] sm:text-base">
            Manage events, testimonies, and ministry updates with clarity and control.
          </p>
        </section>

        <Card className="auth-glass w-full max-w-md p-8">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-background-tertiary)] mb-4">
              <Lock className="h-7 w-7 text-[var(--color-accent-primary)]" />
            </div>
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Welcome Back</h2>
            <p className="text-[var(--color-text-tertiary)] mt-2 text-sm">Sign in to your account</p>
          </div>

          {serverError && (
            <div className="mb-6 rounded-[var(--radius-button)] border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600 whitespace-pre-line">{serverError}</p>
            </div>
          )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
          noValidate
          autoComplete="off"
        >
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--color-text-tertiary)]" />
              <Input
                type="email"
                placeholder="you@example.com"
                className="pl-10"
                {...register('email')}
                error={errors.email?.message}
                disabled={isLoading}
                autoFocus
                autoComplete="off"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--color-text-tertiary)]" />
              <Input
                type="password"
                placeholder="••••••••"
                className="pl-10"
                {...register('password')}
                error={errors.password?.message}
                disabled={isLoading}
                autoComplete="new-password"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Controller
              name="rememberMe"
              control={control}
              render={({ field }) => (
                <Checkbox
                  label="Remember me"
                  disabled={isLoading}
                  checked={!!field.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    field.onChange(e.target.checked)
                  }
                />
              )}
            />

            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setShowForgot(true);
              }}
              className="text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primaryhover)]"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isLoading}
            loading={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
            {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>

          <div className="mt-8 pt-6 border-t border-[var(--color-border-secondary)]">
            <p className="text-center text-sm text-[var(--color-text-tertiary)]">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primaryhover)] font-medium"
            >
              Create one
            </Link>
          </p>
          </div>
        </Card>
      </main>

      <Footer />

      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Reset Password</h2>
              <button
                type="button"
                onClick={() => {
                  setShowForgot(false);
                  resetForgotState();
                }}
                className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
              {forgotStep === 'email' && 'Enter your email address to receive an OTP.'}
              {forgotStep === 'otp' && 'Enter the OTP code sent to your email.'}
              {forgotStep === 'reset' && 'Set a new password for your account.'}
            </p>
            <div className="mt-4 space-y-4">
              {forgotStep === 'email' && (
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={forgotLoading}
                />
              )}
              {forgotStep === 'otp' && (
                <Input
                  type="text"
                  placeholder="Enter OTP"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  disabled={forgotLoading}
                />
              )}
              {forgotStep === 'reset' && (
                <>
                  <Input
                    type="password"
                    placeholder="New password"
                    value={forgotPassword}
                    onChange={(e) => setForgotPassword(e.target.value)}
                    disabled={forgotLoading}
                  />
                  <Input
                    type="password"
                    placeholder="Confirm password"
                    value={forgotConfirm}
                    onChange={(e) => setForgotConfirm(e.target.value)}
                    disabled={forgotLoading}
                  />
                </>
              )}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForgot(false);
                    resetForgotState();
                  }}
                  disabled={forgotLoading}
                >
                  Cancel
                </Button>
                <Button onClick={handleForgotPassword} loading={forgotLoading} disabled={forgotLoading}>
                  {forgotStep === 'email' && 'Send OTP'}
                  {forgotStep === 'otp' && 'Verify OTP'}
                  {forgotStep === 'reset' && 'Update Password'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
