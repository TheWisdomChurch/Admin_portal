'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { apiClient } from '@/lib/api';
import type { NewMemberDashboardResponse, NewMemberSubmission } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function valueFromSubmission(item: NewMemberSubmission, keys: string[]): string {
  const record = item as unknown as Record<string, unknown>;
  for (const key of keys) {
    const direct = text(record[key]);
    if (direct) return direct;
    const nested = text(item.values?.[key]);
    if (nested) return nested;
  }
  return '';
}

function displayName(item: NewMemberSubmission): string {
  const direct = text(item.name) || valueFromSubmission(item, ['fullName', 'full_name', 'memberName', 'member_name']);
  if (direct) return direct;
  const first = valueFromSubmission(item, ['firstName', 'first_name']);
  const last = valueFromSubmission(item, ['lastName', 'last_name', 'surname']);
  return `${first} ${last}`.trim() || 'Unnamed member';
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function NewMembersPage() {
  const [dashboard, setDashboard] = useState<NewMemberDashboardResponse | null>(null);
  const [submissions, setSubmissions] = useState<NewMemberSubmission[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardRes, submissionsRes] = await Promise.all([
        apiClient.getNewMemberDashboard(),
        apiClient.listNewMemberSubmissions({ page: 1, limit: 100 }),
      ]);
      setDashboard(dashboardRes);
      setSubmissions(submissionsRes.data || dashboardRes.recent || []);
    } catch (error) {
      console.error('Failed to load new member dashboard:', error);
      toast.error('Unable to load new-member dashboard. Please sign in again if your session expired.');
      setDashboard(null);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return submissions;
    return submissions.filter((item) =>
      `${displayName(item)} ${item.email || ''} ${item.contactNumber || ''} ${item.formTitle}`
        .toLowerCase()
        .includes(needle)
    );
  }, [query, submissions]);

  const monthly = dashboard?.monthlyGrowth?.slice(-12) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Members"
        subtitle="Membership intake from published forms. This is separate from the all-members registry."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={load} loading={loading}>
              Refresh
            </Button>
            <Button icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.location.assign('/dashboard/forms/new?preset=member')}>
              Prepare form
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ['Total', dashboard?.totalSubmissions],
          ['This week', dashboard?.thisWeek],
          ['This month', dashboard?.thisMonth],
          ['This quarter', dashboard?.thisQuarter],
          ['This year', dashboard?.thisYear],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-[var(--color-text-tertiary)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{Number(value || 0)}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Monthly new-member growth">
          <div className="h-72">
            <Bar
              data={{
                labels: monthly.map((item) => item.period.slice(0, 7)),
                datasets: [{ label: 'New members', data: monthly.map((item) => item.count), backgroundColor: '#16a34a' }],
              }}
              options={{ maintainAspectRatio: false, responsive: true }}
            />
          </div>
        </Card>
        <Card title="Connected intake forms">
          <div className="space-y-3">
            {(dashboard?.forms || []).length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No membership intake form detected.</p>
            ) : (
              dashboard?.forms.map((form) => (
                <div key={form.formId} className="rounded-md border border-[var(--color-border-secondary)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">{form.formTitle}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{form.slug || form.formId}</p>
                    </div>
                    <Badge variant={form.isPublished ? 'success' : 'secondary'}>{form.isPublished ? 'Published' : 'Draft'}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{form.submissionCount} submissions</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card
        title="New-member submissions"
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input className="pl-9" placeholder="Search submissions" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-border-secondary)] text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-tertiary)]">
                <th className="px-3 py-3 font-medium">Profile</th>
                <th className="px-3 py-3 font-medium">Contact</th>
                <th className="px-3 py-3 font-medium">Source</th>
                <th className="px-3 py-3 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-secondary)]">
              {loading ? (
                <tr><td className="px-3 py-8 text-[var(--color-text-tertiary)]" colSpan={4}>Loading new members...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-3 py-8 text-[var(--color-text-tertiary)]" colSpan={4}>No new-member submissions found.</td></tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-[var(--color-text-primary)]">{displayName(item)}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{item.registrationCode || item.id}</p>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">
                      <p>{item.email || valueFromSubmission(item, ['email', 'emailAddress']) || '-'}</p>
                      <p className="text-xs">{item.contactNumber || valueFromSubmission(item, ['phone', 'phoneNumber', 'mobile']) || ''}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="info">{item.formTitle}</Badge>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{formatDate(item.createdAt)}</td>
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
