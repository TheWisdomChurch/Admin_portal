import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-[var(--color-text-tertiary)] sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--color-border-secondary)] pt-6 sm:flex-row">
        <p>© {new Date().getFullYear()} The Wisdom Church. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hover:text-[var(--color-text-secondary)]">Login</Link>
          <Link href="/register" className="hover:text-[var(--color-text-secondary)]">Register</Link>
          <Link href="/" className="hover:text-[var(--color-text-secondary)]">Home</Link>
        </div>
      </div>
    </footer>
  );
}
