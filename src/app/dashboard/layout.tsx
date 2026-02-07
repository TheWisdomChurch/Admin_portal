// src/app/(dashboard)/layout.tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { Container } from '@/layouts/Container';
import { useAuthContext } from '@/providers/AuthProviders';
import { useTheme } from '@/providers/ThemeProviders';
import { SessionTimeout } from '@/components/SessionTimeout';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const auth = useAuthContext();
  const { colors } = useTheme(); // Get theme colors
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

  if (!auth.isInitialized || auth.isLoading) return null;
  if (!auth.isAuthenticated) return null;
  if (!isAllowed) return null;

  return (
    <div 
      className="min-h-screen bg-[var(--color-background-primary)] text-[var(--color-text-primary)]"
      style={{
        backgroundColor: colors.background.primary, // Apply theme background
        color: colors.text.primary, // Apply theme text color
      }}
    >
      <Sidebar />
      <div className="dashboard-shell">
        <Navbar />
        <SessionTimeout />
        <main className="pb-8 pt-4">
          <Container size="full">{children}</Container>
        </main>
      </div>
    </div>
  );
}
