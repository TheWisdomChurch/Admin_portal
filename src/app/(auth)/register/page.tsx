'use client';

import React, { useState } from 'react';
import { useForm, Controller, useWatch, type ControllerRenderProps, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle, Lock, Mail, ShieldCheck, User, UserPlus } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import { Footer } from '@/components/Footer';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Checkbox } from '@/ui/Checkbox';
import { Input } from '@/ui/input';
import { PasswordStrengthMeter } from '@/ui/PasswordStrengthMeter';
import { apiClient } from '@/lib/api';
import { extractServerFieldErrors, getServerErrorMessage } from '@/lib/serverValidation';
import { registerSchema, type RegisterFormSchema } from '@/lib/validation/auth';

type RegisterFormData = RegisterFormSchema;

export default function RegisterPage() {
  const router = useRouter();

  const [serverError, setServerError] = useState('');
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    clearErrors,
    setError,
    reset,
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

  const onSubmit: SubmitHandler<RegisterFormData> = async (formData: RegisterFormData) => {
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
      setCreatedEmail(payload.email);
      reset({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'admin',
        rememberMe: false,
      });
      toast.success('Account created successfully.');

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

      const message = getServerErrorMessage(err, 'Registration failed.');
      setServerError(message);
      toast.error(message);
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

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
        <section className="auth-glass rounded-3xl p-8 sm:p-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
            <UserPlus className="h-6 w-6" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">Create Access</p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text-primary)] sm:text-4xl">Create an admin account</h1>
          <p className="mt-4 max-w-xl text-sm text-[var(--color-text-secondary)] sm:text-base">
            Register with clear role ownership. Admin and super-admin permissions are separated for secure governance.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Role Scope</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Admins manage operational content. Super admins manage platform governance.</p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Security</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Use unique strong passwords with modern complexity and verification controls.</p>
            </div>
          </div>
        </section>

        <Card className="auth-glass rounded-3xl p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)]">
              <ShieldCheck className="h-7 w-7 text-[var(--color-accent-primary)]" />
            </div>
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Create Account</h2>
            <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">Complete the details below</p>
          </div>

          {createdEmail ? (
            <div className="mt-5 rounded-[var(--radius-button)] border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-700" />
                <p className="text-sm text-emerald-800">Account created for {createdEmail}. Redirecting to login.</p>
              </div>
            </div>
          ) : null}

          {serverError ? (
            <div className="mt-5 rounded-[var(--radius-button)] border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">First name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <Input
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
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">Last name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <Input
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
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
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
                  disabled={isSubmitting}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
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
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                </div>
                <PasswordStrengthMeter password={password || ''} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <Input
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
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">Account role</p>
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
                    <span className="block text-xs text-[var(--color-text-tertiary)]">Operations and content workflows</span>
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
                    <span className="block text-xs text-[var(--color-text-tertiary)]">Governance and platform controls</span>
                  </span>
                </label>
              </div>
              {errors.role?.message ? <p className="mt-2 text-xs text-red-600">{errors.role.message}</p> : null}
            </div>

            <Controller
              name="rememberMe"
              control={control}
              render={({ field }: { field: ControllerRenderProps<RegisterFormData, 'rememberMe'> }) => (
                <Checkbox
                  label="Remember me on this trusted device"
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

            <Button type="submit" className="w-full" loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create Account'}
              {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
            </Button>          </form>

          <p className="mt-6 border-t border-[var(--color-border-secondary)] pt-4 text-center text-sm text-[var(--color-text-tertiary)]">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primaryhover)]">
              Sign in
            </Link>
          </p>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
