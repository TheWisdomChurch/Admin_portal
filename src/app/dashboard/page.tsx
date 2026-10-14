'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  ClipboardList,
  Command,
  ExternalLink,
  LineChart,
  Megaphone,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { withAuth } from '@/providers/withAuth';
import { useDashboardSnapshot, type DashboardSnapshot } from '@/hooks/useDashboardSnapshot';
import { Button } from '@/ui/Button';
import { StatCard } from '@/ui/StatCard';
import { Panel } from '@/ui/Panel';

type RawRecord = Record<string, unknown>;
type InsightTone = 'warning' | 'info' | 'danger' | 'success';
type Insight = { title: string; description: string; tone: InsightTone; href?: string; actionLabel?: string };

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : 'Unavailable';
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asRecord(value: unknown): RawRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RawRecord) : {};
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function buildInsights(snapshot: DashboardSnapshot): Insight[] {
  const insights: Insight[] = [];
  const lowStock = snapshot.storeProducts.filter((item) => {
    const stock = numberValue(asRecord(item).stock);
    return stock > 0 && stock <= 5;
  }).length;

  snapshot.decisionInsights?.recommendations.forEach((recommendation) => {
    const normalized = recommendation.toLowerCase();
    const workforceRecommendation = normalized.includes('volunteer') || normalized.includes('workforce');
    const memberRecommendation = normalized.includes('member') || normalized.includes('retention');
    const submissionRecommendation = normalized.includes('submission') || normalized.includes('campaign');
    insights.push({
      title: workforceRecommendation
        ? 'Workforce action recommended'
        : memberRecommendation
          ? 'Member engagement action recommended'
          : submissionRecommendation
            ? 'Follow-up action recommended'
            : 'Operations are on track',
      description: recommendation,
      tone: normalized.includes('healthy') ? 'success' : normalized.includes('low') || normalized.includes('dropping') ? 'danger' : 'info',
      href: workforceRecommendation
        ? '/dashboard/workforce'
        : memberRecommendation
          ? '/dashboard/members'
          : submissionRecommendation
            ? '/dashboard/forms'
            : '/dashboard/analytics',
      actionLabel: workforceRecommendation
        ? 'Open workforce'
        : memberRecommendation
          ? 'Open members'
          : submissionRecommendation
            ? 'Open forms'
            : 'View analytics',
    });
  });

  if (lowStock > 0) {
    insights.push({
      title: 'Store items are running low',
      description: `${formatNumber(lowStock)} active product${lowStock === 1 ? '' : 's'} at low stock — restock before orders are affected.`,
      tone: 'warning',
      href: '/dashboard/store',
      actionLabel: 'Review inventory',
    });
  }

  if (insights.length === 0 && snapshot.failedSources.length > 0) {
    insights.push({
      title: 'Live insight data unavailable',
      description: 'No operational conclusion was generated because one or more authoritative sources failed to load.',
      tone: 'warning',
    });
  } else if (insights.length === 0) {
    insights.push({
      title: 'Everything looks on track',
      description: 'No attention flags were detected from current operational data.',
      tone: 'success',
    });
  }

  return insights;
}

const toneStyles: Record<InsightTone, string> = {
  warning: 'bg-[var(--color-warning-surface)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]',
  info: 'bg-[var(--color-info-surface)] text-[var(--color-info-text)] border-[var(--color-info-border)]',
  danger: 'bg-[var(--color-danger-surface)] text-[var(--color-danger-text)] border-[var(--color-danger-border)]',
  success: 'bg-[var(--color-success-surface)] text-[var(--color-success-text)] border-[var(--color-success-border)]',
};

const quickLinks = [
  { href: '/dashboard/forms', label: 'Program Forms & E-Flyers', icon: Sparkles },
  { href: '/dashboard/event', label: 'Church Events', icon: CalendarDays },
  { href: '/dashboard/members', label: 'Members Directory', icon: Users },
  { href: '/dashboard/email-marketing', label: 'Email Campaigns', icon: Megaphone },
  { href: '/dashboard/store', label: 'Church Store', icon: ShoppingBag },
  { href: '/dashboard/analytics', label: 'Operational Analytics', icon: LineChart },
];

