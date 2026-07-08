import Link from 'next/link';
import { Button } from '@/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--color-background-primary)] px-4">
      <div className="w-full max-w-md text-center">
        <p className="font-display text-5xl font-semibold text-[var(--color-accent-primary)]">404</p>
        <h1 className="mt-4 text-xl font-semibold text-[var(--color-text-primary)]">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <div className="mt-6">
          <Link href="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
