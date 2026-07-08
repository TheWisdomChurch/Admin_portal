'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Mail, Phone, RefreshCw, Search, UserCheck, UserX, Users, X } from 'lucide-react';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Panel } from '@/ui/Panel';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';
import { Pagination } from '@/ui/Pagination';
import { apiClient } from '@/lib/api';
import { getChartPalette } from '@/lib/charts/palette';
import { useTheme } from '@/providers/ThemeProviders';
import { withAuth } from '@/providers/withAuth';
import type { Member, MemberStatsResponse } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const PAGE_SIZE = 20;

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatBirthday(member: Member): string {
  if (!member.birthdayDay || !member.birthdayMonth) return '—';
  return `${String(member.birthdayDay).padStart(2, '0')}/${String(member.birthdayMonth).padStart(2, '0')}`;
}

function memberName(member: Member): string {
  return `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unnamed member';
}

function MemberDrawer({ member, onClose }: { member: Member; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close member drawer" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Member profile</p>
            <h2 className="mt-1 text-lg font-black text-[var(--color-text-primary)]">{memberName(member)}</h2>
          </div>
          <button type="button" className="rounded-2xl p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-secondary)]" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <div className="flex items-center gap-4 rounded-3xl bg-[var(--color-background-secondary)] p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-text-primary)] text-lg font-black text-[var(--color-text-inverse)]">
              {(member.firstName?.[0] || 'M') + (member.lastName?.[0] || '')}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-black text-[var(--color-text-primary)]">{memberName(member)}</p>
              <Badge variant={member.isActive ? 'success' : 'secondary'}>{member.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Email" value={member.email || 'Not provided'} />
            <InfoTile label="Phone" value={member.phone || 'Not provided'} />
            <InfoTile label="Birthday" value={formatBirthday(member)} />
            <InfoTile label="Created" value={formatDate(member.createdAt)} />
          </div>
          <InfoTile label="Member ID" value={member.id} />
        </div>
      </aside>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function MembersPage() {
  const { resolvedTheme } = useTheme();
  const chartPalette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const {
    data: members = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['members', 'list'],
    queryFn: async () => (await apiClient.listMembers({ page: 1, limit: 500 })).data || [],
  });

  const { data: stats = null } = useQuery<MemberStatsResponse | null>({
    queryKey: ['members', 'stats'],
    queryFn: () => apiClient.getMemberStats(),
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (statusFilter === 'active' && !member.isActive) return false;
      if (statusFilter === 'inactive' && member.isActive) return false;
      if (!needle) return true;
      return `${memberName(member)} ${member.email || ''} ${member.phone || ''}`.toLowerCase().includes(needle);
    });
  }, [members, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const growthLabels = (stats?.monthlyGrowth || []).slice(-12).map((item) => item.period.slice(0, 7));
  const growthValues = (stats?.monthlyGrowth || []).slice(-12).map((item) => item.count);

  const columns: TableColumn<Member>[] = [
    {
      key: 'profile',
      header: 'Profile',
      render: (member) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{memberName(member)}</p>
          <p className="truncate text-xs text-[var(--color-text-tertiary)]">{member.id}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (member) => (
        <div className="min-w-0 space-y-1 text-sm text-[var(--color-text-secondary)]">
          <p className="flex min-w-0 items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{member.email || 'No email'}</span></p>
          {member.phone ? <p className="flex min-w-0 items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{member.phone}</span></p> : null}
        </div>
      ),
    },
    { key: 'birthday', header: 'Birthday', render: (member) => formatBirthday(member) },
    {
      key: 'status',
      header: 'Status',
      render: (member) => <Badge variant={member.isActive ? 'success' : 'secondary'}>{member.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    { key: 'createdAt', header: 'Created', render: (member) => formatDate(member.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle="Full church membership registry, separated from new-member intake."
        actions={
          <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void refetch()} loading={isFetching}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total members" value={stats?.total ?? members.length} icon={<Users className="h-5 w-5" />} tone="info" />
        <StatCard label="Active" value={stats?.active ?? members.filter((member) => member.isActive).length} icon={<UserCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Inactive" value={stats?.inactive ?? members.filter((member) => !member.isActive).length} icon={<UserX className="h-5 w-5" />} tone="danger" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Monthly membership growth</h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Monthly growth data.</p>
          <div className="mt-5 h-72">
            {growthLabels.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No monthly growth data yet.</p>
            ) : (
              <Bar
                data={{ labels: growthLabels, datasets: [{ label: 'Members added', data: growthValues, backgroundColor: chartPalette.series.blue.line, borderRadius: 10, maxBarThickness: 36 }] }}
                options={{ maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }}
              />
            )}
          </div>
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Registry status</h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Active versus inactive member records.</p>
          <div className="mx-auto mt-5 h-72 max-w-[280px]">
            <Doughnut
              data={{ labels: ['Active', 'Inactive'], datasets: [{ data: [stats?.active || 0, stats?.inactive || 0], backgroundColor: [chartPalette.series.emerald.line, chartPalette.series.rose.line], borderWidth: 0 }] }}
              options={{ maintainAspectRatio: false, responsive: true, cutout: '66%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } } }}
            />
          </div>
        </Panel>
      </div>

      <Panel padded={false}>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">All member profiles</h2>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Registry table with profile drawer.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,280px)_150px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input className="pl-9" placeholder="Search members" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
            </div>
            <select
              className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 text-sm text-[var(--color-text-primary)]"
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(1); }}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <Table
          columns={columns}
          data={paged}
          rowKey={(member) => member.id}
          loading={isLoading}
          emptyTitle="No members found."
          onRowClick={setSelectedMember}
        />

        {filtered.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[var(--color-border-secondary)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Showing {paged.length} of {filtered.length} members
            </p>
            <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
          </div>
        ) : null}
      </Panel>

      {selectedMember ? <MemberDrawer member={selectedMember} onClose={() => setSelectedMember(null)} /> : null}
    </div>
  );
}

export default withAuth(MembersPage, { requiredRole: 'admin' });
