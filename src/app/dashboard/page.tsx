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
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const categoryValues = Object.values(stats.eventsByCategory);
  const maxCategoryValue = categoryValues.length > 0 ? Math.max(...categoryValues) : 1;
  const firstName = auth.user?.first_name || 'Admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Welcome back, {firstName}! Here's what's happening.
        </p>

        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <div className="bg-white px-4 py-2 rounded-lg shadow">
            <p className="text-sm text-gray-600">
              Role: <span className="font-medium text-blue-600 capitalize">{auth.user?.role?.replace('_', ' ')}</span>
            </p>
          </div>

          <div className="bg-white px-4 py-2 rounded-lg shadow">
            <p className="text-sm text-gray-600">
              Email: <span className="font-medium text-blue-600">{auth.user?.email}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Events"
          value={stats.totalEvents}
          icon={<Calendar className="h-6 w-6 text-blue-600" />}
        />
        <StatCard
          title="Upcoming Events"
          value={stats.upcomingEvents}
          icon={<AlertCircle className="h-6 w-6 text-green-600" />}
        />
        <StatCard
          title="Total Attendees"
          value={stats.totalAttendees.toLocaleString()}
          icon={<Users className="h-6 w-6 text-purple-600" />}
        />
        <StatCard
          title="Categories"
          value={Object.keys(stats.eventsByCategory).length}
          icon={<Video className="h-6 w-6 text-pink-600" />}
        />
      </div>

      {/* Recent Events */}
      <Card title="Recent Events">
        <div className="space-y-4">
          {recentEvents.length > 0 ? (
            recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h4 className="font-medium text-gray-900">{event.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="info">{event.category || 'Uncategorized'}</Badge>
                    <span className="text-sm text-gray-500">
                      {event.date ? new Date(event.date).toLocaleDateString() : 'No date'}
                    </span>
                  </div>
                </div>
                <Badge variant={
                  event.status === 'upcoming' ? 'success' :
                  event.status === 'happening' ? 'warning' : 'default'
                }>
                  {event.status || 'unknown'}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-6">
              No recent events found
            </p>
          )}
        </div>
      </Card>

      {/* Category Distribution */}
      <Card title="Events by Category">
        <div className="space-y-4">
          {Object.entries(stats.eventsByCategory).length > 0 ? (
            Object.entries(stats.eventsByCategory).map(([category, count]) => (
              <div key={category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 font-medium">{category}</span>
                  <span className="text-gray-600">{count} events</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${(count / maxCategoryValue) * 100}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-6">
              No category data available
            </p>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="flex justify-between items-center">
        <Button
          onClick={() => window.location.href = '/dashboard/events'}
          variant="primary"
        >
          View All Events
        </Button>
        
        <Button
          variant="outline"
          onClick={auth.logout}
        >
          Logout
        </Button>
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
    <Card>
      <div className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          <div className="flex items-center gap-1 mt-2 text-green-600 text-sm">
            <ArrowUpRight className="h-4 w-4" />
            <span>Active</span>
          </div>
        </div>
        <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </Card>
  );
}