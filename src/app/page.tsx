import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';

import {
  ASSURANCE,
  CAPABILITIES,
  CAPABILITIES_INTRO,
  CTA,
  FOOTER,
  HEADER,
  HERO,
  ORG,
} from '@/lib/landing/content';
import { HeroBackdrop } from '@/components/landing/HeroBackdrop';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { Reveal } from '@/components/landing/Reveal';

/** One shared inset — the only place the page width + gutters are defined. */
const shell = 'mx-auto w-full max-w-[var(--content-max-width)] px-5 sm:px-8 lg:px-12';

const btnPrimary =
  'inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[var(--lp-ink)] px-6 text-sm font-semibold text-[var(--color-text-inverse)] shadow-[var(--lp-shadow-float)] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--lp-ink-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-secondary)]';

const btnGhost =
  'inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[color-mix(in_srgb,var(--color-background-primary)_75%,transparent)] px-6 text-sm font-semibold text-[var(--color-text-primary)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-focus)] hover:bg-[var(--color-background-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2';

export default function HomePage() {
  return (
    <div className="landing public-form-light min-h-screen overflow-x-clip bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-40 border-b border-[var(--lp-hairline)] bg-[color-mix(in_srgb,var(--color-background-secondary)_95%,transparent)] backdrop-blur-xl">
        <div className={`${shell} flex h-[var(--lp-header-h)] items-center justify-between gap-3`}>
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`${ORG.name} ${ORG.system} home`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border border-[var(--lp-hairline)] bg-[var(--lp-ink)] shadow-[var(--shadow-sm)] sm:h-11 sm:w-11">
              <Image src={ORG.logoSrc} alt="" width={44} height={44} priority className="h-full w-full object-cover" />
            </span>
            <span className="hidden min-w-0 leading-none min-[380px]:block">
              <span className="block truncate text-sm font-bold tracking-[-0.01em] text-[var(--color-text-primary)]">
                {ORG.name}
              </span>
              <span className="mt-1.5 block truncate text-[0.625rem] font-bold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                {ORG.system}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="mr-1 hidden items-center gap-2 text-xs font-semibold text-[var(--color-text-tertiary)] lg:flex">
              <ShieldCheck className="h-4 w-4 text-[var(--lp-gold)]" /> {HEADER.assurance}
            </span>
            <Link
              href={HEADER.signIn.href}
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-border-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] sm:h-11"
            >
              {HEADER.signIn.label}
            </Link>
            <Link
              href={HEADER.requestAccess.href}
              className="hidden h-11 items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[var(--lp-ink)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--lp-ink-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] sm:inline-flex"
            >
              {HEADER.requestAccess.label} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---- Hero -------------------------------------------------------- */}
        <section className="relative isolate">
          <HeroBackdrop />
          <div
            className={`${shell} grid items-center gap-12 py-14 sm:py-20 xl:min-h-[calc(90svh-var(--lp-header-h))] xl:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] xl:gap-16 xl:py-24`}
          >
            <Reveal className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--lp-gold-line)] bg-[color-mix(in_srgb,var(--color-background-primary)_80%,transparent)] px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[var(--lp-gold-strong)] shadow-[var(--shadow-sm)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--lp-gold-bright)]" />
                {HERO.eyebrow}
              </span>

              <h1 className="lp-h1 mt-6 text-balance text-[var(--color-text-primary)]">
                <span className="block">{HERO.titleLead}</span>
                <span className="block text-[var(--lp-gold)]">{HERO.titleAccent}</span>
              </h1>

              <p className="mt-6 max-w-xl text-pretty text-base leading-8 text-[var(--color-text-secondary)] sm:text-lg">
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

              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--lp-hairline)] pt-6">
                {HERO.markers.map((marker) => (
                  <li key={marker} className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--lp-gold-surface)] text-[var(--lp-gold-strong)]">
                      <Check className="h-3 w-3" />
                    </span>
                    {marker}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={120} className="min-w-0">
              <ProductPreview />
            </Reveal>
          </div>
        </section>

        {/* ---- Capabilities --------------------------------------------- */}
        <section className="border-t border-[var(--color-border-primary)] bg-[var(--color-background-primary)]">
          <div className={`${shell} py-14 sm:py-16 lg:py-20`}>
            <Reveal className="max-w-2xl">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lp-gold)]">
                {CAPABILITIES_INTRO.eyebrow}
              </p>
              <h2 className="lp-h2 mt-3 text-balance text-[var(--color-text-primary)]">
                {CAPABILITIES_INTRO.title}
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-border-primary)] sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
              {CAPABILITIES.map(({ icon: Icon, title, description }, index) => (
                <Reveal
                  key={title}
                  delay={index * 70}
                  as="article"
                  className="group flex min-w-0 flex-col bg-[var(--color-background-primary)] px-6 py-7 transition-colors duration-200 hover:bg-[var(--color-background-secondary)] sm:px-7 lg:py-8"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--lp-gold-surface)] text-[var(--lp-gold)] transition-transform duration-200 group-hover:-translate-y-0.5">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-pretty text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
                    {title}
                  </h3>
                  <p className="mt-2 text-pretty text-sm leading-6 text-[var(--color-text-tertiary)]">
                    {description}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Assurance ----------------------------------------------- */}
        <section className="bg-[var(--color-background-secondary)]">
          <div className={`${shell} py-16 sm:py-20 lg:py-24`}>
            <Reveal className="max-w-2xl">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lp-gold)]">
                {ASSURANCE.eyebrow}
              </p>
              <h2 className="lp-h2 mt-4 text-balance text-[var(--color-text-primary)]">{ASSURANCE.title}</h2>
              <p className="mt-4 text-pretty text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                {ASSURANCE.description}
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ASSURANCE.points.map(({ icon: Icon, title, description }, index) => (
                <Reveal
                  key={title}
                  delay={index * 70}
                  className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] p-6 shadow-[var(--shadow-sm)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--lp-shadow-float)] sm:p-7"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--lp-gold-surface)] text-[var(--lp-gold)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-pretty text-sm font-bold tracking-tight text-[var(--color-text-primary)]">{title}</h3>
                  <p className="text-pretty text-[0.8125rem] leading-6 text-[var(--color-text-tertiary)]">{description}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Call to action ----------------------------------------- */}
        <section className="relative isolate overflow-hidden bg-[var(--lp-ink)] text-[var(--lp-on-ink)]">
          <span
            aria-hidden="true"
            className="lp-glow lp-glow-b absolute -right-[8%] top-1/2 h-[36rem] w-[36rem] -translate-y-1/2 bg-[radial-gradient(circle_at_center,var(--lp-gold-bright),transparent_70%)] opacity-[0.12]"
          />
          <div className={`${shell} relative flex flex-col gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:py-24`}>
            <Reveal className="max-w-2xl">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lp-gold-bright)]">
                {CTA.eyebrow}
              </p>
              <h2 className="lp-h2 mt-4 text-balance text-[var(--lp-on-ink)]">{CTA.title}</h2>
              <p className="mt-3 text-pretty text-sm leading-7 text-[var(--lp-on-ink-dim)]">{CTA.subtitle}</p>
            </Reveal>
            <Reveal delay={100} className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={CTA.primary.href}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[var(--brand-500)] px-6 text-sm font-semibold text-[var(--lp-ink)] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--brand-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lp-ink)]"
              >
                {CTA.primary.label} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={CTA.secondary.href}
                className="inline-flex h-12 items-center justify-center rounded-[var(--radius-button)] border border-[var(--lp-hairline-ink)] px-6 text-sm font-semibold text-[var(--lp-on-ink)] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--lp-hairline-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-on-ink-faint)]"
              >
                {CTA.secondary.label}
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border-primary)] bg-[var(--color-background-secondary)]">
        <div
          className={`${shell} flex flex-col gap-4 py-7 text-xs text-[var(--color-text-tertiary)] sm:flex-row sm:items-center sm:justify-between`}
        >
          <p className="text-pretty">
            © {new Date().getFullYear()} {ORG.name}. {FOOTER.note}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {FOOTER.links.map((link) => (
              <Link key={link.href} href={link.href} className="font-semibold transition hover:text-[var(--color-text-primary)]">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
