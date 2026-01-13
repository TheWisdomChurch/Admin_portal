// src/app/(auth)/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Church, UserPlus } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

// Registration schema matching your backend
const registerSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name cannot exceed 50 characters'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name cannot exceed 50 characters'),
  email: z.string()
    .email('Invalid email address')
    .max(100, 'Email cannot exceed 100 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  role: z.enum(['super_admin', 'admin']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema) as any,
    defaultValues: {
      role: 'admin',
    },
  });

  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setLoading(true);
      setError('');

      // Prepare registration data (exclude confirmPassword)
      const { confirmPassword, ...registrationData } = data;

      console.log('Registering admin:', registrationData);

      // Call API to register
      const response = await apiClient.register(registrationData);
      
      toast.success('Admin registered successfully!');
      
      // Optional: Auto-login after registration
      // If your backend doesn't return a token in registration response,
      // you might want to redirect to login instead
      if (response.token) {
        toast.success('Logged in automatically!');
        router.push('/dashboard');
      } else {
        toast.success('Please login with your new credentials');
        router.push('/login');
      }
      
    } catch (err: any) {
      console.error('Registration error:', err);
      
      // Handle specific error messages
      if (err.status === 400) {
        setError('Invalid registration data. Please check your inputs.');
      } else if (err.status === 409) {
        setError('An admin with this email already exists.');
      } else if (err.status === 403) {
        setError('You do not have permission to create an admin account.');
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
      
      toast.error('Registration failed');
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
          <h1 className="text-2xl font-bold text-gray-900">Register New Admin</h1>
          <p className="text-gray-600 mt-2">Create a new administrator account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                placeholder="John"
                className={`w-full rounded-lg border ${
                  errors.firstName ? 'border-red-500' : 'border-gray-300'
                } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                {...register('firstName')}
                disabled={loading}
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-500">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                placeholder="Doe"
                className={`w-full rounded-lg border ${
                  errors.lastName ? 'border-red-500' : 'border-gray-300'
                } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                {...register('lastName')}
                disabled={loading}
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              placeholder="admin@wisdomchurch.org"
              className={`w-full rounded-lg border ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
              {...register('email')}
              disabled={loading}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Password Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className={`w-full rounded-lg border ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                {...register('password')}
                disabled={loading}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
              )}
              {password && !errors.password && (
                <div className="mt-1 text-xs text-gray-500">
                  <div className={`flex items-center ${/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className="mr-1">✓</span> Uppercase letter
                  </div>
                  <div className={`flex items-center ${/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className="mr-1">✓</span> Lowercase letter
                  </div>
                  <div className={`flex items-center ${/[0-9]/.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className="mr-1">✓</span> Number
                  </div>
                  <div className={`flex items-center ${password.length >= 8 ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className="mr-1">✓</span> 8+ characters
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password *
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className={`w-full rounded-lg border ${
                  errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                {...register('confirmPassword')}
                disabled={loading}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          {/* Role Selection */}
          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Admin Role *
            </label>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <input
                  type="radio"
                  id="role-admin"
                  value="admin"
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                  {...register('role')}
                  disabled={loading}
                />
                <div>
                  <label htmlFor="role-admin" className="text-sm font-medium text-gray-700">
                    Admin
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Can manage events, content, announcements, and view analytics.
                    Limited access to user management.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 bg-yellow-50 border-yellow-200">
                <input
                  type="radio"
                  id="role-super-admin"
                  value="super_admin"
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                  {...register('role')}
                  disabled={loading}
                />
                <div>
                  <label htmlFor="role-super-admin" className="text-sm font-medium text-gray-700">
                    Super Admin (Church Leadership Only)
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Full system access including user management, role assignments,
                    system settings, and all administrative functions.
                  </p>
                </div>
              </div>
            </div>
            {errors.role && (
              <p className="mt-1 text-sm text-red-500">{errors.role.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            className="w-full mt-6"
            loading={loading}
            disabled={loading}
          >
            Register Admin
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-col items-center gap-4">
            <Link 
              href="/login" 
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Already have an account? Sign in
            </Link>
            
            <div className="bg-blue-50 p-3 rounded-lg w-full">
              <p className="text-xs text-blue-800 text-center">
                <strong>Important:</strong> Super Admin accounts should only be created for church leadership.
                Regular admin accounts are suitable for event coordinators and content managers.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}