'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProviders';
import type { User } from '@/lib/types';

type WithAuthOptions = {
  requiredRole?: 'admin' | 'super_admin';
};

function roleOf(user: User): 'admin' | 'super_admin' | null {
  const raw = (user as any)?.role;
  if (!raw || typeof raw !== 'string') return null;
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'admin') return 'admin';
  if (normalized === 'super_admin') return 'super_admin';
  return null;
}

function dashboardFor(user: User) {
  return roleOf(user) === 'super_admin' ? '/dashboard/super' : '/dashboard';
}

function hasRequiredRole(user: User, requiredRole?: 'admin' | 'super_admin') {
  if (!requiredRole) return true;
  const r = roleOf(user);
  if (r === 'super_admin') return true;
  return r === requiredRole;
}

function safeRedirect(pathname: string) {
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
    const { user, isInitialized } = useAuthContext();

    useEffect(() => {
      if (!isInitialized) return;

      if (!user) {
        const redirectTo = encodeURIComponent(safeRedirect(pathname));
        router.replace(`/login?redirect=${redirectTo}`);
        return;
      }

      if (requiredRole && !hasRequiredRole(user, requiredRole)) {
        router.replace(dashboardFor(user));
      }
    }, [user, isInitialized, router, pathname, requiredRole]);

    // Only block on first boot; after that, render immediately
    if (!isInitialized) {
      return (
        <div className="flex min-h-[200px] w-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
        </div>
      );
    }

    if (!user) return null;
    if (requiredRole && !hasRequiredRole(user, requiredRole)) return null;

    return <Component {...props} />;
  };
}
