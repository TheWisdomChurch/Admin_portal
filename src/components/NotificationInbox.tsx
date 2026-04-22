'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, ChevronRight, Eye, RefreshCcw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { AdminNotification } from '@/lib/types';
import { useAuthContext } from '@/providers/AuthProviders';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { PageHeader } from '@/layouts';

type Props = {
  title: string;
  subtitle: string;
};

export function NotificationInbox({ title, subtitle }: Props) {
  const router = useRouter();
  const auth = useAuthContext();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
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
    load();
  }, [load]);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [items]
  );
  const visibleItems = useMemo(
    () => (filter === 'unread' ? sorted.filter((item) => !item.isRead) : sorted),
    [filter, sorted]
  );

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

      if (item.ticketCode && isSuperAdmin) {
        return { href: '/dashboard/super/requests', label: 'Open approval requests' };
      }
      if (entityType === 'testimonial' || type.includes('testimonial')) {
        return { href: '/dashboard/testimonials', label: 'Open testimonials' };
      }
      if (entityType === 'event' || type.includes('event')) {
        return { href: '/dashboard/events', label: 'Open events' };
      }
      if (
        entityType === 'leadership' ||
        entityType === 'member' ||
        entityType === 'workforce' ||
        type.includes('leadership') ||
        type.includes('member') ||
        type.includes('workforce')
      ) {
        return { href: '/dashboard/administration', label: 'Open administration' };
      }
      if (entityType === 'form' || type.includes('form')) {
        return { href: '/dashboard/forms', label: 'Open forms' };
      }
      if (type.includes('request') && isSuperAdmin) {
        return { href: '/dashboard/super/requests', label: 'Open approval requests' };
      }
      return { href: '/dashboard', label: 'Open dashboard' };
    },
    [auth.user?.role]
  );

  const openItem = useCallback(
    async (item: AdminNotification) => {
      setActiveItem(item);
      if (!item.isRead) {
        await markRead(item.id);
      }
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

  const itemTypeLabel = useCallback((value: string) => {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={load} disabled={loading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="secondary" onClick={markAllRead} disabled={unread === 0}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          </div>
        }
      />

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <Bell className="h-4 w-4" />
            Inbox
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-[var(--radius-button)] border px-2.5 py-1 text-xs font-semibold transition-colors ${
                filter === 'all'
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]'
                  : 'border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]'
              }`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`rounded-[var(--radius-button)] border px-2.5 py-1 text-xs font-semibold transition-colors ${
                filter === 'unread'
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]'
                  : 'border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]'
              }`}
              onClick={() => setFilter('unread')}
            >
              Unread
            </button>
            <Badge variant={unread > 0 ? 'warning' : 'secondary'} size="sm">
              {unread} unread
            </Badge>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {visibleItems.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No notifications yet.</p>
          ) : (
            visibleItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-[var(--radius-card)] border p-3 ${
                  item.isRead
                    ? 'border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]'
                    : 'border-amber-300/70 bg-amber-50/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                      <Badge variant="secondary" size="sm">{itemTypeLabel(item.type || 'notification')}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.message}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.isRead && (
                      <Button size="sm" variant="ghost" onClick={() => markRead(item.id)}>
                        Mark read
                      </Button>
                    )}
                    <Button size="sm" variant="outline" icon={<Eye className="h-4 w-4" />} onClick={() => openItem(item)}>
                      Open
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Notification detail</p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{activeItem.title}</h3>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                onClick={() => setActiveItem(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                <p className="text-xs text-[var(--color-text-tertiary)]">Message</p>
                <p className="mt-1 text-[var(--color-text-secondary)]">{activeItem.message}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Type</p>
                  <p className="mt-1 font-medium text-[var(--color-text-primary)]">{itemTypeLabel(activeItem.type || 'notification')}</p>
                </div>
                <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Created</p>
                  <p className="mt-1 font-medium text-[var(--color-text-primary)]">{new Date(activeItem.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {(activeItem.ticketCode || activeItem.entityType || activeItem.entityId) && (
                <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3 text-xs text-[var(--color-text-tertiary)]">
                  {activeItem.ticketCode && <p>Ticket: {activeItem.ticketCode}</p>}
                  {activeItem.entityType && <p>Entity: {itemTypeLabel(activeItem.entityType)}</p>}
                  {activeItem.entityId && <p className="truncate">Reference: {activeItem.entityId}</p>}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setActiveItem(null)}>
                Close
              </Button>
              <Button onClick={() => openResolvedRoute(activeItem)} icon={<ChevronRight className="h-4 w-4" />}>
                {resolveNotificationRoute(activeItem).label}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
