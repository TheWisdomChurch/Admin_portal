'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  ThumbsDown,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, type BadgeVariant } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { adminWorkflowApi,requestCreatedAt,
  requestEntityId,
  requestEntityLabel,
  requestRequesterEmail,
  requestRequesterName,
  requestTicketCode,
  type ApprovalRequest,
  type ApprovalRequestStatus,
  type ApprovalRequestType,
  type ApprovalRequestsTimeline,
  type ApprovalTimelinePoint} from '@/lib/adminWorkflow';

type TypeFilter = 'all' | ApprovalRequestType;
type StatusFilter = 'all' | ApprovalRequestStatus;
type SortMode = 'recent' | 'oldest' | 'requester' | 'type';
type ModalAction = 'approve' | 'reject';
type TimelinePoint = { day: string; created: number; approved: number };

const typeLabels: Record<string, string> = {
  testimonial: 'Testimonial',
  event: 'Event',
  event_delete: 'Event Delete',
  admin_user: 'Admin Access',
  leadership_delete: 'Leadership Delete',
  workforce_delete: 'Workforce Delete',
  workforce_registration: 'Workforce Registration',
  form_delete: 'Form Delete',
  form_submission_delete: 'Form Response Delete',
};

const typeDescriptions: Record<string, string> = {
  testimonial: 'Publish or remove testimony requests.',
  event: 'Approve public event visibility.',
  event_delete: 'Authorize taking a live event off the site.',
  admin_user: 'Approve or reject admin account access.',
  leadership_delete: 'Authorize leadership profile deletion.',
  workforce_delete: 'Authorize workforce record deletion.',
  workforce_registration: 'Approve or reject a new workforce applicant.',
  form_delete: 'Authorize form deletion.',
  form_submission_delete: 'Authorize submitted form-response deletion.',
};

const statusVariants: Record<string, BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  deleted: 'danger',
};

