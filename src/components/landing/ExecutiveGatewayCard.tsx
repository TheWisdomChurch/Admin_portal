import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { ORG } from '@/lib/landing/content';

export function ExecutiveGatewayCard() {
  return (
    <div className="relative mx-auto w-full max-w-[28rem] lg:max-w-none">
      {/* Outer ambient glow */}
      <div className="absolute -inset-1.5 rounded-[2rem] bg-gradient-to-br from-[var(--lp-gold-bright)]/20 via-transparent to-[var(--lp-gold-strong)]/10 blur-xl opacity-75" />

      {/* Main Gateway Card */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--lp-gold-line)] bg-[var(--color-background-primary)] p-6 shadow-2xl sm:p-8">
        {/* Subtle decorative top bar */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-primary)] pb-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[var(--lp-gold-line)] bg-[var(--lp-ink)] shadow-md">
              <Image src={ORG.logoSrc} alt="Wisdom Church" width={40} height={40} className="h-full w-full object-cover" priority />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--color-accent-success)] animate-pulse" />
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Portal Security Gateway</span>
              </div>
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)]">Enterprise Single Sign-On</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-surface)] px-2.5 py-1 text-[0.6875rem] font-bold text-[var(--color-success-text)]">
            <ShieldCheck className="h-3.5 w-3.5" /> 2FA Ready
          </span>
        </div>

        {/* Console Details & Live Readiness */}
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-text-tertiary)]">Environment</span>
              <span className="text-xs font-bold text-[var(--color-text-primary)]">Production Cloud</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-[var(--color-border-primary)] pt-2.5">
              <span className="text-xs font-medium text-[var(--color-text-tertiary)]">Encryption & Compliance</span>
              <span className="flex items-center gap-1 text-xs font-bold text-[var(--color-text-primary)]">
                <Lock className="h-3 w-3 text-[var(--lp-gold)]" /> TLS 1.3 / AES-256
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-[var(--color-border-primary)] pt-2.5">
              <span className="text-xs font-medium text-[var(--color-text-tertiary)]">Active System Modules</span>
              <span className="text-xs font-bold text-[var(--color-accent-primary)]">E-Flyers, Forms & Membership</span>
            </div>
          </div>

          {/* Quick Direct Sign-In Action */}
          <div className="pt-2">
            <Link
              href="/login"
              className="group flex h-12 w-full items-center justify-between rounded-xl bg-[var(--lp-ink)] px-5 text-sm font-semibold text-[var(--color-text-inverse)] shadow-lg transition duration-200 hover:bg-[var(--lp-ink-raised)] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-gold)]"
            >
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-[var(--lp-gold-bright)] transition-transform duration-200 group-hover:scale-110" />
                Sign In to Admin Portal
              </span>
              <ArrowRight className="h-4 w-4 text-[var(--lp-gold)] transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="flex items-center justify-center gap-4 pt-1 text-center text-[0.75rem] text-[var(--color-text-tertiary)]">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-accent-success)]" /> TOTP Authenticator
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-[var(--lp-gold)]" /> S3 Media Integrated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

