'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { SessionTimeout } from '@/components/SessionTimeout';
import { useAuthContext } from '@/providers/AuthProviders';
import { getUserRole } from '@/lib/authRole';
import { isSuperAdminPath } from '@/lib/access';

type DashboardLayoutClientProps = Readonly<{
  children: ReactNode;
}>;

function FullPageMessage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-primary)] px-6">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-tertiary)]">{description}</p>
      </div>
    </div>
  );
}

export default function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuthContext();

  const normalizedRole = getUserRole(auth.user);
  const isSuperAdmin = normalizedRole === 'super_admin';
  const isAdmin = normalizedRole === 'admin';
  const isRoleAllowed = isAdmin || isSuperAdmin;

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

    if (auth.accessStatus === 'forbidden') return;

    if (!isRoleAllowed) {
      router.replace('/');
      return;
    }

    // super_admin is a strict superset of admin — it can reach every
    // operational admin page in addition to the Authority Console, so there
    // is nothing to bounce it away from. admin, however, never gets the
    // Authority Console.
    if (isAdmin && isSuperAdminPath(pathname)) {
      router.replace('/dashboard');
    }
  }, [
    auth.accessStatus,
    auth.bootstrapped,
    auth.isInitialized,
    auth.status,
    isAdmin,
    isRoleAllowed,
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-primary)]">
        <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-6 py-5 shadow-xl">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent-primary)] border-t-transparent" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Checking your access</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Validating session, role and MFA state...</p>
          </div>
        </div>
      </div>
    );
  }

  if (auth.accessStatus === 'login_required' || auth.accessStatus === 'mfa_required') {
    return (
      <FullPageMessage
        title="Redirecting..."
        description="Please wait while your session is routed to the correct security step."
      />
    );
  }

  if (auth.accessStatus === 'forbidden') {
    return (
      <FullPageMessage
        title="Access denied"
        description="Your account is signed in, but it does not currently have approved administrator access for this portal."
      />
    );
  }

  if (!auth.isAuthenticated || !isRoleAllowed) return null;

  return (
    <div className="min-h-screen bg-[var(--color-background-primary)] text-[var(--color-text-primary)]">
      <Sidebar />
      <div className="dashboard-shell min-h-screen">
        <Navbar />
        <SessionTimeout />
        <main className="flex-1 overflow-auto">
          <div className="w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-8 xl:px-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
