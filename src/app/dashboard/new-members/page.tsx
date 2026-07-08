'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { ExternalLink, RefreshCw, Search, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { apiClient } from '@/lib/api';
import type { NewMemberDashboardResponse, NewMemberSubmission } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type GrowthPoint = { period: string; count: number };

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
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function shortPeriod(period: string, prefix?: string): string {
  if (!period) return '—';
  if (prefix === 'Year') return period.slice(0, 4);
  if (prefix === 'Quarter') {
    const date = new Date(period);
    if (!Number.isNaN(date.getTime())) return `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`;
  }
  return period.slice(0, 10);
}

function ShellCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm ${className}`}>{children}</section>;
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return <ShellCard className="p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">{label}</p><p className="mt-3 text-3xl font-black text-[var(--color-text-primary)]">{value}</p><p className="mt-2 text-sm text-[var(--color-text-secondary)]">{hint}</p></ShellCard>;
}

export default function NewMembersPage() {
  const [dashboard, setDashboard] = useState<NewMemberDashboardResponse | null>(null);
  const [submissions, setSubmissions] = useState<NewMemberSubmission[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');

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

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return submissions;
    return submissions.filter((item) => `${displayName(item)} ${item.email || ''} ${item.contactNumber || ''} ${item.formTitle}`.toLowerCase().includes(needle));
  }, [query, submissions]);

  const growthSets = useMemo(() => ({
    weekly: dashboard?.weeklyGrowth?.slice(-12) || [],
    monthly: dashboard?.monthlyGrowth?.slice(-12) || [],
    quarterly: dashboard?.quarterlyGrowth?.slice(-8) || [],
    yearly: dashboard?.yearlyGrowth?.slice(-6) || [],
  }), [dashboard]);

  const activeGrowth = growthSets[section] as GrowthPoint[];
  const chartData = useMemo(() => ({
    labels: activeGrowth.map((item) => shortPeriod(item.period, section === 'yearly' ? 'Year' : section === 'quarterly' ? 'Quarter' : undefined)),
    datasets: [{ label: 'New members', data: activeGrowth.map((item) => item.count), backgroundColor: '#2563eb', borderRadius: 10, maxBarThickness: 36 }],
  }), [activeGrowth, section]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Members"
        subtitle="Intake, growth trends, and follow-up records, separated from the main member registry."
        actions={<div className="flex flex-wrap gap-2"><Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()} loading={loading}>Refresh</Button><Button icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.location.assign('/dashboard/forms/new?preset=member')}>Prepare form</Button></div>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total" value={Number(dashboard?.totalSubmissions || 0)} hint="All intake submissions" />
        <StatCard label="This week" value={Number(dashboard?.thisWeek || 0)} hint="Current week intake" />
        <StatCard label="This month" value={Number(dashboard?.thisMonth || 0)} hint="Current month intake" />
        <StatCard label="This quarter" value={Number(dashboard?.thisQuarter || 0)} hint="Quarterly movement" />
        <StatCard label="This year" value={Number(dashboard?.thisYear || 0)} hint="Annual growth" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ShellCard className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-[var(--color-text-primary)]">New-member growth</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Switch between available periods.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((key) => <Button key={key} size="sm" variant={section === key ? 'primary' : 'outline'} onClick={() => setSection(key)}>{key}</Button>)}
            </div>
          </div>
          <div className="mt-5 h-80">
            {activeGrowth.length === 0 ? <p className="text-sm text-[var(--color-text-tertiary)]">No growth data yet.</p> : <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }} />}
          </div>
        </ShellCard>

        <ShellCard className="p-5">
          <h2 className="text-lg font-black text-[var(--color-text-primary)]">Add New Member forms</h2>
          <div className="mt-4 space-y-3">
            {(dashboard?.forms || []).length === 0 ? <p className="text-sm text-[var(--color-text-tertiary)]">No Add New Member form detected.</p> : dashboard?.forms.map((form) => (
              <article key={form.formId} className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-black text-[var(--color-text-primary)]">{form.formTitle}</p><p className="mt-1 truncate text-xs text-[var(--color-text-tertiary)]">{form.slug || form.formId}</p></div>
                  <Badge variant={form.isPublished ? 'success' : 'secondary'}>{form.isPublished ? 'Live' : 'Draft'}</Badge>
                </div>
                <p className="mt-3 text-sm font-semibold text-[var(--color-text-secondary)]">{form.submissionCount} submissions</p>
              </article>
            ))}
          </div>
        </ShellCard>
      </div>

      <ShellCard className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-black text-[var(--color-text-primary)]">Period summaries</h2><p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Compact accordions prevent dashboard overcrowding.</p></div>
          <TrendingUp className="h-5 w-5 text-[var(--color-text-tertiary)]" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <GrowthAccordion title="Weekly" data={growthSets.weekly} />
          <GrowthAccordion title="Monthly" data={growthSets.monthly} open />
          <GrowthAccordion title="Quarterly" data={growthSets.quarterly} />
          <GrowthAccordion title="Yearly" data={growthSets.yearly} />
        </div>
      </ShellCard>

      <ShellCard className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-black text-[var(--color-text-primary)]">Add New Member submissions</h2><p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Latest form-driven intake records.</p></div>
          <div className="relative w-full sm:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" /><Input className="pl-9" placeholder="Search submissions" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--color-border-secondary)]">
          <div className="hidden grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_160px_180px] gap-4 bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] lg:grid">
            <div>Profile</div><div>Contact</div><div>Source</div><div>Submitted</div>
          </div>
          <div className="divide-y divide-[var(--color-border-secondary)]">
            {loading ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">Loading new members...</div> : null}
            {!loading && filtered.length === 0 ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">No new-member submissions found.</div> : null}
            {!loading && filtered.map((item) => (
              <article key={item.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_160px_180px] lg:items-center">
                <div className="min-w-0"><p className="truncate text-sm font-black text-[var(--color-text-primary)]">{displayName(item)}</p><p className="truncate text-xs text-[var(--color-text-tertiary)]">{item.registrationCode || item.id}</p></div>
                <div className="min-w-0 text-sm text-[var(--color-text-secondary)]"><p className="truncate">{item.email || valueFromSubmission(item, ['email', 'emailAddress']) || 'No email'}</p><p className="truncate text-xs text-[var(--color-text-tertiary)]">{item.contactNumber || valueFromSubmission(item, ['phone', 'phoneNumber', 'mobile']) || 'No phone'}</p></div>
                <Badge variant="info">{item.formTitle}</Badge>
                <div className="text-sm text-[var(--color-text-secondary)]">{formatDate(item.createdAt)}</div>
              </article>
            ))}
          </div>
        </div>
      </ShellCard>
    </div>
  );
}

function GrowthAccordion({ title, data, open }: { title: string; data: GrowthPoint[]; open?: boolean }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return (
    <details className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 open:bg-[var(--color-background-primary)]" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-[var(--color-text-primary)]"><span>{title}</span><span className="rounded-full bg-[var(--color-background-primary)] px-3 py-1 text-xs text-[var(--color-text-tertiary)]">{total}</span></summary>
      <div className="mt-4 space-y-2">
        {data.length === 0 ? <p className="text-xs text-[var(--color-text-tertiary)]">No records yet.</p> : data.map((item) => <div key={`${title}-${item.period}`} className="flex items-center justify-between rounded-2xl bg-[var(--color-background-secondary)] px-3 py-2 text-xs"><span className="text-[var(--color-text-secondary)]">{shortPeriod(item.period)}</span><span className="font-black text-[var(--color-text-primary)]">{item.count}</span></div>)}
      </div>
    </details>
  );
}
