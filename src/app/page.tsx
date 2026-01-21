// src/app/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/ui/Button';
import { LandingCarousel } from '@/components/LandingCarousel';
import { Footer } from '@/components/Footer';

export default async function HomePage() {
  const token = (await cookies()).get('auth_token')?.value;

  if (token) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-[var(--color-background-primary)] text-[var(--color-text-primary)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-8 h-80 w-80 rounded-full bg-[var(--color-accent-primary)]/20 blur-3xl" />
        <div className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-slate-400/20 blur-3xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full border-2 border-white bg-black shadow-sm">
            <Image
              src="/OIP.webp"
              alt="Wisdom Church logo"
              width={44}
              height={44}
              className="rounded-full object-cover"
            />
          </div>
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">The Wisdom Church</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Administration Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="outline">Login</Button>
          </Link>
          <Link href="/register" className="hidden sm:inline-flex">
            <Button>Register as Admin</Button>
          </Link>
        </div>
      </header>

      <main className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="space-y-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--color-text-tertiary)]">Secure Access</p>
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
            The Wisdom Church Administration Portal
          </h1>
          <p className="text-base text-[var(--color-text-secondary)] sm:text-lg">
            Manage events, testimonials, and member activity with clarity, security, and a modern workflow.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login">
              <Button>Login</Button>
            </Link>
            <Link href="/register">
              <Button variant="outline">Register as Admin</Button>
            </Link>
          </div>
          <div className="grid gap-3 pt-4 sm:grid-cols-2">
            {[
              'Approve testimonials with confidence',
              'Track registrations and attendance',
              'Build forms in minutes',
              'Monitor analytics for growth',
            ].map((item) => (
              <div
                key={item}
                className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 text-sm text-[var(--color-text-secondary)]"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 py-3 text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">
            Administration crafted for clarity and growth.
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">Portal Highlights</p>
            <h2 className="mt-3 font-display text-2xl font-semibold">Built for clarity & approvals</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Super admins review and approve content, while admins focus on creating and managing church operations.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">Admin</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Create events, publish updates, and track participation.
              </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">Super Admin</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Approve content, monitor analytics, and review registrations.
              </p>
            </div>
          </div>
          <LandingCarousel />
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-gradient-to-br from-[var(--color-accent-primary)]/15 to-transparent p-6">
            <p className="text-sm font-semibold">Ready to get started?</p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              Sign in to continue or request an admin account.
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/login">
                <Button size="sm">Login</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" variant="outline">Register</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
