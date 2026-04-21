'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Mail,
  Megaphone,
  TrendingUp,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

import { Card } from '@/ui/Card';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import type {
  AdminEmailMarketingSummary,
  DashboardAnalytics,
  EventData,
  FormStatsResponse,
} from '@/lib/types';
import { useAuthContext } from '@/providers/AuthProviders';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const nf = new Intl.NumberFormat('en-US');

function formatNumber(value: number): string {
  return nf.format(value);
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

function truncate(value: string, max = 80): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function statusTone(status?: string): string {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'ongoing' || normalized === 'happening') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
  if (normalized === 'completed' || normalized === 'past') {
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }
  return 'bg-amber-100 text-amber-800 border-amber-200';
}

export default function DashboardPage() {
  const auth = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [formStats, setFormStats] = useState<FormStatsResponse | null>(null);
  const [marketing, setMarketing] = useState<AdminEmailMarketingSummary | null>(null);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [analyticsResult, eventsResult, formStatsResult, marketingResult] =
          await Promise.allSettled([
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
    };

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const firstName = auth.user?.first_name || 'Admin';
  const topForms = marketing?.topForms ?? [];
  const recentSubmissions = (formStats?.recent ?? []).slice(0, 8);
  const categoryEntries = Object.entries(analytics?.eventsByCategory ?? {}).sort(
    (a, b) => b[1] - a[1]
  );

  const monthlyChartData = useMemo(() => {
    const source = analytics?.monthlyStats ?? [];
    return {
      labels: source.map(item => item.month),
      datasets: [
        {
          label: 'Events',
          data: source.map(item => item.events),
          borderColor: '#eab308',
          backgroundColor: 'rgba(234,179,8,0.2)',
          tension: 0.32,
          fill: true,
        },
        {
          label: 'Attendees',
          data: source.map(item => item.attendees),
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.18)',
          tension: 0.32,
          fill: true,
        },
      ],
    };
  }, [analytics?.monthlyStats]);

  const categoryChartData = useMemo(() => {
    const labels = categoryEntries.map(([key]) => key);
    const values = categoryEntries.map(([, count]) => count);
    return {
      labels,
      datasets: [
        {
          label: 'Events',
          data: values,
          backgroundColor: [
            '#f59e0b',
            '#38bdf8',
            '#34d399',
            '#a78bfa',
            '#fb7185',
            '#f97316',
            '#22c55e',
          ],
          borderWidth: 0,
        },
      ],
    };
  }, [categoryEntries]);

  const audienceChartData = useMemo(() => {
    const labels = topForms.slice(0, 5).map(item => truncate(item.formTitle, 26));
    const values = topForms.slice(0, 5).map(item => item.uniqueRecipients);
    return {
      labels,
      datasets: [
        {
          label: 'Reachable recipients',
          data: values,
          borderRadius: 8,
          backgroundColor: '#eab308',
        },
      ],
    };
  }, [topForms]);

  const metrics = [
    {
      label: 'Reachable Recipients',
      value: formatNumber(marketing?.reachableRecipients ?? 0),
      hint: 'Deduplicated deliverable audience',
      icon: Mail,
    },
    {
      label: 'Published Forms',
      value: formatNumber(marketing?.publishedForms ?? 0),
      hint: `${formatNumber(marketing?.totalForms ?? 0)} total forms`,
      icon: ClipboardList,
    },
    {
      label: 'Total Registrations',
      value: formatNumber(formStats?.totalSubmissions ?? 0),
      hint: 'Captured from live forms',
      icon: Users,
    },
    {
      label: 'Campaign Sends',
      value: formatNumber(Number(marketing?.totalCampaigns ?? 0)),
      hint: 'All-time outreach campaigns',
      icon: Megaphone,
    },
    {
      label: 'Tracked Events',
      value: formatNumber(analytics?.totalEvents ?? 0),
      hint: `${formatNumber(analytics?.upcomingEvents ?? 0)} upcoming`,
      icon: CalendarDays,
    },
    {
      label: 'Total Attendees',
      value: formatNumber(analytics?.totalAttendees ?? 0),
      hint: 'Attendance records across events',
      icon: TrendingUp,
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={`dashboard-skeleton-${idx}`}
            className="h-28 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Command Dashboard"
        subtitle={`Welcome back, ${firstName}. Monitor performance, outreach, and operations in one professional view.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/forms"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)]"
            >
              Manage Forms
            </Link>
            <Link
              href="/dashboard/email-marketing"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-onprimary)] hover:bg-[var(--color-accent-primaryhover)]"
            >
              Launch Campaign
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ label, value, hint, icon: Icon }) => (
          <Card key={label} className="fade-up">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">{label}</p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{hint}</p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-background-tertiary)] text-[var(--color-accent-primaryactive)]">
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Monthly Trend (Events vs Attendees)">
          {monthlyChartData.labels.length > 0 ? (
            <div className="h-[320px]">
              <Line
                data={monthlyChartData}
                options={{
                  maintainAspectRatio: false,
                  responsive: true,
                  plugins: { legend: { position: 'bottom' as const } },
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-tertiary)]">No monthly analytics available yet.</p>
          )}
        </Card>

        <Card title="Event Category Split">
          {categoryChartData.labels.length > 0 ? (
            <div className="h-[320px]">
              <Doughnut
                data={categoryChartData}
                options={{
                  maintainAspectRatio: false,
                  responsive: true,
                  plugins: { legend: { position: 'bottom' as const } },
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-tertiary)]">No category analytics available yet.</p>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_1.35fr]">
        <Card title="Top Form Reach">
          {audienceChartData.labels.length > 0 ? (
            <div className="h-[300px]">
              <Bar
                data={audienceChartData}
                options={{
                  maintainAspectRatio: false,
                  responsive: true,
                  indexAxis: 'y' as const,
                  plugins: { legend: { display: false } },
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-tertiary)]">No form reach data yet.</p>
          )}
        </Card>

        <Card title="Recent Submissions">
          {recentSubmissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-primary)] text-left text-xs uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                    <th className="px-2 py-2">Form</th>
                    <th className="px-2 py-2">Respondent</th>
                    <th className="px-2 py-2">Email</th>
                    <th className="px-2 py-2">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubmissions.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--color-border-primary)]/70">
                      <td className="px-2 py-2 font-medium text-[var(--color-text-primary)]">{row.formTitle || 'Untitled form'}</td>
                      <td className="px-2 py-2 text-[var(--color-text-secondary)]">{row.name || 'Anonymous'}</td>
                      <td className="px-2 py-2 text-[var(--color-text-secondary)]">{row.email || '—'}</td>
                      <td className="px-2 py-2 text-[var(--color-text-tertiary)]">{formatDate(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-tertiary)]">No recent submissions available.</p>
          )}
        </Card>
      </section>

      <Card title="Event Operations Table">
        {events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-primary)] text-left text-xs uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                  <th className="px-2 py-2">Event</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Location</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-[var(--color-border-primary)]/70">
                    <td className="px-2 py-2">
                      <p className="font-medium text-[var(--color-text-primary)]">{event.title}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {truncate(event.shortDescription || event.description || 'No description', 70)}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-[var(--color-text-secondary)]">{formatDate(event.date || event.startDate)}</td>
                    <td className="px-2 py-2 text-[var(--color-text-secondary)]">{event.location || 'TBD'}</td>
                    <td className="px-2 py-2 text-[var(--color-text-secondary)]">{event.category || 'Uncategorized'}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusTone(event.status)}`}>
                        {event.status || 'upcoming'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-tertiary)]">No event records are available.</p>
        )}
      </Card>
    </div>
  );
}
