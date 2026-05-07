'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, Search, Users, Link2, CalendarDays, FilterX } from 'lucide-react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { DataTable } from '@/components/DateTable';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import type { AdminForm, FormSubmission, FormSubmissionDailyStat } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Column<T> = { key: keyof T; header: string; cell?: (item: T) => ReactNode };
type SubmissionValues = Record<string, string | boolean | number | string[] | null>;

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function readValue(values: SubmissionValues | undefined, key: string): string | undefined {
  if (!values) return undefined;
  const raw = values[key];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'number') return String(raw);
  if (Array.isArray(raw) && raw.length > 0) return raw.join(', ');
  return undefined;
}

function resolveName(submission: FormSubmission, fallback = 'Anonymous'): string {
  const direct = submission.name?.trim();
  if (direct) return direct;
  const values = submission.values as SubmissionValues | undefined;
  const fullName = readValue(values, 'full_name') || readValue(values, 'fullName') || readValue(values, 'name');
  if (fullName) return fullName;
  const first = readValue(values, 'first_name') || readValue(values, 'firstName');
  const last = readValue(values, 'last_name') || readValue(values, 'lastName');
  return [first, last].filter(Boolean).join(' ').trim() || fallback;
}

function resolveEmail(submission: FormSubmission, fallback = '—'): string {
  const direct = submission.email?.trim();
  if (direct) return direct;
  const values = submission.values as SubmissionValues | undefined;
  return readValue(values, 'email') || readValue(values, 'email_address') || readValue(values, 'emailAddress') || fallback;
}

function ShellCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm ${className}`}>{children}</section>;
}

function Metric({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint: string; icon: React.ElementType }) {
  return (
    <ShellCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">{label}</p>
          <p className="mt-3 text-3xl font-black text-[var(--color-text-primary)]">{value}</p>
          <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{hint}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]"><Icon className="h-5 w-5" /></div>
      </div>
    </ShellCard>
  );
}

function RegistrationsPage() {
  const auth = useAuthContext();
  const authBlocked = !auth.isInitialized || auth.isLoading;

  const [forms, setForms] = useState<AdminForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [dailyStats, setDailyStats] = useState<FormSubmissionDailyStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const selectedForm = useMemo(() => forms.find((form) => form.id === selectedFormId) || null, [forms, selectedFormId]);

  const loadForms = useCallback(async () => {
    try {
      setFormsLoading(true);
      const res = await apiClient.getAdminForms({ page: 1, limit: 100 });
      setForms(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load registration links');
      setForms([]);
    } finally {
      setFormsLoading(false);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    if (!selectedFormId) {
      setSubmissions([]);
      setSubmissionsTotal(0);
      return;
    }
    try {
      setSubmissionsLoading(true);
      const res = await apiClient.getFormSubmissions(selectedFormId, { page, limit });
      setSubmissions(Array.isArray(res.data) ? res.data : []);
      setSubmissionsTotal(typeof res.total === 'number' ? res.total : 0);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      console.error(error);
      toast.error('Failed to load registrations');
      setSubmissions([]);
      setSubmissionsTotal(0);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [selectedFormId, page, limit]);

  const loadDailyStats = useCallback(async () => {
    if (!selectedFormId) {
      setDailyStats([]);
      return;
    }
    try {
      setStatsLoading(true);
      const stats = await apiClient.getFormSubmissionStats(selectedFormId);
      setDailyStats(Array.isArray(stats) ? stats : []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load daily registration stats');
      setDailyStats([]);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedFormId]);

  const handleRefresh = useCallback(async () => {
    await loadForms();
    await loadSubmissions();
    await loadDailyStats();
  }, [loadForms, loadSubmissions, loadDailyStats]);

  useEffect(() => { if (!authBlocked) void loadForms(); }, [authBlocked, loadForms]);
  useEffect(() => { if (!selectedFormId && forms.length > 0) setSelectedFormId(forms[0].id); }, [forms, selectedFormId]);
  useEffect(() => { if (!authBlocked) void loadSubmissions(); }, [authBlocked, loadSubmissions]);
  useEffect(() => { if (!authBlocked) void loadDailyStats(); }, [authBlocked, loadDailyStats]);

  const filteredSubmissions = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    const start = filterStart ? new Date(filterStart) : null;
    const end = filterEnd ? new Date(filterEnd) : null;
    if (end) end.setHours(23, 59, 59, 999);
    if (start && Number.isNaN(start.getTime())) return submissions;
    if (end && Number.isNaN(end.getTime())) return submissions;

    return submissions.filter((submission) => {
      if (term) {
        const hay = `${resolveName(submission, '')} ${resolveEmail(submission, '')}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (start || end) {
        const created = new Date(submission.createdAt);
        if (Number.isNaN(created.getTime())) return false;
        if (start && created < start) return false;
        if (end && created > end) return false;
      }
      return true;
    });
  }, [submissions, filterText, filterStart, filterEnd]);

  const hasFilters = Boolean(filterText.trim() || filterStart || filterEnd);
  const filteredTotal = hasFilters ? filteredSubmissions.length : submissionsTotal;

  const filteredDailyStats = useMemo(() => {
    const sorted = [...dailyStats].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!filterStart && !filterEnd) return sorted;
    const start = filterStart ? new Date(filterStart) : null;
    const end = filterEnd ? new Date(filterEnd) : null;
    if (end) end.setHours(23, 59, 59, 999);
    return sorted.filter((item) => {
      const date = new Date(item.date);
      if (Number.isNaN(date.getTime())) return false;
      if (start && date < start) return false;
      if (end && date > end) return false;
      return true;
    });
  }, [dailyStats, filterStart, filterEnd]);

  const trendChartData = useMemo(() => ({
    labels: filteredDailyStats.map((entry) => formatShortDate(entry.date)),
    datasets: [{ label: 'Registrations', data: filteredDailyStats.map((entry) => entry.count), backgroundColor: '#2563eb', borderRadius: 10, maxBarThickness: 34 }],
  }), [filteredDailyStats]);

  const columns = useMemo<Column<FormSubmission>[]>(() => [
    { key: 'name' as keyof FormSubmission, header: 'Full Name', cell: (item) => <span className="text-sm font-black text-[var(--color-text-primary)]">{resolveName(item)}</span> },
    { key: 'email' as keyof FormSubmission, header: 'Email Address', cell: (item) => <span className="break-all text-sm text-[var(--color-text-secondary)]">{resolveEmail(item)}</span> },
    { key: 'createdAt' as keyof FormSubmission, header: 'Registered', cell: (item) => <span className="text-xs text-[var(--color-text-tertiary)]">{formatDateTime(item.createdAt)}</span> },
  ], []);

  const clearFilters = () => {
    setFilterText('');
    setFilterStart('');
    setFilterEnd('');
    setPage(1);
  };

  if (authBlocked) {
    return <div className="flex min-h-[300px] items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-[var(--color-text-tertiary)]" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrations"
        subtitle="Track people who registered through forms and inspect daily sign-up trends."
        actions={<Button variant="outline" onClick={handleRefresh} loading={formsLoading || submissionsLoading || statsLoading} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Registration links" value={forms.length} hint="Available backend forms" icon={Link2} />
        <Metric label="Selected total" value={submissionsTotal} hint="All records for selected link" icon={Users} />
        <Metric label="Current view" value={filteredSubmissions.length} hint={hasFilters ? 'After local filters' : 'Loaded page records'} icon={Search} />
        <Metric label="Last updated" value={lastUpdatedAt ? formatDateTime(lastUpdatedAt).split(',')[0] : '—'} hint="Latest successful refresh" icon={CalendarDays} />
      </div>

      <ShellCard className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_minmax(220px,1fr)_160px_160px]">
            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Registration Link</label>
              <select
                className="h-11 w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 text-sm text-[var(--color-text-primary)]"
                value={selectedFormId}
                onChange={(e) => { setSelectedFormId(e.target.value); setPage(1); }}
                disabled={formsLoading || forms.length === 0}
              >
                {forms.length === 0 ? <option value="">No links available</option> : <><option value="">Select a link</option>{forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}</>}
              </select>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-[var(--color-text-tertiary)]" />
              <Input label="Search" value={filterText} onChange={(e) => { setFilterText(e.target.value); setPage(1); }} placeholder="Name or email" className="pl-9" />
            </div>
            <Input label="From" type="date" value={filterStart} onChange={(e) => { setFilterStart(e.target.value); setPage(1); }} />
            <Input label="To" type="date" value={filterEnd} onChange={(e) => { setFilterEnd(e.target.value); setPage(1); }} />
          </div>
          <Button variant="outline" onClick={clearFilters} disabled={!hasFilters} icon={<FilterX className="h-4 w-4" />}>Clear</Button>
        </div>
      </ShellCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ShellCard className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-[var(--color-text-primary)]">Daily registrations</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Selected link trend. Date filters apply.</p>
            </div>
          </div>
          <div className="mt-5 h-72">
            {!selectedFormId ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">Select a registration link to view daily stats.</div> : statsLoading ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">Loading daily stats...</div> : filteredDailyStats.length > 0 ? <Bar data={trendChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }} /> : <div className="p-6 text-sm text-[var(--color-text-tertiary)]">No daily stats yet.</div>}
          </div>
        </ShellCard>

        <ShellCard className="p-5">
          <h2 className="text-lg font-black text-[var(--color-text-primary)]">Summary</h2>
          <div className="mt-5 space-y-4">
            <Info label="Selected link" value={selectedForm?.title || '—'} />
            <Info label="Total registrations" value={String(submissionsTotal)} />
            <Info label="Filtered results" value={hasFilters ? String(filteredSubmissions.length) : 'No filter'} />
            <Info label="Last updated" value={lastUpdatedAt ? formatDateTime(lastUpdatedAt) : '—'} />
          </div>
        </ShellCard>
      </div>

      <ShellCard className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[var(--color-text-primary)]">Registered People</h2>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Paginated records from the selected registration link.</p>
          </div>
        </div>
        {forms.length === 0 ? <p className="text-sm text-[var(--color-text-tertiary)]">Create a registration link first to see sign-ups.</p> : !selectedFormId ? <p className="text-sm text-[var(--color-text-tertiary)]">Select a registration link to view registrations.</p> : (
          <DataTable data={filteredSubmissions} columns={columns} total={filteredTotal} page={page} limit={limit} onPageChange={setPage} onLimitChange={(next) => { setLimit(next); setPage(1); }} isLoading={submissionsLoading} />
        )}
      </ShellCard>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

export default withAuth(RegistrationsPage);
