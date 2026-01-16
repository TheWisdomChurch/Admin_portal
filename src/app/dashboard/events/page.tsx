// src/app/dashboard/events/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/Card';
import { DataTable } from '@/components/DateTable';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { EventData } from '@/lib/types';
import { withAuth } from '@/providers/AuthProviders';

function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    loadEvents();
  }, [page, limit, search, categoryFilter]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      
      // For development, use mock data
      const mockResponse = {
        data: [
          {
            id: 1,
            title: 'Sunday Service',
            shortDescription: 'Weekly worship service',
            description: 'Weekly Sunday worship service with prayers and sermons',
            date: '2024-01-28',
            time: '10:00 AM',
            location: 'Main Sanctuary',
            category: 'Prayer' as const,
            status: 'upcoming' as const,
            attendees: 150,
            isFeatured: true,
            tags: ['worship', 'prayer'],
            image: '',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
          {
            id: 2,
            title: 'Youth Conference',
            shortDescription: 'Annual youth gathering',
            description: 'Annual youth conference with guest speakers',
            date: '2024-02-15',
            time: '9:00 AM - 5:00 PM',
            location: 'Church Auditorium',
            category: 'Conference' as const,
            status: 'upcoming' as const,
            attendees: 200,
            isFeatured: true,
            tags: ['youth', 'conference'],
            image: '',
            createdAt: '2024-01-05',
            updatedAt: '2024-01-05',
          }
        ],
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      
      setEvents(mockResponse.data);
      setTotal(mockResponse.total);
      
      // Uncomment this when backend is ready:
      // const params: any = { page, limit, search: search || undefined };
      // if (categoryFilter !== 'all') params.category = categoryFilter;
      // const response = await apiClient.getEvents(params);
      // setEvents(response.data);
      // setTotal(response.total);
      
    } catch (error) {
      toast.error('Failed to load events');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (event: EventData) => {
    if (!confirm(`Are you sure you want to delete "${event.title}"?`)) {
      return;
    }

    try {
      // Mock delete for now
      toast.success('Event deleted successfully (Mock)');
      loadEvents(); // Refresh the list
      
      // Uncomment when backend is ready:
      // await apiClient.deleteEvent(event.id);
      // toast.success('Event deleted successfully');
      // loadEvents();
    } catch (error) {
      toast.error('Failed to delete event');
      console.error(error);
    }
  };

  const handleEdit = (event: EventData) => {
    router.push(`/dashboard/events/${event.id}/edit`);
  };

  const columns = [
    {
      key: 'title' as keyof EventData,
      header: 'Title',
      cell: (event: EventData) => (
        <div>
          <div className="font-medium text-secondary-900">{event.title}</div>
          <div className="text-sm text-secondary-500">{event.shortDescription}</div>
        </div>
      ),
    },
    {
      key: 'category' as keyof EventData,
      header: 'Category',
      cell: (event: EventData) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
          {event.category}
        </span>
      ),
    },
    {
      key: 'date' as keyof EventData,
      header: 'Date & Time',
      cell: (event: EventData) => (
        <div className="text-sm">
          <div>{new Date(event.date).toLocaleDateString()}</div>
          <div className="text-secondary-500">{event.time}</div>
        </div>
      ),
    },
    {
      key: 'status' as keyof EventData,
      header: 'Status',
      cell: (event: EventData) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          event.status === 'upcoming' ? 'bg-green-100 text-green-800' :
          event.status === 'happening' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {event.status}
        </span>
      ),
    },
    {
      key: 'attendees' as keyof EventData,
      header: 'Attendees',
      cell: (event: EventData) => (
        <div className="text-center">
          <div className="font-medium">{event.attendees}</div>
          <div className="text-xs text-secondary-500">registered</div>
        </div>
      ),
    },
  ];

  const categories = [
    'all',
    'Outreach',
    'Conference',
    'Workshop',
    'Prayer',
    'Revival',
    'Summit',
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">Events Management</h1>
          <p className="text-secondary-600 mt-2">Create, edit, and manage all church events</p>
        </div>
        <Button onClick={() => router.push('/dashboard/events/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-500" />
            <Input
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-secondary-500" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Events Table */}
      <DataTable
        data={events}
        columns={columns}
        total={total}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={loading}
      />
    </div>
  );
}

export default withAuth(EventsPage, { requiredRole: 'admin' });