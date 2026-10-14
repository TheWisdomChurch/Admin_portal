import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';

import {
  CAPABILITIES,
  CAPABILITIES_INTRO,
  CTA,
  FOOTER,
  HEADER,
  HERO,
  ORG,
} from '@/lib/landing/content';
import { HeroBackdrop } from '@/components/landing/HeroBackdrop';
import { ExecutiveGatewayCard } from '@/components/landing/ExecutiveGatewayCard';
import { Reveal } from '@/components/landing/Reveal';

/** One shared inset — the only place the page width + gutters are defined. */
const shell = 'mx-auto w-full max-w-(--content-max-width) px-5 sm:px-8 lg:px-12';

const btnPrimary =
  'inline-flex h-12 items-center justify-center gap-2 rounded-(--radius-button) bg-(--lp-ink) px-6 text-sm font-semibold text-(--color-text-inverse) shadow-(--lp-shadow-float) transition duration-200 hover:-translate-y-0.5 hover:bg-(--lp-ink-raised) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-background-secondary)';

const btnGhost =
  'inline-flex h-12 items-center justify-center gap-2 rounded-(--radius-button) border border-(--color-border-secondary) bg-[color-mix(in_srgb,var(--color-background-primary)_75%,transparent)] px-6 text-sm font-semibold text-(--color-text-primary) transition duration-200 hover:-translate-y-0.5 hover:border-(--color-border-focus) hover:bg-(--color-background-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus) focus-visible:ring-offset-2';

