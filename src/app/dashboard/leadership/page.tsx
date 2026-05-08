'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
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
  CheckCircle2,
  Clipboard,
  Crown,
  Edit3,
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
import type { LeadershipMember, LeadershipRole, LeadershipStatus, UpdateLeadershipRequest } from '@/lib/types';

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

function toDayMonthInput(day?: number, month?: number): string {
  if (!day || !month) return '';
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
  const [editingLeader, setEditingLeader] = useState<LeadershipMember | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await apiClient.listLeadership({ page: 1, limit: 500 });
      const nextLeaders = Array.isArray(res.data) ? res.data : [];
      setLeaders(nextLeaders);
      setSelectedLeader((prev) => (prev ? nextLeaders.find((item) => item.id === prev.id) || null : prev));
      setEditingLeader((prev) => (prev ? nextLeaders.find((item) => item.id === prev.id) || prev : prev));
    } catch (error) {
      console.error('Failed to load leadership:', error);
      if (showLoader) {
        toast.error('Unable to load leadership profiles');
        setLeaders([]);
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void loadData(false);
    };

    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [loadData]);

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

  const upsertLeader = useCallback((updated: LeadershipMember) => {
    setLeaders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedLeader((prev) => (prev?.id === updated.id ? updated : prev));
    setEditingLeader((prev) => (prev?.id === updated.id ? updated : prev));
  }, []);

  const approveLeader = async (item: LeadershipMember) => {
    setActionId(`approve:${item.id}`);
    try {
      const updated = await apiClient.approveLeadership(item.id);
      upsertLeader(updated);
      toast.success(`${leaderName(updated)} approved`);
    } catch (error) {
      console.error('Failed to approve leadership:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to approve leadership profile');
    } finally {
      setActionId(null);
    }
  };

  const saveLeaderEdits = async (id: string, payload: UpdateLeadershipRequest) => {
    setActionId(`edit:${id}`);
    try {
      const updated = await apiClient.updateLeadership(id, payload);
      upsertLeader(updated);
      setEditingLeader(null);
      toast.success('Leadership profile updated');
    } catch (error) {
      console.error('Failed to update leadership:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to update leadership profile');
    } finally {
      setActionId(null);
    }
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
          <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_260px] gap-4 bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wide text-white xl:grid">
            <div>Profile</div><div>Role</div><div>Status</div><div>Anniversary</div><div className="text-right">Action</div>
          </div>
          <div className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <div className="px-4 py-8"><LoadingMessage label="Loading leadership records..." /></div>
            ) : filtered.length === 0 ? (
              <div className="p-4"><EmptyState label="No leadership records found." /></div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="grid gap-3 px-4 py-4 transition hover:bg-slate-50 xl:grid-cols-[1.4fr_1fr_1fr_1fr_260px] xl:items-center">
                  <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => setSelectedLeader(item)}>
                    <LeaderAvatar leader={item} />
                    <div className="min-w-0"><div className="truncate text-sm font-black text-slate-950">{leaderName(item)}</div><div className="truncate text-xs font-semibold text-slate-500">{item.email || item.phone || 'No contact recorded'}</div></div>
                  </button>
                  <div className="text-sm font-semibold text-slate-600">{roleLabels[item.role] || item.role}</div>
                  <div><Badge variant={statusVariant(item.status)}>{statusLabels[item.status] || item.status}</Badge></div>
                  <div className="text-sm font-semibold text-slate-600">{formatDayMonth(item.anniversaryDay, item.anniversaryMonth)}</div>
                  <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                    {item.status !== 'approved' ? (
                      <Button size="sm" icon={<CheckCircle2 className="h-4 w-4" />} loading={actionId === `approve:${item.id}`} onClick={() => void approveLeader(item)}>Approve</Button>
                    ) : null}
                    <Button size="sm" variant="outline" icon={<Edit3 className="h-4 w-4" />} loading={actionId === `edit:${item.id}`} onClick={() => setEditingLeader(item)}>Edit</Button>
                    <Button size="sm" variant="outline" icon={<Trash2 className="h-4 w-4" />} loading={deletingId === item.id} onClick={() => void requestDelete(item)}>Request Delete</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Panel>

      {selectedLeader ? (
        <LeaderProfile
          leader={selectedLeader}
          onClose={() => setSelectedLeader(null)}
          onEdit={() => setEditingLeader(selectedLeader)}
          onApprove={selectedLeader.status !== 'approved' ? () => void approveLeader(selectedLeader) : undefined}
          approving={actionId === `approve:${selectedLeader.id}`}
        />
      ) : null}
      {editingLeader ? (
        <LeaderEditModal
          key={editingLeader.id}
          leader={editingLeader}
          saving={actionId === `edit:${editingLeader.id}`}
          onClose={() => setEditingLeader(null)}
          onSave={(payload) => void saveLeaderEdits(editingLeader.id, payload)}
        />
      ) : null}
    </main>
  );
}

