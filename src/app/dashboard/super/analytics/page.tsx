'use client';

import { useEffect, useState } from 'react';
import { Activity, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { withAuth } from '@/providers/withAuth';
import { apiClient } from '@/lib/api';
import { DashboardAnalytics } from '@/lib/types';
import toast from 'react-hot-toast';

function SuperAnalyticsPage() {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await apiClient.getAnalytics().catch(() => null);
        if (res) setData(res);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)]">Analytics</h1>
        <p className="text-xs md:text-sm text-[var(--color-text-tertiary)]">
          Church-wide metrics for events, attendees, and categories.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Total events</p>
              <p className="text-lg md:text-xl font-semibold text-[var(--color-text-primary)]">
                {data?.totalEvents ?? '—'}
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Upcoming</p>
              <p className="text-lg md:text-xl font-semibold text-[var(--color-text-primary)]">
                {data?.upcomingEvents ?? '—'}
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Total attendees</p>
              <p className="text-lg md:text-xl font-semibold text-[var(--color-text-primary)]">
                {data?.totalAttendees ?? '—'}
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
        </Card>
      </div>

      <Card title="Categories breakdown">
        {loading && <p className="text-xs md:text-sm text-[var(--color-text-tertiary)]">Loading...</p>}
        {!loading && data?.eventsByCategory ? (
          <div className="space-y-2">
            {Object.entries(data.eventsByCategory).map(([category, count]) => (
              <details key={category} className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)]">
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm md:text-base text-[var(--color-text-primary)]">
                  <span>{category}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{count}</Badge>
                    <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)] group-open:hidden" />
                    <ChevronUp className="h-4 w-4 text-[var(--color-text-tertiary)] hidden group-open:inline" />
                  </div>
                </summary>
                <div className="px-3 pb-3 text-[11px] md:text-xs text-[var(--color-text-tertiary)]">
                  Category performance over time coming soon.
                </div>
              </details>
            ))}
          </div>
        ) : null}
      </Card>

      <Card title="Monthly stats">
        {loading && <p className="text-xs md:text-sm text-[var(--color-text-tertiary)]">Loading...</p>}
        {!loading && data?.monthlyStats ? (
          <div className="space-y-2">
            {data.monthlyStats.map((row) => (
              <details key={row.month} className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)]">
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm md:text-base text-[var(--color-text-primary)]">
                  <span>{row.month}</span>
                  <div className="flex items-center gap-3 text-[11px] md:text-xs text-[var(--color-text-secondary)]">
                    <span>Events: {row.events}</span>
                    <span>Attendees: {row.attendees}</span>
                    <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)] group-open:hidden" />
                    <ChevronUp className="h-4 w-4 text-[var(--color-text-tertiary)] hidden group-open:inline" />
                  </div>
                </summary>
                <div className="px-3 pb-3 text-[11px] md:text-xs text-[var(--color-text-tertiary)]">
                  Detailed charts for this month will appear here when connected to reporting.
                </div>
              </details>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export default withAuth(SuperAnalyticsPage, { requiredRole: 'super_admin' });
