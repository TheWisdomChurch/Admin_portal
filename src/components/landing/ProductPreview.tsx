import Image from 'next/image';
import { BarChart3, ChevronRight, ShieldCheck } from 'lucide-react';
import { ORG, PREVIEW, type ReadinessTone } from '@/lib/landing/content';

const TONE_DOT: Record<ReadinessTone, string> = {
  success: 'bg-[var(--color-accent-success)]',
  warning: 'bg-[var(--color-accent-warning)]',
  info: 'bg-[var(--color-accent-info)]',
};

/**
 * A calm, self-contained representation of the administration workspace.
 * Every label comes from PREVIEW in content.ts; the layout carries no fixed
 * heights and every flex/grid child is min-w-0, so it never clips or forces
 * horizontal scroll from ~320px up to ultrawide.
 */
export function ProductPreview() {
  const InsightIcon = PREVIEW.insight.icon;
  const FloatIcon = PREVIEW.float.icon;

  return (
    <div className="relative mx-auto w-full max-w-[40rem] lg:mx-0">
      <div className="absolute -inset-3 rounded-[calc(var(--radius-shell)+10px)] border border-[var(--lp-gold-line)] bg-[color-mix(in_srgb,var(--color-background-primary)_35%,transparent)] backdrop-blur-sm sm:-inset-4" />

      <div className="relative overflow-hidden rounded-[var(--radius-shell)] border border-[var(--lp-hairline)] bg-[var(--lp-ink)] p-1.5 shadow-[var(--lp-shadow-hero)] sm:p-2">
        <div className="overflow-hidden rounded-[calc(var(--radius-shell)-6px)] bg-[var(--color-background-primary)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-primary)] px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex shrink-0 gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-secondary)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-secondary)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--lp-gold-bright)]" />
              </span>
              <span className="truncate text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                {PREVIEW.label}
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-success-surface)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--color-success-text)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-success)]" />
              {PREVIEW.status}
            </span>
          </div>

          <div className="grid sm:grid-cols-[9.5rem_minmax(0,1fr)]">
            <aside className="hidden min-w-0 flex-col border-r border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-4 sm:flex">
              <div className="mb-5 flex items-center gap-2">
                <Image src={ORG.logoSrc} alt="" width={24} height={24} className="h-6 w-6 rounded-md object-cover" />
                <span className="truncate text-[0.625rem] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                  Wisdom HQ
                </span>
              </div>
              <nav className="flex flex-col gap-1">
                {PREVIEW.nav.map((item, index) => (
                  <span
                    key={item}
                    className={`truncate rounded-[var(--radius-control)] px-3 py-2 text-xs font-semibold ${
                      index === 0
                        ? 'bg-[var(--lp-ink)] text-[var(--color-text-inverse)]'
                        : 'text-[var(--color-text-tertiary)]'
                    }`}
                  >
                    {item}
                  </span>
                ))}
              </nav>
              <div className="mt-6 rounded-[var(--radius-control)] border border-[var(--lp-gold-line)] bg-[var(--lp-gold-surface)] p-3">
                <ShieldCheck className="h-4 w-4 text-[var(--lp-gold)]" />
                <p className="mt-2 text-[0.6875rem] font-semibold text-[var(--color-text-secondary)]">
                  {PREVIEW.guard.title}
                </p>
                <p className="mt-1 text-[0.625rem] leading-4 text-[var(--color-text-tertiary)]">
                  {PREVIEW.guard.note}
                </p>
              </div>
            </aside>

            <div className="min-w-0 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--lp-gold)]">
                    {PREVIEW.workspaceEyebrow}
                  </p>
                  <h3 className="mt-1 text-base font-bold tracking-tight text-[var(--color-text-primary)] sm:text-lg">
                    {PREVIEW.heading}
                  </h3>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-background-tertiary)]">
                  <BarChart3 className="h-4 w-4 text-[var(--color-text-secondary)]" />
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                {PREVIEW.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="min-w-0 rounded-[var(--radius-control)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] p-3 shadow-[var(--shadow-sm)]"
                  >
                    <p className="truncate text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                      {metric.label}
                    </p>
                    <p className="mt-1.5 truncate text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-3">
                <div className="min-w-0 rounded-[var(--radius-control)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] p-4 shadow-[var(--shadow-sm)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {PREVIEW.readiness.title}
                      </p>
                      <p className="mt-0.5 text-[0.625rem] text-[var(--color-text-tertiary)]">
                        {PREVIEW.readiness.note}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--lp-gold-surface)] px-2 py-1 text-[0.625rem] font-bold uppercase tracking-[0.06em] text-[var(--lp-gold-strong)]">
                      {PREVIEW.readiness.status}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {PREVIEW.readiness.rows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-2 text-[0.6875rem] font-semibold text-[var(--color-text-secondary)]"
                      >
                        <span className="truncate">{row.label}</span>
                        <span className="inline-flex shrink-0 items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[row.tone]}`} />
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 rounded-[var(--radius-control)] bg-[var(--lp-ink-raised)] p-4 text-[var(--lp-on-ink)] shadow-[var(--shadow-sm)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] bg-[var(--lp-hairline-ink)]">
                    <InsightIcon className="h-4 w-4 text-[var(--lp-gold-bright)]" />
                  </span>
                  <p className="mt-3.5 text-xs font-semibold">{PREVIEW.care.title}</p>
                  <p className="mt-1 text-[0.625rem] leading-4 text-[var(--lp-on-ink-dim)]">
                    {PREVIEW.care.note}
                  </p>
                  <div className="mt-3.5 space-y-2">
                    {PREVIEW.care.items.map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-[var(--lp-hairline-ink)] px-3 py-2 text-[0.625rem]"
                      >
                        <span className="truncate">{item}</span>
                        <b className="shrink-0">Live</b>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--lp-gold-line)] bg-[var(--lp-gold-surface)] p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[color-mix(in_srgb,var(--brand-500)_20%,transparent)]">
                    <InsightIcon className="h-4 w-4 text-[var(--lp-gold-strong)]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.6875rem] font-semibold text-[var(--color-text-primary)]">
                      {PREVIEW.insight.title}
                    </p>
                    <p className="mt-0.5 truncate text-[0.625rem] text-[var(--color-text-tertiary)]">
                      {PREVIEW.insight.note}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--lp-gold)]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-2 hidden items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] p-3 shadow-[var(--lp-shadow-float)] sm:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-success-surface)] text-[var(--color-success-text)]">
          <FloatIcon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[0.6875rem] font-semibold text-[var(--color-text-primary)]">{PREVIEW.float.title}</p>
          <p className="mt-0.5 text-[0.625rem] text-[var(--color-text-tertiary)]">{PREVIEW.float.note}</p>
        </div>
      </div>
    </div>
  );
}
