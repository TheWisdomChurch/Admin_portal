// src/app/dashboard/forms/[id]/submissions/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Copy, Send } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/layouts';
import { DataTable } from '@/components/DateTable';
import { apiClient } from '@/lib/api';
import {
  buildFormSubmissionsReportUrl,
  exportFormSubmissionsCsv,
  exportFormSubmissionsPdf,
  fetchAllFormSubmissions,
  filterFormSubmissions,
  resolveFormSubmissionEmail,
  resolveFormSubmissionName,
} from '@/lib/formSubmissions';
import type { AdminForm, FormSubmission, FormSubmissionDailyStat } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type RangeOption = 7 | 30;

function toISODateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start, end };
}

function fillDailySeries(range: RangeOption, raw: FormSubmissionDailyStat[]) {
  const { start, end } = buildDateRange(range);
  const cursor = new Date(start);
  const map = new Map<string, number>();
  raw.forEach((row) => {
    const key = toISODateOnly(new Date(row.date));
    map.set(key, row.count);
  });

  const labels: string[] = [];
  const values: number[] = [];
  while (cursor <= end) {
    const key = toISODateOnly(cursor);
    labels.push(key);
    values.push(map.get(key) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  return { labels, values };
}

function SubmissionsPage() {
  const router = useRouter();
  const params = useParams();
  const formId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  }, [params]);

  const [form, setForm] = useState<AdminForm | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [stats, setStats] = useState<FormSubmissionDailyStat[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [range, setRange] = useState<RangeOption>(7);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const load = useCallback(async () => {
    if (!formId) return;
    try {
      setLoading(true);

      const [formRes, submissionsRes, statsRes] = await Promise.all([
        apiClient.getAdminForm(formId),
        apiClient.getFormSubmissions(formId, { page, limit }),
        apiClient.getFormSubmissionStats(formId),
      ]);

      setForm(formRes);
      setSubmissions(submissionsRes.data || []);
      setTotal(submissionsRes.total || 0);
      setStats(Array.isArray(statsRes) ? statsRes : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load submissions';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [formId, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const chartSeries = useMemo(() => fillDailySeries(range, stats), [range, stats]);

  const chartData = useMemo(
    () => ({
      labels: chartSeries.labels,
      datasets: [
        {
          label: 'Registrations',
          data: chartSeries.values,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          tension: 0.3,
          pointRadius: 2,
        },
      ],
    }),
    [chartSeries]
  );

  const columns = useMemo(
    () => [
      {
        key: 'name' as keyof FormSubmission,
        header: 'Name',
        cell: (row: FormSubmission) => row.name || '—',
      },
      {
        key: 'email' as keyof FormSubmission,
        header: 'Email',
        cell: (row: FormSubmission) => row.email || '—',
      },
      {
        key: 'registrationCode' as keyof FormSubmission,
        header: 'Registration Code',
        cell: (row: FormSubmission) => row.registrationCode || '—',
      },
      {
        key: 'createdAt' as keyof FormSubmission,
        header: 'Submitted',
        cell: (row: FormSubmission) => new Date(row.createdAt).toLocaleString(),
      },
    ],
    []
  );

  const sortedSubmissions = useMemo(
    () =>
      submissions.slice().sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();

        if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
        if (Number.isNaN(leftTime)) return 1;
        if (Number.isNaN(rightTime)) return -1;
        return rightTime - leftTime;
      }),
    [submissions]
  );

  const latestSubmissions = useMemo(() => sortedSubmissions.slice(0, 5), [sortedSubmissions]);

  const handleCopyLink = useCallback(async () => {
    if (!formId) return;

    try {
      await navigator.clipboard.writeText(buildFormSubmissionsReportUrl(formId));
      toast.success('Report link copied');
    } catch {
      toast.error('Failed to copy report link');
    }
  }, [formId]);

  const handleExportPdf = useCallback(async () => {
    if (!formId) return;

    try {
      setExportingPdf(true);
      const allSubmissions = await fetchAllFormSubmissions(formId);
      const filtered = filterFormSubmissions(allSubmissions);

      if (filtered.length === 0) {
        toast.error('No submissions to export');
        return;
      }

      await exportFormSubmissionsPdf(filtered, form?.title || formId);
      toast.success('PDF exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  }, [form, formId]);

  const handleExportCsv = useCallback(async () => {
    if (!formId) return;

    try {
      setExportingCsv(true);
      const allSubmissions = await fetchAllFormSubmissions(formId);
      const filtered = filterFormSubmissions(allSubmissions);

      if (filtered.length === 0) {
        toast.error('No submissions to export');
        return;
      }
      exportFormSubmissionsCsv(filtered, form?.title || formId);
      toast.success('CSV exported. You can open it in Excel.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExportingCsv(false);
    }
  }, [form, formId]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Form Submissions"
          subtitle={form ? form.title : 'Registrations and daily counts'}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleCopyLink} icon={<Copy className="h-4 w-4" />}>
            Copy Report Link
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/forms/${formId}/campaigns`)}
            icon={<Send className="h-4 w-4" />}
          >
            Ads & Outreach
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPdf}
            loading={exportingPdf}
            disabled={exportingPdf || total === 0}
          >
            Export PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCsv}
            loading={exportingCsv}
            disabled={exportingCsv || total === 0}
          >
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Total registrations
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{total}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Showing on this page
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {submissions.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Selected range
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {range} days
          </p>
        </Card>
      </div>

      <Card title="Latest Registrations">
        {latestSubmissions.length > 0 ? (
          <div className="space-y-3">
            {latestSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 py-3"
              >
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {resolveFormSubmissionName(submission, 'Anonymous')}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {resolveFormSubmissionEmail(submission) || submission.contactNumber || 'No contact information'}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)]">
                  {new Date(submission.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-tertiary)]">No registrations yet.</p>
        )}
      </Card>

      <Card title="Registrations Over Time">
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <Button
            variant={range === 7 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setRange(7)}
          >
            Last 7 days
          </Button>
          <Button
            variant={range === 30 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setRange(30)}
          >
            Last 30 days
          </Button>
        </div>
        <div className="h-[260px]">
          <Line data={chartData} options={{ maintainAspectRatio: false, responsive: true }} />
        </div>
      </Card>

      <Card className="p-0">
        <DataTable
          data={sortedSubmissions}
          columns={columns}
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          isLoading={false}
        />
      </Card>
    </div>
  );
}

export default withAuth(SubmissionsPage, { requiredRole: 'admin' });
