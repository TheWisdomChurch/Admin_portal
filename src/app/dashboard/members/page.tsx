'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Mail, Phone, RefreshCw, Search, UserCheck, UserX, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { apiClient } from '@/lib/api';
import type { Member, MemberStatsResponse } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatBirthday(member: Member): string {
  if (!member.birthdayDay || !member.birthdayMonth) return '-';
  return `${String(member.birthdayDay).padStart(2, '0')}/${String(member.birthdayMonth).padStart(2, '0')}`;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<MemberStatsResponse | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) =>
      `${member.firstName} ${member.lastName} ${member.email} ${member.phone || ''}`
        .toLowerCase()
        .includes(needle)
    );
  }, [members, query]);

  const growthLabels = (stats?.monthlyGrowth || []).slice(-12).map((item) => item.period.slice(0, 7));
  const growthValues = (stats?.monthlyGrowth || []).slice(-12).map((item) => item.count);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle="The full church membership registry, separated from new-member form intake."
        actions={
          <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={load} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-tertiary)]">Total members</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{stats?.total ?? members.length}</p>
            </div>
            <Users className="h-8 w-8 text-[var(--color-accent-primary)]" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-tertiary)]">Active</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{stats?.active ?? members.filter((m) => m.isActive).length}</p>
            </div>
            <UserCheck className="h-8 w-8 text-emerald-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-tertiary)]">Inactive</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{stats?.inactive ?? members.filter((m) => !m.isActive).length}</p>
            </div>
            <UserX className="h-8 w-8 text-rose-600" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Monthly membership growth">
          <div className="h-72">
            <Bar
              data={{
                labels: growthLabels,
                datasets: [{ label: 'Members added', data: growthValues, backgroundColor: '#2563eb' }],
              }}
              options={{ maintainAspectRatio: false, responsive: true }}
            />
          </div>
        </Card>
        <Card title="Registry status">
          <div className="h-72">
            <Pie
              data={{
                labels: ['Active', 'Inactive'],
                datasets: [{ data: [stats?.active || 0, stats?.inactive || 0], backgroundColor: ['#059669', '#e11d48'] }],
              }}
              options={{ maintainAspectRatio: false, responsive: true }}
            />
          </div>
        </Card>
      </div>

      <Card
        title="All member profiles"
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input className="pl-9" placeholder="Search members" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-border-secondary)] text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-tertiary)]">
                <th className="px-3 py-3 font-medium">Profile</th>
                <th className="px-3 py-3 font-medium">Contact</th>
                <th className="px-3 py-3 font-medium">Birthday</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-secondary)]">
              {loading ? (
                <tr><td className="px-3 py-8 text-[var(--color-text-tertiary)]" colSpan={5}>Loading members...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-3 py-8 text-[var(--color-text-tertiary)]" colSpan={5}>No members found.</td></tr>
              ) : (
                filtered.map((member) => (
                  <tr key={member.id}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-[var(--color-text-primary)]">{member.firstName} {member.lastName}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{member.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1 text-[var(--color-text-secondary)]">
                        <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{member.email}</p>
                        {member.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{member.phone}</p>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{formatBirthday(member)}</td>
                    <td className="px-3 py-3">
                      <Badge variant={member.isActive ? 'success' : 'secondary'}>{member.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{formatDate(member.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
