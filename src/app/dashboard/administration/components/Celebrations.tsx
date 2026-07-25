import { useMemo, useState, type ReactNode } from 'react';
import { Cake, Gem, Loader2, Search, Send, X } from 'lucide-react';

import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { SectionCard } from '@/ui/SectionCard';
import { Avatar } from './Avatar';
import { buildMonthGroups, segmentMeta, type SegmentKey, type TrackerItem, type TrackerMode } from '../lib';

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

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((item) => `${item.name} ${item.email || ''} ${item.role || ''} ${item.segment}`.toLowerCase().includes(q));
  }, [items, query]);

  const monthGroups = useMemo(() => buildMonthGroups(filtered).filter((group) => group.items.length > 0), [filtered]);

  if (!mode) return null;

  const title = mode === 'birthdays' ? 'Birthday scheduler' : 'Wedding anniversary tracker';
  const Icon = mode === 'birthdays' ? Cake : Gem;

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
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]/95 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[var(--color-text-primary)] p-2.5 text-[var(--color-text-inverse)]">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 id="tracker-modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
            <p className="text-xs font-medium text-[var(--color-text-tertiary)]">
              {filtered.length} record{filtered.length === 1 ? '' : 's'} across {monthGroups.length} month{monthGroups.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
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

        <div className="mt-5 space-y-6">
          {monthGroups.map((group) => (
            <div key={group.month}>
              <div className="mb-2 flex items-center gap-3">
                <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">{monthFullName(group.month)}</h3>
                <span className="h-px flex-1 bg-[var(--color-border-secondary)]" />
                <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">{group.items.length}</span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[var(--color-border-secondary)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-background-secondary)] text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                    <tr>
                      <th className="w-16 px-4 py-2.5">Day</th>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="hidden px-4 py-2.5 sm:table-cell">Segment</th>
                      <th className="hidden px-4 py-2.5 md:table-cell">Role / department</th>
                      <th className="px-4 py-2.5 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
                    {group.items.map((item) => (
                      <tr key={item.id} className="transition hover:bg-[var(--color-background-hover)]">
                        <td className="px-4 py-2.5 font-mono text-sm font-bold tabular-nums text-[var(--color-text-primary)]">{String(item.day).padStart(2, '0')}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar person={item} size="sm" />
                            <span className="truncate font-semibold text-[var(--color-text-primary)]">{item.name}</span>
                          </div>
                        </td>
                        <td className="hidden px-4 py-2.5 sm:table-cell">
                          <Badge variant="default">{segmentMeta[item.segment].label}</Badge>
                        </td>
                        <td className="hidden truncate px-4 py-2.5 text-[var(--color-text-secondary)] md:table-cell">{item.role || '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          {item.daysUntil === 0 ? <Badge variant="success">Today</Badge> : <span className="text-xs font-medium text-[var(--color-text-tertiary)]">in {item.daysUntil}d</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {monthGroups.length === 0 ? <EmptyState title="No records match your search." /> : null}
        </div>
      </div>
    </Modal>
  );
}

const MONTH_FULL_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthFullName(month: number): string {
  return MONTH_FULL_NAMES[month - 1] || 'Unknown';
}
