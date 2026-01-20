'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProviders';
import type { User } from '@/lib/types';

type WithAuthOptions = {
  requiredRole?: string; // e.g. 'admin'
};

function hasRequiredRole(user: User, requiredRole?: string) {
  if (!requiredRole) return true;
  // allow super_admin to pass everything if you use it
  if ((user as any).role === 'super_admin') return true;
  return (user as any).role === requiredRole;
}

function safeRedirect(pathname: string) {
  // Keep redirect internal and not auth routes
  if (!pathname?.startsWith('/')) return '/dashboard';
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) return '/dashboard';
  return pathname;
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { requiredRole } = options;

  return function WithAuthComponent(props: P) {
    const router = useRouter();
    const pathname = usePathname();

    const { user, isInitialized, isLoading } = useAuthContext();

    // IMPORTANT: do not redirect until init is completed
    useEffect(() => {
      if (!isInitialized || isLoading) return;

      // not logged in -> go login
      if (!user) {
        const redirectTo = encodeURIComponent(safeRedirect(pathname));
        router.replace(`/login?redirect=${redirectTo}`);
        return;
      }

      // logged in but role missing -> go dashboard (or a 403 page if you have one)
      if (requiredRole && !hasRequiredRole(user, requiredRole)) {
        router.replace('/dashboard');
      }
    }, [user, isInitialized, isLoading, router, pathname, requiredRole]);

    // While auth is initializing, show a stable loading state
    if (!isInitialized || isLoading) {
      return (
        <div className="flex min-h-[300px] w-full items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
        </div>
      );
    }

    // After init: if user is missing or role invalid, render nothing (redirect is in progress)
    if (!user) return null;
    if (requiredRole && !hasRequiredRole(user, requiredRole)) return null;

    return <Component {...props} />;
  };
}
