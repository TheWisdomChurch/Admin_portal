// src/app/(dashboard)/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  Users,
  TrendingUp,
  Video,
  AlertCircle,
  ArrowUpRight,
  ClipboardList,
  FileText,
} from 'lucide-react';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useAuthContext } from '@/providers/AuthProviders';
import { EventData, DashboardAnalytics, AdminForm, FormStatsResponse } from '@/lib/types';

const toArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.items)) return record.items as T[];
    const nested = record.data;
    if (nested && typeof nested === 'object') {
      const nestedRecord = nested as Record<string, unknown>;
      if (Array.isArray(nestedRecord.items)) return nestedRecord.items as T[];
      if (Array.isArray(nestedRecord.data)) return nestedRecord.data as T[];
    }
  }
  return [];
};

const readTotal = (value: unknown, fallback: number): number => {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.total === 'number') return record.total;
    const nested = record.data;
    if (nested && typeof nested === 'object') {
      const nestedRecord = nested as Record<string, unknown>;
      if (typeof nestedRecord.total === 'number') return nestedRecord.total;
    }
  }
  return fallback;
};

export default function DashboardPage() {
  const auth = useAuthContext();

  const [stats, setStats] = useState<DashboardAnalytics | null>(null);

  const [recentEvents, setRecentEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvedTestimonials, setApprovedTestimonials] = useState<{ id: string; full_name?: string; testimony?: string }[]>([]);
  const [formOverview, setFormOverview] = useState<{ total: number; recent: AdminForm[] }>({
    total: 0,
    recent: [],
  });
  const [formStats, setFormStats] = useState<FormStatsResponse | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Try to fetch real data, fall back to mock data if it fails
      const [analyticsResult, eventsResult, testimonialsResult, formsResult, formStatsResult] = await Promise.allSettled([
        apiClient.getAnalytics(),
        apiClient.getEvents({ limit: 5, page: 1 }),
        apiClient.getAllTestimonials({ approved: true }),
        apiClient.getAdminForms({ page: 1, limit: 4 }),
        apiClient.getFormStats({ limit: 6 }),
      ]);

      if (analyticsResult.status === 'fulfilled') {
        setStats(analyticsResult.value);
      } else {
        console.warn('Analytics unavailable:', analyticsResult.reason);
        setStats(null);
      }

      if (eventsResult.status === 'fulfilled') {
        const eventsList = toArray<EventData>(eventsResult.value);
        setRecentEvents(eventsList);
      } else {
        console.warn('Events unavailable:', eventsResult.reason);
        setRecentEvents([]);
      }

      if (testimonialsResult.status === 'fulfilled') {
        const list = toArray<{ id: string; full_name?: string; testimony?: string }>(testimonialsResult.value);
        setApprovedTestimonials(list.slice(0, 4));
      } else {
        console.warn('Testimonials unavailable:', testimonialsResult.reason);
        setApprovedTestimonials([]);
      }

      if (formsResult.status === 'fulfilled') {
        const list = toArray<AdminForm>(formsResult.value);
        const total = readTotal(formsResult.value, list.length);
        setFormOverview({ total, recent: list });
      } else {
        console.warn('Forms unavailable:', formsResult.reason);
        setFormOverview({ total: 0, recent: [] });
      }

      if (formStatsResult.status === 'fulfilled') {
        setFormStats(formStatsResult.value);
      } else {
        console.warn('Form submission stats unavailable:', formStatsResult.reason);
        setFormStats(null);
      }
    } catch (error) {
      console.error('Dashboard error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-[var(--color-text-tertiary)]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const categoryValues = Object.values(stats?.eventsByCategory ?? {});
  const maxCategoryValue = categoryValues.length > 0 ? Math.max(...categoryValues) : 1;
  const firstName = auth.user?.first_name || 'Admin';
  const categoriesByCount = Object.entries(stats?.eventsByCategory ?? {}).sort((a, b) => b[1] - a[1]);
  const topCategory = categoriesByCount[0];

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-500/10" />
        <div className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-rose-200/30 blur-3xl dark:bg-rose-500/10" />
      </div>

      {/* Header */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-[var(--color-background-secondary)] via-[var(--color-background-tertiary)] to-transparent shadow-lg">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">Wisdom Church Admin</p>
            <h1 className="font-display mt-3 text-3xl font-semibold text-[var(--color-text-primary)] md:text-4xl">
              Dashboard Overview
            </h1>
            <p className="mt-2 text-base text-[var(--color-text-secondary)]">
              Welcome back, {firstName}! Here is the latest activity at a glance.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Badge variant="outline" size="lg" className="bg-[var(--color-background-primary)] text-[var(--color-text-secondary)]">
                Role: <span className="ml-1 font-semibold capitalize">{auth.user?.role?.replace('_', ' ')}</span>
              </Badge>
              <Badge variant="secondary" size="lg" className="bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]">
                {auth.user?.email}
              </Badge>
            </div>
          </div>

          <Button variant="outline" onClick={auth.logout}>
            Logout
          </Button>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 fade-up">
        <StatCard
          title="Total Events"
          value={stats ? stats.totalEvents : '—'}
          icon={<Calendar className="h-5 w-5 text-[var(--color-text-primary)]" />}
        />
        <StatCard
          title="Upcoming Events"
          value={stats ? stats.upcomingEvents : '—'}
          icon={<AlertCircle className="h-5 w-5 text-[var(--color-text-primary)]" />}
        />
        <StatCard
          title="Total Attendees"
          value={stats ? stats.totalAttendees.toLocaleString() : '—'}
          icon={<Users className="h-5 w-5 text-[var(--color-text-primary)]" />}
        />
        <StatCard
          title="Categories"
          value={stats ? Object.keys(stats.eventsByCategory).length : '—'}
          icon={<Video className="h-5 w-5 text-[var(--color-text-primary)]" />}
        />
        <StatCard
          title="Forms"
          value={formOverview.total}
          icon={<ClipboardList className="h-5 w-5 text-[var(--color-text-primary)]" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Recent Events */}
        <Card title="Recent Events" className="fade-up">
          <div className="space-y-4">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-background-primary)] md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">{event.title}</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
                      <Badge variant="info" className="bg-sky-100 text-sky-700 border-sky-200">
                        {event.category || 'Uncategorized'}
                      </Badge>
                      <span>
                        {event.date ? new Date(event.date).toLocaleDateString() : 'No date'} ·{' '}
                        {event.time || 'Time TBD'}
                      </span>
                      <span className="text-[var(--color-text-tertiary)]">|</span>
                      <span>{event.location || 'Location TBD'}</span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      event.status === 'upcoming'
                        ? 'success'
                        : event.status === 'happening'
                          ? 'warning'
                          : 'default'
                    }
                    className="capitalize"
                  >
                    {event.status || 'unknown'}
                  </Badge>
                </div>
              ))
            ) : (
                <p className="text-center text-[var(--color-text-tertiary)] py-6">
                  No recent events found
                </p>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Latest Forms" className="fade-up">
            {formOverview.recent.length > 0 ? (
              <div className="space-y-3">
                {formOverview.recent.map((form) => (
                  <div
                    key={form.id}
                    className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-3"
                  >
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{form.title}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {form.slug ? `/forms/${form.slug}` : 'Not published yet'}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
                      <span>{form.isPublished ? 'Published' : 'Draft'}</span>
                      <span>{form.updatedAt ? new Date(form.updatedAt).toLocaleDateString() : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No forms created yet.</p>
            )}
          </Card>
          <Card title="Approved Testimonials" className="fade-up">
            {approvedTestimonials.length > 0 ? (
              <div className="space-y-3">
                {approvedTestimonials.map((t) => (
                  <div key={t.id} className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-3">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t.full_name || 'Anonymous'}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-tertiary)]">{t.testimony || 'No text provided'}</p>
                    <div className="mt-3 flex justify-between">
                      <Badge variant="success">Approved</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toast.success('Published to site (hook backend here)')}
                      >
                        Publish
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No approved testimonials yet.</p>
            )}
          </Card>
          {/* Category Distribution */}
          <Card title="Events by Category" className="fade-up animation-delay-500">
            <div className="space-y-4">
              {categoriesByCount.length > 0 ? (
                categoriesByCount.map(([category, count]) => (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[var(--color-text-secondary)] font-medium">{category}</span>
                      <span className="text-[var(--color-text-tertiary)]">{count} events</span>
                    </div>
                    <div className="h-2.5 bg-[var(--color-background-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 rounded-full transition-all"
                        style={{ width: `${(count / maxCategoryValue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-[var(--color-text-tertiary)] py-6">
                  {stats ? 'No category data available' : 'Analytics unavailable'}
                </p>
              )}
            </div>
          </Card>

          <Card className="relative overflow-hidden bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] fade-up animation-delay-1000">
            <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-amber-400/30 blur-2xl" />
            <div className="relative space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Spotlight</p>
              <h3 className="font-display text-2xl font-semibold">
                {topCategory ? topCategory[0] : 'Your Next Big Event'}
              </h3>
              <p className="text-sm text-slate-200">
                {topCategory
                  ? `${topCategory[1]} events are already trending in this category.`
                  : 'Start building momentum by scheduling new events.'}
              </p>
              <div className="flex items-center gap-2 text-sm text-amber-200">
                <TrendingUp className="h-4 w-4" />
                <span>Momentum snapshot</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card title="Form Activity" className="fade-up">
          {formStats?.recent?.length ? (
            <div className="space-y-3">
              {formStats.recent.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--color-text-primary)] truncate">
                      {item.formTitle || 'Form'}
                    </div>
                    <div className="text-[var(--color-text-tertiary)] truncate">
                      {item.name || item.email || 'Anonymous'}
                    </div>
                  </div>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[var(--color-text-tertiary)]">No recent submissions yet.</div>
          )}
        </Card>

        <Card className="fade-up">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-tertiary)]">Total Form Submissions</p>
              <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {formStats?.totalSubmissions ?? 0}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
            Track registrations by opening a form and viewing its submissions.
          </p>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <Card
      className="group relative overflow-hidden bg-[var(--color-background-secondary)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
      contentClassName="p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">{title}</p>
          <p className="font-display mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{value}</p>
          <div className="mt-2 flex items-center gap-1 text-[0.7rem] font-medium text-emerald-500">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Active</span>
          </div>
        </div>
        <div className="h-10 w-10 rounded-2xl bg-[var(--color-background-tertiary)] flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="pointer-events-none absolute -right-10 -top-12 h-24 w-24 rounded-full bg-amber-200/40 blur-2xl transition-opacity group-hover:opacity-80" />
    </Card>
  );
}
