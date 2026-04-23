'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { useAuthContext } from '@/providers/AuthProviders';
import { SessionTimeout } from '@/components/SessionTimeout';
import { getUserRole } from '@/lib/authRole';

function FullPageMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function DashboardLayoutClient({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuthContext();

  const normalizedRole = getUserRole(auth.user);
  const isSuperAdmin = normalizedRole === 'super_admin';
  const isRoleAllowed =
    normalizedRole === 'admin' || normalizedRole === 'super_admin';

  useEffect(() => {
    if (!auth.isInitialized || !auth.bootstrapped) return;
    if (auth.status === 'loading' || auth.accessStatus === 'loading') return;

    if (auth.accessStatus === 'login_required') {
      router.replace('/login');
      return;
    }

    if (auth.accessStatus === 'mfa_required') {
      router.replace('/mfa/setup');
      return;
    }

    if (auth.accessStatus === 'forbidden') {
      return;
    }

    if (!isRoleAllowed) {
      router.replace('/');
      return;
    }

    if (isSuperAdmin && pathname === '/dashboard') {
      router.replace('/dashboard/super');
    }
  }, [
    auth.isInitialized,
    auth.bootstrapped,
    auth.status,
    auth.accessStatus,
    isRoleAllowed,
    isSuperAdmin,
    pathname,
    router,
  ]);

  if (
    !auth.isInitialized ||
    !auth.bootstrapped ||
    auth.status === 'loading' ||
    auth.accessStatus === 'loading'
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-lg text-muted-foreground">Checking your access...</p>
        </div>
      </div>
    );
  }

  if (auth.accessStatus === 'login_required' || auth.accessStatus === 'mfa_required') {
    return (
      <FullPageMessage
        title="Redirecting..."
        description="Please wait while we route your session to the correct access flow."
      />
    );
  }

  if (auth.accessStatus === 'forbidden') {
    return (
      <FullPageMessage
        title="Access denied"
        description="Your account is signed in, but it does not currently have the required admin access for this portal."
      />
    );
  }

  if (!auth.isAuthenticated || !isRoleAllowed) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="dashboard-shell">
        <Navbar />
        <SessionTimeout />
        <main className="flex-1 overflow-auto">
          <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
