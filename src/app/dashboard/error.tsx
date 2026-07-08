'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/ui/Button';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Dashboard route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger-surface)] text-[var(--color-danger-text)]">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[var(--color-text-primary)]">Something went wrong</h2>
        <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
          This section couldn&apos;t load. You can try again, or head back to the dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>
            Back to dashboard
          </Button>
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
