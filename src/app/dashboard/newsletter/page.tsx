'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Mail, RefreshCw, Search, Send, Users, UserCheck, UserX, Clock3 } from 'lucide-react';
import toast from 'react-hot-toast';

import { withAuth } from '@/providers/withAuth';
import { apiClient } from '@/lib/api';
import { getServerErrorMessage } from '@/lib/serverValidation';
import type { EventData, Subscriber, SubscriberSummary } from '@/lib/types';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/Input';
import { Panel } from '@/ui/Panel';
import { StatCard } from '@/ui/StatCard';

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(Math.max(0, total) / limit)), [total, limit]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const [summaryData, listData, eventsData] = await Promise.all([
        apiClient.getSubscriberSummary(),
        apiClient.listSubscribers({ page, limit, status, search: search.trim() || undefined }),
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

  useEffect(() => { void load(); }, [load]);

  async function handleSend() {
    if (!subject.trim() || !title.trim() || !message.trim()) { toast.error('Subject, title, and message are required.'); return; }
    if (type === 'event' && !eventId) { toast.error('Select an event before sending an event newsletter.'); return; }

    setSending(true);
    try {
      const result = await apiClient.sendNotification({
        type,
        audience: 'newsletter_subscribers' as const,
        subject: subject.trim(),
        title: title.trim(),
        message: message.trim(),
        eventId: type === 'event' ? eventId : undefined,
      });
      toast.success(`Sent ${result.sent} email(s). ${result.failed} failed.`);
      setSubject('');
      setTitle('');
      setMessage('');
      await load();
    } catch (error) {
      toast.error(getServerErrorMessage(error, 'Failed to send newsletter update.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <ShellCard className="overflow-hidden">
        <div className="flex flex-col gap-4 p-6 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              <Mail className="h-4 w-4" /> Newsletter
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-3xl">Subscriber Control Center</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--color-text-secondary)]">Manage public newsletter subscribers and send clean audience-safe updates.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading} loading={loading} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
        </div>
      </ShellCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total subscribers" value={summary?.total ?? 0} icon={Users} hint="All newsletter records" />
        <Metric label="Active" value={summary?.active ?? 0} icon={UserCheck} hint="Can receive newsletter sends" />
        <Metric label="Unsubscribed" value={summary?.unsubscribed ?? 0} icon={UserX} hint="Opted out from email" />
        <Metric label="Last send" value={formatDate(summary?.lastNotifiedAt).split(',')[0]} icon={Clock3} hint="Most recent newsletter delivery" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
        <ShellCard className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[var(--color-text-primary)]">Compose newsletter</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Simple, readable, and focused for public updates.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Type</label>
              <select className="h-11 w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 text-sm text-[var(--color-text-primary)]" value={type} onChange={(e) => setType(e.target.value as 'update' | 'event')}>
                <option value="update">General update</option>
                <option value="event">Event update</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Event</label>
              <select className="h-11 w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 text-sm text-[var(--color-text-primary)] disabled:opacity-50" value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={type !== 'event'}>
                <option value="">Select event</option>
                {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Email title" />
            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--color-text-secondary)]">Message</label>
              <textarea className="min-h-[150px] w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-border-focus)]/20" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Public newsletter message" />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-[var(--color-border-secondary)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--color-text-tertiary)]">Internal operational messages are blocked from this channel.</p>
            <Button onClick={handleSend} loading={sending} disabled={sending} icon={<Send className="h-4 w-4" />}>Send Newsletter</Button>
          </div>
        </ShellCard>

        <ShellCard className="p-5">
          <h2 className="text-lg font-black text-[var(--color-text-primary)]">Subscribers</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
            <select className="h-11 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 text-sm text-[var(--color-text-primary)]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as 'all' | 'active' | 'unsubscribed'); setPage(1); }}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input className="pl-9" placeholder="Search by email or name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? <p className="text-sm text-[var(--color-text-tertiary)]">Loading subscribers...</p> : null}
            {!loading && subscribers.length === 0 ? <p className="text-sm text-[var(--color-text-tertiary)]">No subscribers found for this filter.</p> : null}
            {!loading && subscribers.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-black text-[var(--color-text-primary)]">{item.email}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{item.name || 'No name'} · {item.source || 'No source'}</p>
                  </div>
                  <Badge variant={item.status === 'active' ? 'success' : 'warning'} size="sm">{item.status}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-tertiary)] sm:grid-cols-2">
                  <span>Last notified: {formatDate(item.lastNotifiedAt)}</span>
                  <span>Unsubscribed: {formatDate(item.unsubscribedAt)}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border-secondary)] pt-4">
            <p className="text-xs text-[var(--color-text-tertiary)]">{total} total • page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
            </div>
          </div>
        </ShellCard>
      </div>
    </div>
  );
}

export default withAuth(NewsletterPage, { requiredRole: 'admin' });
