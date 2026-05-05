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
import { CalendarDays, ExternalLink, RefreshCw, Search } from 'lucide-react';
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

  const weekly = dashboard?.weeklyGrowth?.slice(-12) || [];
  const monthly = dashboard?.monthlyGrowth?.slice(-12) || [];
  const quarterly = dashboard?.quarterlyGrowth?.slice(-8) || [];
  const yearly = dashboard?.yearlyGrowth?.slice(-6) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Members"
        subtitle="Add New Member intake, growth trends, and follow-up records. This is separate from the all-members registry."
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="New-member growth">
          <div className="grid gap-4 lg:grid-cols-2">
            <GrowthChart title="Weekly" data={weekly} color="#2563eb" labelPrefix="Week" />
            <GrowthChart title="Monthly" data={monthly} color="#16a34a" labelPrefix="Month" />
            <GrowthChart title="Quarterly" data={quarterly} color="#d97706" labelPrefix="Quarter" />
            <GrowthChart title="Yearly" data={yearly} color="#7c3aed" labelPrefix="Year" />
          </div>
        </Card>
        <Card title="Add New Member form">
          <div className="space-y-3">
            {(dashboard?.forms || []).length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No Add New Member form detected.</p>
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

      <Card title="Period summaries">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <GrowthAccordion title="Weekly" data={weekly} />
          <GrowthAccordion title="Monthly" data={monthly} />
          <GrowthAccordion title="Quarterly" data={quarterly} />
          <GrowthAccordion title="Yearly" data={yearly} />
        </div>
      </Card>

      <Card
        title="Add New Member submissions"
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

function shortPeriod(period: string, prefix?: string): string {
  if (!period) return '-';
  if (prefix === 'Year') return period.slice(0, 4);
  if (prefix === 'Quarter') {
    const date = new Date(period);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`;
    }
  }
  return period.slice(0, 10);
}

function GrowthChart({ title, data, color, labelPrefix }: { title: string; data: { period: string; count: number }[]; color: string; labelPrefix: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border-secondary)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
        <CalendarDays className="h-4 w-4 text-[var(--color-text-tertiary)]" />
      </div>
      <div className="h-52">
        <Bar
          data={{
            labels: data.map((item) => shortPeriod(item.period, labelPrefix)),
            datasets: [{ label: 'New members', data: data.map((item) => item.count), backgroundColor: color, borderRadius: 6 }],
          }}
          options={{ maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }}
        />
      </div>
    </div>
  );
}

function GrowthAccordion({ title, data }: { title: string; data: { period: string; count: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return (
    <details className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3" open={title === 'Monthly'}>
      <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-primary)]">
        {title} <span className="text-[var(--color-text-tertiary)]">({total})</span>
      </summary>
      <div className="mt-3 space-y-2">
        {data.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">No records yet.</p>
        ) : (
          data.map((item) => (
            <div key={`${title}-${item.period}`} className="flex items-center justify-between rounded-[var(--radius-button)] bg-[var(--color-background-primary)] px-3 py-2 text-xs">
              <span className="text-[var(--color-text-secondary)]">{shortPeriod(item.period)}</span>
              <span className="font-semibold text-[var(--color-text-primary)]">{item.count}</span>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
