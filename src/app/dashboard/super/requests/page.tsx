'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { useDashboardSearch } from '@/hooks/useDashboardSearch';
import { apiClient } from '@/lib/api';
import type {
  ApprovalRequest,
  ApprovalRequestStatus,
  ApprovalRequestType,
  ApprovalRequestsTimeline,
} from '@/lib/types';
import { Activity, CheckCircle2, Clock3, Filter, RefreshCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const typeLabel: Record<ApprovalRequestType, string> = {
  testimonial: 'Testimonial',
  event: 'Event',
  admin_user: 'Admin Access',
};

const statusVariant: Record<ApprovalRequestStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  deleted: 'danger',
};

function fallbackMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function openPathByType(type: ApprovalRequestType): string {
  if (type === 'testimonial') return '/dashboard/testimonials';
  if (type === 'event') return '/dashboard/event';
  return '/dashboard';
}

function RequestsPage() {
  const router = useRouter();
  const { searchTerm, setSearchTerm } = useDashboardSearch('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [timeline, setTimeline] = useState<ApprovalRequestsTimeline | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | ApprovalRequestType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ApprovalRequestStatus>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'requester'>('recent');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [requestsRes, timelineRes] = await Promise.all([
        apiClient.listApprovalRequests({ limit: 120 }),
        apiClient.getApprovalRequestsTimeline(14),
      ]);
      setRequests(Array.isArray(requestsRes) ? requestsRes : []);
      setTimeline(timelineRes);
    } catch (error: unknown) {
      toast.error(fallbackMessage(error, 'Failed to load super-admin requests.'));
      setRequests([]);
      setTimeline(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const source = Array.isArray(requests) ? requests : [];
    return source
      .filter((item) => (typeFilter === 'all' ? true : item.type === typeFilter))
      .filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter))
      .filter((item) => {
        if (!query) return true;
        const haystack = `${item.ticketCode} ${item.entityLabel ?? ''} ${item.requestedByName ?? ''} ${item.requestedByEmail ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        if (sortBy === 'requester') {
          return (a.requestedByName || a.requestedByEmail || '').localeCompare(
            b.requestedByName || b.requestedByEmail || ''
          );
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [requests, searchTerm, sortBy, statusFilter, typeFilter]);

  const timelinePoints = useMemo(() => {
    if (!timeline) return [];
    const created = Array.isArray(timeline.created)
      ? timeline.created.filter((item): item is { day: string; count: number } => Boolean(item && item.day))
      : [];
    const approved = Array.isArray(timeline.approved)
      ? timeline.approved.filter((item): item is { day: string; count: number } => Boolean(item && item.day))
      : [];
    const approvedByDay = new Map<string, number>(
      approved.map((item) => {
        const safeDay = new Date(item.day);
        const dayKey = Number.isNaN(safeDay.getTime()) ? item.day.slice(0, 10) : safeDay.toISOString().slice(0, 10);
        return [dayKey, item.count];
      })
    );
    return created.map((item) => {
      const safeDay = new Date(item.day);
      const key = Number.isNaN(safeDay.getTime()) ? item.day.slice(0, 10) : safeDay.toISOString().slice(0, 10);
      return {
        day: key,
        created: item.count,
        approved: approvedByDay.get(key) || 0,
      };
    });
  }, [timeline]);

  const timelineMax = useMemo(() => {
    return Math.max(1, ...timelinePoints.map((item) => Math.max(item.created, item.approved)));
  }, [timelinePoints]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests"
        subtitle="Live super-admin request stream from approval tickets and workflow events."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs px-3" onClick={() => setSearchTerm('')}>
              Clear search
            </Button>
            <Button variant="outline" size="sm" className="text-xs px-3" onClick={() => void loadData()} loading={loading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Total tickets</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{requests.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
            {requests.filter((item) => item.status === 'pending').length}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Approved</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
            {requests.filter((item) => item.status === 'approved').length}
          </p>
        </Card>
      </div>

      <Card title="Request Timeline" actions={<Activity className="h-4 w-4 text-[var(--color-text-tertiary)]" />}>
        {timelinePoints.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">No timeline data yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
            {timelinePoints.map((point) => {
              const createdHeight = Math.max(8, Math.round((point.created / timelineMax) * 70));
              const approvedHeight = Math.max(8, Math.round((point.approved / timelineMax) * 70));
              return (
                <div key={point.day} className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">{point.day.slice(5)}</p>
                  <div className="mt-2 flex h-20 items-end gap-2">
                    <div className="w-3 rounded-sm bg-amber-400/80" style={{ height: `${createdHeight}px` }} title={`Created: ${point.created}`} />
                    <div className="w-3 rounded-sm bg-emerald-400/80" style={{ height: `${approvedHeight}px` }} title={`Approved: ${point.approved}`} />
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">C:{point.created} • A:{point.approved}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="text-xs px-3" variant={typeFilter === 'all' ? 'primary' : 'ghost'} icon={<Filter className="h-4 w-4" />} onClick={() => setTypeFilter('all')}>
              All
            </Button>
            <Button size="sm" className="text-xs px-3" variant={typeFilter === 'event' ? 'primary' : 'ghost'} onClick={() => setTypeFilter('event')}>
              Events
            </Button>
            <Button size="sm" className="text-xs px-3" variant={typeFilter === 'testimonial' ? 'primary' : 'ghost'} onClick={() => setTypeFilter('testimonial')}>
              Testimonials
            </Button>
            <Button size="sm" className="text-xs px-3" variant={typeFilter === 'admin_user' ? 'primary' : 'ghost'} onClick={() => setTypeFilter('admin_user')}>
              Admin Access
            </Button>

            <Button size="sm" className="text-xs px-3" variant={statusFilter === 'pending' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('pending')}>
              Pending
            </Button>
            <Button size="sm" className="text-xs px-3" variant={statusFilter === 'approved' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('approved')}>
              Approved
            </Button>
            <Button size="sm" className="text-xs px-3" variant={statusFilter === 'deleted' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('deleted')}>
              Deleted
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-[28rem]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by ticket, requester, label..." className="pl-10" />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-xs md:text-sm"
            >
              <option value="recent">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="requester">Requester</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredRequests.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No requests match these filters.</p>
          ) : (
            filteredRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{req.ticketCode}</p>
                      <Badge variant="outline" size="sm">{typeLabel[req.type]}</Badge>
                      <Badge variant={statusVariant[req.status]} size="sm">{req.status}</Badge>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{req.entityLabel || 'No label provided'}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(req.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      Requested by: {req.requestedByName || req.requestedByEmail || 'System'}
                    </p>
                    {req.approvedAt && (
                      <p className="text-xs text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approved {new Date(req.approvedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className={clsx('text-xs px-3')}
                      onClick={() => router.push(openPathByType(req.type))}
                    >
                      Open Related
                    </Button>
                    {req.entityId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs px-3"
                        onClick={() => setSearchTerm(req.entityId || '')}
                      >
                        Track ID
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

export default withAuth(RequestsPage, { requiredRole: 'super_admin' });
