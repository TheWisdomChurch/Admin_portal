'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, RefreshCw, Send } from 'lucide-react';
import toast from 'react-hot-toast';

import { withAuth } from '@/providers/withAuth';
import { apiClient } from '@/lib/api';
import { getServerErrorMessage } from '@/lib/serverValidation';
import type { EventData, Subscriber, SubscriberSummary } from '@/lib/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/input';

function formatDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
}

function NewsletterPage() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<SubscriberSummary | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unsubscribed'>('all');
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<EventData[]>([]);

  const [type, setType] = useState<'update' | 'event'>('update');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [eventId, setEventId] = useState('');

  const totalPages = useMemo(() => {
    if (total <= 0) return 1;
    return Math.max(1, Math.ceil(total / limit));
  }, [total, limit]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const [summaryData, listData, eventsData] = await Promise.all([
        apiClient.getSubscriberSummary(),
        apiClient.listSubscribers({
          page,
          limit,
          status,
          search: search.trim() || undefined,
        }),
        apiClient.getEvents({ page: 1, limit: 100 }),
      ]);

      setSummary(summaryData);
      setSubscribers(Array.isArray(listData.data) ? listData.data : []);
      setTotal(Number(listData.total || 0));
      setEvents(Array.isArray(eventsData.data) ? eventsData.data : []);
    } catch (error) {
      toast.error(getServerErrorMessage(error, 'Failed to load newsletter workspace.'));
    } finally {
      setLoading(false);
    }
  }, [limit, page, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSend() {
    if (!subject.trim() || !title.trim() || !message.trim()) {
      toast.error('Subject, title, and message are required.');
      return;
    }
    if (type === 'event' && !eventId) {
      toast.error('Select an event before sending an event newsletter.');
      return;
    }

    setSending(true);
    try {
      const payload = {
        type,
        audience: 'newsletter_subscribers' as const,
        subject: subject.trim(),
        title: title.trim(),
        message: message.trim(),
        eventId: type === 'event' ? eventId : undefined,
      };
      const result = await apiClient.sendNotification(payload);
      toast.success(`Sent ${result.sent} email(s). ${result.failed} failed.`);
      await load();
    } catch (error) {
      toast.error(getServerErrorMessage(error, 'Failed to send newsletter update.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Newsletter</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">Subscriber Control Center</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Manage active and unsubscribed emails, then send only public-safe newsletter updates.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs text-[var(--color-text-tertiary)]">Total subscribers</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{summary?.total ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--color-text-tertiary)]">Active</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{summary?.active ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--color-text-tertiary)]">Unsubscribed</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{summary?.unsubscribed ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--color-text-tertiary)]">Last newsletter send</p>
          <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">{formatDate(summary?.lastNotifiedAt)}</p>
        </Card>
      </div>

      <Card title="Send Newsletter Update">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-tertiary)]">Type</label>
            <select
              className="w-full rounded-[var(--radius-input)] border border-[var(--color-border-secondary)] bg-white px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as 'update' | 'event')}
            >
              <option value="update">General update</option>
              <option value="event">Event update</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-tertiary)]">Event (for event updates)</label>
            <select
              className="w-full rounded-[var(--radius-input)] border border-[var(--color-border-secondary)] bg-white px-3 py-2 text-sm"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={type !== 'event'}
            >
              <option value="">Select event</option>
              {events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid gap-3">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Email title" />
          <textarea
            className="min-h-[120px] w-full rounded-[var(--radius-input)] border border-[var(--color-border-secondary)] bg-white px-3 py-2 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Public newsletter message"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Internal operational messages are blocked from this channel.
          </p>
          <Button onClick={handleSend} loading={sending} disabled={sending}>
            <Send className="mr-2 h-4 w-4" />
            Send Newsletter
          </Button>
        </div>
      </Card>

      <Card title="Subscribers">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            className="rounded-[var(--radius-input)] border border-[var(--color-border-secondary)] bg-white px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'unsubscribed');
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
          <Input
            placeholder="Search by email or name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading subscribers...</p>
        ) : subscribers.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">No subscribers found for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-secondary)]">
                  <th className="py-2">Email</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Source</th>
                  <th className="py-2">Last notified</th>
                  <th className="py-2">Unsubscribed at</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--color-border-secondary)]">
                    <td className="py-2">{item.email}</td>
                    <td className="py-2">{item.name || '-'}</td>
                    <td className="py-2">
                      <Badge variant={item.status === 'active' ? 'success' : 'warning'} size="sm">
                        {item.status}
                      </Badge>
                    </td>
                    <td className="py-2">{item.source || '-'}</td>
                    <td className="py-2">{formatDate(item.lastNotifiedAt)}</td>
                    <td className="py-2">{formatDate(item.unsubscribedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {total} total • page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-4 w-4 text-[var(--color-text-tertiary)]" />
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Newsletter sends are restricted to subscriber audience only. Use Admin Notifications inbox for internal
            approval, security, and operational alerts.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default withAuth(NewsletterPage, { requiredRole: 'admin' });

