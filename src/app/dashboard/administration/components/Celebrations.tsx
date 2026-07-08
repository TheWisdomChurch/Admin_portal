import { useState, type ReactNode } from 'react';
import { Loader2, Search, Send, X } from 'lucide-react';

import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { SectionCard } from '@/ui/SectionCard';
import { Avatar } from './Avatar';
import { segmentMeta, type SegmentKey, type TrackerItem, type TrackerMode } from '../lib';

export function TrackerList({ title, items, icon, onOpen }: { title: string; items: TrackerItem[]; icon: ReactNode; onOpen: (item: TrackerItem) => void }) {
  return (
    <SectionCard title={title} subtitle="Live tracker from saved profile data." icon={icon}>
      <div className="space-y-3">
        {items.slice(0, 8).map((item) => (
          <button key={item.id} type="button" onClick={() => onOpen(item)} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border-secondary)] p-3 text-left transition hover:border-[var(--color-border-primary)] hover:bg-[var(--color-background-hover)]">
            <Avatar person={item} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{item.name}</div>
              <div className="truncate text-xs text-[var(--color-text-tertiary)]">{segmentMeta[item.segment].label} • {item.role || 'Profile'}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-[var(--color-text-primary)]">{item.dateLabel}</div>
              <div className="text-[11px] font-medium text-[var(--color-text-tertiary)]">{item.daysUntil === 0 ? 'Today' : `${item.daysUntil} days`}</div>
            </div>
          </button>
        ))}
        {items.length === 0 ? <EmptyState title="No upcoming records found." /> : null}
      </div>
    </SectionCard>
  );
}

function ActionButton({ children, loading, onClick }: { children: ReactNode; loading?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-text-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function TrackerModal({
  mode,
  items,
  onClose,
  onSendToday,
}: {
  mode: TrackerMode | null;
  items: TrackerItem[];
  onClose: () => void;
  onSendToday: (mode: TrackerMode, segment?: SegmentKey) => Promise<void>;
}) {
  const [sending, setSending] = useState<string>('');
  const [query, setQuery] = useState('');

  if (!mode) return null;

  const filtered = items.filter((item) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return `${item.name} ${item.email || ''} ${item.role || ''} ${item.segment}`.toLowerCase().includes(q);
  });

  const title = mode === 'birthdays' ? 'Birthday scheduler' : 'Wedding anniversary tracker';

  const runSend = async (segment?: SegmentKey) => {
    const key = `${mode}-${segment || 'all'}`;
    setSending(key);
    try {
      await onSendToday(mode, segment);
    } finally {
      setSending('');
    }
  };

  return (
    <Modal open={Boolean(mode)} onClose={onClose} size="xl" labelledBy="tracker-modal-title">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]/95 px-5 py-4 backdrop-blur">
        <h2 id="tracker-modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-2xl border border-[var(--color-border-primary)] p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="max-h-[80vh] overflow-y-auto p-5">
        <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[var(--color-text-primary)] p-3 text-[var(--color-text-inverse)]">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-[var(--color-text-primary)]">Celebration workflow</div>
                <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Generated from saved profile data.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {mode === 'birthdays' ? (
                <>
                  <ActionButton loading={sending === 'birthdays-leadership'} onClick={() => runSend('leadership')}>Leadership</ActionButton>
                  <ActionButton loading={sending === 'birthdays-members'} onClick={() => runSend('members')}>Members</ActionButton>
                  <ActionButton loading={sending === 'birthdays-workforce'} onClick={() => runSend('workforce')}>Workforce</ActionButton>
                </>
              ) : (
                <ActionButton loading={sending === 'anniversaries-leadership'} onClick={() => runSend('leadership')}>Send anniversaries</ActionButton>
              )}
            </div>
          </div>
        </div>

        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email, segment, role..." />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center gap-3">
                <Avatar person={item} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{item.name}</div>
                  <div className="truncate text-xs text-[var(--color-text-tertiary)]">{segmentMeta[item.segment].label} · {item.role || 'Profile'}</div>
                </div>
                <Badge variant={item.daysUntil === 0 ? 'success' : 'default'}>{item.daysUntil === 0 ? 'Today' : `${item.daysUntil}d`}</Badge>
              </div>
              <div className="mt-4 rounded-2xl bg-[var(--color-background-secondary)] p-3 text-sm font-semibold text-[var(--color-text-secondary)]">{item.dateLabel}</div>
            </div>
          ))}
          {filtered.length === 0 ? <div className="md:col-span-2 xl:col-span-3"><EmptyState title="No records match your search." /></div> : null}
        </div>
      </div>
    </Modal>
  );
}
