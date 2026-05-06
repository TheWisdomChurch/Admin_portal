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
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';

import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/layouts';
import { useSuperQueues, type ApprovalItem } from '@/hooks/useSuperQueues';
import { apiClient } from '@/lib/api';
import type { DashboardAnalytics, EventData, MemberStatsResponse, NewMemberDashboardResponse, WorkforceStatsResponse } from '@/lib/types';
import { useAuthContext } from '@/providers/AuthProviders';
import { getUserRole } from '@/lib/authRole';

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

function dayKey(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function AccessDeniedState() {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Access denied</h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        This section is restricted to super administrators.
      </p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <details className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-semibold text-[var(--color-text-primary)]">{value.toLocaleString()}</span>
      </summary>
      <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">Computed from current church records.</p>
    </details>
  );
}

export default function SuperDashboard() {
  const auth = useAuthContext();
  const role = getUserRole(auth.user);
  const isSuperAdmin = role === 'super_admin';

  const canLoadProtectedData =
    auth.isInitialized &&
    auth.bootstrapped &&
    auth.accessStatus === 'ready' &&
    auth.isAuthenticated &&
    isSuperAdmin;

  const { items, loading, refresh, approveItem, declineItem, stats } = useSuperQueues();

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [memberStats, setMemberStats] = useState<MemberStatsResponse | null>(null);
  const [newMembers, setNewMembers] = useState<NewMemberDashboardResponse | null>(null);
  const [workforceStats, setWorkforceStats] = useState<WorkforceStatsResponse | null>(null);
  const [opsLoading, setOpsLoading] = useState(true);

  useEffect(() => {
    if (!canLoadProtectedData) return;

    let cancelled = false;

    async function loadOps() {
      setOpsLoading(true);

      const [analyticsResult, eventsResult, memberStatsResult, newMembersResult, workforceStatsResult] = await Promise.allSettled([
        apiClient.getAnalytics(),
        apiClient.getEvents({ limit: 8, page: 1 }),
        apiClient.getMemberStats(),
        apiClient.getNewMemberDashboard(),
        apiClient.getWorkforceStats(),
      ]);

      if (cancelled) return;

      setAnalytics(analyticsResult.status === 'fulfilled' ? analyticsResult.value : null);
      setEvents(eventsResult.status === 'fulfilled' ? eventsResult.value.data : []);
      setMemberStats(memberStatsResult.status === 'fulfilled' ? memberStatsResult.value : null);
      setNewMembers(newMembersResult.status === 'fulfilled' ? newMembersResult.value : null);
      setWorkforceStats(workforceStatsResult.status === 'fulfilled' ? workforceStatsResult.value : null);
      setOpsLoading(false);
    }

    void loadOps();

    return () => {
      cancelled = true;
    };
  }, [canLoadProtectedData]);

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const safeEvents = useMemo(() => (Array.isArray(events) ? events : []), [events]);

  const queueByTypeChart = useMemo(
    () => ({
      labels: ['Testimonials', 'Events', 'Admin Access', 'Leadership Delete', 'Workforce Delete'],
      datasets: [
        {
          data: [stats.testimonials, stats.events, stats.adminUsers, stats.leadershipDeletes, stats.workforceDeletes],
          backgroundColor: ['#1d4ed8', '#059669', '#a16207', '#7c3aed', '#dc2626'],
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
        .sort(
          (a, b) =>
            new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        )
        .slice(0, 8),
    [safeItems]
  );

  const mappedLocation = useMemo(
    () =>
      safeEvents.find((event) => event.location && event.location.trim())?.location?.trim() ||
      '',
    [safeEvents]
  );

  const mapSrc = mappedLocation
    ? `https://www.google.com/maps?q=${encodeURIComponent(mappedLocation)}&output=embed`
    : '';

  const handleApprove = async (item: ApprovalItem) => {
    setApprovingId(item.id);
    try {
      await approveItem(item);
    } finally {
      setApprovingId(null);
    }
  };

  const handleDecline = async (item: ApprovalItem) => {
    setApprovingId(item.id);
    try {
      await declineItem(item);
    } finally {
      setApprovingId(null);
    }
  };

  if (!auth.isInitialized || !auth.bootstrapped || auth.accessStatus === 'loading') {
    return null;
  }

  if (!isSuperAdmin) {
    return <AccessDeniedState />;
  }

  if (!canLoadProtectedData) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Command Center"
        subtitle="Governance, approvals, and platform-wide operational intelligence."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refresh();
            }}
            disabled={loading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh Queue
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
            Pending Approvals
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {stats.total}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Items requiring super-admin decision
          </p>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
            Testimonial Queue
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {stats.testimonials}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Content moderation inflow
          </p>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
            Event Queue
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {stats.events}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Event oversight approvals
          </p>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
            Live Operations
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {analytics?.upcomingEvents ?? 0}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Upcoming events under oversight
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Membership Growth</h2>
            <Users className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 space-y-2">
            <MetricRow label="Total members" value={memberStats?.total || 0} />
            <MetricRow label="New this month" value={newMembers?.thisMonth || 0} />
            <MetricRow label="New this quarter" value={newMembers?.thisQuarter || 0} />
            <MetricRow label="New this year" value={newMembers?.thisYear || 0} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Workforce Health</h2>
            <TrendingUp className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 space-y-2">
            <MetricRow label="Serving" value={workforceStats?.byStatus?.serving || 0} />
            <MetricRow label="New / pending" value={(workforceStats?.byStatus?.new || 0) + (workforceStats?.byStatus?.pending || 0)} />
            <MetricRow label="Inactive" value={workforceStats?.byStatus?.not_serving || 0} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Forecast Signal</h2>
            <UserPlus className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
            At the current monthly intake pace, the projected next-quarter intake is{' '}
            <span className="font-semibold text-[var(--color-text-primary)]">{(newMembers?.thisMonth || 0) * 3}</span> people.
          </p>
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            Use this with outreach planning, follow-up capacity, and department onboarding.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Queue Composition
            </h2>
            <ShieldCheck className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 h-[280px]">
            {stats.total > 0 ? (
              <Pie
                data={queueByTypeChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } },
                }}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No active approvals.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Queue Velocity
            </h2>
            <Clock className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 h-[280px]">
            {queueVelocity.labels.length > 0 ? (
              <Line
                data={queueVelocityChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                }}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                No queue history available yet.
              </p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Platform Activity Trend
            </h2>
            <Activity className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div className="mt-4 h-[280px]">
            {(analytics?.monthlyStats?.length ?? 0) > 0 ? (
              <Bar
                data={monthlyOpsChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'top' } },
                }}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                No monthly operations analytics available.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Operations Map
            </h2>
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
            {mappedLocation
              ? `Focused location: ${mappedLocation}`
              : 'Add event locations to enable geographic monitoring.'}
          </p>
        </Card>
      </section>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Priority Decision Queue
          </h2>
          <Badge variant="warning" size="sm">
            Top {pendingTop.length}
          </Badge>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading queue...</p>
          ) : pendingTop.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">
              No pending approvals at the moment.
            </p>
          ) : (
            pendingTop.map((item) => (
              <div
                key={item.id}
                className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {item.name}
                    </p>
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
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Refreshing operations telemetry...
        </p>
      ) : null}
    </div>
  );
}
