import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Eye, PanelRightOpen, Search, SlidersHorizontal } from 'lucide-react';

import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { Avatar } from './Avatar';
import {
  dateLabel,
  segmentMeta,
  titleCase,
  PAGE_SIZE_OPTIONS,
  type DashboardData,
  type PersonRecord,
  type SegmentKey,
  type SortDirection,
  type SortKey,
} from '../lib';

function latestProfiles(items: PersonRecord[], limit = 8): PersonRecord[] {
  return items
    .slice()
    .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime())
    .slice(0, limit);
}

export function SegmentAccordion({ data, onOpen }: { data: DashboardData; onOpen: (person: PersonRecord) => void }) {
  const [open, setOpen] = useState<SegmentKey>('leadership');

  const groups: Array<{ key: SegmentKey; items: PersonRecord[] }> = [
    { key: 'leadership', items: data.leadership },
    { key: 'members', items: data.members },
    { key: 'workforce', items: data.workforce },
  ];

  return (
    <SectionCard title="People intelligence accordions" subtitle="Segmented profile summaries with recent records and status distribution." icon={<PanelRightOpen className="h-5 w-5" />}>
      <div className="space-y-3">
        {groups.map((group) => {
          const meta = segmentMeta[group.key];
          const Icon = meta.icon;
          const activeCount = group.items.filter((item) => ['active', 'approved', 'published', 'true'].includes(item.status || '')).length;
          const isOpen = open === group.key;

          return (
            <div key={group.key} className="overflow-hidden rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
              <button type="button" onClick={() => setOpen(group.key)} className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-[var(--color-background-hover)]">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-[var(--color-background-tertiary)] p-3 text-[var(--color-text-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--color-text-primary)]">{meta.label}</div>
                    <div className="text-sm text-[var(--color-text-tertiary)]">{group.items.length} records · {activeCount} active/approved</div>
                  </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-[var(--color-text-tertiary)] transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="grid gap-4 border-t border-[var(--color-border-secondary)] p-4 lg:grid-cols-3">
                    <MiniStat label="Records" value={group.items.length} />
                    <MiniStat label="Birthdays" value={group.items.filter((item) => item.birthdayMonth && item.birthdayDay).length} />
                    <MiniStat label="Active" value={activeCount} />
                  </div>
                  <div className="grid gap-3 px-4 pb-4 md:grid-cols-3">
                    {latestProfiles(group.items, 6).map((person) => (
                      <button key={`${person.segment}-${person.id}`} type="button" onClick={() => onOpen(person)} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-secondary)] p-3 text-left transition hover:border-[var(--color-border-primary)] hover:bg-[var(--color-background-hover)]">
                        <Avatar person={person} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{person.name}</div>
                          <div className="truncate text-xs text-[var(--color-text-tertiary)]">{person.role || person.department || titleCase(person.status || 'profile')}</div>
                        </div>
                        <Eye className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                      </button>
                    ))}
                    {group.items.length === 0 ? <div className="md:col-span-3"><EmptyState title={`No ${meta.label.toLowerCase()} records found.`} /></div> : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function comparePeople(a: PersonRecord, b: PersonRecord, sortKey: SortKey, direction: SortDirection): number {
  const modifier = direction === 'asc' ? 1 : -1;
  const value = (person: PersonRecord): string | number => {
    switch (sortKey) {
      case 'name': return person.name.toLowerCase();
      case 'segment': return person.segment;
      case 'status': return person.status || 'unknown';
      case 'birthday': return (person.birthdayMonth || 99) * 100 + (person.birthdayDay || 99);
      case 'anniversary': return (person.anniversaryMonth || 99) * 100 + (person.anniversaryDay || 99);
      case 'createdAt':
      default: return new Date(person.createdAt || person.updatedAt || 0).getTime();
    }
  };

  const left = value(a);
  const right = value(b);
  if (left < right) return -1 * modifier;
  if (left > right) return 1 * modifier;
  return 0;
}

function SortHeader({ label, active, onClick, align }: { label: string; active: boolean; onClick: () => void; align?: 'right' }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end text-right' : ''} ${active ? 'text-[var(--color-text-inverse)]' : 'text-[var(--color-text-inverse)]/70'}`}>
      {label}
      <ChevronsUpDown className="h-3.5 w-3.5" />
    </button>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)] outline-none transition focus:border-[var(--color-border-focus)]"
    >
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export function PeopleTable({ people, onOpen }: { people: PersonRecord[]; onOpen: (person: PersonRecord) => void }) {
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<'all' | SegmentKey>('all');
  const [status, setStatus] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const statuses = useMemo(() => ['all', ...Array.from(new Set(people.map((item) => item.status || 'unknown'))).sort()], [people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = people.filter((person) => {
      if (segment !== 'all' && person.segment !== segment) return false;
      if (status !== 'all' && (person.status || 'unknown') !== status) return false;
      if (!q) return true;
      return `${person.name} ${person.email || ''} ${person.phone || ''} ${person.role || ''} ${person.department || ''} ${person.status || ''} ${person.segment}`.toLowerCase().includes(q);
    });

    rows.sort((a, b) => comparePeople(a, b, sortKey, sortDirection));
    return rows;
  }, [people, query, segment, sortDirection, sortKey, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => setPage(1), [query, segment, status, pageSize]);

  const setSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'name' || key === 'segment' ? 'asc' : 'desc');
  };

  return (
    <SectionCard
      title="Professional profile table"
      subtitle="Responsive accordion table with filtering, sorting, pagination, and profile drawer actions."
      icon={<SlidersHorizontal className="h-5 w-5" />}
      actions={<Badge variant="info">{filtered.length} visible</Badge>}
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_130px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, phone, role..." />
        </div>
        <Select value={segment} onChange={(value) => setSegment(value as 'all' | SegmentKey)} options={[{ label: 'All segments', value: 'all' }, { label: 'Leadership', value: 'leadership' }, { label: 'Members', value: 'members' }, { label: 'Workforce', value: 'workforce' }]} />
        <Select value={status} onChange={setStatus} options={statuses.map((item) => ({ label: item === 'all' ? 'All statuses' : titleCase(item), value: item }))} />
        <Select value={String(pageSize)} onChange={(value) => setPageSize(Number(value))} options={PAGE_SIZE_OPTIONS.map((item) => ({ label: `${item} / page`, value: String(item) }))} />
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--color-border-secondary)]">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_120px_80px] gap-4 bg-[var(--color-text-primary)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-inverse)] xl:grid">
          <SortHeader label="Profile" active={sortKey === 'name'} onClick={() => setSort('name')} />
          <SortHeader label="Segment" active={sortKey === 'segment'} onClick={() => setSort('segment')} />
          <SortHeader label="Birthday" active={sortKey === 'birthday'} onClick={() => setSort('birthday')} />
          <SortHeader label="Anniversary" active={sortKey === 'anniversary'} onClick={() => setSort('anniversary')} />
          <SortHeader label="Status" active={sortKey === 'status'} onClick={() => setSort('status')} align="right" />
          <div className="text-right">Open</div>
        </div>

        <div className="divide-y divide-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
          {paged.map((person) => (
            <button key={`${person.segment}-${person.id}`} type="button" onClick={() => onOpen(person)} className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[var(--color-background-hover)] xl:grid-cols-[1.4fr_1fr_1fr_1fr_120px_80px] xl:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar person={person} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{person.name}</div>
                  <div className="truncate text-xs text-[var(--color-text-tertiary)]">{person.email || person.phone || 'No contact recorded'}</div>
                </div>
              </div>
              <div><Badge variant={segmentMeta[person.segment].badgeVariant}>{segmentMeta[person.segment].label}</Badge></div>
              <div className="text-sm font-semibold text-[var(--color-text-tertiary)]">{person.birthdayMonth && person.birthdayDay ? dateLabel(person.birthdayMonth, person.birthdayDay) : '—'}</div>
              <div className="text-sm font-semibold text-[var(--color-text-tertiary)]">{person.anniversaryMonth && person.anniversaryDay ? dateLabel(person.anniversaryMonth, person.anniversaryDay) : '—'}</div>
              <div className="xl:text-right"><Badge>{titleCase(person.status || 'Unknown')}</Badge></div>
              <div className="hidden justify-end xl:flex"><Eye className="h-4 w-4 text-[var(--color-text-tertiary)]" /></div>
            </button>
          ))}
          {paged.length === 0 ? <div className="p-4"><EmptyState title="No profiles match your filters." /></div> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[var(--color-text-tertiary)]">Showing {paged.length} of {filtered.length} records</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1} className="rounded-2xl border border-[var(--color-border-primary)] p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-background-hover)] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-5 w-5" /></button>
          <span className="rounded-2xl bg-[var(--color-text-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)]">{currentPage} / {totalPages}</span>
          <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages} className="rounded-2xl border border-[var(--color-border-primary)] p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-background-hover)] disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    </SectionCard>
  );
}
