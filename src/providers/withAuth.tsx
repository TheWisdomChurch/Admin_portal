'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProviders';
import type { User } from '@/lib/types';
import { getUserRole } from '@/lib/authRole';

type WithAuthOptions = {
  requiredRole?: 'admin' | 'super_admin';
};

function roleOf(user: User): 'admin' | 'super_admin' | null {
  return getUserRole(user);
}

function dashboardFor(user: User) {
  return roleOf(user) === 'super_admin' ? '/dashboard/super' : '/dashboard';
}

function hasRequiredRole(user: User, requiredRole?: 'admin' | 'super_admin') {
  if (!requiredRole) return true;
  const r = roleOf(user);
  if (requiredRole === 'admin' && r === 'super_admin') return true;
  return r === requiredRole;
}

function safeRedirect(pathname: string) {
  if (!pathname?.startsWith('/')) return '/dashboard';
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) return '/dashboard';
  return pathname;
}

const adminOnlyPrefixes = [
  '/dashboard/event',
  '/dashboard/reels',
  '/dashboard/testimonials',
  '/dashboard/forms',
  '/dashboard/email-marketing',
  '/dashboard/newsletter',
  '/dashboard/registrations',
  '/dashboard/notifications',
  '/dashboard/content',
  '/dashboard/settings',
  '/dashboard/store',
  '/dashboard/administration',
  '/dashboard/leadership',
  '/dashboard/workforce',
  '/dashboard/new-members',
  '/dashboard/members',
];

function inferredRequiredRole(pathname: string): 'admin' | 'super_admin' | undefined {
  if (pathname.startsWith('/dashboard/super')) return 'super_admin';
  if (pathname === '/dashboard') return 'admin';
  if (adminOnlyPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return 'admin';
  return undefined;
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

      const effectiveRole = requiredRole || inferredRequiredRole(pathname);

      if (effectiveRole && !hasRequiredRole(user, effectiveRole)) {
        router.replace(dashboardFor(user));
      }
    }, [user, isInitialized, router, pathname]);

    // Only block on first boot; after that, render immediately
    if (!isInitialized) {
      return (
        <div className="flex min-h-[200px] w-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
        </div>
      );
    }

    if (!user) return null;
    const effectiveRole = requiredRole || inferredRequiredRole(pathname);
    if (effectiveRole && !hasRequiredRole(user, effectiveRole)) return null;

    return <Component {...props} />;
  };
}
