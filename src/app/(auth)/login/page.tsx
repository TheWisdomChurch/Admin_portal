// src/app/(auth)/login/page.tsx
'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useForm, Controller, type ControllerRenderProps, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, ArrowRight, UserPlus, AlertTriangle, Chrome } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { Checkbox } from '@/ui/Checkbox';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthContext } from '@/providers/AuthProviders';
import { Footer } from '@/components/Footer';
import { apiClient, getAuthRememberPreference, setAuthRememberPreference } from '@/lib/api';
import { getConfiguredAuthIdentityProviders } from '@/lib/authProviders';
import type { ApiError } from '@/lib/api';
import {
  extractServerFieldErrors,
  getFirstServerFieldError,
  getServerErrorCode,
  getServerErrorMessage,
} from '@/lib/serverValidation';
import { loginSchema, type LoginFormSchema } from '@/lib/validation/auth';
import { OtpModal } from '@/ui/OtpModal';
import { AlertModal } from '@/ui/AlertModal';
import type { MFAMethod } from '@/lib/types';

type LoginFormData = LoginFormSchema;

function ProviderIcon({ providerId }: { providerId: string }) {
  if (providerId === 'google') {
    return <Chrome className="h-4 w-4" aria-hidden="true" />;
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2C6.5 2 2 6.2 2 11.6c0 4.9 3.6 9 8.3 9.8v-7h-2.5V11.6h2.5V9.5c0-2.4 1.5-3.8 3.7-3.8 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.7-1.6 1.5v1.8h2.7l-.4 2.8h-2.3v7C18.4 20.6 22 16.5 22 11.6 22 6.2 17.5 2 12 2Z" />
    </svg>
  );
}

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
  const [forgotStep, setForgotStep] = useState<'email' | 'otp'>('email');
  const [forgotLoading, setForgotLoading] = useState(false);

  const [otpOpen, setOtpOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'otp'>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<LoginFormData | null>(null);
  const [challengePurpose, setChallengePurpose] = useState<string>('');
  const [challengeMethod, setChallengeMethod] = useState<MFAMethod>('email_otp');

  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    mode: 'bad_password' | 'not_found' | 'generic';
  }>({ open: false, title: '', description: '', mode: 'generic' });

  const portalMode = useMemo(
    () => (searchParams.get('portal') === 'super' ? 'super' : 'admin'),
    [searchParams]
  );
  const redirectPath = useMemo(() => {
    const raw = searchParams.get('redirect');
    if (!raw) {
      return portalMode === 'super' ? '/dashboard/super' : '/dashboard';
    }
    return safeRedirect(raw);
  }, [searchParams, portalMode]);

  const {
    register,
    control,
    handleSubmit,
    clearErrors,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    mode: 'onSubmit',
    resolver: zodResolver(loginSchema),
  });

  const rememberMe = watch('rememberMe');
  const identityProviders = useMemo(
    () => getConfiguredAuthIdentityProviders({ rememberMe: !!rememberMe }) ?? [],
    [rememberMe]
  );

  useEffect(() => {
    setValue('rememberMe', getAuthRememberPreference(), { shouldDirty: false });
  }, [setValue]);
  const onSubmit: SubmitHandler<LoginFormData> = async (data: LoginFormData) => {
    clearErrors();
    setServerError('');

    try {
      setPendingLogin(data);
      setOtpEmail(data.email.trim().toLowerCase());
      setOtpLoading(true);
      setAuthRememberPreference(!!data.rememberMe);

      const result = await apiClient.login({
        ...data,
        email: data.email.trim().toLowerCase(),
      });

      if ('otp_required' in result && result.otp_required) {
        const method = result.mfa_method ?? 'email_otp';
        setChallengeMethod(method);
        setChallengePurpose(result.purpose || 'login');
        setOtpStep('otp');
        setOtpOpen(true);
        toast.success(
          method === 'totp'
            ? 'Enter the current code from your authenticator app.'
            : 'A verification code was sent to your email.'
        );
        return;
      }

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

        if (!applied) setServerError(getServerErrorMessage(apiErr, 'Unable to sign in right now.'));
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
      } else if (status === 403) {
        const code = getServerErrorCode(apiErr);
        if (code === 'admin_mfa_required' || code === 'admin_totp_session_required') {
          setErrorModal({
            open: true,
            title: 'MFA setup required',
            description:
              'Your account needs TOTP authenticator MFA for admin access. Sign in and complete MFA setup in Security Settings.',
            mode: 'generic',
          });
          return;
        }
        setErrorModal({
          open: true,
          title: 'Access denied',
          description: apiErr?.message || 'Your account does not have access to this portal.',
          mode: 'generic',
        });
      } else {
        setErrorModal({
          open: true,
          title: 'Login failed',
          description: apiErr?.message || 'Unable to sign in right now.',
          mode: 'generic',
        });
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const requestOtp = async () => {
    if (!pendingLogin) {
      toast.error('Please submit your email and password first.');
      return;
    }
    if (challengeMethod !== 'email_otp') {
      toast.error('Use the authenticator app to generate a code for this sign-in.');
      return;
    }

    try {
      setOtpLoading(true);
      const result = await apiClient.resendLoginOtp({
        email: otpEmail.trim().toLowerCase(),
      });
      setChallengeMethod(result.mfa_method ?? 'email_otp');
      setChallengePurpose(result.purpose || 'login');
      setOtpStep('otp');
      toast.success('A fresh verification code was sent to your email.');
    } catch (err) {
      toast.error(getServerErrorMessage(err, 'Failed to resend the login code'));
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtpAndLogin = async () => {
    if (!pendingLogin) {
      toast.error('Please restart the login process');
      setOtpOpen(false);
      return;
    }

    try {
      setOtpLoading(true);
      setAuthRememberPreference(!!pendingLogin.rememberMe);

      await apiClient.verifyLoginOtp({
        email: otpEmail.trim().toLowerCase(),
        code: otpCode.trim(),
        purpose: challengePurpose || 'login',
        method: challengeMethod,
        rememberMe: pendingLogin.rememberMe,
      });

      const me = await checkAuth();

      if (!me) {
        toast.error('Login verified, but session was not established. Please refresh.');
        return;
      }

      toast.success('Login verified');
      setOtpOpen(false);
      setOtpCode('');
      setChallengeMethod('email_otp');
      router.replace(redirectPath);
    } catch (err) {
      const fieldErrors = extractServerFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        toast.error(getFirstServerFieldError(fieldErrors) || 'Please check the code and try again.');
        return;
      }
      toast.error(getServerErrorMessage(err, 'Verification failed'));
    } finally {
      setOtpLoading(false);
    }
  };

  const resetForgotState = () => {
    setForgotEmail('');
    setForgotOtp('');
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
        const trimmedEmail = forgotEmail.trim().toLowerCase();
        const trimmedCode = forgotOtp.trim();
        await apiClient.verifyOtp({
          email: trimmedEmail,
          code: trimmedCode,
          purpose: 'password_reset',
        });
        toast.success('Code verified. Set a new password.');
        setShowForgot(false);
        resetForgotState();
        router.push(
          `/passwordreset?email=${encodeURIComponent(trimmedEmail)}&code=${encodeURIComponent(trimmedCode)}&purpose=password_reset`
        );
        return;
      }
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
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {portalMode === 'super' ? 'Super Admin Console' : 'Administration Portal'}
            </p>
          </div>
        </Link>
        {portalMode === 'admin' ? (
          <Link href="/register">
            <Button variant="outline">Register as Admin</Button>
          </Link>
        ) : (
          <Link href="/login?redirect=%2Fdashboard">
            <Button variant="outline">Admin Login</Button>
          </Link>
        )}
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="flex flex-col justify-center gap-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--color-text-tertiary)]">
            {portalMode === 'super' ? 'Super Admin Access' : 'Secure Access'}
          </p>
          <h1 className="auth-hero-text font-display text-3xl font-semibold text-[var(--color-text-primary)] sm:text-4xl">
            {portalMode === 'super'
              ? 'The Wisdom Church Super Admin Console'
              : 'The Wisdom Church Administration Portal'}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] sm:text-base">
            {portalMode === 'super'
              ? 'Oversee approvals, security-sensitive operations, reports, and platform-wide analytics.'
              : 'Manage events, testimonies, and ministry updates with clarity and control.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                {portalMode === 'super' ? 'Elevated Access' : 'Access Control'}
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Password sign-in is protected with a one-time verification code before the session is established.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Trusted Devices</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Use Remember me only on secure devices you control. Session persistence remains optional.
              </p>
            </div>
          </div>
        </section>

        <Card className="auth-glass w-full max-w-md p-8">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-background-tertiary)] mb-4">
              <Lock className="h-7 w-7 text-[var(--color-accent-primary)]" />
            </div>
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Welcome Back</h2>
            <p className="text-[var(--color-text-tertiary)] mt-2 text-sm">
              {portalMode === 'super' ? 'Sign in as super admin' : 'Sign in to your account'}
            </p>
          </div>

          {serverError && (
            <div className="mb-6 rounded-[var(--radius-button)] border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600 whitespace-pre-line">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate autoComplete="on">
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
                  autoComplete="email"
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
                  autoComplete="current-password"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Controller
                name="rememberMe"
                control={control}
                render={({ field }: { field: ControllerRenderProps<LoginFormData, 'rememberMe'> }) => (
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
                  resetForgotState();
                  setForgotEmail((getValues('email') || '').trim());
                  setShowForgot(true);
                }}
                className="text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primaryhover)]"
              >
                Forgot password?
              </Link>
            </div>

            <p className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
              Enterprise security is enabled: password sign-in is verified with email OTP or an authenticator app.
            </p>

            <Button type="submit" variant="primary" className="w-full" disabled={isLoading} loading={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>

            {identityProviders.length > 0 ? (
              <div className="space-y-3">
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--color-border-secondary)]" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {identityProviders.map((provider) => (
                    <Button
                      key={provider.id}
                      type="button"
                      variant="outline"
                      className="w-full justify-center"
                      disabled={isLoading}
                      onClick={() => {
                        setAuthRememberPreference(!!rememberMe);
                        window.location.assign(provider.href);
                      }}
                    >
                      <ProviderIcon providerId={provider.id} />
                      <span className="ml-2">{provider.label}</span>
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center opacity-70"
                    disabled
                    title="Facebook sign-in is not enabled yet"
                  >
                    <ProviderIcon providerId="facebook" />
                    <span className="ml-2">Continue with Facebook (Coming soon)</span>
                  </Button>
                </div>
              </div>
            ) : null}
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--color-border-secondary)]">
            {portalMode === 'admin' ? (
              <p className="text-center text-sm text-[var(--color-text-tertiary)]">
                Don&apos;t have an account?{' '}
                <Link
                  href="/register"
                  className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primaryhover)] font-medium"
                >
                  Create one
                </Link>
              </p>
            ) : (
              <p className="text-center text-sm text-[var(--color-text-tertiary)]">
                Need regular admin access?{' '}
                <Link
                  href="/login?redirect=%2Fdashboard"
                  className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primaryhover)] font-medium"
                >
                  Switch to admin login
                </Link>
              </p>
            )}
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
          setChallengeMethod('email_otp');
        }}
        loading={otpLoading || isLoading}
        title={challengeMethod === 'totp' ? 'Authenticator verification' : 'Email verification'}
        subtitle={
          otpStep === 'email'
            ? 'Confirm your email to receive a one-time code.'
            : challengeMethod === 'totp'
              ? 'Open your authenticator app and enter the current 6-digit code.'
              : `Enter the code we sent to ${otpEmail}.`
        }
        otpLabel={challengeMethod === 'totp' ? 'Authenticator code' : 'Enter the 6-digit code'}
        otpHint={
          challengeMethod === 'totp'
            ? 'Codes refresh every 30 seconds. If a code is rejected, make sure your device time is set automatically.'
            : 'Check your inbox for the code. It expires shortly.'
        }
        confirmText="Verify & sign in"
        requestText="Send login code"
        secondaryActionText={challengeMethod === 'email_otp' ? 'Resend code' : undefined}
        onSecondaryAction={challengeMethod === 'email_otp' ? requestOtp : undefined}
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
