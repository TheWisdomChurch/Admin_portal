'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  HandHeart,
  HeartHandshake,
  RefreshCw,
  Search,
  Trash2,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { StatCard } from '@/ui/StatCard';
import { EmptyState } from '@/ui/EmptyState';
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import { apiClient } from '@/lib/api';
import { useAuthContext } from '@/providers/AuthProviders';
import { withAuth } from '@/providers/withAuth';
import type { PrayerRequestAdmin, PrayerRequestStatus } from '@/lib/types';

const statusLabels: Record<PrayerRequestStatus, string> = {
  pending: 'Pending',
  praying: 'Praying',
  answered: 'Answered',
  closed: 'Closed',
};

const statusVariant: Record<PrayerRequestStatus, 'warning' | 'info' | 'success' | 'secondary'> = {
  pending: 'warning',
  praying: 'info',
  answered: 'success',
  closed: 'secondary',
};

type StatusFilter = 'all' | PrayerRequestStatus;

function requesterName(item: PrayerRequestAdmin): string {
  if (item.isAnonymous) return 'Anonymous';
  return `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unnamed requester';
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function PrayerRequestsPage() {
  const { user } = useAuthContext();
  const [requests, setRequests] = useState<PrayerRequestAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<PrayerRequestAdmin | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PrayerRequestAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.listPrayerRequests({ page: 1, limit: 200 });
      const items = Array.isArray(res.data) ? res.data : [];
      setRequests(items);
      setSelected((prev) => (prev ? items.find((item) => item.id === prev.id) || null : prev));
    } catch (error) {
      console.error('Failed to load prayer requests:', error);
      toast.error('Unable to load prayer requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    setNoteDraft(selected?.notes || '');
  }, [selected]);

  const counts = useMemo(() => {
    return requests.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      { total: 0 } as Record<string, number>
    );
  }, [requests]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!needle) return true;
      return `${requesterName(item)} ${item.email || ''} ${item.request} ${item.category || ''}`.toLowerCase().includes(needle);
    });
  }, [requests, query, statusFilter]);

  const changeStatus = async (item: PrayerRequestAdmin, status: PrayerRequestStatus) => {
    setActionId(`status:${item.id}`);
    try {
      await apiClient.updatePrayerRequestStatus(item.id, status);
      toast.success(`Marked as ${statusLabels[status].toLowerCase()}`);
      await loadData();
    } catch (error) {
      console.error('Failed to update prayer request status:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to update status');
    } finally {
      setActionId(null);
    }
  };

  const assignToMe = async (item: PrayerRequestAdmin) => {
    if (!user?.id) return;
    setActionId(`assign:${item.id}`);
    try {
      await apiClient.assignPrayerRequest(item.id, user.id);
      toast.success('Assigned to you');
      await loadData();
    } catch (error) {
      console.error('Failed to assign prayer request:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to assign request');
    } finally {
      setActionId(null);
    }
  };

  const saveNotes = async (item: PrayerRequestAdmin) => {
    setActionId(`notes:${item.id}`);
    try {
      await apiClient.addPrayerRequestNotes(item.id, noteDraft.trim());
      toast.success('Notes saved');
      await loadData();
    } catch (error) {
      console.error('Failed to save prayer request notes:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to save notes');
    } finally {
      setActionId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.deletePrayerRequest(deleteTarget.id);
      toast.success('Prayer request deleted');
      setDeleteTarget(null);
      setSelected(null);
      await loadData();
    } catch (error) {
      console.error('Failed to delete prayer request:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to delete prayer request');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Prayer Requests"
        subtitle="Review, triage, and follow up on prayer requests submitted from the website."
        actions={
          <Button variant="outline" icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />} onClick={() => void loadData()} loading={loading}>
            Refresh
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total requests" value={counts.total || 0} icon={<HandHeart className="h-5 w-5" />} />
        <StatCard label="Pending" value={counts.pending || 0} icon={<Clock3 className="h-5 w-5" />} tone="warning" />
        <StatCard label="Praying" value={counts.praying || 0} icon={<HeartHandshake className="h-5 w-5" />} tone="info" />
        <StatCard label="Answered / Closed" value={(counts.answered || 0) + (counts.closed || 0)} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
      </section>

      <SectionCard
        title="Requests"
        subtitle="Confidential — request text is decrypted for authorized staff only."
        icon={<HandHeart className="h-5 w-5" />}
        actions={
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_170px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requests..." className="pl-10" /></div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-black text-[var(--color-text-secondary)] outline-none transition focus:border-[var(--color-border-focus)]">
              <option value="all">All statuses</option>
              {(Object.keys(statusLabels) as PrayerRequestStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </div>
        }
      >
        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center text-sm font-bold text-[var(--color-text-tertiary)]">Loading prayer requests...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<HandHeart className="h-6 w-6" />} title="No prayer requests found" description="Requests submitted from the website will appear here." />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="block w-full rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 text-left transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-black text-[var(--color-text-primary)]">{requesterName(item)}</h3>
                      <Badge variant={statusVariant[item.status]}>{statusLabels[item.status] || item.status}</Badge>
                      {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.request}</p>
                    <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">Submitted {formatDate(item.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[var(--color-text-primary)]/50 backdrop-blur-sm">
          <button type="button" aria-label="Close prayer request" className="absolute inset-0 cursor-default" onClick={() => setSelected(null)} />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Prayer request</p>
                <h2 className="mt-1 text-lg font-black text-[var(--color-text-primary)]">{requesterName(selected)}</h2>
              </div>
              <button type="button" className="rounded-2xl border border-[var(--color-border-secondary)] p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]" onClick={() => setSelected(null)} aria-label="Close prayer request">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant[selected.status]}>{statusLabels[selected.status] || selected.status}</Badge>
                {selected.category ? <Badge variant="outline">{selected.category}</Badge> : null}
                {selected.isAnonymous ? <Badge variant="secondary">Anonymous</Badge> : null}
              </div>

              {!selected.isAnonymous ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--color-text-tertiary)]"><User className="h-4 w-4" />Requester</p>
                    <p className="mt-2 break-words text-sm font-bold text-[var(--color-text-primary)]">{requesterName(selected)}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-[var(--color-text-tertiary)]">Email</p>
                    <p className="mt-2 break-words text-sm font-bold text-[var(--color-text-primary)]">{selected.email || 'Not provided'}</p>
                  </div>
                </div>
              ) : null}

              <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Request</p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[var(--color-text-secondary)]">{selected.request}</p>
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Update status</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(statusLabels) as PrayerRequestStatus[]).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={selected.status === status ? 'primary' : 'outline'}
                      loading={actionId === `status:${selected.id}`}
                      disabled={selected.status === status}
                      onClick={() => void changeStatus(selected, status)}
                    >
                      {statusLabels[status]}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Assignment</p>
                  <Button size="sm" variant="outline" icon={<UserCheck className="h-4 w-4" />} loading={actionId === `assign:${selected.id}`} onClick={() => void assignToMe(selected)}>
                    Assign to me
                  </Button>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">{selected.assignedTo ? `Assigned (staff id: ${selected.assignedTo})` : 'Not yet assigned'}</p>
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Pastoral notes</p>
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  rows={4}
                  placeholder="Add internal notes for the pastoral team..."
                  className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" loading={actionId === `notes:${selected.id}`} onClick={() => void saveNotes(selected)}>
                    Save notes
                  </Button>
                </div>
              </div>

              <div className="flex justify-end border-t border-[var(--color-border-secondary)] pt-5">
                <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteTarget(selected)}>
                  Delete request
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <VerifyActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete prayer request"
        description={`This permanently deletes ${deleteTarget ? requesterName(deleteTarget) : 'this'}'s prayer request. This cannot be undone.`}
        verifyText="DELETE"
        confirmText="Delete request"
        variant="danger"
        loading={deleting}
      />
    </main>
  );
}

export default withAuth(PrayerRequestsPage, { requiredRole: 'admin' });
