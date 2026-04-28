'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  // FileText,
  Mail,
  Megaphone,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import toast from 'react-hot-toast';

import { apiClient } from '@/lib/api';
import { withAuth } from '@/providers/withAuth';
import type {
  AdminEmailMarketingSummary,
  DashboardAnalytics,
  EventData,
  FormStatsResponse,
} from '@/lib/types';
import { Button } from '@/ui/Button';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
);

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value?: number | null): string {
  return numberFormatter.format(typeof value === 'number' && Number.isFinite(value) ? value : 0);
}

function formatDate(value?: string): string {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function dayKey(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {value}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{hint}</p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[var(--color-accent-primary)]">
          {icon}
        </div>
      </div>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-[var(--radius-button)] border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-6 text-center text-sm text-[var(--color-text-tertiary)]">
      {message}
    </div>
  );
}

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [formStats, setFormStats] = useState<FormStatsResponse | null>(null);
  const [marketing, setMarketing] = useState<AdminEmailMarketingSummary | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const [analyticsResult, eventsResult, formStatsResult, marketingResult] = await Promise.allSettled([
        apiClient.getAnalytics(),
        apiClient.getEvents({ page: 1, limit: 10 }),
        apiClient.getFormStats(),
        apiClient.getEmailMarketingSummary(),
      ]);

      setAnalytics(analyticsResult.status === 'fulfilled' ? analyticsResult.value : null);
      setEvents(
        eventsResult.status === 'fulfilled' && Array.isArray(eventsResult.value.data)
          ? eventsResult.value.data
          : []
      );
      setFormStats(formStatsResult.status === 'fulfilled' ? formStatsResult.value : null);
      setMarketing(marketingResult.status === 'fulfilled' ? marketingResult.value : null);

      const failed = [analyticsResult, eventsResult, formStatsResult, marketingResult].some(
        (result) => result.status === 'rejected'
      );

      if (failed) {
        toast.error('Some dashboard data could not be loaded');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const safeEvents = useMemo(() => (Array.isArray(events) ? events : []), [events]);
  const recentSubmissions = useMemo(() => formStats?.recent ?? [], [formStats]);
  const recentCampaigns = useMemo(() => marketing?.recentCampaigns ?? [], [marketing]);
  const monthlyStats = useMemo(() => analytics?.monthlyStats ?? [], [analytics]);
  const eventsByCategory = useMemo(() => analytics?.eventsByCategory ?? {}, [analytics]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();

    return safeEvents
      .filter((event) => {
        const rawDate = event.startDate || event.date || event.createdAt;
        if (!rawDate) return false;
        const parsed = new Date(rawDate);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed.getTime() >= now;
      })
      .slice(0, 5);
  }, [safeEvents]);

  const submissionsTrend = useMemo(() => {
    const counts: Record<string, number> = {};

    recentSubmissions.forEach((submission) => {
      const key = dayKey(submission.createdAt);
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });

    const labels = Object.keys(counts).sort();

    return {
      labels,
      values: labels.map((label) => counts[label]),
    };
  }, [recentSubmissions]);

  const monthlyChartData = useMemo(
    () => ({
      labels: monthlyStats.map((row) => row.month),
      datasets: [
        {
          label: 'Events',
          data: monthlyStats.map((row) => row.events),
          borderColor: '#0f766e',
          backgroundColor: 'rgba(15,118,110,0.18)',
          borderWidth: 2,
          tension: 0.35,
        },
        {
          label: 'Attendees',
          data: monthlyStats.map((row) => row.attendees),
          borderColor: '#1d4ed8',
          backgroundColor: 'rgba(29,78,216,0.16)',
          borderWidth: 2,
          tension: 0.35,
        },
      ],
    }),
    [monthlyStats]
  );

  const categoryChartData = useMemo(
    () => ({
      labels: Object.keys(eventsByCategory),
      datasets: [
        {
          data: Object.values(eventsByCategory),
          backgroundColor: ['#1d4ed8', '#0f766e', '#ca8a04', '#7c3aed', '#dc2626', '#0891b2'],
          borderWidth: 1,
        },
      ],
    }),
    [eventsByCategory]
  );

  const submissionsChartData = useMemo(
    () => ({
      labels: submissionsTrend.labels,
      datasets: [
        {
          label: 'Submissions',
          data: submissionsTrend.values,
          backgroundColor: 'rgba(202,138,4,0.45)',
          borderColor: '#ca8a04',
          borderWidth: 1,
        },
      ],
    }),
    [submissionsTrend]
  );

  const kpis = [
    {
      label: 'Events',
      value: formatNumber(analytics?.totalEvents),
      hint: `${formatNumber(analytics?.upcomingEvents)} upcoming`,
      icon: <CalendarDays className="h-5 w-5" />,
    },
    {
      label: 'Attendees',
      value: formatNumber(analytics?.totalAttendees),
      hint: 'Across recorded events',
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: 'Audience',
      value: formatNumber(marketing?.reachableRecipients),
      hint: `${formatNumber(marketing?.publishedForms)} published forms`,
      icon: <Mail className="h-5 w-5" />,
    },
    {
      label: 'Submissions',
      value: formatNumber(formStats?.totalSubmissions),
      hint: 'Captured form responses',
      icon: <ClipboardList className="h-5 w-5" />,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-44 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`dashboard-skeleton-${index}`}
              className="h-32 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]"
            />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-80 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
          <div className="h-80 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-gradient-to-br from-[var(--color-background-secondary)] to-[var(--color-background-primary)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              <Activity className="h-3.5 w-3.5" />
              Admin Dashboard
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-3xl">
              Real-time church operations, registrations, and outreach overview.
            </h1>

            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)] md:text-base">
              Monitor live platform data from events, forms, submissions, and email campaigns. No placeholder or mock
              data is rendered here.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => loadDashboard(true)}
              loading={refreshing}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>

            <Link
              href="/dashboard/forms"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
            >
              Forms
            </Link>

            <Link
              href="/dashboard/email-marketing"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-[var(--color-accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-onprimary)] hover:bg-[var(--color-accent-primaryhover)]"
            >
              Campaigns
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Monthly Performance
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Events and attendees from backend analytics.</p>
            </div>
          </div>

          <div className="mt-4 h-[300px]">
            {monthlyStats.length > 0 ? (
              <Line
                data={monthlyChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { precision: 0 },
                    },
                  },
                }}
              />
            ) : (
              <EmptyState message="No monthly analytics available yet." />
            )}
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Event Categories
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Distribution by event category.</p>
            </div>
          </div>

          <div className="mt-4 h-[300px]">
            {Object.keys(eventsByCategory).length > 0 ? (
              <Pie
                data={categoryChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' },
                  },
                }}
              />
            ) : (
              <EmptyState message="No event category data available." />
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Submission Velocity
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Recent form responses grouped by day.</p>
            </div>
          </div>

          <div className="mt-4 h-[270px]">
            {submissionsTrend.labels.length > 0 ? (
              <Bar
                data={submissionsChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { precision: 0 },
                    },
                  },
                }}
              />
            ) : (
              <EmptyState message="No recent submissions captured yet." />
            )}
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Upcoming Events
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Latest event records from the backend.</p>
            </div>
            <CalendarDays className="h-5 w-5 text-[var(--color-accent-primary)]" />
          </div>

          <div className="mt-4 space-y-3">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{event.title}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    {formatDate(event.startDate || event.date || event.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState message="No upcoming events found." />
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Recent Campaigns
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Email delivery activity from campaign history.</p>
            </div>
            <Megaphone className="h-5 w-5 text-[var(--color-accent-primary)]" />
          </div>

          <div className="mt-4 space-y-3">
            {recentCampaigns.length > 0 ? (
              recentCampaigns.slice(0, 6).map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {campaign.subject || 'Untitled campaign'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    Sent {formatNumber(campaign.sent)} / {formatNumber(campaign.targeted)} · Failed{' '}
                    {formatNumber(campaign.failed)} · {formatDate(campaign.startedAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState message="No campaign history yet." />
            )}
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Latest Registrations
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Most recent form responses from form statistics.</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-[var(--color-accent-primary)]" />
          </div>

          <div className="mt-4 space-y-3">
            {recentSubmissions.length > 0 ? (
              recentSubmissions.slice(0, 6).map((submission) => (
                <div
                  key={submission.id}
                  className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {submission.formTitle || 'Form response'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    {submission.name || submission.email || 'Anonymous'} · {formatDate(submission.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState message="No registrations captured yet." />
            )}
          </div>
        </article>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Operational Shortcuts</h2>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Go directly to the core admin workflows.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/events"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
            >
              Events
            </Link>
            <Link
              href="/dashboard/forms"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
            >
              Forms
            </Link>
            <Link
              href="/dashboard/administration"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
            >
              Administration
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default withAuth(DashboardPage, { requiredRole: 'admin' });