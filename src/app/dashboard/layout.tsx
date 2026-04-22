// src/app/(dashboard)/layout.tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { useAuthContext } from '@/providers/AuthProviders';
import { SessionTimeout } from '@/components/SessionTimeout';
import { getUserRole } from '@/lib/authRole';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuthContext();
  const normalizedRole = getUserRole(auth.user);
  const isSuperAdmin = normalizedRole === 'super_admin';
  const isAllowed = normalizedRole === 'admin' || normalizedRole === 'super_admin';

  useEffect(() => {
    if (!auth.isInitialized || auth.isLoading) return;

    if (!auth.isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (!isAllowed) {
      router.replace('/');
      return;
    }

    if (isSuperAdmin && pathname === '/dashboard') {
      router.replace('/dashboard/super');
    }
  }, [auth, isAllowed, isSuperAdmin, pathname, router]);

  if (!auth.isInitialized || auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-lg text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) return null;
  if (!isAllowed) return null;

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