export default function HomePage() {
  return (
    <div className="landing public-form-light min-h-screen overflow-x-clip bg-(--color-background-secondary) text-(--color-text-primary)">
      <header className="sticky top-0 z-40 border-b border-(--lp-hairline) bg-[color-mix(in_srgb,var(--color-background-secondary)_95%,transparent)] backdrop-blur-xl">
        <div className={`${shell} flex h-(--lp-header-h) items-center justify-between gap-3`}>
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`${ORG.name} ${ORG.system} home`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-(--radius-control) border border-(--lp-hairline) bg-(--lp-ink) shadow-(--shadow-sm) sm:h-11 sm:w-11">
              <Image src={ORG.logoSrc} alt="" width={44} height={44} priority className="h-full w-full object-cover" />
            </span>
            <span className="hidden min-w-0 leading-none min-[380px]:block">
              <span className="block truncate text-sm font-bold tracking-[-0.01em] text-(--color-text-primary)">
                {ORG.name}
              </span>
              <span className="mt-1.5 block truncate text-[0.625rem] font-bold uppercase tracking-[0.2em] text-(--color-text-tertiary)">
                {ORG.system}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="mr-1 hidden items-center gap-2 text-xs font-semibold text-(--color-text-tertiary) lg:flex">
              <ShieldCheck className="h-4 w-4 text-(--lp-gold)" /> {HEADER.assurance}
            </span>
            <Link
              href={HEADER.signIn.href}
              className="inline-flex h-10 items-center justify-center rounded-(--radius-button) border border-(--color-border-secondary) bg-(--color-background-primary) px-4 text-sm font-semibold text-(--color-text-primary) transition hover:border-(--color-border-focus) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus) sm:h-11"
            >
              {HEADER.signIn.label}
            </Link>
            <Link
              href={HEADER.requestAccess.href}
              className="hidden h-11 items-center justify-center gap-2 rounded-(--radius-button) bg-(--lp-ink) px-4 text-sm font-semibold text-(--color-text-inverse) shadow-(--shadow-sm) transition hover:bg-(--lp-ink-raised) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus) sm:inline-flex"
            >
              {HEADER.requestAccess.label} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---- 1. Hero with Executive Gateway Card ------------------------ */}
        <section className="relative isolate">
          <HeroBackdrop />
          <div
            className={`${shell} grid items-center gap-12 py-14 sm:py-20 xl:min-h-[calc(90svh-var(--lp-header-h))] xl:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] xl:gap-16 xl:py-24`}
          >
            <Reveal className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-(--lp-gold-line) bg-(--color-background-primary)/80 px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-(--lp-gold-strong) shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-(--lp-gold-bright)" />
                {HERO.eyebrow}
              </span>

              <h1 className="lp-h1 mt-6 text-balance text-(--color-text-primary)">
                <span className="block">{HERO.titleLead}</span>
                <span className="block text-(--lp-gold)">{HERO.titleAccent}</span>
              </h1>

              <p className="mt-6 max-w-xl text-pretty text-base leading-8 text-(--color-text-secondary) sm:text-lg">
                {HERO.subtitle}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href={HERO.primaryCta.href} className={btnPrimary}>
                  {HERO.primaryCta.label} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href={HERO.secondaryCta.href} className={btnGhost}>
                  {HERO.secondaryCta.label}
                </Link>
              </div>

              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-(--lp-hairline) pt-6">
                {HERO.markers.map((marker) => (
                  <li key={marker} className="flex items-center gap-2 text-xs font-semibold text-(--color-text-secondary)">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--lp-gold-surface) text-(--lp-gold-strong)">
                      <Check className="h-3 w-3" />
                    </span>
                    {marker}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={120} className="min-w-0">
              <ExecutiveGatewayCard />
            </Reveal>
          </div>
        </section>

        {/* ---- 2. Core Capabilities (3 Essential Pillars) ---------------- */}
        <section className="border-t border-(--color-border-primary) bg-(--color-background-primary)">
          <div className={`${shell} py-14 sm:py-16 lg:py-20`}>
            <Reveal className="max-w-2xl">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-(--lp-gold)">
                {CAPABILITIES_INTRO.eyebrow}
              </p>
              <h2 className="lp-h2 mt-3 text-balance text-(--color-text-primary)">
                {CAPABILITIES_INTRO.title}
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-6 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.slice(0, 3).map(({ icon: Icon, title, description }, index) => (
                <Reveal
                  key={title}
                  delay={index * 70}
                  as="article"
                  className="group flex min-w-0 flex-col rounded-3xl border border-(--color-border-primary) bg-(--color-background-secondary) p-7 transition-all duration-200 hover:-translate-y-1 hover:border-(--lp-gold) hover:shadow-lg sm:p-8"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--lp-gold-surface) text-(--lp-gold) transition-transform duration-200 group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-pretty text-base font-bold tracking-tight text-(--color-text-primary)">
                    {title}
                  </h3>
                  <p className="mt-2.5 text-pretty text-sm leading-6 text-(--color-text-tertiary)">
                    {description}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---- 3. Executive Security & Sign-in CTA --------------------- */}
        <section className="relative isolate overflow-hidden bg-(--lp-ink) text-(--lp-on-ink)">
          <span
            aria-hidden="true"
            className="lp-glow lp-glow-b absolute right-[-8%] top-1/2 h-144 w-xl -translate-y-1/2 bg-[radial-gradient(circle_at_center,var(--lp-gold-bright),transparent_70%)] opacity-[0.12]"
          />
          <div className={`${shell} relative flex flex-col gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:py-24`}>
            <Reveal className="max-w-2xl">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-(--lp-gold-bright)">
                {CTA.eyebrow}
              </p>
              <h2 className="lp-h2 mt-4 text-balance text-(--lp-on-ink)">{CTA.title}</h2>
              <p className="mt-3 text-pretty text-sm leading-7 text-(--lp-on-ink-dim)">{CTA.subtitle}</p>
            </Reveal>
            <Reveal delay={100} className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={CTA.primary.href}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-(--radius-button) bg-(--brand-500) px-6 text-sm font-semibold text-(--lp-ink) transition duration-200 hover:-translate-y-0.5 hover:bg-(--brand-400) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-400) focus-visible:ring-offset-2 focus-visible:ring-offset-(--lp-ink)"
              >
                {CTA.primary.label} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={CTA.secondary.href}
                className="inline-flex h-12 items-center justify-center rounded-(--radius-button) border border-(--lp-hairline-ink) px-6 text-sm font-semibold text-(--lp-on-ink) transition duration-200 hover:-translate-y-0.5 hover:bg-(--lp-hairline-ink) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--lp-on-ink-faint)"
              >
                {CTA.secondary.label}
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-(--color-border-primary) bg-(--color-background-secondary)">
        <div
          className={`${shell} flex flex-col gap-4 py-7 text-xs text-(--color-text-tertiary) sm:flex-row sm:items-center sm:justify-between`}
        >
          <p className="text-pretty">
            © {new Date().getFullYear()} {ORG.name}. {FOOTER.note}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {FOOTER.links.map((link) => (
              <Link key={link.href} href={link.href} className="font-semibold transition hover:text-(--color-text-primary)">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