function LoadingMessage({ label }: { label: string }) {
  return <div className="flex h-full min-h-[180px] items-center justify-center gap-3 text-sm font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />{label}</div>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><p className="text-sm font-bold text-slate-500">{label}</p></div>;
}

function LeaderProfile({
  leader,
  onClose,
  onEdit,
  onApprove,
  approving,
}: {
  leader: LeadershipMember;
  onClose: () => void;
  onEdit: () => void;
  onApprove?: () => void;
  approving?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 backdrop-blur-sm">
      <button type="button" aria-label="Close leadership profile" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Leadership profile</p><h2 className="text-lg font-black text-slate-950">{leaderName(leader)}</h2></div>
          <div className="flex items-center gap-2">
            {onApprove ? <Button size="sm" icon={<CheckCircle2 className="h-4 w-4" />} loading={approving} onClick={onApprove}>Approve</Button> : null}
            <Button size="sm" variant="outline" icon={<Edit3 className="h-4 w-4" />} onClick={onEdit}>Edit</Button>
            <button type="button" className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950" onClick={onClose} aria-label="Close leadership profile"><X className="h-5 w-5" /></button>
          </div>
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

function LeaderEditModal({
  leader,
  saving,
  onClose,
  onSave,
}: {
  leader: LeadershipMember;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: UpdateLeadershipRequest) => void;
}) {
  const [draft, setDraft] = useState({
    firstName: leader.firstName || '',
    lastName: leader.lastName || '',
    email: leader.email || '',
    phone: leader.phone || '',
    role: leader.role,
    status: leader.status,
    bio: leader.bio || '',
    imageUrl: leader.imageUrl || '',
    birthday: toDayMonthInput(leader.birthdayDay, leader.birthdayMonth),
    anniversary: toDayMonthInput(leader.anniversaryDay, leader.anniversaryMonth),
  });

  const updateDraft = (updates: Partial<typeof draft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();

    if (!firstName || !lastName) {
      toast.error('First name and last name are required');
      return;
    }

    onSave({
      firstName,
      lastName,
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      role: draft.role,
      status: draft.status,
      bio: draft.bio.trim(),
      imageUrl: draft.imageUrl.trim(),
      birthday: draft.birthday.trim(),
      anniversary: draft.anniversary.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Close leadership editor" className="absolute inset-0 cursor-default" onClick={onClose} />
      <form onSubmit={submit} className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Edit leadership profile</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{leaderName(leader)}</h2>
          </div>
          <button type="button" className="self-start rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950" onClick={onClose} aria-label="Close leadership editor"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="First name" value={draft.firstName} onChange={(event) => updateDraft({ firstName: event.target.value })} />
          <Input label="Last name" value={draft.lastName} onChange={(event) => updateDraft({ lastName: event.target.value })} />
          <Input label="Email" value={draft.email} onChange={(event) => updateDraft({ email: event.target.value })} />
          <Input label="Phone" value={draft.phone} onChange={(event) => updateDraft({ phone: event.target.value })} />
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            <span>Role</span>
            <select value={draft.role} onChange={(event) => updateDraft({ role: event.target.value as LeadershipRole })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-400">
              {(Object.keys(roleLabels) as LeadershipRole[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            <span>Status</span>
            <select value={draft.status} onChange={(event) => updateDraft({ status: event.target.value as LeadershipStatus })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-400">
              {(Object.keys(statusLabels) as LeadershipStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </label>
          <Input label="Birthday (DD/MM)" value={draft.birthday} onChange={(event) => updateDraft({ birthday: event.target.value })} />
          <Input label="Anniversary (DD/MM)" value={draft.anniversary} onChange={(event) => updateDraft({ anniversary: event.target.value })} />
          <div className="sm:col-span-2">
            <Input label="Image URL" value={draft.imageUrl} onChange={(event) => updateDraft({ imageUrl: event.target.value })} />
          </div>
          <label className="space-y-2 text-sm font-semibold text-slate-700 sm:col-span-2">
            <span>Bio</span>
            <textarea
              value={draft.bio}
              onChange={(event) => updateDraft({ bio: event.target.value })}
              rows={5}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-400"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} icon={<CheckCircle2 className="h-4 w-4" />}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
}

function ProfileInfo({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400"><Icon className="h-4 w-4" />{label}</div><div className="mt-2 break-words text-sm font-bold text-slate-800">{value}</div></div>;
}
