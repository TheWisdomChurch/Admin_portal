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
} from 'lucide-react';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useAuthContext } from '@/providers/AuthProviders';
import { EventData, DashboardAnalytics } from '@/lib/types';

export default function DashboardPage() {
  const auth = useAuthContext();

  const [stats, setStats] = useState<DashboardAnalytics>({
    totalEvents: 0,
    upcomingEvents: 0,
    totalAttendees: 0,
    eventsByCategory: {},
    monthlyStats: [],
  });

  const [recentEvents, setRecentEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Try to fetch real data, fall back to mock data if it fails
      try {
        const [analytics, eventsData] = await Promise.all([
          apiClient.getAnalytics(),
          apiClient.getEvents({ limit: 5, page: 1 }),
        ]);

        setStats(analytics);
        
        // Handle different response formats
        if (Array.isArray(eventsData)) {
          setRecentEvents(eventsData);
        } else if (eventsData && 'data' in eventsData) {
          setRecentEvents(eventsData.data);
        } else {
          setRecentEvents([]);
        }
      } catch (error) {
        console.error('Failed to load real data, using mock data:', error);
        
  
        
        
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

  const categoryValues = Object.values(stats.eventsByCategory);
  const maxCategoryValue = categoryValues.length > 0 ? Math.max(...categoryValues) : 1;
  const firstName = auth.user?.first_name || 'Admin';
  const categoriesByCount = Object.entries(stats.eventsByCategory).sort((a, b) => b[1] - a[1]);
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

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => (window.location.href = '/dashboard/events')}
              variant="primary"
              className="shadow-sm"
            >
              View All Events
            </Button>
            <Button variant="outline" onClick={auth.logout}>
              Logout
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 fade-up">
        <StatCard
          title="Total Events"
          value={stats.totalEvents}
          icon={<Calendar className="h-5 w-5 text-[var(--color-text-primary)]" />}
        />
        <StatCard
          title="Upcoming Events"
          value={stats.upcomingEvents}
          icon={<AlertCircle className="h-5 w-5 text-[var(--color-text-primary)]" />}
        />
        <StatCard
          title="Total Attendees"
          value={stats.totalAttendees.toLocaleString()}
          icon={<Users className="h-5 w-5 text-[var(--color-text-primary)]" />}
        />
        <StatCard
          title="Categories"
          value={Object.keys(stats.eventsByCategory).length}
          icon={<Video className="h-5 w-5 text-[var(--color-text-primary)]" />}
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
                  No category data available
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
