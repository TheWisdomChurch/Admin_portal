'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { useAuthContext } from '@/providers/AuthProviders';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const auth = useAuthContext();

  useEffect(() => {
    if (!auth.isInitialized || auth.isLoading) return;

    if (!auth.isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (!['admin', 'super_admin'].includes(auth.user?.role ?? '')) {
      router.replace('/');
    }
  }, [auth, router]);

  if (!auth.isInitialized || auth.isLoading) return null;
  if (!auth.isAuthenticated) return null;
  if (!['admin', 'super_admin'].includes(auth.user?.role ?? '')) return null;

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-72">
        <Navbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
