'use client';

import { useMemo } from 'react';
import { Activity, BarChart3, CalendarDays, ClipboardList, LineChart as LineChartIcon, Megaphone, RefreshCw, ShoppingBag, Sparkles, Users } from 'lucide-react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

import { PageHeader } from '@/layouts';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { EmptyState } from '@/ui/EmptyState';
import { useDashboardSnapshot, type AuditLogRecord, type DashboardSnapshot } from '@/hooks/useDashboardSnapshot';
import { getChartPalette } from '@/lib/charts/palette';
import { useTheme } from '@/providers/ThemeProviders';
import { withAuth } from '@/providers/withAuth';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend);

type RawRecord = Record<string, unknown>;
type RecordType = 'event' | 'submission' | 'campaign' | 'product' | 'order' | 'audit';

type TimelineItem = {
  id: string;
  type: RecordType;
  title: string;
  description: string;
  time?: string;
  status?: string;
};

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

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asRecord(value: unknown): RawRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RawRecord) : {};
}

function formatDateTime(value?: string): string {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toDateValue(value?: string): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function extractArray<T = unknown>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = asRecord(payload);
  const candidates = [record.items, record.results, record.records, record.data, record.logs];
  const firstArray = candidates.find(Array.isArray);
  return Array.isArray(firstArray) ? (firstArray as T[]) : [];
}

function forecastNext(values: number[]): number | null {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length < 2) return null;

  const window = usable.slice(-3);
  const average = window.reduce((sum, value) => sum + value, 0) / window.length;
  const previous = usable[usable.length - 2] || 0;
  const current = usable[usable.length - 1] || 0;
  const momentum = current - previous;

  return Math.max(0, Math.round(average + momentum * 0.35));
}

function getRecordIcon(type: RecordType) {
  switch (type) {
    case 'event':
      return CalendarDays;
    case 'submission':
      return ClipboardList;
    case 'campaign':
      return Megaphone;
    case 'product':
    case 'order':
      return ShoppingBag;
    case 'audit':
      return Activity;
    default:
      return Sparkles;
  }
}

function buildTimeline(snapshot: DashboardSnapshot): TimelineItem[] {
  const recentSubmissions = extractArray<unknown>((snapshot.formStats as RawRecord | null)?.recent ?? []);
  const recentCampaigns = extractArray<unknown>((snapshot.marketing as RawRecord | null)?.recentCampaigns ?? []);

  const events: TimelineItem[] = snapshot.events.slice(0, 6).map((event) => {
    const raw = asRecord(event);
    return {
      id: `event-${stringValue(raw.id) || stringValue(raw.title)}`,
      type: 'event',
      title: stringValue(raw.title) || 'Untitled event',
      description: stringValue(raw.category) || 'Event',
      time: stringValue(raw.startDate) || stringValue(raw.date) || stringValue(raw.createdAt),
      status: stringValue(raw.status) || 'scheduled',
    };
  });

  const submissions: TimelineItem[] = recentSubmissions.slice(0, 6).map((submission) => {
    const raw = asRecord(submission);
    return {
      id: `submission-${stringValue(raw.id) || stringValue(raw.email)}`,
      type: 'submission',
      title: stringValue(raw.formTitle) || stringValue(raw.form_title) || 'Form response',
      description: stringValue(raw.name) || stringValue(raw.email) || 'Anonymous',
      time: stringValue(raw.createdAt) || stringValue(raw.created_at),
      status: stringValue(raw.status) || 'received',
    };
  });

  const campaigns: TimelineItem[] = recentCampaigns.slice(0, 6).map((campaign) => {
    const raw = asRecord(campaign);
    const failed = numberValue(raw.failed);
    return {
      id: `campaign-${stringValue(raw.id) || stringValue(raw.subject)}`,
      type: 'campaign',
      title: stringValue(raw.subject) || 'Untitled campaign',
      description: `Sent ${formatNumber(numberValue(raw.sent))} / ${formatNumber(numberValue(raw.targeted))}`,
      time: stringValue(raw.startedAt) || stringValue(raw.createdAt),
      status: failed > 0 ? 'attention' : 'sent',
    };
  });

  const audits: TimelineItem[] = snapshot.auditLogs.slice(0, 10).map((audit: AuditLogRecord) => ({
    id: `audit-${audit.id}`,
    type: 'audit',
    title: audit.action || audit.description || 'Audit event',
    description: `${audit.actor || 'System'} · ${audit.resource || 'Platform'}`,
    time: audit.createdAt || audit.created_at,
    status: audit.status || 'logged',
  }));

  return [...events, ...submissions, ...campaigns, ...audits]
    .sort((a, b) => toDateValue(b.time) - toDateValue(a.time))
    .slice(0, 16);
}

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
};

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
};

const horizontalBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  plugins: { legend: { display: false } },
  scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: { legend: { position: 'bottom' as const } },
};

function AnalyticsPage() {
  const { data, isLoading, isFetching, refetch } = useDashboardSnapshot();
  const { resolvedTheme } = useTheme();
  const chartPalette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);

  const monthlyStats = data?.analytics?.monthlyStats ?? [];
  const eventsByCategory = data?.analytics?.eventsByCategory ?? {};
  const recentSubmissions = useMemo(
    () => extractArray<unknown>((data?.formStats as RawRecord | null)?.recent ?? []),
    [data]
  );

  const submissionsTrend = useMemo(() => {
    const counts: Record<string, number> = {};
    recentSubmissions.forEach((submission) => {
      const raw = asRecord(submission);
      const date = stringValue(raw.createdAt) || stringValue(raw.created_at);
      if (!date) return;
      const key = new Date(date).toISOString().slice(0, 10);
      counts[key] = (counts[key] || 0) + 1;
    });
    const labels = Object.keys(counts).sort().slice(-14);
    return { labels, values: labels.map((label) => counts[label]) };
  }, [recentSubmissions]);

  const workforceDepartments = useMemo(
    () =>
      Object.entries(asRecord((data?.workforceStats as RawRecord | null)?.byDepartment))
        .map(([department, count]) => [department, numberValue(count)] as const)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8),
    [data]
  );

  const timeline = useMemo(() => (data ? buildTimeline(data) : []), [data]);

  const forecastEvents = forecastNext(monthlyStats.map((row) => row.events));
  const forecastAttendees = forecastNext(monthlyStats.map((row) => row.attendees));

  const totalMembers = numberValue((data?.memberStats as RawRecord | null)?.total);
  const activeMembers = numberValue((data?.memberStats as RawRecord | null)?.active);
  const newMembersThisMonth = numberValue((data?.newMembers as RawRecord | null)?.thisMonth);
  const newMembersThisYear = numberValue((data?.newMembers as RawRecord | null)?.thisYear);
  const workforceServing = numberValue(asRecord((data?.workforceStats as RawRecord | null)?.byStatus).serving);
  const workforceTotal = numberValue((data?.workforceStats as RawRecord | null)?.total);
  const activeProducts = data?.storeProducts.filter((item) => Boolean(asRecord(item).isActive ?? asRecord(item).is_active)).length ?? 0;
  const lowStockProducts =
    data?.storeProducts.filter((item) => {
      const stock = numberValue(asRecord(item).stock);
      return stock > 0 && stock <= 5;
    }).length ?? 0;

  const monthlyChartData = {
    labels: monthlyStats.map((row) => row.month),
    datasets: [
      {
        label: 'Events',
        data: monthlyStats.map((row) => row.events),
        borderColor: chartPalette.series.emerald.line,
        backgroundColor: chartPalette.series.emerald.fill,
        borderWidth: 3,
        fill: true,
        tension: 0.42,
        pointRadius: 3,
      },
      {
        label: 'Attendees',
        data: monthlyStats.map((row) => row.attendees),
        borderColor: chartPalette.series.blue.line,
        backgroundColor: chartPalette.series.blue.fill,
        borderWidth: 3,
        fill: true,
        tension: 0.42,
        pointRadius: 3,
      },
    ],
  };

  const categoryChartData = {
    labels: Object.keys(eventsByCategory).map(normalizeLabel),
    datasets: [
      {
        data: Object.values(eventsByCategory),
        backgroundColor: chartPalette.categorical,
        borderColor: chartPalette.surface,
        borderWidth: 4,
        hoverOffset: 8,
      },
    ],
  };

  const submissionsChartData = {
    labels: submissionsTrend.labels.map((label) => new Date(label).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Submissions',
        data: submissionsTrend.values,
        backgroundColor: chartPalette.series.amber.fill,
        borderColor: chartPalette.series.amber.line,
        borderWidth: 2,
        borderRadius: 12,
      },
    ],
  };

  const workforceChartData = {
    labels: workforceDepartments.map(([department]) => normalizeLabel(department)),
    datasets: [
      {
        label: 'Workers',
        data: workforceDepartments.map(([, count]) => count),
        backgroundColor: chartPalette.series.blue.fill,
        borderColor: chartPalette.series.blue.line,
        borderWidth: 2,
        borderRadius: 10,
      },
    ],
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-14 animate-pulse rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Analytics & Insights"
        subtitle="Deeper trends and activity across events, forms, workforce, and store operations."
        actions={
          <Button variant="outline" onClick={() => void refetch()} loading={isFetching} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Next month event forecast</p>
          <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">
            {forecastEvents === null ? 'Insufficient data' : formatNumber(forecastEvents)}
          </p>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Next month attendee forecast</p>
          <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">
            {forecastAttendees === null ? 'Insufficient data' : formatNumber(forecastAttendees)}
          </p>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Operational watch</p>
          <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">
            {formatNumber(lowStockProducts)} stock alerts
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Monthly performance</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Events and attendees over time.</p>
            </div>
            <LineChartIcon className="h-5 w-5 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 h-[300px]">
            {monthlyStats.length > 0 ? <Line data={monthlyChartData} options={lineOptions} /> : <EmptyState title="No monthly analytics available yet." />}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Event category mix</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Distribution by event category.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 h-[300px]">
            {Object.keys(eventsByCategory).length > 0 ? <Doughnut data={categoryChartData} options={doughnutOptions} /> : <EmptyState title="No event category data available." />}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Submission velocity</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Recent form responses grouped by day.</p>
            </div>
            <ClipboardList className="h-5 w-5 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 h-[300px]">
            {submissionsTrend.labels.length > 0 ? <Bar data={submissionsChartData} options={barOptions} /> : <EmptyState title="No recent submissions captured yet." />}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Workforce department coverage</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Department load from workforce records.</p>
            </div>
            <Users className="h-5 w-5 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 h-[300px]">
            {workforceDepartments.length > 0 ? <Bar data={workforceChartData} options={horizontalBarOptions} /> : <EmptyState title="No department records yet." />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Membership pulse</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between"><dt className="text-[var(--color-text-secondary)]">Total members</dt><dd className="font-semibold text-[var(--color-text-primary)]">{formatNumber(totalMembers)}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-[var(--color-text-secondary)]">Active members</dt><dd className="font-semibold text-[var(--color-text-primary)]">{formatNumber(activeMembers)}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-[var(--color-text-secondary)]">New this month</dt><dd className="font-semibold text-[var(--color-text-primary)]">{formatNumber(newMembersThisMonth)}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-[var(--color-text-secondary)]">New this year</dt><dd className="font-semibold text-[var(--color-text-primary)]">{formatNumber(newMembersThisYear)}</dd></div>
          </dl>
        </Panel>

        <Panel>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Workforce and store health</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between"><dt className="text-[var(--color-text-secondary)]">Serving workforce</dt><dd className="font-semibold text-[var(--color-text-primary)]">{formatNumber(workforceServing)}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-[var(--color-text-secondary)]">Total workforce</dt><dd className="font-semibold text-[var(--color-text-primary)]">{formatNumber(workforceTotal)}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-[var(--color-text-secondary)]">Active products</dt><dd className="font-semibold text-[var(--color-text-primary)]">{formatNumber(activeProducts)}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-[var(--color-text-secondary)]">Low stock products</dt><dd className="font-semibold text-[var(--color-text-primary)]">{formatNumber(lowStockProducts)}</dd></div>
          </dl>
        </Panel>
      </div>

      <Panel>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Recent activity</h2>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Latest movement across events, forms, and campaigns.</p>
        <div className="mt-4 space-y-3">
          {timeline.map((item) => {
            const Icon = getRecordIcon(item.type);
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                  <p className="truncate text-xs text-[var(--color-text-tertiary)]">{item.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{normalizeLabel(item.status || item.type)}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{formatDateTime(item.time)}</p>
                </div>
              </div>
            );
          })}
          {timeline.length === 0 ? <EmptyState title="No activity records are available yet." /> : null}
        </div>
      </Panel>
    </div>
  );
}

export default withAuth(AnalyticsPage, { requiredRole: 'admin' });
