// src/app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { useAuthContext } from '@/providers/AuthProviders';
import toast from 'react-hot-toast';
import { LoginCredentials } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/');

  // Use useEffect to set mounted and get redirect path only on client side
  useEffect(() => {
    setMounted(true);
    
    // Get redirect path from query params or sessionStorage (client-side only)
    const queryRedirect = searchParams.get('redirect');
    const storedRedirect = typeof window !== 'undefined' 
      ? sessionStorage.getItem('redirect_path') 
      : null;
    
    setRedirectPath(queryRedirect || storedRedirect || '/');
  }, [searchParams]);

  // Redirect if already authenticated (but only after mount)
  useEffect(() => {
    if (mounted && auth.isAuthenticated) {
      // Clear the stored redirect path
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('redirect_path');
      }
      router.replace(redirectPath);
    }
  }, [auth.isAuthenticated, router, mounted, redirectPath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    
    setLoading(true);
    try {
      const credentials: LoginCredentials = { email, password };
      await auth.login(credentials);
      
      toast.success('Login successful');
      
      // Clear form
      setEmail('');
      setPassword('');
      
      // Redirect will be handled by the useEffect above
    } catch (error: any) {
      toast.error(error?.message || 'Login failed. Please check your credentials.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle initial loading state without hydration mismatch
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-secondary-50 p-4">
        <div className="bg-white rounded-xl border border-secondary-200 shadow-sm w-full max-w-md p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-6"></div>
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-11 bg-gray-200 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-11 bg-gray-200 rounded"></div>
              </div>
              <div className="h-11 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading while checking auth
  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-secondary-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Don't render if already authenticated (will redirect)
  if (auth.isAuthenticated) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary-50 p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-secondary-900">Admin Login</h1>
          <p className="text-secondary-600 mt-2">Sign in to your account</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="admin@wisdomchurch.org"
            disabled={loading}
            autoComplete="email"
          />
          
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            disabled={loading}
            autoComplete="current-password"
          />
          
          <Button 
            type="submit" 
            disabled={loading || !email || !password} 
            className="w-full"
            variant="primary"
            loading={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
        
        {auth.error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600 text-center">{auth.error}</p>
          </div>
        )}
        
        <div className="mt-6 pt-6 border-t border-secondary-200">
          <p className="text-sm text-secondary-600 text-center">
            Don't have an account?{' '}
            <Link 
              href="/register" 
              className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
            >
              Register here
            </Link>
          </p>
          <p className="text-xs text-secondary-500 text-center mt-3">
            By logging in, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </Card>
    </div>
  );
}