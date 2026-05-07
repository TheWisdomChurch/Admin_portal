'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Copy, Download, Send, ArrowLeft, RefreshCw, Users, CalendarDays } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';

import { Button } from '@/ui/Button';
import { PageHeader } from '@/layouts';
import { DataTable } from '@/components/DateTable';
import { apiClient } from '@/lib/api';
import {
  copyFormSubmissionsReportLink,
  exportFormSubmissionsCsv,
  exportFormSubmissionsPdf,
  fetchAllFormSubmissions,
  filterFormSubmissions,
  resolveFormSubmissionEmail,
  resolveFormSubmissionName,
} from '@/lib/formSubmissions';
import type { AdminForm, FormSubmission, FormSubmissionDailyStat } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

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
    labels.push(key.slice(5));
    values.push(map.get(key) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  return { labels, values };
}

function ShellCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm ${className}`}>{children}</section>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return <ShellCard className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">{label}</p><p className="mt-3 text-3xl font-black text-[var(--color-text-primary)]">{value}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]"><Icon className="h-5 w-5" /></div></div></ShellCard>;
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
      toast.error(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [formId, page, limit]);

  useEffect(() => { void load(); }, [load]);

  const chartSeries = useMemo(() => fillDailySeries(range, stats), [range, stats]);
  const chartData = useMemo(() => ({
    labels: chartSeries.labels,
    datasets: [{ label: 'Registrations', data: chartSeries.values, borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.14)', fill: true, tension: 0.35, pointRadius: 2 }],
  }), [chartSeries]);

  const sortedSubmissions = useMemo(() => submissions.slice().sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return rightTime - leftTime;
  }), [submissions]);

  const latestSubmissions = sortedSubmissions.slice(0, 5);

  const columns = useMemo(() => [
    { key: 'name' as keyof FormSubmission, header: 'Name', cell: (row: FormSubmission) => <span className="font-black text-[var(--color-text-primary)]">{resolveFormSubmissionName(row, '—')}</span> },
    { key: 'email' as keyof FormSubmission, header: 'Email', cell: (row: FormSubmission) => <span className="break-all text-[var(--color-text-secondary)]">{resolveFormSubmissionEmail(row) || '—'}</span> },
    { key: 'registrationCode' as keyof FormSubmission, header: 'Registration Code', cell: (row: FormSubmission) => row.registrationCode || '—' },
    { key: 'createdAt' as keyof FormSubmission, header: 'Submitted', cell: (row: FormSubmission) => new Date(row.createdAt).toLocaleString() },
  ], []);

  const handleCopyLink = useCallback(async () => {
    if (!formId) return;
    try { await copyFormSubmissionsReportLink(formId); toast.success('Client report link copied'); } catch { toast.error('Failed to copy report link'); }
  }, [formId]);

  const handleExportPdf = useCallback(async () => {
    if (!formId) return;
    try {
      setExportingPdf(true);
      const exportForm = form?.id === formId && (form.fields?.length || 0) > 0 ? form : await apiClient.getAdminForm(formId);
      const allSubmissions = await fetchAllFormSubmissions(formId);
      const filtered = filterFormSubmissions(allSubmissions);
      if (filtered.length === 0) { toast.error('No submissions to export'); return; }
      await exportFormSubmissionsPdf(filtered, exportForm.title || formId, undefined, exportForm.fields);
      toast.success('PDF exported');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to export PDF'); } finally { setExportingPdf(false); }
  }, [form, formId]);

  const handleExportCsv = useCallback(async () => {
    if (!formId) return;
    try {
      setExportingCsv(true);
      const exportForm = form?.id === formId && (form.fields?.length || 0) > 0 ? form : await apiClient.getAdminForm(formId);
      const allSubmissions = await fetchAllFormSubmissions(formId);
      const filtered = filterFormSubmissions(allSubmissions);
      if (filtered.length === 0) { toast.error('No submissions to export'); return; }
      exportFormSubmissionsCsv(filtered, exportForm.title || formId, exportForm.fields);
      toast.success('CSV exported. You can open it in Excel.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to export CSV'); } finally { setExportingCsv(false); }
  }, [form, formId]);

  if (loading) {
    return <div className="flex min-h-[300px] items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-[var(--color-text-tertiary)]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader title="Form Submissions" subtitle={form ? form.title : 'Registrations and daily counts'} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleCopyLink} icon={<Copy className="h-4 w-4" />}>Copy Report Link</Button>
          <Button variant="outline" onClick={() => router.push(`/dashboard/forms/${formId}/campaigns`)} icon={<Send className="h-4 w-4" />}>Ads & Outreach</Button>
          <Button variant="outline" onClick={handleExportPdf} loading={exportingPdf} disabled={exportingPdf || total === 0} icon={<Download className="h-4 w-4" />}>PDF</Button>
          <Button variant="outline" onClick={handleExportCsv} loading={exportingCsv} disabled={exportingCsv || total === 0} icon={<Download className="h-4 w-4" />}>CSV</Button>
          <Button variant="outline" onClick={() => router.back()} icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Total registrations" value={total} icon={Users} />
        <Metric label="Showing page" value={submissions.length} icon={CalendarDays} />
        <Metric label="Range" value={`${range} days`} icon={CalendarDays} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <ShellCard className="p-5">
          <h2 className="text-lg font-black text-[var(--color-text-primary)]">Latest registrations</h2>
          <div className="mt-4 space-y-3">
            {latestSubmissions.length > 0 ? latestSubmissions.map((submission) => (
              <article key={submission.id} className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="truncate text-sm font-black text-[var(--color-text-primary)]">{resolveFormSubmissionName(submission, 'Anonymous')}</p>
                <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{resolveFormSubmissionEmail(submission) || submission.contactNumber || 'No contact information'}</p>
                <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">{new Date(submission.createdAt).toLocaleString()}</p>
              </article>
            )) : <p className="text-sm text-[var(--color-text-tertiary)]">No registrations yet.</p>}
          </div>
        </ShellCard>

        <ShellCard className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-lg font-black text-[var(--color-text-primary)]">Registrations over time</h2><p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Daily series for the selected form.</p></div>
            <div className="flex gap-2"><Button variant={range === 7 ? 'primary' : 'outline'} size="sm" onClick={() => setRange(7)}>7 days</Button><Button variant={range === 30 ? 'primary' : 'outline'} size="sm" onClick={() => setRange(30)}>30 days</Button></div>
          </div>
          <div className="mt-5 h-[300px]"><Line data={chartData} options={{ maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }} /></div>
        </ShellCard>
      </div>

      <ShellCard className="p-5">
        <h2 className="mb-4 text-lg font-black text-[var(--color-text-primary)]">All submissions</h2>
        <DataTable data={sortedSubmissions} columns={columns} total={total} page={page} limit={limit} onPageChange={setPage} onLimitChange={setLimit} isLoading={false} />
      </ShellCard>
    </div>
  );
}

export default withAuth(SubmissionsPage, { requiredRole: 'admin' });
