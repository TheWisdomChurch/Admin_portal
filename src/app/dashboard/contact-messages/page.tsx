'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, MessageCircle, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';
import { StatCard } from '@/ui/StatCard';
import { EmptyState } from '@/ui/EmptyState';
import { Pagination } from '@/ui/Pagination';
import { apiClient } from '@/lib/api';
import { withAuth } from '@/providers/withAuth';
import type { ContactMessageAdmin } from '@/lib/types';

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessageAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<ContactMessageAdmin | null>(null);

  const loadData = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const res = await apiClient.listContactMessages({ page: targetPage, limit: 20 });
      setMessages(Array.isArray(res.data) ? res.data : []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (error) {
      console.error('Failed to load contact messages:', error);
      toast.error('Unable to load contact messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(page); }, [loadData, page]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Contact Messages"
        subtitle="Messages submitted through the public contact form."
        actions={
          <Button variant="outline" icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />} onClick={() => void loadData(page)} loading={loading}>
            Refresh
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <StatCard label="Total messages" value={total} icon={<Mail className="h-5 w-5" />} />
        <StatCard label="On this page" value={messages.length} icon={<MessageCircle className="h-5 w-5" />} tone="info" />
      </section>

      <SectionCard title="Messages" icon={<MessageCircle className="h-5 w-5" />}>
        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center text-sm font-bold text-[var(--color-text-tertiary)]">Loading messages...</div>
        ) : messages.length === 0 ? (
          <EmptyState icon={<MessageCircle className="h-6 w-6" />} title="No contact messages yet" description="Messages submitted from the website will appear here." />
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m)}
                className="block w-full rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 text-left transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black text-[var(--color-text-primary)]">{m.firstName} {m.lastName}</h3>
                  {m.topic ? <Badge variant="outline">{m.topic}</Badge> : null}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{m.message}</p>
                <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">{m.email} · {formatDateTime(m.createdAt)}</p>
              </button>
            ))}
          </div>
        )}
        {totalPages > 1 ? (
          <div className="mt-4 flex justify-center">
            <Pagination page={page} pageCount={totalPages} onPageChange={setPage} />
          </div>
        ) : null}
      </SectionCard>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[var(--color-text-primary)]/50 backdrop-blur-sm">
          <button type="button" aria-label="Close message" className="absolute inset-0 cursor-default" onClick={() => setSelected(null)} />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Contact message</p>
                <h2 className="mt-1 text-lg font-black text-[var(--color-text-primary)]">{selected.firstName} {selected.lastName}</h2>
              </div>
              <button type="button" className="rounded-2xl border border-[var(--color-border-secondary)] p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]" onClick={() => setSelected(null)} aria-label="Close message">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--color-text-tertiary)]">Email</p>
                  <p className="mt-2 break-words text-sm font-bold text-[var(--color-text-primary)]">{selected.email}</p>
                </div>
                <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--color-text-tertiary)]">Phone</p>
                  <p className="mt-2 text-sm font-bold text-[var(--color-text-primary)]">{selected.phone || 'Not provided'}</p>
                </div>
              </div>
              {selected.topic ? (
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--color-text-tertiary)]">Topic</p>
                  <Badge variant="outline" className="mt-2">{selected.topic}</Badge>
                </div>
              ) : null}
              <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Message</p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[var(--color-text-secondary)]">{selected.message}</p>
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)]">Submitted {formatDateTime(selected.createdAt)} · via {selected.sourceChannel}</p>
              <div className="flex justify-end">
                <a href={`mailto:${selected.email}`}>
                  <Button size="sm" icon={<Mail className="h-4 w-4" />}>Reply by email</Button>
                </a>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

export default withAuth(ContactMessagesPage, { requiredRole: 'admin' });
