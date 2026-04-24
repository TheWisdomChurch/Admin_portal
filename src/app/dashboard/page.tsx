'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Mail,
  MapPin,
  Megaphone,
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
import type { AdminEmailMarketingSummary, DashboardAnalytics, EventData, FormStatsResponse } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value: number): string {
  return numberFormatter.format(value);
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

function dayKey(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [formStats, setFormStats] = useState<FormStatsResponse | null>(null);
  const [marketing, setMarketing] = useState<AdminEmailMarketingSummary | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      try {
        const [analyticsResult, eventsResult, formStatsResult, marketingResult] = await Promise.allSettled([
          apiClient.getAnalytics(),
          apiClient.getEvents({ limit: 8, page: 1 }),
          apiClient.getFormStats(),
          apiClient.getEmailMarketingSummary(),
        ]);

        if (!active) return;

        setAnalytics(analyticsResult.status === 'fulfilled' ? analyticsResult.value : null);
        setEvents(eventsResult.status === 'fulfilled' ? eventsResult.value.data : []);
        setFormStats(formStatsResult.status === 'fulfilled' ? formStatsResult.value : null);
        setMarketing(marketingResult.status === 'fulfilled' ? marketingResult.value : null);
      } catch (error) {
        console.error(error);
        if (active) toast.error('Failed to load dashboard data');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const safeEvents = useMemo(() => (Array.isArray(events) ? events : []), [events]);
  const safeRecentSubmissions = useMemo(() => formStats?.recent ?? [], [formStats?.recent]);
  const safeCampaigns = useMemo(() => marketing?.recentCampaigns ?? [], [marketing?.recentCampaigns]);

  const monthlyStats = useMemo(() => analytics?.monthlyStats ?? [], [analytics?.monthlyStats]);
  const eventsByCategory = useMemo(() => analytics?.eventsByCategory ?? {}, [analytics?.eventsByCategory]);

  const submissionsTrend = useMemo(() => {
    const counts: Record<string, number> = {};
    safeRecentSubmissions.forEach((item) => {
      const key = dayKey(item.createdAt);
      counts[key] = (counts[key] || 0) + 1;
    });
    const labels = Object.keys(counts).sort();
    return {
      labels,
      values: labels.map((label) => counts[label]),
    };
  }, [safeRecentSubmissions]);

  const monthlyChartData = useMemo(
    () => ({
      labels: monthlyStats.map((row) => row.month),
      datasets: [
        {
          label: 'Events',
          data: monthlyStats.map((row) => row.events),
          borderColor: '#0f766e',
          backgroundColor: 'rgba(15,118,110,0.2)',
          borderWidth: 2,
          tension: 0.35,
        },
        {
          label: 'Attendees',
          data: monthlyStats.map((row) => row.attendees),
          borderColor: '#1d4ed8',
          backgroundColor: 'rgba(29,78,216,0.18)',
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

  const mappedLocation = useMemo(
    () => safeEvents.find((event) => event.location && event.location.trim())?.location?.trim() || '',
    [safeEvents]
  );
  const mapSrc = mappedLocation
    ? `https://www.google.com/maps?q=${encodeURIComponent(mappedLocation)}&output=embed`
    : '';

  const kpis = [
    {
      label: 'Total Events',
      value: formatNumber(analytics?.totalEvents ?? 0),
      hint: `${formatNumber(analytics?.upcomingEvents ?? 0)} upcoming`,
      icon: <CalendarDays className="h-5 w-5" />,
    },
    {
      label: 'Total Attendees',
      value: formatNumber(analytics?.totalAttendees ?? 0),
      hint: 'Across tracked events',
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: 'Reachable Audience',
      value: formatNumber(marketing?.reachableRecipients ?? 0),
      hint: `${formatNumber(marketing?.publishedForms ?? 0)} published forms`,
      icon: <Mail className="h-5 w-5" />,
    },
    {
      label: 'Captured Submissions',
      value: formatNumber(formStats?.totalSubmissions ?? 0),
      hint: 'Ready for follow-up',
      icon: <ClipboardList className="h-5 w-5" />,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`kpi-skeleton-${idx}`} className="h-28 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-gradient-to-r from-[var(--color-background-secondary)] to-[var(--color-background-primary)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-tertiary)]">Admin Operations Center</p>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] md:text-3xl">
              Build campaigns, monitor registrations, and execute event operations.
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] md:text-base">
              This workspace combines performance analytics, outreach signals, and event geography in one operational view.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/forms" className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]">
              Form Builder
            </Link>
            <Link href="/dashboard/email-marketing" className="inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-[var(--color-accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-onprimary)] hover:bg-[var(--color-accent-primaryhover)]">
              Campaign Studio
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <article
            key={item.label}
            className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">{item.label}</p>
              <span className="rounded-full bg-[var(--color-background-secondary)] p-2 text-[var(--color-accent-primary)]">{item.icon}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-[var(--color-text-primary)]">{item.value}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.hint}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Monthly Performance Trend</h2>
            <span className="text-xs text-[var(--color-text-tertiary)]">Events vs attendees</span>
          </div>
          <div className="mt-4 h-[280px]">
            {monthlyStats.length > 0 ? (
              <Line
                data={monthlyChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'top' } },
                }}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No monthly analytics available yet.</p>
            )}
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Event Category Mix</h2>
            <Activity className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 h-[280px]">
            {Object.keys(eventsByCategory).length > 0 ? (
              <Pie
                data={categoryChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } },
                }}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No category data available.</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Recent Submission Velocity</h2>
            <span className="text-xs text-[var(--color-text-tertiary)]">Grouped by day</span>
          </div>
          <div className="mt-4 h-[250px]">
            {submissionsTrend.labels.length > 0 ? (
              <Bar
                data={submissionsChartData}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No recent submissions yet.</p>
            )}
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Location Intelligence</h2>
            <MapPin className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 overflow-hidden rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
            {mapSrc ? (
              <iframe
                title="Primary event location"
                src={mapSrc}
                className="h-[250px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-[250px] items-center justify-center p-4 text-sm text-[var(--color-text-tertiary)]">
                No event location available for map rendering.
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            {mappedLocation ? `Focused location: ${mappedLocation}` : 'Add event locations to activate map context.'}
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Recent Campaign Deliveries</h2>
            <Megaphone className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 space-y-3">
            {safeCampaigns.length > 0 ? (
              safeCampaigns.slice(0, 6).map((campaign) => (
                <div key={campaign.id} className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] p-3">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{campaign.subject}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    Sent {campaign.sent} / {campaign.targeted} · Failed {campaign.failed} · {formatDate(campaign.startedAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No campaign history yet.</p>
            )}
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Latest Registrations</h2>
            <Users className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 space-y-3">
            {safeRecentSubmissions.length > 0 ? (
              safeRecentSubmissions.slice(0, 6).map((submission) => (
                <div key={submission.id} className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] p-3">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{submission.formTitle || 'Form response'}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {submission.name || submission.email || 'Anonymous'} · {formatDate(submission.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No submissions captured yet.</p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

export default withAuth(DashboardPage, { requiredRole: 'admin' });