const commands = [
  { label: 'Go to Dashboard', href: '/dashboard' },
  { label: 'Create New Program Form', href: '/dashboard/forms/new' },
  { label: 'Manage Forms & E-Flyers', href: '/dashboard/forms' },
  { label: 'Manage Church Events', href: '/dashboard/event' },
  { label: 'Review Members Directory', href: '/dashboard/members' },
  { label: 'Launch Email Campaign', href: '/dashboard/email-marketing' },
  { label: 'Review Workforce', href: '/dashboard/workforce' },
  { label: 'Check Giving & Tithes', href: '/dashboard/giving' },
  { label: 'Portal Settings', href: '/dashboard/settings' },
];

function DashboardPage() {
  const { data, isLoading, isFetching, refetch } = useDashboardSnapshot();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const pressed = isMac ? event.metaKey && event.key.toLowerCase() === 'k' : event.ctrlKey && event.key.toLowerCase() === 'k';
      if (pressed) {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === 'Escape') setCommandOpen(false);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const insights = useMemo(() => (data ? buildInsights(data) : []), [data]);

  const totalMembers = data?.memberStats?.total ?? null;
  const activeMembers = data?.memberStats?.active ?? null;
  const upcomingEventCount = data?.analytics?.upcomingEvents ?? null;
  const totalSubmissions = data?.formStats?.totalSubmissions ?? null;
  const workforceServing = data?.workforceStats ? numberValue(data.workforceStats.byStatus.serving) : null;
  const workforceTotal = data?.workforceStats?.total ?? null;

  const kpis = [
    {
      label: 'Members',
      value: formatNumber(totalMembers),
      trend: `${formatNumber(activeMembers)} active members`,
      icon: <Users className="h-5 w-5" />,
      tone: 'info' as const,
    },
    {
      label: 'Upcoming Programs',
      value: formatNumber(upcomingEventCount),
      trend: 'Active in 30 days',
      icon: <CalendarDays className="h-5 w-5" />,
      tone: 'success' as const,
    },
    {
      label: 'Form Registrations',
      value: formatNumber(totalSubmissions),
      trend: 'Confirmed attendees',
      icon: <ClipboardList className="h-5 w-5" />,
      tone: 'default' as const,
    },
    {
      label: 'Workforce Serving',
      value: formatNumber(workforceServing),
      trend: `of ${formatNumber(workforceTotal)} assigned`,
      icon: <UserPlus className="h-5 w-5" />,
      tone: 'warning' as const,
    },
  ];

  const activePrograms = useMemo(() => {
    return (data?.events || []).filter((e) => e.status === 'upcoming' || e.status === 'ongoing').slice(0, 3);
  }, [data?.events]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {getGreeting()}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
            Wisdom Church operations, program registrations, and executive intelligence overview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCommandOpen(true)} icon={<Command className="h-4 w-4" />}>
            Search (Cmd+K)
          </Button>
          <Button variant="outline" onClick={() => void refetch()} loading={isFetching} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
          <Link href="/dashboard/forms/new">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New Program Form
            </Button>
          </Link>
        </div>
      </div>

      {data?.failedSources.length ? (
        <Panel className="border-[var(--color-warning-border)] bg-[var(--color-warning-surface)]">
          <p className="text-sm font-semibold text-[var(--color-warning-text)]">
            Some live sources could not be loaded: {data.failedSources.join(', ')}. Available metrics are displayed.
          </p>
        </Panel>
      ) : null}

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} value={kpi.value} trend={kpi.trend} icon={kpi.icon} tone={kpi.tone} />
        ))}
      </section>

      {/* Active Programs & E-Flyers Showcase */}
      <Panel>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--lp-gold)]" />
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Active Programs & E-Flyers Pulse</h2>
          </div>
          <Link href="/dashboard/forms" className="text-xs font-semibold text-[var(--color-accent-primary)] hover:underline inline-flex items-center gap-1">
            View All Program Forms <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {activePrograms.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activePrograms.map((program) => {
              const flyerUrl = program.bannerImage || program.image;
              return (
                <div
                  key={program.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--color-background-tertiary)]">
                    {flyerUrl ? (
                      <Image
                        src={flyerUrl}
                        alt={program.title}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-105"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-medium text-[var(--color-text-tertiary)]">
                        No Flyer Image
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                      {program.category || 'Program'}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] line-clamp-1">{program.title}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
                      <Calendar className="h-3.5 w-3.5" /> {program.date || 'Upcoming'} {program.time ? `• ${program.time}` : ''}
                    </p>
                    {program.location && (
                      <p className="mt-1 text-xs text-[var(--color-text-tertiary)] line-clamp-1">
                        📍 {program.location}
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-primary)] pt-3 text-xs">
                      <span className="font-semibold text-[var(--color-text-secondary)]">
                        👥 {formatNumber(program.attendees)} Registered
                      </span>
                      <Link
                        href={`/dashboard/forms`}
                        className="inline-flex items-center gap-1 font-bold text-[var(--color-accent-primary)] hover:underline"
                      >
                        Manage Form <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border-secondary)] p-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-[var(--color-text-tertiary)]" />
            <p className="mt-2 text-sm font-semibold text-[var(--color-text-secondary)]">No programs scheduled this week</p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Create a program form to publish registrations and status flyers.</p>
            <div className="mt-4">
              <Link href="/dashboard/forms/new">
                <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />}>
                  Create Program Form
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Panel>

      {/* Needs Your Attention / Operational Insights */}
      <Panel>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-accent-primary)]" />
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">Operational Readiness & Insights</h2>
          {data?.decisionInsights ? (
            <span className="ml-auto rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
              Readiness Score: {Math.round(data.decisionInsights.signals.decisionReadinessScore)}%
            </span>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {insights.map((insight) => (
            <div key={insight.title} className={`rounded-2xl border p-4 ${toneStyles[insight.tone]}`}>
              <p className="text-sm font-bold">{insight.title}</p>
              <p className="mt-1 text-xs leading-5 opacity-90">{insight.description}</p>
              {insight.href && insight.actionLabel ? (
                <Link href={insight.href} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold underline-offset-4 hover:underline">
                  {insight.actionLabel} <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>

      {/* Quick Navigation Tiles */}
      <Panel>
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">Quick Navigation</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-background-hover)] shadow-sm"
              >
                <span className="inline-flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  {link.label}
                </span>
                <ArrowRight className="h-4 w-4 text-[var(--color-text-tertiary)]" />
              </Link>
            );
          })}
        </div>
      </Panel>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onRefresh={() => void refetch()} />
    </div>
  );
}

function CommandPalette({ open, onClose, onRefresh }: { open: boolean; onClose: () => void; onRefresh: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  if (!open) return null;

  const allCommands = [
    ...commands.map((command) => ({ label: command.label, hint: command.href, action: () => router.push(command.href) })),
    { label: 'Refresh dashboard data', hint: 'Reload live snapshot', action: onRefresh },
  ].filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(search.toLowerCase().trim()));

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && allCommands[0]) {
      allCommands[0].action();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-20 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKey}
      >
        <div className="flex items-center gap-3 border-b border-[var(--color-border-secondary)] px-4 py-3">
          <Command className="h-5 w-5 text-[var(--color-text-tertiary)]" />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pages and actions..."
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
          <button type="button" onClick={onClose} className="rounded-xl p-2 transition hover:bg-[var(--color-background-hover)]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {allCommands.map((command) => (
            <button
              key={command.label}
              type="button"
              onClick={() => {
                command.action();
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-[var(--color-background-hover)]"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{command.label}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">{command.hint}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--color-text-tertiary)]" />
            </button>
          ))}
          {allCommands.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--color-text-tertiary)]">No command matches your search.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-14 animate-pulse rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`dashboard-skeleton-${index}`} className="h-32 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
      <div className="h-40 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
    </div>
  );
}

export default withAuth(DashboardPage, { requiredRole: 'admin' });
