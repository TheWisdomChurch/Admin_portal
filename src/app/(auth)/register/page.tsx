// src/app/(auth)/register/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, UserPlus, CheckCircle, Mail, Lock, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { Checkbox } from '@/ui/Checkbox';
import { useAuthContext } from '@/providers/AuthProviders';

// Keep rememberMe REQUIRED to avoid resolver typing mismatch
const registerSchema = z
  .object({
    first_name: z.string().min(1, 'First name is required').max(50, 'First name cannot exceed 50 characters'),
    last_name: z.string().min(1, 'Last name is required').max(50, 'Last name cannot exceed 50 characters'),
    email: z.string().email('Invalid email address').max(100, 'Email cannot exceed 100 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password cannot exceed 100 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['user', 'admin']),
    rememberMe: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

function humanizeServerError(err: any): string {
  // Your backend shape can vary; keep it defensive
  const payload = err?.details || err?.response?.data || err;

  if (payload?.errors && typeof payload.errors === 'object') {
    const fieldMap: Record<string, string> = {
      first_name: 'First Name',
      last_name: 'Last Name',
      email: 'Email',
      password: 'Password',
      role: 'Role',
    };

    return Object.entries(payload.errors)
      .map(([field, messages]) => {
        const name = fieldMap[field] || field;
        const text = Array.isArray(messages) ? messages.join(', ') : String(messages);
        return `${name}: ${text}`;
      })
      .join('\n');
  }

  return payload?.message || err?.message || 'Registration failed. Please try again.';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Registration successful</h2>
          <p className="mt-2 text-sm text-gray-600">
            Your account has been created. Please sign in to continue.
          </p>

          <div className="mt-5 rounded-xl bg-gray-50 p-4 text-left">
            <p className="text-xs font-medium text-gray-700">Registered email</p>
            <p className="mt-1 break-all text-base font-semibold text-blue-600">{email}</p>
          </div>

          <div className="mt-6 space-y-3">
            <Button variant="primary" className="w-full" onClick={onGoToLogin}>
              Go to Login
            </Button>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>

          <p className="mt-5 text-xs text-gray-500">
            If you saved a password in your browser previously, it may offer to autofill on the login page.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const { register: registerUser } = useAuthContext();
  const router = useRouter();

  const [serverError, setServerError] = useState('');
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'user',
      rememberMe: false,
    },
    mode: 'onSubmit',
  });

  const password = watch('password');
  const passwordHint = useMemo(() => {
    if (!password) return null;
    if (password.length < 6) return { ok: false, text: 'Use at least 6 characters' };
    if (password.length < 10) return { ok: true, text: 'Good — consider adding more length' };
    return { ok: true, text: 'Strong length' };
  }, [password]);

  const onSubmit: SubmitHandler<RegisterFormData> = async (formData) => {
    try {
      setServerError('');

      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        rememberMe: formData.rememberMe,
      };

      await registerUser(payload);

      reset();
      setSuccessEmail(payload.email);
      toast.success('Account created successfully');

      // Optional: auto-route after short delay (still allows user to click button)
      setTimeout(() => {
        router.replace('/login');
      }, 1200);
    } catch (err: any) {
      const msg = humanizeServerError(err);
      setServerError(msg);
      toast.error(msg.split('\n')[0] || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 p-4">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: marketing / info panel */}
          <div className="hidden lg:block">
            <div className="h-full rounded-3xl bg-white/60 p-10 shadow-sm backdrop-blur">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
                <UserPlus className="h-7 w-7 text-blue-600" />
              </div>
              <h1 className="mt-6 text-3xl font-bold text-gray-900">
                Create your Wisdom House account
              </h1>
              <p className="mt-3 text-gray-600">
                Register to submit testimonials and access church resources. Admin accounts can manage events and content.
              </p>

              <div className="mt-8 space-y-4">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">Member access</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Submit testimonials and view content.
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">Administrator access</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Manage testimonials, events, and site content.
                  </p>
                </div>
              </div>

              <div className="mt-10 text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          {/* Right: form */}
          <Card className="w-full rounded-3xl p-8 shadow-lg">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
                <UserPlus className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
              <p className="mt-2 text-sm text-gray-600">Join Wisdom House Church</p>
            </div>

            {serverError && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700 whitespace-pre-line">{serverError}</p>
              </div>
            )}

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="mt-6 space-y-4"
              noValidate
              autoComplete="off"
            >
              {/* Name row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">First name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="John"
                      className="pl-10"
                      {...register('first_name')}
                      error={errors.first_name?.message}
                      disabled={isSubmitting}
                      autoComplete="off"
                      autoCapitalize="words"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Last name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Doe"
                      className="pl-10"
                      {...register('last_name')}
                      error={errors.last_name?.message}
                      disabled={isSubmitting}
                      autoComplete="off"
                      autoCapitalize="words"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="your.email@example.com"
                    className="pl-10"
                    {...register('email')}
                    error={errors.email?.message}
                    disabled={isSubmitting}
                    autoComplete="off"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Password row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      {...register('password')}
                      error={errors.password?.message}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>
                  {passwordHint && !errors.password?.message && (
                    <p className={`mt-1 text-xs ${passwordHint.ok ? 'text-green-700' : 'text-gray-500'}`}>
                      {passwordHint.text}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      {...register('confirmPassword')}
                      error={errors.confirmPassword?.message}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>

              {/* Role */}
              <div className="pt-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">Account type</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 hover:bg-gray-50">
                    <input
                      type="radio"
                      value="user"
                      className="mt-1"
                      {...register('role')}
                      disabled={isSubmitting}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">Church Member</span>
                      <span className="block text-xs text-gray-500">Submit testimonials and view content</span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 hover:bg-gray-50">
                    <input
                      type="radio"
                      value="admin"
                      className="mt-1"
                      {...register('role')}
                      disabled={isSubmitting}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">Administrator</span>
                      <span className="block text-xs text-gray-500">Manage testimonials and events</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Remember me */}
              <div className="pt-1">
                <Controller
                  name="rememberMe"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      label="Remember me on this device"
                      disabled={isSubmitting}
                      checked={!!field.value}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        field.onChange(e.target.checked)
                      }
                    />
                  )}
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </Button>

              {/* Footer links */}
              <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-5 text-sm">
                <Link
                  href="/login"
                  className="inline-flex items-center text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Already have an account?
                </Link>

                <Link href="/" className="text-gray-600 hover:text-gray-900">
                  Back to Home
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {successEmail && (
        <SuccessModal
          email={successEmail}
          onClose={() => setSuccessEmail(null)}
          onGoToLogin={() => router.replace('/login')}
        />
      )}
    </div>
  );
}
