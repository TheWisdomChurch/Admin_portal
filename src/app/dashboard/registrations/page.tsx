'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { DataTable } from '@/components/DateTable';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import type { AdminForm, FormSubmission } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type Column<T> = {
  key: keyof T;
  header: string;
  cell?: (item: T) => ReactNode;
};

type SubmissionValues = Record<string, string | boolean | number | string[]>;

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
  const fullName =
    readValue(values, 'full_name') ||
    readValue(values, 'fullName') ||
    readValue(values, 'name');

  if (fullName) return fullName;

  const first = readValue(values, 'first_name') || readValue(values, 'firstName');
  const last = readValue(values, 'last_name') || readValue(values, 'lastName');
  const combined = [first, last].filter(Boolean).join(' ').trim();

  return combined || fallback;
}

function resolveEmail(submission: FormSubmission, fallback = '—'): string {
  const direct = submission.email?.trim();
  if (direct) return direct;
  const values = submission.values as SubmissionValues | undefined;
  return (
    readValue(values, 'email') ||
    readValue(values, 'email_address') ||
    readValue(values, 'emailAddress') ||
    fallback
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
  const [filterText, setFilterText] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const selectedForm = useMemo(
    () => forms.find((form) => form.id === selectedFormId) || null,
    [forms, selectedFormId]
  );

  const loadForms = useCallback(async () => {
    try {
      setFormsLoading(true);
      const res = await apiClient.getAdminForms({ page: 1, limit: 200 });
      const list = Array.isArray(res.data) ? res.data : [];
      setForms(list);
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

  const handleRefresh = useCallback(async () => {
    await loadForms();
    await loadSubmissions();
  }, [loadForms, loadSubmissions]);

  useEffect(() => {
    if (authBlocked) return;
    loadForms();
  }, [authBlocked, loadForms]);

  useEffect(() => {
    if (!selectedFormId && forms.length > 0) {
      setSelectedFormId(forms[0].id);
    }
  }, [forms, selectedFormId]);

  useEffect(() => {
    if (authBlocked) return;
    loadSubmissions();
  }, [authBlocked, loadSubmissions]);

  const filteredSubmissions = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    const start = filterStart ? new Date(filterStart) : null;
    const end = filterEnd ? new Date(filterEnd) : null;
    if (end) end.setHours(23, 59, 59, 999);

    if (start && Number.isNaN(start.getTime())) return submissions;
    if (end && Number.isNaN(end.getTime())) return submissions;

    return submissions.filter((submission) => {
      if (term) {
        const name = resolveName(submission, '').toLowerCase();
        const email = resolveEmail(submission, '').toLowerCase();
        if (!name.includes(term) && !email.includes(term)) return false;
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

  const trendBuckets = useMemo(() => {
    const days = 14;
    const today = new Date();
    const buckets = Array.from({ length: days }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (days - 1 - index));
      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: 0,
      };
    });

    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    filteredSubmissions.forEach((submission) => {
      const created = new Date(submission.createdAt);
      if (Number.isNaN(created.getTime())) return;
      const key = created.toISOString().slice(0, 10);
      const bucket = bucketMap.get(key);
      if (bucket) bucket.count += 1;
    });

    return buckets;
  }, [filteredSubmissions]);

  const hasTrendData = trendBuckets.some((bucket) => bucket.count > 0);

  const trendChartData = useMemo(() => {
    return {
      labels: trendBuckets.map((bucket) => bucket.label),
      datasets: [
        {
          label: 'Registrations',
          data: trendBuckets.map((bucket) => bucket.count),
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          maxBarThickness: 32,
        },
      ],
    };
  }, [trendBuckets]);

  const trendChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: { mode: 'index' as const, intersect: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#6b7280', font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { color: '#6b7280', precision: 0 },
        },
      },
    }),
    []
  );

  const columns = useMemo<Column<FormSubmission>[]>(
    () => [
      {
        key: 'name' as keyof FormSubmission,
        header: 'Full Name',
        cell: (item: FormSubmission) => (
          <span className="text-sm font-semibold text-secondary-900">{resolveName(item)}</span>
        ),
      },
      {
        key: 'email' as keyof FormSubmission,
        header: 'Email Address',
        cell: (item: FormSubmission) => (
          <span className="text-sm text-secondary-700">{resolveEmail(item)}</span>
        ),
      },
      {
        key: 'createdAt' as keyof FormSubmission,
        header: 'Registered',
        cell: (item: FormSubmission) => (
          <span className="text-xs text-secondary-600">{formatDateTime(item.createdAt)}</span>
        ),
      },
    ],
    []
  );

  if (authBlocked) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrations"
        subtitle="See everyone who registered through your links and track sign-up trends."
        actions={(
          <Button variant="outline" onClick={handleRefresh}>
            Refresh
          </Button>
        )}
      />

      <Card title="Filters">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px]">
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              Registration Link
            </label>
            <select
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
              value={selectedFormId}
              onChange={(e) => {
                setSelectedFormId(e.target.value);
                setPage(1);
              }}
              disabled={formsLoading || forms.length === 0}
            >
              {forms.length === 0 ? (
                <option value="">No links available</option>
              ) : (
                <>
                  <option value="">Select a link</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.title}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <Input
            label="Search"
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setPage(1);
            }}
            placeholder="Name or email"
          />

          <Input
            label="From"
            type="date"
            value={filterStart}
            onChange={(e) => {
              setFilterStart(e.target.value);
              setPage(1);
            }}
          />

          <Input
            label="To"
            type="date"
            value={filterEnd}
            onChange={(e) => {
              setFilterEnd(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="mt-3 text-xs text-[var(--color-text-tertiary)]">
          Last updated: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : '—'}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Registration Trend (last 14 days)">
          {hasTrendData ? (
            <div>
              <div className="h-60">
                <Bar data={trendChartData} options={trendChartOptions} />
              </div>
              <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                Chart reflects the current filters and page size.
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-tertiary)]">
              No registration data yet for the selected link.
            </p>
          )}
        </Card>

        <Card title="Summary">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Selected link</p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                {selectedForm?.title || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Total registrations</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
                {submissionsTotal}
              </p>
            </div>
            {hasFilters ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Filtered results</p>
                <p className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">
                  {filteredSubmissions.length}
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card title="Registered People">
        {forms.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Create a registration link first to see sign-ups.
          </p>
        ) : !selectedFormId ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Select a registration link to view registrations.
          </p>
        ) : (
          <DataTable
            data={filteredSubmissions}
            columns={columns}
            total={filteredTotal}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
            isLoading={submissionsLoading}
          />
        )}
      </Card>
    </div>
  );
}

export default withAuth(RegistrationsPage);
