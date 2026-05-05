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
import { Bar, Pie } from 'react-chartjs-2';
import { CalendarHeart, Clipboard, ExternalLink, IdCard, Plus, RefreshCw, Search, Trash2, UserCheck, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
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

export default function LeadershipPage() {
  const [leaders, setLeaders] = useState<LeadershipMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
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

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const byRole = useMemo(() => countBy(leaders, (item) => item.role), [leaders]);
  const byStatus = useMemo(() => countBy(leaders, (item) => item.status), [leaders]);
  const approved = byStatus.approved || 0;
  const anniversariesCaptured = leaders.filter((item) => item.anniversaryMonth && item.anniversaryDay).length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return leaders;
    return leaders.filter((item) => `${leaderName(item)} ${item.email || ''} ${item.phone || ''} ${roleLabels[item.role]}`.toLowerCase().includes(needle));
  }, [leaders, query]);

  const roleKeys = Object.keys(byRole) as LeadershipRole[];
  const roleChart = {
    labels: roleKeys.map((role) => roleLabels[role] || role),
    datasets: [{ label: 'Leaders', data: roleKeys.map((role) => byRole[role]), backgroundColor: '#2563eb', borderRadius: 6 }],
  };
  const statusChart = {
    labels: ['Approved', 'Pending', 'Awaiting', 'Declined'],
    datasets: [
      {
        data: [
          byStatus.approved || 0,
          byStatus.pending || 0,
          byStatus.awaiting_super_admin_approval || 0,
          byStatus.declined || 0,
        ],
        backgroundColor: ['#059669', '#2563eb', '#d97706', '#dc2626'],
        borderWidth: 0,
      },
    ],
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
    <div className="space-y-5">
      <PageHeader
        title="Leadership"
        subtitle="Standalone leadership profiles, biodata intake, anniversary tracking, and approval-governed deletion."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadData()} loading={loading}>
              Refresh
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => window.location.assign('/dashboard/forms/new?preset=leadership')}>
              Create Form
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Leadership profiles" value={leaders.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Approved" value={approved} icon={<UserCheck className="h-5 w-5" />} />
        <StatCard label="Pending review" value={(byStatus.pending || 0) + (byStatus.awaiting_super_admin_approval || 0)} icon={<IdCard className="h-5 w-5" />} />
        <StatCard label="Anniversaries captured" value={anniversariesCaptured} icon={<CalendarHeart className="h-5 w-5" />} />
      </div>

      <Card
        title="Leadership biodata form"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" icon={<Clipboard className="h-4 w-4" />} onClick={() => void copyFormLink()}>Copy Link</Button>
            <Button size="sm" variant="outline" icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.open(LEADERSHIP_FORM_URL, '_blank', 'noopener,noreferrer')}>Open Form</Button>
          </div>
        }
      >
        <p className="break-all text-sm text-[var(--color-text-tertiary)]">{LEADERSHIP_FORM_URL}</p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="Leadership by role">
          <div className="h-[300px]">
            {roleKeys.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">{loading ? 'Loading chart...' : 'No leadership data yet.'}</p>
            ) : (
              <Bar data={roleChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
            )}
          </div>
        </Card>
        <Card title="Approval status">
          <div className="mx-auto h-[220px] max-w-[260px]">
            <Pie data={statusChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } } }} />
          </div>
        </Card>
      </div>

      <Card
        title="Leadership profiles"
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leadership..." className="pl-10" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-border-secondary)] text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-tertiary)]">
                <th className="px-3 py-2 font-semibold">Profile</th>
                <th className="px-3 py-2 font-semibold">Role</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Anniversary</th>
                <th className="px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-secondary)]">
              {loading ? (
                <tr><td className="px-3 py-6 text-[var(--color-text-tertiary)]" colSpan={5}>Loading leadership records...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-3 py-6 text-[var(--color-text-tertiary)]" colSpan={5}>No leadership records found.</td></tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--color-background-secondary)]">
                    <td className="px-3 py-3">
                      <button className="flex items-center gap-2 text-left font-medium text-[var(--color-text-primary)]" onClick={() => setSelectedLeader(item)}>
                        <IdCard className="h-4 w-4 text-[var(--color-accent-primary)]" />
                        {leaderName(item)}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{roleLabels[item.role] || item.role}</td>
                    <td className="px-3 py-3"><Badge variant={statusVariant(item.status)}>{statusLabels[item.status] || item.status}</Badge></td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{formatDayMonth(item.anniversaryDay, item.anniversaryMonth)}</td>
                    <td className="px-3 py-3">
                      <Button size="sm" variant="outline" icon={<Trash2 className="h-4 w-4" />} loading={deletingId === item.id} onClick={() => void requestDelete(item)}>
                        Request Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedLeader && <LeaderProfile leader={selectedLeader} onClose={() => setSelectedLeader(null)} />}
    </div>
  );
}

function formatDayMonth(day?: number, month?: number): string {
  if (!day || !month) return 'Not provided';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-text-tertiary)]">{label}</p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]">{icon}</div>
      </div>
    </Card>
  );
}

function LeaderProfile({ leader, onClose }: { leader: LeadershipMember; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Leadership Profile</p>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{leaderName(leader)}</h2>
          </div>
          <button className="rounded-[var(--radius-button)] p-2 hover:bg-[var(--color-background-hover)]" onClick={onClose} aria-label="Close leadership profile">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-accent-primary)] text-xl font-bold text-[var(--color-text-onprimary)]">
              {leader.firstName?.[0] || 'L'}{leader.lastName?.[0] || ''}
            </div>
            <div>
              <Badge variant={statusVariant(leader.status)}>{statusLabels[leader.status]}</Badge>
              <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">{roleLabels[leader.role] || leader.role}</p>
            </div>
          </div>
          <div className="grid gap-3 text-sm">
            <ProfileRow label="Email" value={leader.email || 'Not provided'} />
            <ProfileRow label="Phone" value={leader.phone || 'Not provided'} />
            <ProfileRow label="Birthday" value={formatDayMonth(leader.birthdayDay, leader.birthdayMonth)} />
            <ProfileRow label="Anniversary" value={formatDayMonth(leader.anniversaryDay, leader.anniversaryMonth)} />
            <ProfileRow label="Bio" value={leader.bio || 'No bio'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-[var(--color-border-secondary)] pb-2 last:border-0">
      <span className="text-[var(--color-text-tertiary)]">{label}</span>
      <span className="break-words font-medium text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}
