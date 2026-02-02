// src/app/(auth)/login/page.tsx
'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, ArrowRight, AlertTriangle, UserPlus } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { Checkbox } from '@/ui/Checkbox';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthContext } from '@/providers/AuthProviders';
import { Footer } from '@/components/Footer';
import { OtpModal } from '@/ui/OtpModal';
import { apiClient } from '@/lib/api';
import { AlertModal } from '@/ui/AlertModal';
import type { ApiError } from '@/lib/api';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';

type LoginFormData = {
  email: string;
  password: string;
  rememberMe: boolean;
};

function safeRedirect(raw: string | null): string {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/')) return '/dashboard';
  if (raw === '/login' || raw === '/register') return '/dashboard';
  return raw;
}

function LoginInner() {
  const { checkAuth, isLoading } = useAuthContext();
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

  const [otpOpen, setOtpOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'otp'>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<LoginFormData | null>(null);
  const [challengePurpose, setChallengePurpose] = useState<string>('');

  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    mode: 'bad_password' | 'not_found' | 'generic';
  }>({ open: false, title: '', description: '', mode: 'generic' });

  const redirectPath = useMemo(() => safeRedirect(searchParams.get('redirect')), [searchParams]);

  const {
    register,
    control,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    mode: 'onSubmit',
  });

  const onSubmit: SubmitHandler<LoginFormData> = async (data) => {
    clearErrors();
    setServerError('');

    try {
      setPendingLogin(data);
      setOtpEmail(data.email);
      setOtpLoading(true);

      const result = await apiClient.login(data);

      // If backend says OTP required
      if ('otp_required' in result && result.otp_required) {
        setChallengePurpose(result.purpose || 'login');
        setOtpStep('otp');
        setOtpOpen(true);
        toast.success('A verification code was sent to your email');
        return;
      }

      // Otherwise authenticated
      await checkAuth();
      toast.success('Login successful!');
      router.replace(redirectPath);
    } catch (err) {
      const apiErr = err as ApiError;
      const status = apiErr.statusCode ?? 0;

      if (status === 400 || status === 422) {
        const fieldErrors = extractServerFieldErrors(apiErr);
        let applied = false;

        (Object.entries(fieldErrors) as Array<[keyof LoginFormData, string]>).forEach(([field, message]) => {
          if (field in data) {
            applied = true;
            setError(field, { type: 'server', message });
          }
        });

        if (!applied) {
          setServerError(getServerErrorMessage(apiErr, 'Unable to sign in right now.'));
        }
        return;
      }

      if (status === 404) {
        setErrorModal({
          open: true,
          title: 'Account not found',
          description:
            'No account exists for that email. You can register for access. Admin signups require super-admin approval.',
          mode: 'not_found',
        });
      } else if (status === 401) {
        setErrorModal({
          open: true,
          title: 'Incorrect password',
          description: 'The email exists, but the password is incorrect. You can retry or reset your password.',
          mode: 'bad_password',
        });
      } else {
        const message = apiErr?.message || 'Unable to sign in right now.';
        setErrorModal({
          open: true,
          title: 'Login failed',
          description: message,
          mode: 'generic',
        });
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const requestOtp = async () => {
    toast.success('Check your email for the code we just sent.');
    setOtpStep('otp');
  };

  const verifyOtpAndLogin = async () => {
    if (!pendingLogin) {
      toast.error('Please restart the login process');
      setOtpOpen(false);
      return;
    }

    try {
      setOtpLoading(true);
      await apiClient.verifyLoginOtp({
        email: otpEmail.trim(),
        code: otpCode.trim(),
        purpose: challengePurpose || 'login',
        rememberMe: pendingLogin.rememberMe,
      });

      await checkAuth();
      toast.success('Login verified');
      setOtpOpen(false);
      setOtpCode('');
      router.replace(redirectPath);
    } catch (err) {
      const apiErr = err as ApiError;
      const status = apiErr.statusCode ?? 0;

      if (status === 400 || status === 422) {
        const fieldErrors = extractServerFieldErrors(apiErr);
        if (Object.keys(fieldErrors).length > 0) {
          toast.error(getFirstServerFieldError(fieldErrors) || 'Please check the code and try again.');
          return;
        }
      }

      if (status === 404) {
        setErrorModal({
          open: true,
          title: 'Account not found',
          description:
            'We couldn’t find a user with that email. You can register for access. Admin signups require super-admin approval.',
          mode: 'not_found',
        });
      } else if (status === 401) {
        setErrorModal({
          open: true,
          title: 'Incorrect password',
          description: 'The email exists, but the password is incorrect. You can retry or reset your password.',
          mode: 'bad_password',
        });
      } else {
        const message = apiErr?.message || 'Verification failed';
        setErrorModal({
          open: true,
          title: 'Unable to sign in',
          description: message,
          mode: 'generic',
        });
      }
    } finally {
      setOtpLoading(false);
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
    try {
      setForgotLoading(true);

      if (forgotStep === 'email') {
        await apiClient.requestPasswordReset({ email: forgotEmail.trim() });
        toast.success('Password reset code sent. Check your email.');
        setForgotStep('otp');
        return;
      }

      if (forgotStep === 'otp') {
        await apiClient.verifyOtp({
          email: forgotEmail.trim(),
          code: forgotOtp.trim(),
          purpose: 'password_reset',
        });
        toast.success('Code verified. Set a new password.');
        setForgotStep('reset');
        return;
      }

      await apiClient.confirmPasswordReset({
        email: forgotEmail.trim(),
        code: forgotOtp.trim(),
        purpose: 'password_reset',
        newPassword: forgotPassword,
        confirmPassword: forgotConfirm,
      });
      toast.success('Password reset successfully. You can sign in now.');
      setShowForgot(false);
      resetForgotState();
    } catch (err) {
      const fieldErrors = extractServerFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        toast.error(getFirstServerFieldError(fieldErrors) || 'Please review the highlighted fields.');
        return;
      }
      const message = getServerErrorMessage(err, 'Failed to update password');
      toast.error(message);
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

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate autoComplete="off">
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
                  {...register('email', {
                    onChange: () => {
                      setServerError('');
                      clearErrors('email');
                    },
                  })}
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
                  {...register('password', {
                    onChange: () => {
                      setServerError('');
                      clearErrors('password');
                    },
                  })}
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setServerError('');
                      clearErrors('rememberMe');
                      field.onChange(e.target.checked);
                    }}
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

            <Button type="submit" variant="primary" className="w-full" disabled={isLoading} loading={isLoading}>
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

      <OtpModal
        open={otpOpen}
        step={otpStep}
        email={otpEmail}
        code={otpCode}
        onEmailChange={setOtpEmail}
        onCodeChange={setOtpCode}
        onRequestOtp={requestOtp}
        onVerifyOtp={verifyOtpAndLogin}
        onClose={() => {
          setOtpOpen(false);
          setOtpCode('');
          setOtpStep('email');
        }}
        loading={otpLoading || isLoading}
        title="Two-factor login"
        subtitle={otpStep === 'email' ? 'Confirm your email to receive a one-time code.' : `Enter the code we sent to ${otpEmail}.`}
        confirmText="Verify & sign in"
        requestText="Send login code"
      />

      <AlertModal
        open={errorModal.open}
        title={errorModal.title}
        description={errorModal.description}
        icon={
          errorModal.mode === 'not_found' ? <UserPlus className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />
        }
        onClose={() => setErrorModal({ ...errorModal, open: false })}
        secondaryAction={{
          label: 'Try again',
          variant: 'outline',
          onClick: () => setErrorModal({ ...errorModal, open: false }),
        }}
        primaryAction={{
          label: errorModal.mode === 'not_found' ? 'Register' : errorModal.mode === 'bad_password' ? 'Reset password' : 'Try again',
          onClick: () => {
            setErrorModal({ ...errorModal, open: false });
            if (errorModal.mode === 'not_found') {
              router.push('/register');
            } else if (errorModal.mode === 'bad_password') {
              setForgotEmail(otpEmail || pendingLogin?.email || '');
              setShowForgot(true);
              setForgotStep('email');
            }
          },
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  // ✅ Required by Next when using useSearchParams()
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
