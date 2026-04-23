'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Activity,
  CheckCircle,
  Clock,
  MapPin,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { useSuperQueues, ApprovalItem } from '@/hooks/useSuperQueues';
import { apiClient } from '@/lib/api';
import type { DashboardAnalytics, EventData } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

function dayKey(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function SuperDashboard() {
  const { items, loading, refresh, approveItem, declineItem, stats } = useSuperQueues();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [opsLoading, setOpsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadOps() {
      setOpsLoading(true);
      try {
        const [analyticsResult, eventsResult] = await Promise.allSettled([
          apiClient.getAnalytics(),
          apiClient.getEvents({ limit: 8, page: 1 }),
        ]);

        if (!active) return;

        setAnalytics(analyticsResult.status === 'fulfilled' ? analyticsResult.value : null);
        setEvents(eventsResult.status === 'fulfilled' ? eventsResult.value.data : []);
      } finally {
        if (active) setOpsLoading(false);
      }
    }

    void loadOps();
    return () => {
      active = false;
    };
  }, []);

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const safeEvents = useMemo(() => (Array.isArray(events) ? events : []), [events]);

  const queueByTypeChart = useMemo(
    () => ({
      labels: ['Testimonials', 'Events', 'Admin Access'],
      datasets: [
        {
          data: [stats.testimonials, stats.events, stats.adminUsers],
          backgroundColor: ['#1d4ed8', '#059669', '#a16207'],
          borderWidth: 1,
        },
      ],
    }),
    [stats]
  );

  const queueVelocity = useMemo(() => {
    const counts: Record<string, number> = {};
    safeItems.forEach((item) => {
      const key = dayKey(item.submittedAt);
      counts[key] = (counts[key] || 0) + 1;
    });
    const labels = Object.keys(counts).sort();
    return {
      labels,
      values: labels.map((label) => counts[label]),
    };
  }, [safeItems]);

  const queueVelocityChart = useMemo(
    () => ({
      labels: queueVelocity.labels,
      datasets: [
        {
          label: 'Incoming approvals',
          data: queueVelocity.values,
          borderColor: '#ca8a04',
          backgroundColor: 'rgba(202,138,4,0.2)',
          borderWidth: 2,
          tension: 0.35,
        },
      ],
    }),
    [queueVelocity]
  );

  const monthlyOpsChart = useMemo(
    () => ({
      labels: analytics?.monthlyStats?.map((row) => row.month) ?? [],
      datasets: [
        {
          label: 'Events',
          data: analytics?.monthlyStats?.map((row) => row.events) ?? [],
          backgroundColor: 'rgba(29,78,216,0.42)',
          borderColor: '#1d4ed8',
          borderWidth: 1,
        },
        {
          label: 'Attendees',
          data: analytics?.monthlyStats?.map((row) => row.attendees) ?? [],
          backgroundColor: 'rgba(5,150,105,0.42)',
          borderColor: '#059669',
          borderWidth: 1,
        },
      ],
    }),
    [analytics?.monthlyStats]
  );

  const pendingTop = useMemo(
    () =>
      safeItems
        .filter((item) => item.status === 'pending')
        .slice()
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
        .slice(0, 8),
    [safeItems]
  );

  const mappedLocation = useMemo(
    () => safeEvents.find((event) => event.location && event.location.trim())?.location?.trim() || '',
    [safeEvents]
  );
  const mapSrc = mappedLocation
    ? `https://www.google.com/maps?q=${encodeURIComponent(mappedLocation)}&output=embed`
    : '';

  const handleApprove = async (item: ApprovalItem) => {
    setApprovingId(item.id);
    await approveItem(item);
    setApprovingId(null);
  };

  const handleDecline = async (item: ApprovalItem) => {
    setApprovingId(item.id);
    await declineItem(item);
    setApprovingId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Command Center"
        subtitle="Governance, approvals, and platform-wide operational intelligence."
        actions={
          <Button variant="outline" size="sm" onClick={() => { void refresh(); }} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh Queue
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Pending Approvals</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{stats.total}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Items requiring super-admin decision</p>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Testimonial Queue</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{stats.testimonials}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Content moderation inflow</p>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Event Queue</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{stats.events}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Event oversight approvals</p>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Live Operations</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{analytics?.upcomingEvents ?? 0}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Upcoming events under oversight</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Queue Composition</h2>
            <ShieldCheck className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 h-[280px]">
            {stats.total > 0 ? (
              <Pie
                data={queueByTypeChart}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No active approvals.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Queue Velocity</h2>
            <Clock className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 h-[280px]">
            {queueVelocity.labels.length > 0 ? (
              <Line
                data={queueVelocityChart}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No queue history available yet.</p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Platform Activity Trend</h2>
            <Activity className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 h-[280px]">
            {(analytics?.monthlyStats?.length ?? 0) > 0 ? (
              <Bar
                data={monthlyOpsChart}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No monthly operations analytics available.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Operations Map</h2>
            <MapPin className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 overflow-hidden rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
            {mapSrc ? (
              <iframe
                title="Operations location"
                src={mapSrc}
                className="h-[280px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-[280px] items-center justify-center p-4 text-sm text-[var(--color-text-tertiary)]">
                No location context available from current event data.
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            {mappedLocation ? `Focused location: ${mappedLocation}` : 'Add event locations to enable geographic monitoring.'}
          </p>
        </Card>
      </section>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Priority Decision Queue</h2>
          <Badge variant="warning" size="sm">Top {pendingTop.length}</Badge>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading queue...</p>
          ) : pendingTop.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No pending approvals at the moment.</p>
          ) : (
            pendingTop.map((item) => (
              <div key={item.id} className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {item.type.toUpperCase()} · {new Date(item.submittedAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{item.summary}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDecline(item)}
                      loading={approvingId === item.id}
                      disabled={item.type !== 'testimonial' || item.status !== 'pending'}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleApprove(item)}
                      loading={approvingId === item.id}
                      disabled={item.status !== 'pending'}
                      icon={<CheckCircle className="h-4 w-4" />}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {opsLoading ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">Refreshing operations telemetry...</p>
      ) : null}
    </div>
  );
}

export default withAuth(SuperDashboard, { requiredRole: 'super_admin' });