function humanType(type: string): string {
  return typeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function fallbackMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function openPathForRequest(request: ApprovalRequest): string {
  const id = requestEntityId(request);
  switch (request.type) {
    case 'admin_user':
      return id ? `/dashboard/super/requests?admin=${encodeURIComponent(id)}` : '/dashboard/super/requests';
    case 'testimonial':
      return '/dashboard/testimonials';
    case 'event':
    case 'event_delete':
      return '/dashboard/event';
    case 'leadership_delete':
      return '/dashboard/leadership';
    case 'workforce_delete':
    case 'workforce_registration':
      return '/dashboard/workforce';
    case 'form_delete':
    case 'form_submission_delete':
      return '/dashboard/forms';
    default:
      return '/dashboard/super/requests';
  }
}

function requestMatches(request: ApprovalRequest, query: string): boolean {
  if (!query) return true;
  const haystack = [
    requestTicketCode(request),
    humanType(request.type),
    request.status,
    requestEntityLabel(request),
    requestRequesterName(request),
    requestRequesterEmail(request),
    requestEntityId(request),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function ActionModal({
  action,
  request,
  loading,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  action: ModalAction;
  request: ApprovalRequest | null;
  loading: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!request) return null;

  const isReject = action === 'reject';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--color-text-primary)]/50 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-secondary)] p-5">
          <div>
            <Badge variant={isReject ? 'danger' : 'success'}>{isReject ? 'Reject request' : 'Approve request'}</Badge>
            <h2 className="mt-3 text-xl font-bold text-[var(--color-text-primary)]">
              {isReject ? 'Reject' : 'Approve'} {humanType(request.type)}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
              Ticket {requestTicketCode(request)} · {requestEntityLabel(request) || 'No label'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-hover)]"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">Requester</p>
                <p className="mt-1 text-[var(--color-text-primary)]">
                  {requestRequesterName(request) || requestRequesterEmail(request) || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">Created</p>
                <p className="mt-1 text-[var(--color-text-primary)]">{formatDate(requestCreatedAt(request))}</p>
              </div>
            </div>
          </div>

          {isReject && (
            <label className="block">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">Reason sent to requester</span>
              <textarea
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
                placeholder="Example: Access request was not approved at this time."
              />
            </label>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border-secondary)] p-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant={isReject ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {isReject ? 'Reject request' : 'Approve request'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [timeline, setTimeline] = useState<ApprovalRequestsTimeline | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [sortBy, setSortBy] = useState<SortMode>('recent');
  const [modalAction, setModalAction] = useState<ModalAction | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [requestItems, timelinePayload] = await Promise.all([
        adminWorkflowApi.listApprovalRequests({ limit: 250 }),
        adminWorkflowApi.getApprovalTimeline(14).catch(() => null),
      ]);
      setRequests(requestItems);
      setTimeline(timelinePayload);
    } catch (error) {
      console.error('Failed to load approval requests:', error);
      toast.error(fallbackMessage(error, 'Failed to load approval requests.'));
      setRequests([]);
      setTimeline(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const counts = useMemo(() => {
    return requests.reduce(
      (acc, request) => {
        acc.total += 1;
        acc[request.status] = (acc[request.status] || 0) + 1;
        return acc;
      },
      { total: 0 } as Record<string, number>
    );
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return [...requests]
      .filter((request) => (typeFilter === 'all' ? true : request.type === typeFilter))
      .filter((request) => (statusFilter === 'all' ? true : request.status === statusFilter))
      .filter((request) => requestMatches(request, searchTerm.trim()))
      .sort((a, b) => {
        if (sortBy === 'requester') {
          return (requestRequesterName(a) || requestRequesterEmail(a)).localeCompare(
            requestRequesterName(b) || requestRequesterEmail(b)
          );
        }
        if (sortBy === 'type') return humanType(a.type).localeCompare(humanType(b.type));
        const aTime = new Date(requestCreatedAt(a)).getTime() || 0;
        const bTime = new Date(requestCreatedAt(b)).getTime() || 0;
        return sortBy === 'oldest' ? aTime - bTime : bTime - aTime;
      });
  }, [requests, searchTerm, sortBy, statusFilter, typeFilter]);

  const timelinePoints = useMemo<TimelinePoint[]>(() => {
    const created: ApprovalTimelinePoint[] = Array.isArray(timeline?.created) ? timeline.created : [];
    const approved: ApprovalTimelinePoint[] = Array.isArray(timeline?.approved) ? timeline.approved : [];
    const approvedByDay = new Map<string, number>(
      approved.map((item: ApprovalTimelinePoint) => [String(item.day).slice(0, 10), Number(item.count) || 0])
    );

    return created.map((item: ApprovalTimelinePoint): TimelinePoint => {
      const day = String(item.day).slice(0, 10);
      return {
        day,
        created: Number(item.count) || 0,
        approved: approvedByDay.get(day) || 0,
      };
    });
  }, [timeline]);

  const timelineMax = useMemo(
    () => Math.max(1, ...timelinePoints.map((item: TimelinePoint) => Math.max(item.created, item.approved))),
    [timelinePoints]
  );

  const openAction = (action: ModalAction, request: ApprovalRequest) => {
    setSelectedRequest(request);
    setModalAction(action);
    setRejectReason(action === 'reject' ? 'Request was not approved.' : '');
  };

  const closeAction = () => {
    if (actionLoading) return;
    setSelectedRequest(null);
    setModalAction(null);
    setRejectReason('');
  };

  const confirmAction = async () => {
    if (!selectedRequest || !modalAction) return;
    try {
      setActionLoading(true);
      if (modalAction === 'approve') {
        await adminWorkflowApi.approveRequest(selectedRequest);
        toast.success('Request approved');
      } else {
        await adminWorkflowApi.rejectRequest(selectedRequest, rejectReason);
        toast.success('Request rejected');
      }
      closeAction();
      await loadData();
    } catch (error) {
      console.error('Approval action failed:', error);
      toast.error(fallbackMessage(error, 'Unable to complete request action.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Requests"
        subtitle="Central authority queue for admin accounts, content publishing, deletion requests and operational approvals."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadData()} loading={loading}>
              <RefreshCcw className="h-4 w-4" />
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">Total tickets</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{counts.total || 0}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">Pending</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-warning-text)]">{counts.pending || 0}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">Approved</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-success-text)]">{counts.approved || 0}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">Rejected / Deleted</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-danger-text)]">{(counts.rejected || 0) + (counts.deleted || 0)}</p>
        </Card>
      </div>

      <Card title="Request Timeline" actions={<Activity className="h-4 w-4 text-[var(--color-text-tertiary)]" />}>
        {timelinePoints.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">No timeline data is available yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
            {timelinePoints.map((point: TimelinePoint) => {
              const createdHeight = Math.max(8, Math.round((point.created / timelineMax) * 72));
              const approvedHeight = Math.max(8, Math.round((point.approved / timelineMax) * 72));
              return (
                <div key={point.day} className="rounded-2xl border border-[var(--color-border-secondary)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">{point.day.slice(5)}</p>
                  <div className="mt-2 flex h-20 items-end gap-2">
                    <div className="w-3 rounded-t bg-[var(--color-warning-text)]" style={{ height: `${createdHeight}px` }} />
                    <div className="w-3 rounded-t bg-[var(--color-success-text)]" style={{ height: `${approvedHeight}px` }} />
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">C:{point.created} · A:{point.approved}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={typeFilter === 'all' ? 'primary' : 'ghost'} onClick={() => setTypeFilter('all')}>
              <Filter className="h-4 w-4" />
              <span className="ml-2">All</span>
            </Button>
            {['admin_user', 'event', 'testimonial', 'leadership_delete', 'workforce_delete', 'workforce_registration', 'form_submission_delete'].map((type) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={typeFilter === type ? 'primary' : 'ghost'}
                onClick={() => setTypeFilter(type)}
              >
                {humanType(type)}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-10" placeholder="Search ticket, requester, label..." />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="deleted">Deleted</option>
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortMode)}
              className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="recent">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="requester">Requester</option>
              <option value="type">Type</option>
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--color-border-secondary)] p-8 text-[var(--color-text-tertiary)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border-secondary)] p-8 text-center">
              <ShieldAlert className="mx-auto h-8 w-8 text-[var(--color-text-tertiary)]" />
              <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">No matching requests</p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Adjust filters or refresh the queue.</p>
            </div>
          ) : (
            filteredRequests.map((request) => {
              const pending = request.status === 'pending';
              const requester = requestRequesterName(request) || requestRequesterEmail(request) || 'Unknown requester';
              return (
                <div key={request.id} className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariants[request.status] || 'secondary'}>{request.status}</Badge>
                        <Badge variant="outline">{humanType(request.type)}</Badge>
                        <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">{requestTicketCode(request)}</span>
                      </div>
                      <h3 className="mt-3 text-base font-bold text-[var(--color-text-primary)]">{requestEntityLabel(request) || humanType(request.type)}</h3>
                      <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{typeDescriptions[request.type] || 'Review this request and decide the next action.'}</p>
                      {request.reason ? (
                        <div className="mt-2 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2">
                          <p className="text-xs font-black uppercase tracking-wide text-[var(--color-text-tertiary)]">Stated reason</p>
                          <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{request.reason}</p>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-tertiary)]">
                        <span>Requester: <strong className="text-[var(--color-text-secondary)]">{requester}</strong></span>
                        <span>Created: <strong className="text-[var(--color-text-secondary)]">{formatDate(requestCreatedAt(request))}</strong></span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Button type="button" variant="outline" size="sm" onClick={() => router.push(openPathForRequest(request))}>
                        <Eye className="h-4 w-4" />
                        <span className="ml-2">Open</span>
                      </Button>
                      {pending && (
                        <>
                          <Button type="button" variant="primary" size="sm" onClick={() => openAction('approve', request)}>
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="ml-2">Approve</span>
                          </Button>
                          <Button type="button" variant="danger" size="sm" onClick={() => openAction('reject', request)}>
                            <ThumbsDown className="h-4 w-4" />
                            <span className="ml-2">Reject</span>
                          </Button>
                        </>
                      )}
                      {!pending && (
                        <Badge variant="secondary" className="gap-1">
                          <Clock3 className="h-3 w-3" />
                          Finalized
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <ActionModal
        action={modalAction || 'approve'}
        request={selectedRequest}
        loading={actionLoading}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onClose={closeAction}
        onConfirm={() => void confirmAction()}
      />
    </div>
  );
}

export default withAuth(RequestsPage, { requiredRole: 'super_admin' });
