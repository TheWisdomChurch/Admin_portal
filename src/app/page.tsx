// src/app/(dashboard)/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  Users,
  TrendingUp,
  Video,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { EventData } from '@/lib/types';
// import { toast } from '@/components/admin/Toast';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalEvents: 0,
    upcomingEvents: 0,
    totalAttendees: 0,
    eventsByCategory: {} as Record<string, number>,
    monthlyStats: [] as Array<{ month: string; events: number; attendees: number }>,
  });
  const [recentEvents, setRecentEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [analytics, events] = await Promise.all([
        apiClient.getAnalytics(),
        apiClient.getEvents({ limit: 5, page: 1 }),
      ]);
      setStats(analytics);
      setRecentEvents(events.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-24 bg-secondary-200 rounded-lg"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">Dashboard</h1>
        <p className="text-secondary-600 mt-2">Welcome back! Here's what's happening.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Total Events</p>
              <p className="text-3xl font-bold text-secondary-900 mt-2">{stats.totalEvents}</p>
              <div className="flex items-center gap-1 mt-2">
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">12% from last month</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Upcoming Events</p>
              <p className="text-3xl font-bold text-secondary-900 mt-2">{stats.upcomingEvents}</p>
              <div className="flex items-center gap-1 mt-2">
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">3 new this week</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Total Attendees</p>
              <p className="text-3xl font-bold text-secondary-900 mt-2">
                {stats.totalAttendees.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">8% from last month</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Media Reels</p>
              <p className="text-3xl font-bold text-secondary-900 mt-2">
                {Object.keys(stats.eventsByCategory).length}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">5 new this month</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <Video className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Events & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <Card title="Recent Events" actions={
          <Button variant="ghost" size="sm">View All</Button>
        }>
          <div className="space-y-4">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary-50">
                <div>
                  <h4 className="font-medium text-secondary-900">{event.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="info">{event.category}</Badge>
                    <span className="text-sm text-secondary-500">
                      {new Date(event.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Badge variant={
                  event.status === 'upcoming' ? 'info' :
                  event.status === 'happening' ? 'warning' : 'default'
                }>
                  {event.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Category Distribution */}
        <Card title="Events by Category">
          <div className="space-y-4">
            {Object.entries(stats.eventsByCategory).map(([category, count]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-secondary-700">{category}</span>
                  <span className="text-sm text-secondary-600">{count} events</span>
                </div>
                <div className="h-2 bg-secondary-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-600 rounded-full"
                    style={{
                      width: `${(count / Math.max(...Object.values(stats.eventsByCategory))) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button variant="outline" className="h-auto py-4 flex-col gap-2">
            <Calendar className="h-6 w-6" />
            <span>Create Event</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2">
            <Video className="h-6 w-6" />
            <span>Upload Reel</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2">
            <TrendingUp className="h-6 w-6" />
            <span>View Reports</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}