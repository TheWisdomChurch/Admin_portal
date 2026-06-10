'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Calendar, RefreshCcw, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { withAuth } from '@/providers/withAuth';
import { apiClient } from '@/lib/api';
import type { DashboardAnalytics } from '@/lib/types';

function numberValue(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toLocaleString();
}

function SuperAnalyticsPage() {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAnalytics();
      setData(res || null);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(() => {
    const entries = Object.entries(data?.eventsByCategory || {});
    return entries.sort((a, b) => b[1] - a[1]);
  }, [data?.eventsByCategory]);

  const categoryMax = useMemo(() => Math.max(1, ...categories.map(([, count]) => count)), [categories]);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-[var(--color-border-primary)] bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 text-white shadow-2xl md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="warning" className="mb-4">Super Admin Intelligence</Badge>
            <h1 className="text-2xl font-bold tracking-tight md:text-4xl">Analytics command center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70 md:text-base">
              Review church-wide performance, approvals impact, event pipeline and growth indicators from one authority view.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()} loading={loading} className="border-white/20 text-white hover:bg-white/10">
            <RefreshCcw className="h-4 w-4" />
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-[var(--color-background-secondary)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Total events</p>
              <p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{numberValue(data?.totalEvents)}</p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">All events in the catalogue</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="bg-[var(--color-background-secondary)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Upcoming events</p>
              <p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{numberValue(data?.upcomingEvents)}</p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Scheduled programs still ahead</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Activity className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="bg-[var(--color-background-secondary)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Total attendees</p>
              <p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{numberValue(data?.totalAttendees)}</p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Registered attendance signal</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <Card
          title="Category performance"
          actions={<BarChart3 className="h-4 w-4 text-[var(--color-text-tertiary)]" />}
        >
          {loading ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading category data...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No category analytics available yet.</p>
          ) : (
            <div className="space-y-4">
              {categories.map(([category, count]) => {
                const width = Math.max(8, Math.round((count / categoryMax) * 100));
                return (
                  <div key={category}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{category}</p>
                      <Badge variant="secondary">{count.toLocaleString()}</Badge>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-background-tertiary)]">
                      <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Monthly activity">
          {loading ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading monthly data...</p>
          ) : !data?.monthlyStats?.length ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No monthly analytics available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  <tr>
                    <th className="pb-3 pr-4">Month</th>
                    <th className="pb-3 pr-4">Events</th>
                    <th className="pb-3 pr-4">Attendees</th>
                    <th className="pb-3">Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-secondary)]">
                  {data.monthlyStats.map((row) => (
                    <tr key={row.month}>
                      <td className="py-3 pr-4 font-semibold text-[var(--color-text-primary)]">{row.month}</td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{row.events.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{row.attendees.toLocaleString()}</td>
                      <td className="py-3">
                        <Badge variant={row.events > 0 ? 'success' : 'secondary'}>
                          {row.events > 0 ? 'Active' : 'No activity'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default withAuth(SuperAnalyticsPage, { requiredRole: 'super_admin' });
