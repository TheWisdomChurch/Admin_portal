import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Cake,
  CalendarDays,
  Gem,
  Mail,
  Phone,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Select } from '@/ui/Select';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { SectionCard } from '@/ui/SectionCard';
import { Avatar } from './Avatar';
import {
  buildMonthGroups,
  segmentMeta,
  type SegmentKey,
  type TrackerItem,
  type TrackerMode,
} from '../lib';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function timingLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

function trackerPersonId(item: TrackerItem): string {
  return item.id
    .replace(/^today-/, '')
    .replace(`${item.type}-${item.segment}-`, '');
}

export function TrackerList({
  title,
  items,
  icon,
  onOpen,
  onViewAll,
}: {
  title: string;
  items: TrackerItem[];
  icon: ReactNode;
  onOpen: (item: TrackerItem) => void;
  onViewAll?: () => void;
}) {
  const today = items.filter((item) => item.daysUntil === 0).length;

  return (
    <SectionCard
      title={title}
      subtitle={`${today ? `${today} today · ` : ''}${items.length} within the next 45 days`}
      icon={icon}
      actions={onViewAll ? <Button size="sm" variant="ghost" onClick={onViewAll}>View calendar</Button> : undefined}
    >
      <div className="space-y-2">
        {items.slice(0, 6).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-transparent bg-[var(--color-background-secondary)] p-3 text-left transition hover:border-[var(--color-border-primary)] hover:bg-[var(--color-background-hover)]"
          >
            <div className="relative">
              <Avatar person={item} size="sm" />
              {item.daysUntil === 0 ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[var(--color-background-primary)] bg-[var(--color-success-solid)]" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{item.name}</div>
              <div className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]">{segmentMeta[item.segment].label} · {item.role || 'Profile'}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-bold text-[var(--color-text-primary)]">{item.dateLabel}</div>
              <div className={`mt-0.5 text-[11px] font-semibold ${item.daysUntil === 0 ? 'text-[var(--color-success-text)]' : 'text-[var(--color-text-tertiary)]'}`}>{timingLabel(item.daysUntil)}</div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-text-primary)]" />
          </button>
        ))}
        {items.length === 0 ? <EmptyState title="No celebrations in the next 45 days" description="Add dates to people profiles to include them automatically." /> : null}
      </div>
    </SectionCard>
  );
}

