'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, RefreshCcw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AdminNotification } from '@/lib/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { PageHeader } from '@/layouts';

type Props = {
  title: string;
  subtitle: string;
};

export function NotificationInbox({ title, subtitle }: Props) {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

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
          <Badge variant={unread > 0 ? 'warning' : 'secondary'} size="sm">
            {unread} unread
          </Badge>
        </div>

        <div className="mt-4 space-y-2">
          {sorted.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No notifications yet.</p>
          ) : (
            sorted.map((item) => (
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
                    <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.message}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!item.isRead && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(item.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

