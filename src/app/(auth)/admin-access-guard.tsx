'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProviders';

function FullPageMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-slate-300 leading-6">{description}</p>
      </div>
    </div>
  );
}

export function AdminAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    status,
    accessStatus,
    isInitialized,
    bootstrapped,
  } = useAuthContext();

  useEffect(() => {
    if (!isInitialized || !bootstrapped) return;
    if (status === 'loading' || accessStatus === 'loading') return;

    if (accessStatus === 'login_required' && pathname !== '/login') {
      router.replace('/login');
      return;
    }

    if (accessStatus === 'mfa_required' && pathname !== '/mfa/setup') {
      router.replace('/mfa/setup');
      return;
    }

    if (accessStatus === 'ready' && pathname === '/mfa/setup') {
      router.replace('/dashboard');
    }
  }, [status, accessStatus, isInitialized, bootstrapped, pathname, router]);

  if (!isInitialized || !bootstrapped || status === 'loading' || accessStatus === 'loading') {
    return (
      <FullPageMessage
        title="Checking your access"
        description="We are validating your session, MFA status, and admin access."
      />
    );
  }

  if (accessStatus === 'forbidden') {
    return (
      <FullPageMessage
        title="Access denied"
        description="Your account is signed in, but it does not currently have the required admin access for this portal."
      />
    );
  }

  if (accessStatus === 'login_required' && pathname !== '/login') {
    return null;
  }

  if (accessStatus === 'mfa_required' && pathname !== '/mfa/setup') {
    return null;
  }

  return <>{children}</>;
}