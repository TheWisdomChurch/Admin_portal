'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  CalendarHeart,
  Clipboard,
  Crown,
  ExternalLink,
  IdCard,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { apiClient } from '@/lib/api';
import type { LeadershipMember, LeadershipRole, LeadershipStatus } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const LEADERSHIP_FORM_URL = 'https://wisdomchurchhq.org/forms/leadership-biodata';

const roleLabels: Record<LeadershipRole, string> = {
  senior_pastor: 'Senior Pastor',
  associate_pastor: 'Associate Pastor',
  deacon: 'Deacon',
  deaconess: 'Deaconess',
  reverend: 'Reverend',
};

const statusLabels: Record<LeadershipStatus, string> = {
  pending: 'Pending',
  awaiting_super_admin_approval: 'Awaiting approval',
  approved: 'Approved',
  declined: 'Declined',
};

type StatusFilter = 'all' | LeadershipStatus;
type RoleFilter = 'all' | LeadershipRole;

function leaderName(item: LeadershipMember): string {
  return `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unnamed leader';
}

function statusVariant(status: LeadershipStatus): 'success' | 'warning' | 'danger' | 'primary' {
  if (status === 'approved') return 'success';
  if (status === 'declined') return 'danger';
  if (status === 'awaiting_super_admin_approval') return 'warning';
  return 'primary';
}

function countBy<T extends string>(items: LeadershipMember[], selector: (item: LeadershipMember) => T): Record<T, number> {
  return items.reduce<Record<T, number>>((acc, item) => {
    const key = selector(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function formatDayMonth(day?: number, month?: number): string {
  if (!day || !month) return 'Not provided';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

function Panel({ title, subtitle, icon: Icon, actions, children }: { title: string; subtitle?: string; icon?: ComponentType<{ className?: string }>; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:shadow-md">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon ? <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-sm"><Icon className="h-5 w-5" /></div> : null}
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
            {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: ComponentType<{ className?: string }> }) {
  return (
    <article className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <strong className="mt-3 block text-3xl font-black tracking-tight text-slate-950">{value}</strong>
        </div>
        <div className="rounded-2xl bg-slate-950 p-3 text-white"><Icon className="h-5 w-5" /></div>
      </div>
    </article>
  );
}

function LeaderAvatar({ leader }: { leader: LeadershipMember }) {
  const initials = `${leader.firstName?.[0] || 'L'}${leader.lastName?.[0] || ''}`.toUpperCase();
  return <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">{initials}</div>;
}

export default function LeadershipPage() {
  const [leaders, setLeaders] = useState<LeadershipMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedLeader, setSelectedLeader] = useState<LeadershipMember | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.listLeadership({ page: 1, limit: 500 });
      setLeaders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load leadership:', error);
      toast.error('Unable to load leadership profiles');
      setLeaders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const byRole = useMemo(() => countBy(leaders, (item) => item.role), [leaders]);
  const byStatus = useMemo(() => countBy(leaders, (item) => item.status), [leaders]);
  const approved = byStatus.approved || 0;
  const pendingReview = (byStatus.pending || 0) + (byStatus.awaiting_super_admin_approval || 0);
  const anniversariesCaptured = leaders.filter((item) => item.anniversaryMonth && item.anniversaryDay).length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leaders.filter((item) => {
      if (roleFilter !== 'all' && item.role !== roleFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!needle) return true;
      return `${leaderName(item)} ${item.email || ''} ${item.phone || ''} ${roleLabels[item.role] || item.role} ${statusLabels[item.status] || item.status}`.toLowerCase().includes(needle);
    });
  }, [leaders, query, roleFilter, statusFilter]);

  const roleKeys = Object.keys(byRole) as LeadershipRole[];
  const roleChart = {
    labels: roleKeys.map((role) => roleLabels[role] || role),
    datasets: [{ label: 'Leaders', data: roleKeys.map((role) => byRole[role]), backgroundColor: 'rgba(15, 23, 42, 0.82)', borderRadius: 12 }],
  };

  const statusChart = {
    labels: ['Approved', 'Pending', 'Awaiting', 'Declined'],
    datasets: [{
      data: [byStatus.approved || 0, byStatus.pending || 0, byStatus.awaiting_super_admin_approval || 0, byStatus.declined || 0],
      backgroundColor: ['rgba(16, 185, 129, 0.82)', 'rgba(37, 99, 235, 0.82)', 'rgba(245, 158, 11, 0.82)', 'rgba(220, 38, 38, 0.82)'],
      borderColor: '#ffffff',
      borderWidth: 4,
    }],
  };

  const barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } },
  };

  const copyFormLink = async () => {
    await navigator.clipboard.writeText(LEADERSHIP_FORM_URL);
    toast.success('Leadership form link copied');
  };

  const requestDelete = async (item: LeadershipMember) => {
    if (!window.confirm(`Send ${leaderName(item)} for super-admin delete approval?`)) return;
    setDeletingId(item.id);
    try {
      await apiClient.deleteLeadership(item.id);
      toast.success('Delete request sent to super admin');
      await loadData();
    } catch (error) {
      console.error('Failed to request leadership delete:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to request delete approval');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Leadership"
        subtitle="Manage leadership profiles, biodata intake, anniversary tracking, approvals, and governance workflows."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />} onClick={() => void loadData()} loading={loading}>Refresh</Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => window.location.assign('/dashboard/forms/new?preset=leadership')}>Create Form</Button>
          </div>
        }
      />

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/65"><Crown className="h-4 w-4" /> Leadership governance</div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl xl:text-5xl">Review, approve, and manage leadership biodata with clear operational visibility.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">Monitor submitted profiles, copy the biodata form, inspect profile completeness, and request governed deletion.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">Biodata intake form</p>
            <p className="mt-2 break-all text-sm font-semibold text-white/70">{LEADERSHIP_FORM_URL}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" icon={<Clipboard className="h-4 w-4" />} onClick={() => void copyFormLink()}>Copy Link</Button>
              <Button size="sm" variant="outline" icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.open(LEADERSHIP_FORM_URL, '_blank', 'noopener,noreferrer')}>Open Form</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Leadership profiles" value={leaders.length} icon={Users} />
        <StatCard label="Approved" value={approved} icon={UserCheck} />
        <StatCard label="Pending review" value={pendingReview} icon={IdCard} />
        <StatCard label="Anniversaries captured" value={anniversariesCaptured} icon={CalendarHeart} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Leadership by role" subtitle="Role distribution from current records." icon={Crown}>
          <div className="h-[320px]">{loading ? <LoadingMessage label="Loading role chart..." /> : roleKeys.length === 0 ? <EmptyState label="No leadership data yet." /> : <Bar data={roleChart} options={barOptions} />}</div>
        </Panel>
        <Panel title="Approval status" subtitle="Current approval queue split." icon={ShieldCheck}>
          <div className="mx-auto h-[280px] max-w-[300px]">{loading ? <LoadingMessage label="Loading status chart..." /> : <Doughnut data={statusChart} options={doughnutOptions} />}</div>
        </Panel>
      </section>

      <Panel
        title="Leadership profiles"
        subtitle="Search, filter, inspect profiles, and request delete approval."
        icon={IdCard}
        actions={
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_170px_170px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leadership..." className="pl-10" /></div>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 outline-none transition focus:border-slate-400">
              <option value="all">All roles</option>
              {(Object.keys(roleLabels) as LeadershipRole[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 outline-none transition focus:border-slate-400">
              <option value="all">All statuses</option>
              {(Object.keys(statusLabels) as LeadershipStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </div>
        }
      >
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
          <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_160px] gap-4 bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wide text-white xl:grid">
            <div>Profile</div><div>Role</div><div>Status</div><div>Anniversary</div><div className="text-right">Action</div>
          </div>
          <div className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <div className="px-4 py-8"><LoadingMessage label="Loading leadership records..." /></div>
            ) : filtered.length === 0 ? (
              <div className="p-4"><EmptyState label="No leadership records found." /></div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="grid gap-3 px-4 py-4 transition hover:bg-slate-50 xl:grid-cols-[1.4fr_1fr_1fr_1fr_160px] xl:items-center">
                  <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => setSelectedLeader(item)}>
                    <LeaderAvatar leader={item} />
                    <div className="min-w-0"><div className="truncate text-sm font-black text-slate-950">{leaderName(item)}</div><div className="truncate text-xs font-semibold text-slate-500">{item.email || item.phone || 'No contact recorded'}</div></div>
                  </button>
                  <div className="text-sm font-semibold text-slate-600">{roleLabels[item.role] || item.role}</div>
                  <div><Badge variant={statusVariant(item.status)}>{statusLabels[item.status] || item.status}</Badge></div>
                  <div className="text-sm font-semibold text-slate-600">{formatDayMonth(item.anniversaryDay, item.anniversaryMonth)}</div>
                  <div className="xl:text-right"><Button size="sm" variant="outline" icon={<Trash2 className="h-4 w-4" />} loading={deletingId === item.id} onClick={() => void requestDelete(item)}>Request Delete</Button></div>
                </div>
              ))
            )}
          </div>
        </div>
      </Panel>

      {selectedLeader ? <LeaderProfile leader={selectedLeader} onClose={() => setSelectedLeader(null)} /> : null}
    </main>
  );
}

function LoadingMessage({ label }: { label: string }) {
  return <div className="flex h-full min-h-[180px] items-center justify-center gap-3 text-sm font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />{label}</div>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><p className="text-sm font-bold text-slate-500">{label}</p></div>;
}

function LeaderProfile({ leader, onClose }: { leader: LeadershipMember; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 backdrop-blur-sm">
      <button type="button" aria-label="Close leadership profile" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Leadership profile</p><h2 className="text-lg font-black text-slate-950">{leaderName(leader)}</h2></div>
          <button type="button" className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950" onClick={onClose} aria-label="Close leadership profile"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">
          <div className="rounded-[2rem] bg-slate-950 p-5 text-white">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-950">{leader.firstName?.[0] || 'L'}{leader.lastName?.[0] || ''}</div>
              <div className="min-w-0"><h3 className="text-2xl font-black tracking-tight">{leaderName(leader)}</h3><p className="mt-1 text-sm font-semibold text-white/60">{roleLabels[leader.role] || leader.role}</p><div className="mt-3"><Badge variant={statusVariant(leader.status)}>{statusLabels[leader.status] || leader.status}</Badge></div></div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ProfileInfo icon={Mail} label="Email" value={leader.email || 'Not provided'} />
            <ProfileInfo icon={Phone} label="Phone" value={leader.phone || 'Not provided'} />
            <ProfileInfo icon={CalendarHeart} label="Birthday" value={formatDayMonth(leader.birthdayDay, leader.birthdayMonth)} />
            <ProfileInfo icon={CalendarHeart} label="Anniversary" value={formatDayMonth(leader.anniversaryDay, leader.anniversaryMonth)} />
          </div>
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Bio</p><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">{leader.bio || 'No bio recorded.'}</p></div>
        </div>
      </aside>
    </div>
  );
}

function ProfileInfo({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400"><Icon className="h-4 w-4" />{label}</div><div className="mt-2 break-words text-sm font-bold text-slate-800">{value}</div></div>;
}