export function TrackerModal({
  mode,
  items,
  onClose,
  onSendToday,
  onOpen,
}: {
  mode: TrackerMode | null;
  items: TrackerItem[];
  onClose: () => void;
  onSendToday: (mode: TrackerMode, segment?: SegmentKey) => Promise<void>;
  onOpen: (item: TrackerItem) => void;
}) {
  const [sending, setSending] = useState<string>('');
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<SegmentKey | 'all'>('all');
  const [month, setMonth] = useState<number | 'all'>('all');

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return items.filter((item) => {
      if (segment !== 'all' && item.segment !== segment) return false;
      if (month !== 'all' && item.month !== month) return false;
      return !needle || `${item.name} ${item.email || ''} ${item.phone || ''} ${item.role || ''} ${item.segment}`.toLowerCase().includes(needle);
    });
  }, [items, month, query, segment]);

  const monthGroups = useMemo(() => buildMonthGroups(filtered).filter((group) => group.items.length > 0), [filtered]);
  const today = items.filter((item) => item.daysUntil === 0);
  const nextSevenDays = items.filter((item) => item.daysUntil > 0 && item.daysUntil <= 7).length;
  const withEmail = today.filter((item) => Boolean(item.email)).length;

  if (!mode) return null;

  const isBirthday = mode === 'birthdays';
  const Icon = isBirthday ? Cake : Gem;
  const title = isBirthday ? 'Birthday care centre' : 'Wedding anniversary care centre';

  const runSend = async (target?: SegmentKey) => {
    const key = `${mode}-${target || 'all'}`;
    setSending(key);
    try {
      await onSendToday(mode, target);
    } finally {
      setSending('');
    }
  };

  return (
    <Modal open onClose={onClose} size="xl" labelledBy="celebration-centre-title">
      <div className="flex max-h-[88vh] flex-col overflow-hidden bg-[var(--color-background-primary)]">
        <header className="relative overflow-hidden border-b border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-5 py-5 md:px-7 md:py-6">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[var(--color-accent-primary)] opacity-[0.07]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] shadow-sm">
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">People care</p>
                  <Badge variant={today.length ? 'success' : 'secondary'}>{today.length} today</Badge>
                </div>
                <h2 id="celebration-centre-title" className="mt-1 text-xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-2xl">{title}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">Plan timely, personal recognition from profile data and keep every celebration visible to the care team.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-2 text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-primary)]" aria-label="Close celebration centre">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto">
          <div className="space-y-6 p-5 md:p-7">
            <section className="grid gap-3 sm:grid-cols-3">
              <Metric icon={<Sparkles className="h-4 w-4" />} label="Celebrating today" value={today.length} detail={today.length ? 'Ready for recognition' : 'No action due today'} />
              <Metric icon={<CalendarDays className="h-4 w-4" />} label="Next seven days" value={nextSevenDays} detail="Plan communications early" />
              <Metric icon={<Users className="h-4 w-4" />} label="Annual records" value={items.length} detail={`${withEmail}/${today.length || 0} today have email`} />
            </section>

            <section className="overflow-hidden rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
              <div className="flex flex-col gap-4 border-b border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="font-bold text-[var(--color-text-primary)]">Today&apos;s communication run</h3>
                  <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Only profiles celebrating today are included. The backend records and sends the approved greeting template.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isBirthday ? (
                    (['leadership', 'members', 'workforce'] as SegmentKey[]).map((target) => (
                      <Button key={target} size="sm" variant={target === 'members' ? 'primary' : 'outline'} icon={<Send className="h-4 w-4" />} loading={sending === `${mode}-${target}`} disabled={!today.some((item) => item.segment === target) || Boolean(sending)} onClick={() => void runSend(target)}>
                        {segmentMeta[target].label}
                      </Button>
                    ))
                  ) : (
                    <Button size="sm" icon={<Send className="h-4 w-4" />} loading={sending === `${mode}-leadership`} disabled={!today.some((item) => item.segment === 'leadership') || Boolean(sending)} onClick={() => void runSend('leadership')}>
                      Send today&apos;s greetings
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {today.map((item) => <CelebrationCard key={item.id} item={item} onOpen={() => onOpen(item)} compact />)}
                {today.length === 0 ? <div className="sm:col-span-2 lg:col-span-3"><EmptyState title={`No ${isBirthday ? 'birthdays' : 'anniversaries'} today`} description="Use the calendar below to prepare for upcoming celebrations." /></div> : null}
              </div>
            </section>

            <section>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Annual celebration calendar</h3>
                  <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Search, filter, and open the corresponding people profile.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_150px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                    <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people..." aria-label="Search celebrations" />
                  </div>
                  <Select value={segment} onChange={(event) => setSegment(event.target.value as SegmentKey | 'all')} aria-label="Filter by people group">
                    <option value="all">All groups</option>
                    <option value="leadership">Leadership</option>
                    <option value="members">Members</option>
                    <option value="workforce">Workforce</option>
                  </Select>
                  <Select value={month} onChange={(event) => setMonth(event.target.value === 'all' ? 'all' : Number(event.target.value))} aria-label="Filter by month">
                    <option value="all">All months</option>
                    {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                  </Select>
                </div>
              </div>

              <div className="mt-5 space-y-7">
                {monthGroups.map((group) => (
                  <div key={group.month}>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-[var(--color-background-tertiary)] px-2 text-xs font-semibold text-[var(--color-accent-primary)]">{String(group.month).padStart(2, '0')}</div>
                      <h4 className="font-bold text-[var(--color-text-primary)]">{MONTH_NAMES[group.month - 1]}</h4>
                      <span className="h-px flex-1 bg-[var(--color-border-secondary)]" />
                      <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">{group.items.length} {group.items.length === 1 ? 'person' : 'people'}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {group.items.map((item) => <CelebrationCard key={item.id} item={item} onOpen={() => onOpen(item)} />)}
                    </div>
                  </div>
                ))}
                {monthGroups.length === 0 ? <EmptyState title="No matching celebration records" description="Try a different search, group, or month." /> : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
      <div className="flex items-center gap-2 text-[var(--color-text-tertiary)]">{icon}<span className="text-xs font-bold uppercase tracking-[0.12em]">{label}</span></div>
      <div className="mt-3 text-2xl font-bold text-[var(--color-text-primary)]">{value}</div>
      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{detail}</p>
    </div>
  );
}

function CelebrationCard({ item, onOpen, compact = false }: { item: TrackerItem; onOpen: () => void; compact?: boolean }) {
  return (
    <article className="group rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--color-border-primary)] hover:shadow-sm">
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 text-left">
        <Avatar person={item} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{item.name}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]">{item.role || segmentMeta[item.segment].label}</p>
            </div>
            <div className="rounded-xl bg-[var(--color-background-tertiary)] px-2.5 py-1.5 text-center">
              <div className="text-base font-bold leading-none text-[var(--color-text-primary)]">{String(item.day).padStart(2, '0')}</div>
              <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">{MONTH_NAMES[item.month - 1]?.slice(0, 3)}</div>
            </div>
          </div>
          {!compact ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={segmentMeta[item.segment].badgeVariant}>{segmentMeta[item.segment].label}</Badge>
              {item.daysUntil <= 45 ? <Badge variant={item.daysUntil === 0 ? 'success' : 'secondary'}>{timingLabel(item.daysUntil)}</Badge> : null}
            </div>
          ) : null}
        </div>
      </button>
      {(item.email || item.phone) ? (
        <div className="mt-3 flex gap-2 border-t border-[var(--color-border-secondary)] pt-3">
          {item.email ? <a href={`mailto:${item.email}`} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-background-hover)]"><Mail className="h-3.5 w-3.5" /> Email</a> : null}
          {item.phone ? <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-background-hover)]"><Phone className="h-3.5 w-3.5" /> Call</a> : null}
        </div>
      ) : null}
    </article>
  );
}

export { trackerPersonId };
