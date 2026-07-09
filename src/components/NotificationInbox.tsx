'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Eye,
  Inbox,
  RefreshCcw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';

import { apiClient } from '@/lib/api';
import type { AdminNotification } from '@/lib/types';
import { useAuthContext } from '@/providers/AuthProviders';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/Input';
import { Panel } from '@/ui/Panel';
import { StatCard } from '@/ui/StatCard';
import { EmptyState } from '@/ui/EmptyState';
import { PageHeader } from '@/layouts';

type Props = {
  title: string;
  subtitle: string;
};

type NotificationFilter = 'all' | 'unread' | 'approval' | 'content' | 'system';

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function itemTypeLabel(value?: string): string {
  const raw = value?.trim() || 'notification';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function classifyNotification(item: AdminNotification): Exclude<NotificationFilter, 'all' | 'unread'> {
  const type = `${item.type || ''} ${item.entityType || ''}`.toLowerCase();
  if (item.ticketCode || type.includes('request') || type.includes('approval') || type.includes('delete')) return 'approval';
  if (type.includes('testimonial') || type.includes('event') || type.includes('form') || type.includes('content')) return 'content';
  return 'system';
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

export function NotificationInbox({ title, subtitle }: Props) {
  const router = useRouter();
  const auth = useAuthContext();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [query, setQuery] = useState('');
  const [activeItem, setActiveItem] = useState<AdminNotification | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const inbox = await apiClient.listAdminNotifications(100);
      setItems(Array.isArray(inbox.items) ? inbox.items : []);
      setUnread(Number(inbox.unread || 0));
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setItems([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sorted
      .filter((item) => {
        if (filter === 'unread') return !item.isRead;
        if (filter === 'approval' || filter === 'content' || filter === 'system') return classifyNotification(item) === filter;
        return true;
      })
      .filter((item) => {
        if (!needle) return true;
        return `${item.title || ''} ${item.message || ''} ${item.type || ''} ${item.entityType || ''} ${item.ticketCode || ''}`
          .toLowerCase()
          .includes(needle);
      });
  }, [filter, query, sorted]);

  const approvalCount = useMemo(() => items.filter((item) => classifyNotification(item) === 'approval').length, [items]);
  const contentCount = useMemo(() => items.filter((item) => classifyNotification(item) === 'content').length, [items]);

  const markRead = useCallback(async (id: string) => {
    try {
      await apiClient.markAdminNotificationRead(id);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
      setUnread((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiClient.markAllAdminNotificationsRead();
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnread(0);
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    }
  }, []);

  const resolveNotificationRoute = useCallback(
    (item: AdminNotification): { href: string; label: string } => {
      const isSuperAdmin = auth.user?.role === 'super_admin';
      const type = (item.type || '').toLowerCase();
      const entityType = (item.entityType || '').toLowerCase();

      if ((item.ticketCode || type.includes('request') || type.includes('approval')) && isSuperAdmin) {
        return { href: '/dashboard/super/requests', label: 'Open request queue' };
      }
      if (entityType === 'testimonial' || type.includes('testimonial')) {
        return { href: '/dashboard/testimonials', label: 'Review testimonials' };
      }
      if (entityType === 'event' || type.includes('event')) {
        return { href: '/dashboard/event', label: 'Review events' };
      }
      if (entityType === 'leadership' || type.includes('leadership')) {
        return { href: '/dashboard/leadership', label: 'Open leadership' };
      }
      if (entityType === 'workforce' || type.includes('workforce')) {
        return { href: '/dashboard/workforce', label: 'Open workforce' };
      }
      if (entityType === 'member' || type.includes('member')) {
        return { href: '/dashboard/members', label: 'Open members' };
      }
      if (entityType === 'form' || type.includes('form')) {
        return { href: '/dashboard/forms', label: 'Open forms' };
      }
      return { href: '/dashboard', label: 'Open dashboard' };
    },
    [auth.user?.role]
  );

  const openItem = useCallback(
    async (item: AdminNotification) => {
      setActiveItem(item);
      if (!item.isRead) await markRead(item.id);
    },
    [markRead]
  );

  const openResolvedRoute = useCallback(
    (item: AdminNotification) => {
      const route = resolveNotificationRoute(item);
      setActiveItem(null);
      router.push(route.href);
    },
    [resolveNotificationRoute, router]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading} loading={loading} icon={<RefreshCcw className="h-4 w-4" />}>
              Refresh
            </Button>
            <Button variant="secondary" onClick={() => void markAllRead()} disabled={unread === 0} icon={<CheckCheck className="h-4 w-4" />}>
              Mark all read
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total inbox" value={items.length} trend="All super-admin notifications loaded." />
        <StatCard label="Unread" value={unread} trend="Items requiring attention." tone="warning" />
        <StatCard label="Approval signals" value={approvalCount} trend="Tickets, requests, and actions." tone="info" />
        <StatCard label="Content signals" value={contentCount} trend="Events, forms, testimonials, and records." />
      </div>

      <Panel>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <Bell className="h-5 w-5" />
              <h2 className="text-lg font-black">Decision inbox</h2>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Prioritised alerts for super-admin decisions.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,300px)_auto]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notifications..." className="pl-10" />
            </div>
            <Badge variant={unread > 0 ? 'warning' : 'secondary'} size="sm">
              {unread} unread
            </Badge>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterButton>
          <FilterButton active={filter === 'unread'} onClick={() => setFilter('unread')}>Unread</FilterButton>
          <FilterButton active={filter === 'approval'} onClick={() => setFilter('approval')}>Approvals</FilterButton>
          <FilterButton active={filter === 'content'} onClick={() => setFilter('content')}>Content</FilterButton>
          <FilterButton active={filter === 'system'} onClick={() => setFilter('system')}>System</FilterButton>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? <p className="text-sm text-[var(--color-text-tertiary)]">Loading notifications...</p> : null}
          {!loading && visibleItems.length === 0 ? <EmptyState icon={<Inbox className="h-5 w-5" />} title="No notifications found" description="Try another filter or refresh the inbox." /> : null}
          {!loading &&
            visibleItems.map((item) => {
              const route = resolveNotificationRoute(item);
              const category = classifyNotification(item);
              return (
                <article
                  key={item.id}
                  className={`rounded-3xl border p-4 transition hover:shadow-sm ${
                    item.isRead
                      ? 'border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]'
                      : 'border-[var(--color-warning-border)] bg-[var(--color-warning-surface)]'
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-black text-[var(--color-text-primary)]">{item.title}</p>
                        <Badge variant={category === 'approval' ? 'warning' : category === 'content' ? 'info' : 'secondary'} size="sm">
                          {itemTypeLabel(item.type || category)}
                        </Badge>
                        {!item.isRead ? <span className="h-2 w-2 rounded-full bg-[var(--color-accent-warning)]" aria-label="Unread" /> : null}
                      </div>
                      <p className="break-words text-sm leading-6 text-[var(--color-text-secondary)]">{item.message}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{formatDateTime(item.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                      {!item.isRead ? (
                        <Button size="sm" variant="ghost" onClick={() => void markRead(item.id)}>
                          Mark read
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" icon={<Eye className="h-4 w-4" />} onClick={() => void openItem(item)}>
                        Inspect
                      </Button>
                      <Button size="sm" icon={<ChevronRight className="h-4 w-4" />} onClick={() => openResolvedRoute(item)}>
                        {route.label}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </Panel>

      {activeItem ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <button className="absolute inset-0 cursor-default" aria-label="Close notification detail" onClick={() => setActiveItem(null)} />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
            <div className="bg-[var(--color-text-primary)] px-5 py-6 text-[var(--color-text-inverse)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-inverse)]/55">Notification detail</p>
                  <h3 className="mt-2 break-words text-2xl font-black">{activeItem.title}</h3>
                </div>
                <button className="rounded-2xl p-2 text-[var(--color-text-inverse)]/70 hover:bg-[var(--color-text-inverse)]/10 hover:text-[var(--color-text-inverse)]" onClick={() => setActiveItem(null)} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Message</p>
                <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-[var(--color-text-secondary)]">{activeItem.message}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Type</p>
                  <p className="mt-1 font-bold text-[var(--color-text-primary)]">{itemTypeLabel(activeItem.type)}</p>
                </div>
                <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Created</p>
                  <p className="mt-1 font-bold text-[var(--color-text-primary)]">{formatDateTime(activeItem.createdAt)}</p>
                </div>
              </div>

              {(activeItem.ticketCode || activeItem.entityType || activeItem.entityId) ? (
                <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 text-sm">
                  <div className="mb-3 flex items-center gap-2 font-bold text-[var(--color-text-primary)]">
                    <ShieldAlert className="h-4 w-4" />
                    Routing metadata
                  </div>
                  {activeItem.ticketCode ? <p className="break-words text-[var(--color-text-secondary)]">Ticket: {activeItem.ticketCode}</p> : null}
                  {activeItem.entityType ? <p className="break-words text-[var(--color-text-secondary)]">Entity: {itemTypeLabel(activeItem.entityType)}</p> : null}
                  {activeItem.entityId ? <p className="break-words text-[var(--color-text-secondary)]">Reference: {activeItem.entityId}</p> : null}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border-secondary)] pt-5">
                <Button variant="ghost" onClick={() => setActiveItem(null)}>Close</Button>
                <Button onClick={() => openResolvedRoute(activeItem)} icon={<ChevronRight className="h-4 w-4" />}>
                  {resolveNotificationRoute(activeItem).label}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
