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
import { useAuthContext } from '@/providers/AuthProviders';

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-4">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600 mt-2">Sign in to your account</p>
        </div>

        {serverError && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
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
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-700"
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

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Create one
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
