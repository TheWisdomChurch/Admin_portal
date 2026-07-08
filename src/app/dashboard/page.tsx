'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Command,
  LineChart,
  Megaphone,
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
type Insight = { title: string; description: string; tone: InsightTone };

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value?: number | null): string {
  return numberFormatter.format(typeof value === 'number' && Number.isFinite(value) ? value : 0);
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
  const upcoming = numberValue((snapshot.analytics as RawRecord | null)?.upcomingEvents);
  const totalMembers = numberValue((snapshot.memberStats as RawRecord | null)?.total);
  const newThisMonth = numberValue((snapshot.newMembers as RawRecord | null)?.thisMonth);
  const totalWorkforce = numberValue((snapshot.workforceStats as RawRecord | null)?.total);
  const serving = numberValue(asRecord((snapshot.workforceStats as RawRecord | null)?.byStatus).serving);
  const lowStock = snapshot.storeProducts.filter((item) => {
    const stock = numberValue(asRecord(item).stock);
    return stock > 0 && stock <= 5;
  }).length;

  if (upcoming === 0) {
    insights.push({
      title: 'No upcoming events scheduled',
      description: 'Add upcoming services, outreach, or programs to keep the calendar visible to your team.',
      tone: 'warning',
    });
  }

  if (totalMembers > 0 && newThisMonth === 0) {
    insights.push({
      title: 'No new members recorded this month',
      description: 'Review intake forms and follow-up workflows to see why acquisition has stalled.',
      tone: 'info',
    });
  }

  if (totalWorkforce > 0 && serving / Math.max(totalWorkforce, 1) < 0.5) {
    insights.push({
      title: 'Workforce engagement is below target',
      description: 'Less than half of workforce profiles are currently marked as serving.',
      tone: 'danger',
    });
  }

  if (lowStock > 0) {
    insights.push({
      title: 'Store items are running low',
      description: `${formatNumber(lowStock)} active product${lowStock === 1 ? '' : 's'} at low stock — restock before orders are affected.`,
      tone: 'warning',
    });
  }

  if (insights.length === 0) {
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
  { href: '/dashboard/event', label: 'Events', icon: CalendarDays },
  { href: '/dashboard/members', label: 'Members', icon: Users },
  { href: '/dashboard/forms', label: 'Forms', icon: ClipboardList },
  { href: '/dashboard/email-marketing', label: 'Campaigns', icon: Megaphone },
  { href: '/dashboard/store', label: 'Store', icon: ShoppingBag },
  { href: '/dashboard/analytics', label: 'Analytics', icon: LineChart },
];

const commands = [
  { label: 'Go to Dashboard', href: '/dashboard' },
  { label: 'Go to Analytics', href: '/dashboard/analytics' },
  { label: 'Go to Members', href: '/dashboard/members' },
  { label: 'Go to Events', href: '/dashboard/event' },
  { label: 'Go to Forms', href: '/dashboard/forms' },
  { label: 'Go to Administration', href: '/dashboard/administration' },
  { label: 'Go to Campaigns', href: '/dashboard/email-marketing' },
  { label: 'Go to Store', href: '/dashboard/store' },
  { label: 'Go to Settings', href: '/dashboard/settings' },
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

  const totalMembers = numberValue((data?.memberStats as RawRecord | null)?.total);
  const activeMembers = numberValue((data?.memberStats as RawRecord | null)?.active);
  const upcomingEventCount = numberValue((data?.analytics as RawRecord | null)?.upcomingEvents);
  const totalSubmissions = numberValue((data?.formStats as RawRecord | null)?.totalSubmissions);
  const workforceServing = numberValue(asRecord((data?.workforceStats as RawRecord | null)?.byStatus).serving);
  const workforceTotal = numberValue((data?.workforceStats as RawRecord | null)?.total);

  const kpis = [
    {
      label: 'Members',
      value: formatNumber(totalMembers),
      trend: `${formatNumber(activeMembers)} active`,
      icon: <Users className="h-5 w-5" />,
      tone: 'info' as const,
    },
    {
      label: 'Upcoming events',
      value: formatNumber(upcomingEventCount),
      trend: 'Next 30 days',
      icon: <CalendarDays className="h-5 w-5" />,
      tone: 'success' as const,
    },
    {
      label: 'Form submissions',
      value: formatNumber(totalSubmissions),
      trend: 'All time',
      icon: <ClipboardList className="h-5 w-5" />,
      tone: 'default' as const,
    },
    {
      label: 'Workforce serving',
      value: formatNumber(workforceServing),
      trend: `of ${formatNumber(workforceTotal)} total`,
      icon: <UserPlus className="h-5 w-5" />,
      tone: 'warning' as const,
    },
  ];

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">
            {getGreeting()}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
            Here&apos;s what needs your attention today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCommandOpen(true)} icon={<Command className="h-4 w-4" />}>
            Search
          </Button>
          <Button variant="outline" onClick={() => void refetch()} loading={isFetching} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} value={kpi.value} trend={kpi.trend} icon={kpi.icon} tone={kpi.tone} />
        ))}
      </section>

      <Panel>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-accent-primary)]" />
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Needs your attention</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {insights.map((insight) => (
            <div key={insight.title} className={`rounded-2xl border p-4 ${toneStyles[insight.tone]}`}>
              <p className="text-sm font-semibold">{insight.title}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">{insight.description}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Quick navigation</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-background-hover)]"
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" /> {link.label}
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
