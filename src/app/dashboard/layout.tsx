// src/app/(dashboard)/layout.tsx
'use client';

import { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { withAuth } from '@/providers/AuthProviders';

function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary-50">
      <Sidebar />
      <div className="lg:ml-72">
        <Navbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

export default withAuth(DashboardLayout, { requiredRole: 'admin' });