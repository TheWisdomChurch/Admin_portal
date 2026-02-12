'use client';

import { useState } from 'react';
import { useForm, Controller, useWatch, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterFormSchema } from '@/lib/validation/auth';
import { ArrowLeft, UserPlus, CheckCircle, Mail, Lock, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Image from 'next/image';

import { Footer } from '@/components/Footer';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { Checkbox } from '@/ui/Checkbox';
import { PasswordStrengthMeter } from '@/ui/PasswordStrengthMeter';

import apiClient from '@/lib/api';
import { extractServerFieldErrors, getServerErrorMessage } from '@/lib/serverValidation';

type RegisterFormData = RegisterFormSchema;

function humanizeServerError(err: unknown): string {
  const fieldErrors = extractServerFieldErrors(err);
  if (Object.keys(fieldErrors).length > 0) {
    const fieldMap: Record<string, string> = {
      first_name: 'First Name',
      last_name: 'Last Name',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      role: 'Role',
    };

    return Object.entries(fieldErrors)
      .map(([field, message]) => `${fieldMap[field] || field}: ${message}`)
      .join('\n');
  }

  return getServerErrorMessage(err, 'Registration failed. Please try again.');
}

function SuccessModal({
  email,
  onGoToLogin,
  onClose,
}: {
  email: string;
  onGoToLogin: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-[var(--radius-card)] bg-[var(--color-background-primary)] p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-background-tertiary)]">
            <CheckCircle className="h-8 w-8 text-[var(--color-accent-success)]" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Registration successful</h2>
          <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">Your account has been created. Please sign in to continue.</p>

          <div className="mt-5 rounded-[var(--radius-button)] bg-[var(--color-background-tertiary)] p-4 text-left">
            <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Registered email</p>
            <p className="mt-1 break-all text-base font-semibold text-[var(--color-accent-primary)]">{email}</p>
          </div>

          <div className="mt-6 space-y-3">
            <Button variant="primary" className="w-full" onClick={onGoToLogin}>
              Go to Login
            </Button>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>

          <p className="mt-5 text-xs text-[var(--color-text-tertiary)]">
            If you saved a password in your browser previously, it may offer to autofill on the login page.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();

  const [serverError, setServerError] = useState('');
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'admin',
      rememberMe: false,
    },
    mode: 'onSubmit',
    resolver: zodResolver(registerSchema),
  });

  const password = useWatch({ control, name: 'password' });

  const onSubmit: SubmitHandler<RegisterFormData> = async (formData) => {
    try {
      clearErrors();
      setServerError('');

      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        rememberMe: formData.rememberMe,
      };

      await apiClient.register(payload);

      reset();
      setSuccessEmail(payload.email);
      toast.success('Account created successfully');

      setTimeout(() => {
        router.replace('/login');
      }, 1200);
    } catch (err) {
      const fieldErrors = extractServerFieldErrors(err);
      const fieldMap: Record<string, keyof RegisterFormData> = {
        confirm_password: 'confirmPassword',
        confirmPassword: 'confirmPassword',
      };

      const allowedFields: Array<keyof RegisterFormData> = [
        'first_name',
        'last_name',
        'email',
        'password',
        'confirmPassword',
        'role',
        'rememberMe',
      ];

      Object.entries(fieldErrors).forEach(([field, message]) => {
        const target = fieldMap[field] ?? (field as keyof RegisterFormData);
        if (allowedFields.includes(target)) {
          setError(target, { type: 'server', message });
        }
      });

      const msg = humanizeServerError(err);
      setServerError(msg);
      toast.error(msg.split('\n')[0] || 'Registration failed');
    }
  };

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
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="hidden lg:block">
            <div className="auth-glass h-full rounded-3xl p-10 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)]">
                <UserPlus className="h-7 w-7 text-[var(--color-accent-primary)]" />
              </div>
              <h1 className="mt-6 text-3xl font-semibold text-[var(--color-text-primary)]">Create your Wisdom House account</h1>
              <p className="mt-3 text-[var(--color-text-secondary)]">
                Register to submit testimonials and access church resources. Admin accounts can manage events and content.
              </p>
            </div>
          </div>

          <Card className="auth-glass w-full rounded-3xl p-8 shadow-lg">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)]">
                <UserPlus className="h-8 w-8 text-[var(--color-accent-primary)]" />
              </div>
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Create Account</h2>
              <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">Join Wisdom House Church</p>
            </div>

            {serverError && (
              <div className="mt-6 rounded-[var(--radius-button)] border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700 whitespace-pre-line">{serverError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate autoComplete="off">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="first_name" className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                    First name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                    <Input
                      id="first_name"
                      type="text"
                      placeholder="John"
                      className="pl-10"
                      {...register('first_name', {
                        onChange: () => {
                          setServerError('');
                          clearErrors('first_name');
                        },
                      })}
                      error={errors.first_name?.message}
                      disabled={isSubmitting}
                      autoComplete="off"
                      autoCapitalize="words"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="last_name" className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                    Last name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                    <Input
                      id="last_name"
                      type="text"
                      placeholder="Doe"
                      className="pl-10"
                      {...register('last_name', {
                        onChange: () => {
                          setServerError('');
                          clearErrors('last_name');
                        },
                      })}
                      error={errors.last_name?.message}
                      disabled={isSubmitting}
                      autoComplete="off"
                      autoCapitalize="words"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    className="pl-10"
                    {...register('email', {
                      onChange: () => {
                        setServerError('');
                        clearErrors('email');
                      },
                    })}
                    error={errors.email?.message}
                    disabled={isSubmitting}
                    autoComplete="off"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="password" className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                    <Input
                      id="password"
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
                      disabled={isSubmitting}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>
                  <PasswordStrengthMeter password={password || ''} />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      {...register('confirmPassword', {
                        onChange: () => {
                          setServerError('');
                          clearErrors('confirmPassword');
                        },
                      })}
                      error={errors.confirmPassword?.message}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">Register as</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 hover:bg-[var(--color-background-hover)]">
                    <input
                      type="radio"
                      value="admin"
                      className="mt-1"
                      {...register('role', {
                        onChange: () => {
                          setServerError('');
                          clearErrors('role');
                        },
                      })}
                      disabled={isSubmitting}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[var(--color-text-primary)]">Admin</span>
                      <span className="block text-xs text-[var(--color-text-tertiary)]">Manage events, forms, and content</span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 hover:bg-[var(--color-background-hover)]">
                    <input
                      type="radio"
                      value="super_admin"
                      className="mt-1"
                      {...register('role', {
                        onChange: () => {
                          setServerError('');
                          clearErrors('role');
                        },
                      })}
                      disabled={isSubmitting}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[var(--color-text-primary)]">Super Admin</span>
                      <span className="block text-xs text-[var(--color-text-tertiary)]">Approve testimonials and view analytics</span>
                    </span>
                  </label>
                </div>
                {errors.role?.message && <p className="mt-2 text-xs text-red-600">{errors.role.message}</p>}
              </div>

              <div className="pt-1">
                <Controller
                  name="rememberMe"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      label="Remember me on this device"
                      disabled={isSubmitting}
                      checked={!!field.value}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setServerError('');
                        clearErrors('rememberMe');
                        field.onChange(e.target.checked);
                      }}
                    />
                  )}
                />
              </div>

              <Button type="submit" variant="primary" className="w-full mt-2" disabled={isSubmitting} loading={isSubmitting}>
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </Button>

              <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border-secondary)] pt-5 text-sm">
                <Link href="/login" className="inline-flex items-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Already have an account?
                </Link>

                <Link href="/" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
                  Back to Home.
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </main>

      <Footer />

      {successEmail && (
        <SuccessModal email={successEmail} onClose={() => setSuccessEmail(null)} onGoToLogin={() => router.replace('/login')} />
      )}
    </div>
  );
}
