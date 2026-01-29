'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { useDashboardSearch } from '@/hooks/useDashboardSearch';
import { BarChart3, CheckCircle, Clock, Filter, RefreshCcw, Search, Send, TicketX } from 'lucide-react';

type RequestCategory = 'access' | 'report' | 'event' | 'budget';
type RequestStatus = 'open' | 'in_review' | 'closed';
type RequestPriority = 'high' | 'medium' | 'low';

interface RequestItem {
  id: string;
  title: string;
  owner: string;
  category: RequestCategory;
  status: RequestStatus;
  priority: RequestPriority;
  submittedAt: string;
  summary: string;
}

const defaultRequests: RequestItem[] = [
  {
    id: 'req-001',
    title: 'Approve event collaboration',
    owner: 'Lola James',
    category: 'event',
    status: 'open',
    priority: 'high',
    submittedAt: new Date().toISOString(),
    summary: 'Requesting approval to co-host the Easter outreach with media team support.',
  },
  {
    id: 'req-002',
    title: 'Budget top-up for sound',
    owner: 'Emeka Obi',
    category: 'budget',
    status: 'in_review',
    priority: 'medium',
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    summary: 'Need ₦250,000 additional funds for hired speakers due to higher turnout.',
  },
  {
    id: 'req-003',
    title: 'Analytics export',
    owner: 'Bisola Adeyemi',
    category: 'report',
    status: 'open',
    priority: 'low',
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    summary: 'Export attendee breakdown for Q1 report and attach to board deck.',
  },
  {
    id: 'req-004',
    title: 'Access to approvals dashboard',
    owner: 'John Mensah',
    category: 'access',
    status: 'closed',
    priority: 'low',
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    summary: 'Needs read-only access for compliance audit scheduled next week.',
  },
  {
    id: 'req-005',
    title: 'Volunteer training session',
    owner: 'Seyi Babalola',
    category: 'event',
    status: 'in_review',
    priority: 'high',
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    summary: 'Schedule training for 12 new volunteers and request projector booking.',
  },
];

const priorityWeight: Record<RequestPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function RequestsPage() {
  const { searchTerm, setSearchTerm } = useDashboardSearch('');
  const [requests, setRequests] = useState<RequestItem[]>(defaultRequests);
  const [categoryFilter, setCategoryFilter] = useState<'all' | RequestCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'priority' | 'owner'>('recent');

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return requests
      .filter((item) => (categoryFilter === 'all' ? true : item.category === categoryFilter))
      .filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter))
      .filter((item) => {
        if (!normalizedSearch) return true;
        const haystack = `${item.title} ${item.owner} ${item.summary}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        if (sortBy === 'owner') return a.owner.localeCompare(b.owner);
        if (sortBy === 'priority') return priorityWeight[b.priority] - priorityWeight[a.priority];
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      });
  }, [categoryFilter, requests, searchTerm, sortBy, statusFilter]);

  const updateStatus = (id: string, status: RequestStatus) => {
    setRequests((prev) => prev.map((req) => (req.id === id ? { ...req, status } : req)));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests"
        subtitle="Track every super-admin request separately from approvals."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs px-3" onClick={() => setSearchTerm('')}>
              Clear search
            </Button>
            <Button variant="outline" size="sm" className="text-xs px-3" onClick={() => setRequests(defaultRequests)}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Reset queue
            </Button>
          </div>
        }
      />

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="text-xs px-3"
              variant={categoryFilter === 'all' ? 'primary' : 'ghost'}
              icon={<Filter className="h-4 w-4" />}
              onClick={() => setCategoryFilter('all')}
            >
              All
            </Button>
            <Button size="sm" className="text-xs px-3" variant={categoryFilter === 'event' ? 'primary' : 'ghost'} onClick={() => setCategoryFilter('event')}>
              Events
            </Button>
            <Button size="sm" className="text-xs px-3" variant={categoryFilter === 'report' ? 'primary' : 'ghost'} onClick={() => setCategoryFilter('report')}>
              Reports
            </Button>
            <Button size="sm" className="text-xs px-3" variant={categoryFilter === 'budget' ? 'primary' : 'ghost'} onClick={() => setCategoryFilter('budget')}>
              Budget
            </Button>
            <Button size="sm" className="text-xs px-3" variant={categoryFilter === 'access' ? 'primary' : 'ghost'} onClick={() => setCategoryFilter('access')}>
              Access
            </Button>
            <Button size="sm" className="text-xs px-3" variant={statusFilter === 'open' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('open')}>
              Open
            </Button>
            <Button size="sm" className="text-xs px-3" variant={statusFilter === 'in_review' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('in_review')}>
              Review
            </Button>
            <Button size="sm" className="text-xs px-3" variant={statusFilter === 'closed' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('closed')}>
              Closed
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-96">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search requests..."
                className="pl-10"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-xs md:text-sm"
            >
              <option value="recent">Newest</option>
              <option value="priority">Priority</option>
              <option value="owner">Owner</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{req.title}</p>
                  <Badge variant="outline" size="sm">{req.category}</Badge>
                  <Badge
                    variant={req.priority === 'high' ? 'danger' : req.priority === 'medium' ? 'warning' : 'secondary'}
                    size="sm"
                  >
                    {req.priority} priority
                  </Badge>
                  <Badge
                    variant={req.status === 'closed' ? 'success' : req.status === 'in_review' ? 'info' : 'warning'}
                    size="sm"
                  >
                    {req.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-[11px] md:text-xs text-[var(--color-text-tertiary)] flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {new Date(req.submittedAt).toLocaleString()} • Owner: {req.owner}
                </p>
                <p className="text-sm md:text-base text-[var(--color-text-secondary)]">{req.summary}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs px-3"
                  onClick={() => updateStatus(req.id, 'in_review')}
                  icon={<BarChart3 className="h-4 w-4" />}
                >
                  Review
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs px-3"
                  onClick={() => updateStatus(req.id, 'closed')}
                  icon={<CheckCircle className="h-4 w-4" />}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs px-3"
                  onClick={() => updateStatus(req.id, 'open')}
                  icon={<TicketX className="h-4 w-4" />}
                >
                  Reopen
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredRequests.length === 0 && (
          <p className="text-sm text-[var(--color-text-tertiary)]">No requests match these filters.</p>
        )}
      </Card>

      <Card title="Quick actions">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="sm" className="text-xs px-3" icon={<Send className="h-4 w-4" />}>
            Follow-up
          </Button>
          <Button variant="secondary" size="sm" className="text-xs px-3" icon={<BarChart3 className="h-4 w-4" />}>
            Analytics
          </Button>
          <Button variant="outline" size="sm" className="text-xs px-3" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => setRequests(defaultRequests)}>
            Reload
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default withAuth(RequestsPage, { requiredRole: 'super_admin' });
