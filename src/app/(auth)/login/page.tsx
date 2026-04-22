'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useForm, Controller, type ControllerRenderProps, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';

import { useAuthContext } from '@/providers/AuthProviders';
import { Footer } from '@/components/Footer';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Checkbox } from '@/ui/Checkbox';
import { Input } from '@/ui/input';
import { OtpModal } from '@/ui/OtpModal';
import { apiClient, getAuthRememberPreference, setAuthRememberPreference } from '@/lib/api';
import { getConfiguredAuthIdentityProviders } from '@/lib/authProviders';
import { getUserRole } from '@/lib/authRole';
import type { ApiError } from '@/lib/api';
import type { MFAMethod, User } from '@/lib/types';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';
import { loginSchema, type LoginFormSchema } from '@/lib/validation/auth';

type LoginFormData = LoginFormSchema;

function safeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return '/dashboard';
  if (raw === '/login' || raw === '/register') return '/dashboard';
  return raw;
}

function resolvePostLoginDestination(user: User | null, requestedPath: string): string {
  const role = getUserRole(user);
  const defaultPath = role === 'super_admin' ? '/dashboard/super' : '/dashboard';
  if (!requestedPath || requestedPath === '/dashboard') return defaultPath;

  if (role === 'super_admin' && requestedPath === '/dashboard') {
    return '/dashboard/super';
  }

  return requestedPath;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 3.3 14.7 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.6 0 9.3-4 9.3-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

function LoginInner() {
  const { checkAuth, isLoading, activateSession } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [serverError, setServerError] = useState('');
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'otp'>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<LoginFormData | null>(null);
  const [challengePurpose, setChallengePurpose] = useState<string>('');
  const [challengeMethod, setChallengeMethod] = useState<MFAMethod>('email_otp');

  const portalMode = useMemo(
    () => (searchParams.get('portal') === 'super' ? 'super' : 'admin'),
    [searchParams]
  );

  const redirectPath = useMemo(() => {
    const raw = searchParams.get('redirect');
    if (!raw) return portalMode === 'super' ? '/dashboard/super' : '/dashboard';
    return safeRedirect(raw);
  }, [portalMode, searchParams]);

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

      const me = await checkAuth();
      if (!me) {
        toast.error('Login succeeded, but session was not established. Please retry.');
        return;
      }

      activateSession();
      await apiClient.getCsrfToken().catch(() => undefined);
      toast.success('Login successful.');
      router.replace(resolvePostLoginDestination(me, redirectPath));
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
        setServerError('No account found for this email. Create an account to continue.');
      } else if (status === 401) {
        setServerError('The password is incorrect. Reset password if you cannot remember it.');
      } else {
        setServerError(apiErr?.message || 'Unable to sign in right now.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const requestOtp = async () => {
    if (!pendingLogin) {
      toast.error('Submit your email and password first.');
      return;
    }

    if (challengeMethod !== 'email_otp') {
      toast.error('Use your authenticator app code for this sign-in.');
      return;
    }

    try {
      setOtpLoading(true);
      const result = await apiClient.resendLoginOtp({ email: otpEmail.trim().toLowerCase() });
      setChallengeMethod(result.mfa_method ?? 'email_otp');
      setChallengePurpose(result.purpose || 'login');
      setOtpStep('otp');
      toast.success('A fresh verification code was sent.');
    } catch (err) {
      toast.error(getServerErrorMessage(err, 'Failed to resend code'));
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtpAndLogin = async () => {
    if (!pendingLogin) {
      toast.error('Restart the sign-in flow.');
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
        toast.error('Verification passed, but session was not established. Please refresh.');
        return;
      }

      activateSession();
      await apiClient.getCsrfToken().catch(() => undefined);
      toast.success('Verification successful.');
      setOtpOpen(false);
      setOtpCode('');
      setChallengeMethod('email_otp');
      router.replace(resolvePostLoginDestination(me, redirectPath));
    } catch (err) {
      const fieldErrors = extractServerFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        toast.error(getFirstServerFieldError(fieldErrors) || 'Check the code and retry.');
        return;
      }
      toast.error(getServerErrorMessage(err, 'Verification failed'));
    } finally {
      setOtpLoading(false);
    }
  };

  const forgotHref = `/passwordreset${getValues('email') ? `?email=${encodeURIComponent(getValues('email').trim().toLowerCase())}` : ''}`;

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
        {portalMode === 'super' ? (
          <Link href="/">
            <Button variant="outline">Back to Site</Button>
          </Link>
        ) : (
          <Link href="/register">
            <Button variant="outline">Create Account</Button>
          </Link>
        )}
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
        <section className="auth-glass rounded-3xl p-8 sm:p-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">Secure Sign-In</p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text-primary)] sm:text-4xl">
            {portalMode === 'super' ? 'Super Admin Control Access' : 'Admin Portal Access'}
          </h1>
          <p className="mt-4 max-w-xl text-sm text-[var(--color-text-secondary)] sm:text-base">
            {portalMode === 'super'
              ? 'This entry point is for platform oversight. Sign-in requires role validation and second-factor verification.'
              : 'Access church operations with role-based access control and one-time verification before session activation.'}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Session Policy</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Persistent sessions only apply when Remember me is enabled on trusted devices.</p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">MFA</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Verification supports email OTP and authenticator app where configured.</p>
            </div>
          </div>
        </section>

        <Card className="auth-glass rounded-3xl p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)]">
              <Lock className="h-7 w-7 text-[var(--color-accent-primary)]" />
            </div>
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Sign In</h2>
            <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
              {portalMode === 'super' ? 'Authenticate as super admin' : 'Authenticate your admin account'}
            </p>
          </div>

          {serverError ? (
            <div className="mt-5 rounded-[var(--radius-button)] border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate autoComplete="on">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                <Input
                  type="email"
                  className="pl-10"
                  placeholder="you@example.com"
                  {...register('email', {
                    onChange: () => {
                      setServerError('');
                      clearErrors('email');
                    },
                  })}
                  error={errors.email?.message}
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                <Input
                  type="password"
                  className="pl-10"
                  placeholder="••••••••"
                  {...register('password', {
                    onChange: () => {
                      setServerError('');
                      clearErrors('password');
                    },
                  })}
                  error={errors.password?.message}
                  disabled={isLoading}
                  autoComplete="current-password"
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
                href={forgotHref}
                className="text-sm font-medium text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primaryhover)]"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" loading={isLoading} disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
              {!isLoading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
            </Button>

            {identityProviders.length > 0 ? (
              <>
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--color-border-secondary)]" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-[var(--color-background-primary)] px-3 text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                      Or continue with
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {identityProviders.map((provider) => (
                    <Button
                      key={provider.id}
                      type="button"
                      variant="outline"
                      className="w-full justify-center gap-2"
                      disabled={isLoading}
                      onClick={() => {
                        setAuthRememberPreference(!!rememberMe);
                        window.location.assign(provider.href);
                      }}
                    >
                      {provider.id === 'google' ? <GoogleIcon /> : null}
                      {provider.label}
                    </Button>
                  ))}
                </div>
              </>
            ) : null}
          </form>

          {portalMode === 'super' ? null : (
            <p className="mt-6 border-t border-[var(--color-border-secondary)] pt-4 text-center text-sm text-[var(--color-text-tertiary)]">
              New admin?{' '}
              <Link href="/register" className="font-medium text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primaryhover)]">
                Create account
              </Link>
            </p>
          )}
        </Card>
      </main>

      <Footer />

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
            ? 'Codes refresh every 30 seconds. If rejected, confirm your device time is automatic.'
            : 'Check your inbox for the code. It expires shortly.'
        }
        confirmText="Verify & sign in"
        requestText="Send login code"
        secondaryActionText={challengeMethod === 'email_otp' ? 'Resend code' : undefined}
        onSecondaryAction={challengeMethod === 'email_otp' ? requestOtp : undefined}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
