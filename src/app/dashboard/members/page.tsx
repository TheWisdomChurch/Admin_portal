'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { apiClient } from '@/lib/api';
import type { Member, MemberStatsResponse } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

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

function ShellCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm ${className}`}>{children}</section>;
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ElementType; tone: string }) {
  return (
    <ShellCard className="p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">{label}</p>
          <p className="mt-3 text-3xl font-black text-[var(--color-text-primary)]">{value}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></div>
      </div>
    </ShellCard>
  );
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
          <button type="button" className="rounded-2xl p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-secondary)]" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-5">
          <div className="flex items-center gap-4 rounded-3xl bg-[var(--color-background-secondary)] p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-text-primary)] text-lg font-black text-[var(--color-background-primary)]">
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
  return <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</p><p className="mt-2 break-words text-sm font-bold text-[var(--color-text-primary)]">{value}</p></div>;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<MemberStatsResponse | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, statsRes] = await Promise.all([
        apiClient.listMembers({ page: 1, limit: 500 }),
        apiClient.getMemberStats(),
      ]);
      setMembers(membersRes.data || []);
      setStats(statsRes);
    } catch (error) {
      console.error('Failed to load members:', error);
      toast.error('Unable to load members. Please sign in again if your session expired.');
      setMembers([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (statusFilter === 'active' && !member.isActive) return false;
      if (statusFilter === 'inactive' && member.isActive) return false;
      if (!needle) return true;
      return `${memberName(member)} ${member.email || ''} ${member.phone || ''}`.toLowerCase().includes(needle);
    });
  }, [members, query, statusFilter]);

  const growthLabels = (stats?.monthlyGrowth || []).slice(-12).map((item) => item.period.slice(0, 7));
  const growthValues = (stats?.monthlyGrowth || []).slice(-12).map((item) => item.count);

  return (
    <div className="space-y-6">
      <PageHeader title="Members" subtitle="Full church membership registry, separated from new-member intake." actions={<Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()} loading={loading}>Refresh</Button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Total members" value={stats?.total ?? members.length} icon={Users} tone="bg-blue-500/10 text-blue-700" />
        <Metric label="Active" value={stats?.active ?? members.filter((member) => member.isActive).length} icon={UserCheck} tone="bg-emerald-500/10 text-emerald-700" />
        <Metric label="Inactive" value={stats?.inactive ?? members.filter((member) => !member.isActive).length} icon={UserX} tone="bg-rose-500/10 text-rose-700" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ShellCard className="p-5">
          <h2 className="text-lg font-black text-[var(--color-text-primary)]">Monthly membership growth</h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Backend monthly growth data.</p>
          <div className="mt-5 h-72">
            {growthLabels.length === 0 ? <p className="text-sm text-[var(--color-text-tertiary)]">No monthly growth data yet.</p> : <Bar data={{ labels: growthLabels, datasets: [{ label: 'Members added', data: growthValues, backgroundColor: '#2563eb', borderRadius: 10, maxBarThickness: 36 }] }} options={{ maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }} />}
          </div>
        </ShellCard>
        <ShellCard className="p-5">
          <h2 className="text-lg font-black text-[var(--color-text-primary)]">Registry status</h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Active versus inactive member records.</p>
          <div className="mx-auto mt-5 h-72 max-w-[280px]"><Doughnut data={{ labels: ['Active', 'Inactive'], datasets: [{ data: [stats?.active || 0, stats?.inactive || 0], backgroundColor: ['#059669', '#e11d48'], borderWidth: 0 }] }} options={{ maintainAspectRatio: false, responsive: true, cutout: '66%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } } }} /></div>
        </ShellCard>
      </div>

      <ShellCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-lg font-black text-[var(--color-text-primary)]">All member profiles</h2><p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Responsive registry table with profile drawer.</p></div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,280px)_150px]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" /><Input className="pl-9" placeholder="Search members" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <select className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 text-sm text-[var(--color-text-primary)]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--color-border-secondary)]">
          <div className="hidden grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_120px_120px_160px] gap-4 bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] lg:grid"><div>Profile</div><div>Contact</div><div>Birthday</div><div>Status</div><div>Created</div></div>
          <div className="divide-y divide-[var(--color-border-secondary)]">
            {loading ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">Loading members...</div> : null}
            {!loading && filtered.length === 0 ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">No members found.</div> : null}
            {!loading && filtered.map((member) => (
              <button key={member.id} type="button" className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[var(--color-background-secondary)] lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_120px_120px_160px] lg:items-center" onClick={() => setSelectedMember(member)}>
                <div className="min-w-0"><p className="truncate text-sm font-black text-[var(--color-text-primary)]">{memberName(member)}</p><p className="truncate text-xs text-[var(--color-text-tertiary)]">{member.id}</p></div>
                <div className="min-w-0 space-y-1 text-sm text-[var(--color-text-secondary)]"><p className="flex min-w-0 items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{member.email || 'No email'}</span></p>{member.phone ? <p className="flex min-w-0 items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{member.phone}</span></p> : null}</div>
                <div className="text-sm text-[var(--color-text-secondary)]">{formatBirthday(member)}</div>
                <div><Badge variant={member.isActive ? 'success' : 'secondary'}>{member.isActive ? 'Active' : 'Inactive'}</Badge></div>
                <div className="text-sm text-[var(--color-text-secondary)]">{formatDate(member.createdAt)}</div>
              </button>
            ))}
          </div>
        </div>
      </ShellCard>
      {selectedMember ? <MemberDrawer member={selectedMember} onClose={() => setSelectedMember(null)} /> : null}
    </div>
  );
}
