'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Mail, Phone, Plus, RefreshCw, Search, UserPlus, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { apiClient } from '@/lib/api';
import type { CreateMemberRequest, Member } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data as T[];
    if (record.data && typeof record.data === 'object') {
      const nested = record.data as Record<string, unknown>;
      if (Array.isArray(nested.data)) return nested.data as T[];
      if (Array.isArray(nested.items)) return nested.items as T[];
    }
  }
  return [];
}

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const diff = next.getDate() - day + (day === 0 ? -6 : 1);
  next.setDate(diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isAfter(value: string, boundary: Date): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= boundary;
}

function countSince(members: Member[], boundary: Date): number {
  return members.filter((member) => isAfter(member.createdAt, boundary)).length;
}

function buildInitialDraft(): CreateMemberRequest {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    isActive: true,
  };
}

export default function MembersPage() {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<CreateMemberRequest>(() => buildInitialDraft());

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.listMembers({ page: 1, limit: 500 });
      setMembers(toArray<Member>(res));
    } catch (error) {
      console.error('Failed to load members:', error);
      toast.error('Unable to load members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;

    return members.filter((member) =>
      `${member.firstName} ${member.lastName} ${member.email} ${member.phone || ''}`.toLowerCase().includes(needle)
    );
  }, [members, query]);

  const now = useMemo(() => new Date(), []);
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const monthlyCounts = useMemo(() => {
    const counts = new Array(12).fill(0) as number[];
    members.forEach((member) => {
      const date = new Date(member.createdAt);
      if (!Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear()) {
        counts[date.getMonth()] += 1;
      }
    });
    return counts;
  }, [members, now]);

  const submitMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.email.trim()) {
      toast.error('First name, last name, and email are required');
      return;
    }

    setSaving(true);
    try {
      await apiClient.createMember({
        ...draft,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        email: draft.email.trim(),
        phone: draft.phone?.trim() || undefined,
      });
      toast.success('Member created');
      setModalOpen(false);
      setDraft(buildInitialDraft());
      await loadMembers();
    } catch (error) {
      console.error('Failed to create member:', error);
      toast.error('Unable to create member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle="Backend-driven member records and new-member growth analytics."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={loadMembers} loading={loading}>
              Refresh
            </Button>
            <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
              Add Member
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="This week" value={countSince(members, weekStart)} meta="New members" icon={<Plus className="h-5 w-5" />} />
        <StatCard label="This month" value={countSince(members, monthStart)} meta="New members" icon={<Users className="h-5 w-5" />} />
        <StatCard label="This quarter" value={countSince(members, quarterStart)} meta="New members" icon={<Users className="h-5 w-5" />} />
        <StatCard label="This year" value={countSince(members, yearStart)} meta={`${members.length} total records`} icon={<Users className="h-5 w-5" />} />
      </div>

      <Card title="Monthly new members">
        <div className="h-[320px]">
          <Bar
            data={{
              labels: monthLabels,
              datasets: [
                {
                  label: 'New members',
                  data: monthlyCounts,
                  backgroundColor: '#16a34a',
                  borderRadius: 6,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
            }}
          />
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">Member directory</p>
            <p className="text-sm text-[var(--color-text-tertiary)]">All rows are loaded from the backend member records.</p>
          </div>
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members..." className="pl-10" />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border-secondary)]">
          <table className="min-w-full divide-y divide-[var(--color-border-secondary)] text-sm">
            <thead className="bg-[var(--color-background-tertiary)]">
              <tr className="text-left text-[var(--color-text-secondary)]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-secondary)]">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-[var(--color-text-tertiary)]">Loading members...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-[var(--color-text-tertiary)]">No members found.</td></tr>
              ) : (
                filtered.map((member) => (
                  <tr key={member.id}>
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{member.firstName} {member.lastName}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      <div className="space-y-1">
                        <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />{member.email}</span>
                        <span className="flex items-center gap-2"><Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />{member.phone || 'No phone'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge variant={member.isActive ? 'success' : 'warning'}>{member.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-4 py-3 text-[var(--color-text-tertiary)]">{new Date(member.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-xl rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] p-5 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Add new member</h2>
                <p className="text-sm text-[var(--color-text-tertiary)]">This creates a backend member record.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-full p-2 hover:bg-[var(--color-background-hover)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitMember}>
              <Input label="First name" value={draft.firstName} onChange={(event) => setDraft((prev) => ({ ...prev, firstName: event.target.value }))} required />
              <Input label="Last name" value={draft.lastName} onChange={(event) => setDraft((prev) => ({ ...prev, lastName: event.target.value }))} required />
              <Input className="sm:col-span-2" label="Email" type="email" value={draft.email} onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))} required />
              <Input className="sm:col-span-2" label="Phone" value={draft.phone || ''} onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))} />

              <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.isActive !== false}
                  onChange={(event) => setDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                Active member
              </label>

              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button type="submit" loading={saving}>Create member</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, meta, icon }: { label: string; value: number; meta: string; icon: ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-text-tertiary)]">{label}</p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{meta}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]">
          {icon}
        </div>
      </div>
    </Card>
  );
}
