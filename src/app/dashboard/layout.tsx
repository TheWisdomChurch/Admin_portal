// src/app/(dashboard)/layout.tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { useAuthContext } from '@/providers/AuthProviders';
import { SessionTimeout } from '@/components/SessionTimeout';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const auth = useAuthContext();
  const normalizedRole = (auth.user?.role || '').toLowerCase().replace(/\s+/g, '_');
  const isAllowed = normalizedRole === 'admin' || normalizedRole === 'super_admin';

  useEffect(() => {
    if (!auth.isInitialized || auth.isLoading) return;

    if (!auth.isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (!isAllowed) {
      router.replace('/');
    }
  }, [auth, router, isAllowed]);

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
          <div className="container mx-auto px-6 py-8 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
