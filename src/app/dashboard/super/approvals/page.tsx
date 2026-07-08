'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  CalendarClock,
  CheckCircle,
  Clock,
  Filter,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCog,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { useDashboardSearch } from '@/hooks/useDashboardSearch';
import { useSuperQueues, type ApprovalItem } from '@/hooks/useSuperQueues';

type TypeFilter = 'all' | 'testimonial' | 'event' | 'admin_user';
type StatusFilter = 'all' | 'pending' | 'approved' | 'deleted';
type SortKey = 'recent' | 'oldest' | 'name';

function ShellCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm ${className}`}>{children}</section>;
}

function FilterButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-2 text-xs font-black transition ${
        active
          ? 'bg-[var(--color-text-primary)] text-[var(--color-background-primary)] shadow-sm'
          : 'border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)]'
      }`}
    >
      {children}
    </button>
  );
}

function typeLabel(type: ApprovalItem['type']) {
  if (type === 'testimonial') return 'Testimonial';
  if (type === 'event') return 'Event';
  return 'Admin Access';
}

function typeIcon(type: ApprovalItem['type']) {
  if (type === 'event') return <CalendarClock className="h-4 w-4" />;
  if (type === 'admin_user') return <UserCog className="h-4 w-4" />;
  return <ShieldCheck className="h-4 w-4" />;
}

