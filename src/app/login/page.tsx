// src/app/(auth)/login/page.tsx - Updated with registration link
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Church, UserPlus } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema) as any,
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError('');
      await login({
        email: data.email,
        password: data.password
      });
      toast.success('Login successful!');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
      toast.error('Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-4">
            <Church className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Church Admin Panel</h1>
          <p className="text-gray-600 mt-2">Sign in to manage your content</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Input
              label="Email Address"
              type="email"
              placeholder="admin@example.com"
              error={errors.email?.message}
              {...register('email')}
              disabled={isLoading}
            />
          </div>

          <div>
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            disabled={isLoading}
          >
            Sign In
          </Button>
        </form>

<div className="mt-6 pt-6 border-t border-gray-200">
  <div className="flex flex-col items-center gap-3">
    <p className="text-sm text-gray-600">
      Need an admin account?
    </p>
    <Link 
      href="/register" 
      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
    >
      <UserPlus className="h-4 w-4 mr-2" />
      Register New Admin
    </Link>
    <p className="text-center text-sm text-gray-600 mt-2">
      Contact support if you've forgotten your credentials
    </p>
  </div>
</div>
      </Card>
    </div>
  );
}