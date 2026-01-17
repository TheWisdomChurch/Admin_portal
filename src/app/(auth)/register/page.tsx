// src/app/(auth)/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { Checkbox } from '@/ui/Checkbox';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { AxiosError } from 'axios';
import { RegisterData } from '@/lib/types';

// Schema matched to backend requirements
const registerSchema = z.object({
  first_name: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name cannot exceed 50 characters'),
  last_name: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name cannot exceed 50 characters'),
  email: z.string()
    .email('Invalid email address')
    .max(100, 'Email cannot exceed 100 characters'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password cannot exceed 100 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  role: z.enum(['user', 'admin']),
  rememberMe: z.boolean().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'admin',
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirmPassword: '',
      rememberMe: false,
    },
  });

  const password = watch('password');

  const onSubmit = async (formData: RegisterFormData) => {
    try {
      setLoading(true);
      setServerError('');

      // Prepare data matching backend expectations
      const registrationData: RegisterData & { rememberMe?: boolean } = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        rememberMe: formData.rememberMe,
      };

      console.log('Registration data:', registrationData);

      // Register via API
      const response = await apiClient.register(registrationData);
      
      toast.success('Account created successfully!');
      
      // Store user data (token handled via HttpOnly cookie)
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
      
      toast.success('Logged in automatically!');
      
      // Role-based redirect
      if (response.user.role === 'admin') {
        router.push('/dashboard');
      } else {
        router.push('/');
      }
      
    } catch (err: any) {
      console.error('Registration error:', err);
      
      const axiosError = err as AxiosError<{ message?: string; errors?: Record<string, string[]> }>;
      const errorData = axiosError.response?.data;
      
      if (errorData?.errors) {
        const validationErrors = Object.entries(errorData.errors)
          .map(([field, messages]) => {
            const fieldMap: Record<string, string> = {
              first_name: 'First Name',
              last_name: 'Last Name',
              email: 'Email',
              password: 'Password',
              role: 'Role',
            };
            const fieldName = fieldMap[field] || field;
            const messageText = Array.isArray(messages) ? messages.join(', ') : messages;
            return `${fieldName}: ${messageText}`;
          })
          .join('\n');
        setServerError(validationErrors);
      } else {
        setServerError(errorData?.message || err.message || 'Registration failed');
      }
      
      toast.error(errorData?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-4">
            <UserPlus className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 mt-2">Join Wisdom House Church</p>
        </div>

        {serverError && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600 whitespace-pre-line">{serverError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <Input
                type="text"
                placeholder="John"
                {...register('first_name')}
                error={errors.first_name?.message}
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <Input
                type="text"
                placeholder="Doe"
                {...register('last_name')}
                error={errors.last_name?.message}
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <Input
              type="email"
              placeholder="your.email@example.com"
              {...register('email')}
              error={errors.email?.message}
              disabled={loading}
              required
            />
          </div>

          {/* Password Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                error={errors.password?.message}
                disabled={loading}
                required
              />
              {password && !errors.password && (
                <div className="mt-1 text-xs text-gray-500">
                  <div className={`flex items-center ${password.length >= 6 ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className="mr-1">✓</span> At least 6 characters
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password *
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                error={errors.confirmPassword?.message}
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Account Type *
            </label>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <input
                  type="radio"
                  id="role-user"
                  value="user"
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                  {...register('role')}
                  disabled={loading}
                />
                <label htmlFor="role-user" className="text-sm font-medium text-gray-700">
                  <div className="font-semibold">Church Member</div>
                  <div className="text-xs text-gray-500">Submit testimonials and view content</div>
                </label>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <input
                  type="radio"
                  id="role-admin"
                  value="admin"
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                  {...register('role')}
                  disabled={loading}
                />
                <label htmlFor="role-admin" className="text-sm font-medium text-gray-700">
                  <div className="font-semibold">Church Administrator</div>
                  <div className="text-xs text-gray-500">Manage testimonials, events, and content</div>
                </label>
              </div>
            </div>
          </div>

          {/* Remember Me */}
          <div className="pt-2">
            <Checkbox
              label="Remember me on this device"
              {...register('rememberMe')}
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-6"
            disabled={loading}
            loading={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <Link href="/login" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Already have an account? Sign in
            </Link>
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-800">
              Back to Home
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}