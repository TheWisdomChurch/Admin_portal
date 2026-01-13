// src/app/(dashboard)/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  Download,
  Filter,
} from 'lucide-react';
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
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';
// import { toast } from '@/components/admin/Toast';

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

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAnalytics();
      setAnalytics(data);
    } catch (error) {
      toast.error('Failed to load analytics');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics) {
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

  // Prepare chart data
  const categoryData = {
    labels: Object.keys(analytics.eventsByCategory),
    datasets: [
      {
        data: Object.values(analytics.eventsByCategory),
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#8b5cf6',
          '#ef4444',
          '#06b6d4',
        ],
      },
    ],
  };

  const monthlyEventsData = {
    labels: analytics.monthlyStats.map((stat: any) => stat.month),
    datasets: [
      {
        label: 'Events',
        data: analytics.monthlyStats.map((stat: any) => stat.events),
        backgroundColor: '#3b82f6',
      },
      {
        label: 'Attendees',
        data: analytics.monthlyStats.map((stat: any) => stat.attendees / 100),
        backgroundColor: '#10b981',
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">Analytics Dashboard</h1>
          <p className="text-secondary-600 mt-2">
            Track performance and engagement metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-secondary-500" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="rounded-lg border border-secondary-300 px-3 py-2 text-sm"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Total Events</p>
              <p className="text-3xl font-bold text-secondary-900 mt-2">
                {analytics.totalEvents}
              </p>
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
              <p className="text-3xl font-bold text-secondary-900 mt-2">
                {analytics.upcomingEvents}
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card>
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

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Avg. Attendance</p>
              <p className="text-3xl font-bold text-secondary-900 mt-2">
                {Math.round(analytics.totalAttendees / analytics.totalEvents)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Events by Category">
          <div className="h-80">
            <Pie
              data={categoryData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                  },
                },
              }}
            />
          </div>
        </Card>

        <Card title="Monthly Trends">
          <div className="h-80">
            <Bar
              data={monthlyEventsData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
            />
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card title="Recent Activity">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-secondary-900">
                  New event created: "Annual Youth Summit"
                </p>
                <p className="text-sm text-secondary-500">2 hours ago</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-secondary-900">
                  25 new registrations for "Prayer Night"
                </p>
                <p className="text-sm text-secondary-500">5 hours ago</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-secondary-900">
                  Weekly report generated
                </p>
                <p className="text-sm text-secondary-500">1 day ago</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}