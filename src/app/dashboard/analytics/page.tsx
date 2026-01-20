// src/app/(dashboard)/analytics/page.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { BarChart3, Users, Calendar, TrendingUp, Download, Filter } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import toast from 'react-hot-toast';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { apiClient } from '@/lib/api';
import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

type TimeRange = 'week' | 'month' | 'quarter' | 'year';

interface AnalyticsData {
  totalEvents: number;
  upcomingEvents: number;
  totalAttendees: number;
  eventsByCategory: Record<string, number>;
  monthlyStats: Array<{
    month: string;
    events: number;
    attendees: number;
  }>;
}

function AnalyticsPage() {
  const { isInitialized, isLoading } = useAuthContext();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [loading, setLoading] = useState(true);

  const authBlocked = !isInitialized || isLoading;

  /**
   * NOTE:
   * Your current apiClient.getAnalytics() takes 0 arguments.
   * If you later add backend filtering by range, update api.ts signature too.
   */
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);

      const data = await apiClient.getAnalytics();

      // If your backend later supports timeRange filtering:
      // const data = await apiClient.getAnalytics({ range: timeRange });

      setAnalytics(data as AnalyticsData);
    } catch (error) {
      toast.error('Failed to load analytics');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authBlocked) return;
    loadAnalytics();
  }, [authBlocked, loadAnalytics]);

  // If you still want the UI control, you can optionally refetch on timeRange change.
  // Right now backend ignores it, but the layout stays the same.
  useEffect(() => {
    if (authBlocked) return;
    // If you don't want extra refetches, remove this effect.
    loadAnalytics();
  }, [timeRange, authBlocked, loadAnalytics]);

  const categoryData = useMemo(() => {
    const byCategory = analytics?.eventsByCategory ?? {};
    return {
      labels: Object.keys(byCategory),
      datasets: [
        {
          data: Object.values(byCategory),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'],
          borderWidth: 1,
        },
      ],
    };
  }, [analytics]);

  const monthlyEventsData = useMemo(() => {
    const stats = analytics?.monthlyStats ?? [];
    return {
      labels: stats.map((stat) => stat.month),
      datasets: [
        {
          label: 'Events',
          data: stats.map((stat) => stat.events),
          backgroundColor: '#3b82f6',
          borderRadius: 4,
        },
        {
          label: 'Attendees',
          data: stats.map((stat) => stat.attendees / 100),
          backgroundColor: '#10b981',
          borderRadius: 4,
        },
      ],
    };
  }, [analytics]);

  const handleExport = () => {
    toast.success('Export feature coming soon!');
  };

  const handleTimeRangeChange = (value: string) => {
    if (value === 'week' || value === 'month' || value === 'quarter' || value === 'year') {
      setTimeRange(value);
    }
  };

  if (authBlocked || loading || !analytics) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse p-6">
              <div className="h-24 bg-secondary-200 rounded-lg" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">Analytics Dashboard</h1>
          <p className="text-secondary-600 mt-2">Track performance and engagement metrics</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-secondary-500" />
            <select
              value={timeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value)}
              className="rounded-lg border border-secondary-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>

          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Total Events</p>
              <p className="text-3xl font-bold text-secondary-900 mt-2">{analytics.totalEvents}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Upcoming Events</p>
              <p className="text-3xl font-bold text-secondary-900 mt-2">{analytics.upcomingEvents}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Total Attendees</p>
              <p className="text-3xl font-bold text-secondary-900 mt-2">
                {analytics.totalAttendees.toLocaleString()}
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Avg. Attendance</p>
              <p className="text-3xl font-bold text-secondary-900 mt-2">
                {analytics.totalEvents > 0 ? Math.round(analytics.totalAttendees / analytics.totalEvents) : 0}
              </p>
              <p className="text-xs text-secondary-500 mt-1">per event</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-secondary-900 mb-4">Events by Category</h2>
          <div className="h-80">
            <Pie
              data={categoryData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                    labels: { padding: 20, usePointStyle: true },
                  },
                },
              }}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-secondary-900 mb-4">Monthly Trends</h2>
          <div className="h-80">
            <Bar
              data={monthlyEventsData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                  x: { grid: { display: false } },
                  y: { beginAtZero: true },
                },
              }}
            />
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-secondary-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-secondary-900">New event created: "Annual Youth Summit"</p>
                <p className="text-sm text-secondary-500">2 hours ago</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-secondary-900">25 new registrations for "Prayer Night"</p>
                <p className="text-sm text-secondary-500">5 hours ago</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-secondary-900">Weekly report generated</p>
                <p className="text-sm text-secondary-500">1 day ago</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default withAuth(AnalyticsPage, { requiredRole: 'admin' });