function ApprovalsPage() {
  const { items, loading, refresh, approveItem, declineItem } = useSuperQueues();
  const { searchTerm, setSearchTerm } = useDashboardSearch('');

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ApprovalItem | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return items
      .filter((item) => (typeFilter === 'all' ? true : item.type === typeFilter))
      .filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter))
      .filter((item) => {
        if (!normalizedSearch) return true;
        const haystack = `${item.name} ${item.summary} ${item.department ?? ''} ${item.email ?? ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'oldest') return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      });
  }, [items, searchTerm, statusFilter, typeFilter, sortBy]);

  const pending = useMemo(() => items.filter((item) => item.status === 'pending').length, [items]);
  const approved = useMemo(() => items.filter((item) => item.status === 'approved').length, [items]);

  const handleApprove = async (item: ApprovalItem) => {
    setBusyId(item.id);
    try {
      await approveItem(item);
      setActiveItem(null);
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (item: ApprovalItem) => {
    setBusyId(item.id);
    try {
      await declineItem(item);
      setActiveItem(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Approvals"
        subtitle="Fast approval stream for content, event publishing, and admin-access decisions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setSearchTerm('')}>Clear search</Button>
            <Button variant="outline" onClick={refresh} disabled={loading} loading={loading} icon={<RefreshCcw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
        }
      />

      <ShellCard className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-6 md:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Approval authority</p>
                <h1 className="mt-2 text-2xl font-black text-[var(--color-text-primary)] md:text-3xl">Approve only what should go live</h1>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--color-text-secondary)]">
                  This page is designed for quick super-admin review. Use the request center for deeper governance, IDs, deletion approvals, and audit trails.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5 xl:border-l xl:border-t-0">
            <div className="rounded-3xl bg-[var(--color-background-primary)] p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[var(--color-text-tertiary)]">Pending</p>
              <p className="mt-2 text-2xl font-black text-[var(--color-text-primary)]">{pending}</p>
            </div>
            <div className="rounded-3xl bg-[var(--color-background-primary)] p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[var(--color-text-tertiary)]">Approved</p>
              <p className="mt-2 text-2xl font-black text-[var(--color-text-primary)]">{approved}</p>
            </div>
          </div>
        </div>
      </ShellCard>

      <ShellCard className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterButton active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}><span className="inline-flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> All</span></FilterButton>
            <FilterButton active={typeFilter === 'testimonial'} onClick={() => setTypeFilter('testimonial')}>Testimonials</FilterButton>
            <FilterButton active={typeFilter === 'event'} onClick={() => setTypeFilter('event')}>Events</FilterButton>
            <FilterButton active={typeFilter === 'admin_user'} onClick={() => setTypeFilter('admin_user')}>Admin Access</FilterButton>
            <FilterButton active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')}>Pending</FilterButton>
            <FilterButton active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')}>Approved</FilterButton>
            <FilterButton active={statusFilter === 'deleted'} onClick={() => setStatusFilter('deleted')}>Deleted</FilterButton>
            <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}><span className="inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Reset</span></FilterButton>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,320px)_150px]">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search approvals..." className="pl-10" />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="recent">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--color-border-secondary)]">
          <div className="hidden grid-cols-[220px_160px_minmax(280px,1fr)_180px_140px_240px] gap-4 bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] xl:grid">
            <div>Name</div><div>Type</div><div>Summary</div><div>Submitted</div><div>Status</div><div className="text-right">Action</div>
          </div>
          <div className="divide-y divide-[var(--color-border-secondary)]">
            {loading ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">Loading approvals...</div> : null}
            {!loading && filteredItems.length === 0 ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">No approvals found for these filters.</div> : null}
            {!loading && filteredItems.map((item) => (
              <article key={item.id} className="grid gap-4 px-4 py-4 transition hover:bg-[var(--color-background-secondary)] xl:grid-cols-[220px_160px_minmax(280px,1fr)_180px_140px_240px] xl:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[var(--color-text-primary)]">{item.name}</p>
                  {item.email ? <p className="mt-1 truncate text-xs text-[var(--color-text-tertiary)]">{item.email}</p> : null}
                </div>
                <div><Badge variant="outline" size="sm"><span className="inline-flex items-center gap-1">{typeIcon(item.type)} {typeLabel(item.type)}</span></Badge></div>
                <div className="min-w-0"><p className="line-clamp-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.summary}</p></div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]"><Clock className="h-4 w-4" />{new Date(item.submittedAt).toLocaleString()}</div>
                <div><Badge variant={item.status === 'pending' ? 'warning' : item.status === 'approved' ? 'success' : 'danger'} size="sm">{item.status}</Badge></div>
                <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                  <Button size="sm" variant="outline" onClick={() => setActiveItem(item)}>Inspect</Button>
                  <Button size="sm" variant="ghost" onClick={() => void handleDecline(item)} loading={busyId === item.id} disabled={item.type !== 'testimonial' || item.status !== 'pending'}>
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => void handleApprove(item)} loading={busyId === item.id} disabled={item.status !== 'pending'} icon={<CheckCircle className="h-4 w-4" />}>
                    Approve
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </ShellCard>

      {activeItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Approval detail</p>
                <h2 className="mt-2 break-words text-xl font-black text-[var(--color-text-primary)]">{activeItem.name}</h2>
                <p className="mt-2 break-words text-sm leading-6 text-[var(--color-text-secondary)]">{activeItem.summary}</p>
              </div>
              <button type="button" onClick={() => setActiveItem(null)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]" aria-label="Close">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs text-[var(--color-text-tertiary)]">Type</p>
                <p className="mt-1 font-bold text-[var(--color-text-primary)]">{typeLabel(activeItem.type)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs text-[var(--color-text-tertiary)]">Status</p>
                <p className="mt-1 font-bold text-[var(--color-text-primary)]">{activeItem.status}</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs text-[var(--color-text-tertiary)]">Email</p>
                <p className="mt-1 break-words font-bold text-[var(--color-text-primary)]">{activeItem.email || '—'}</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs text-[var(--color-text-tertiary)]">Department</p>
                <p className="mt-1 break-words font-bold text-[var(--color-text-primary)]">{activeItem.department || '—'}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--color-border-secondary)] pt-5">
              <Button variant="ghost" onClick={() => setActiveItem(null)}>Close</Button>
              <Button variant="outline" onClick={() => void handleDecline(activeItem)} loading={busyId === activeItem.id} disabled={activeItem.type !== 'testimonial' || activeItem.status !== 'pending'}>Decline</Button>
              <Button onClick={() => void handleApprove(activeItem)} loading={busyId === activeItem.id} disabled={activeItem.status !== 'pending'}>Approve</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default withAuth(ApprovalsPage, { requiredRole: 'super_admin' });
