'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
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

import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/layouts';
import { Panel } from '@/ui/Panel';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';
import { apiClient, triggerBlobDownload } from '@/lib/api';
import { getChartPalette } from '@/lib/charts/palette';
import {
  copyFormSubmissionsReportLink,
  exportFormSubmissionsCsv,
  exportFormSubmissionsPdf,
  exportFormSubmissionsXlsx,
  exportStructuredSubmissionsPdf,
  fetchAllFormSubmissions,
  filterFormSubmissions,
  resolveFormSubmissionEmail,
  resolveFormSubmissionName,
  serializeSubmissionValue,
  sortFormSubmissionsByCreatedAt,
  submissionHasMedia,
} from '@/lib/forms/formSubmissions';
import { buildFormAnalytics } from '@/lib/forms/formAnalytics';
import { SubmissionDetailModal } from './SubmissionDetailModal';
import type { AdminForm, FormSubmission, FormSubmissionDailyStat } from '@/lib/types';
import { useTheme } from '@/providers/ThemeProviders';
import { withAuth } from '@/providers/withAuth';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type RangeOption = 'all' | 7 | 30;

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
  const days = range === 'all' ? 30 : range;
  const { start, end } = buildDateRange(days);
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

function SubmissionsPage() {
  const { resolvedTheme } = useTheme();
  const chartPalette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);
  const router = useRouter();
  const params = useParams();
  const formId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  }, [params]);

  const [form, setForm] = useState<AdminForm | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<FormSubmission[]>([]);
  const [stats, setStats] = useState<FormSubmissionDailyStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filtering State
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<RangeOption>(7);
  const [onlyWithCode, setOnlyWithCode] = useState(false);
  const [onlyWithMedia, setOnlyWithMedia] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Export Loading States
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingServerPdf, setExportingServerPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  // Modal View
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);

  const load = useCallback(async () => {
    if (!formId) return;
    try {
      setLoading(true);
      const [formRes, subsRes, statsRes] = await Promise.all([
        apiClient.getAdminForm(formId),
        fetchAllFormSubmissions(formId).catch(async () => {
          const fallback = await apiClient.getFormSubmissions(formId, { page: 1, limit: 200 });
          return fallback.data || [];
        }),
        apiClient.getFormSubmissionStats(formId).catch(() => []),
      ]);
      setForm(formRes);
      setAllSubmissions(subsRes || []);
      setStats(Array.isArray(statsRes) ? statsRes : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load form submissions');
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Overall metric tallies
  const totalCount = allSubmissions.length;
  const withCodeCount = useMemo(
    () => allSubmissions.filter((s) => Boolean(s.registrationCode?.trim())).length,
    [allSubmissions]
  );
  const withMediaCount = useMemo(
    () => allSubmissions.filter((s) => submissionHasMedia(s)).length,
    [allSubmissions]
  );

  // Filtered dataset
  const filteredSubmissions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    let cutoff: Date | null = null;

    if (range === 7) {
      cutoff = new Date();
      cutoff.setDate(now.getDate() - 7);
    } else if (range === 30) {
      cutoff = new Date();
      cutoff.setDate(now.getDate() - 30);
    }

    return allSubmissions.filter((sub) => {
      if (onlyWithCode && !sub.registrationCode?.trim()) return false;
      if (onlyWithMedia && !submissionHasMedia(sub)) return false;

      if (cutoff) {
        const created = new Date(sub.createdAt);
        if (Number.isNaN(created.getTime()) || created < cutoff) return false;
      }

      if (term) {
        const valuesHaystack = Object.values(sub.values || {})
          .map((v) => serializeSubmissionValue(v))
          .join(' ')
          .toLowerCase();

        const match =
          (sub.name || '').toLowerCase().includes(term) ||
          (sub.email || '').toLowerCase().includes(term) ||
          (sub.contactNumber || '').toLowerCase().includes(term) ||
          (sub.contactAddress || '').toLowerCase().includes(term) ||
          (sub.registrationCode || '').toLowerCase().includes(term) ||
          valuesHaystack.includes(term);

        if (!match) return false;
      }

      return true;
    });
  }, [allSubmissions, search, range, onlyWithCode, onlyWithMedia]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, range, onlyWithCode, onlyWithMedia]);

  const sortedFilteredSubmissions = useMemo(() => {
    return sortFormSubmissionsByCreatedAt(filteredSubmissions);
  }, [filteredSubmissions]);

  // Paginated slice for current table view
  const paginatedSubmissions = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedFilteredSubmissions.slice(start, start + limit);
  }, [sortedFilteredSubmissions, page, limit]);

  const latestSubmissions = useMemo(() => {
    return sortFormSubmissionsByCreatedAt(allSubmissions).slice(0, 5);
  }, [allSubmissions]);

  // Chart
  const chartSeries = useMemo(() => fillDailySeries(range, stats), [range, stats]);
  const chartData = useMemo(
    () => ({
      labels: chartSeries.labels,
      datasets: [
        {
          label: 'Registrations',
          data: chartSeries.values,
          borderColor: chartPalette.series.amber.line,
          backgroundColor: chartPalette.series.amber.fill,
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    }),
    [chartSeries, chartPalette]
  );

  const isFilterActive =
    search.trim() !== '' || range !== 'all' || onlyWithCode || onlyWithMedia;

  const handleResetFilters = () => {
    setSearch('');
    setRange('all');
    setOnlyWithCode(false);
    setOnlyWithMedia(false);
  };

  const columns = useMemo<TableColumn<FormSubmission>[]>(
    () => [
      {
        key: 'name' as keyof FormSubmission,
        header: 'Attendee / Name',
        cell: (row: FormSubmission) => (
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 font-bold text-[var(--color-text-primary)]">
              {resolveFormSubmissionName(row, 'Anonymous Attendee')}
              {submissionHasMedia(row) ? (
                <span
                  title="Has uploaded media/document"
                  className="rounded bg-amber-100 p-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                >
                  <Paperclip className="h-3 w-3" />
                </span>
              ) : null}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {row.contactNumber || 'No phone'}
            </span>
          </div>
        ),
      },
      {
        key: 'email' as keyof FormSubmission,
        header: 'Email Address',
        cell: (row: FormSubmission) => (
          <span className="break-all font-medium text-[var(--color-text-secondary)]">
            {resolveFormSubmissionEmail(row) || '—'}
          </span>
        ),
      },
      {
        key: 'registrationCode' as keyof FormSubmission,
        header: 'Check-in Passcode',
        cell: (row: FormSubmission) =>
          row.registrationCode ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-xs font-bold text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
              {row.registrationCode}
            </span>
          ) : (
            <span className="text-xs text-[var(--color-text-tertiary)]">None</span>
          ),
      },
      {
        key: 'createdAt' as keyof FormSubmission,
        header: 'Submitted At',
        cell: (row: FormSubmission) => (
          <span className="text-xs text-[var(--color-text-secondary)]">
            {new Date(row.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        ),
      },
      {
        key: 'id' as keyof FormSubmission,
        header: 'Action',
        cell: (row: FormSubmission) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSubmission(row);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-accent-primary)] hover:text-[var(--color-accent-primary)]"
          >
            <Eye className="h-3.5 w-3.5" />
            Inspect
          </button>
        ),
      },
    ],
    []
  );

  const handleCopyLink = useCallback(async () => {
    if (!formId) return;
    try {
      await copyFormSubmissionsReportLink(formId);
      toast.success('Public report link copied to clipboard');
    } catch {
      toast.error('Failed to copy report link');
    }
  }, [formId]);

  // Executive Branded Structured PDF Export
  const handleExportStructuredPdf = useCallback(async () => {
    if (!formId) return;
    try {
      setExportingPdf(true);
      const exportForm =
        form?.id === formId && (form.fields?.length || 0) > 0
          ? form
          : await apiClient.getAdminForm(formId);

      const targetSubmissions =
        sortedFilteredSubmissions.length > 0 ? sortedFilteredSubmissions : allSubmissions;

      if (targetSubmissions.length === 0) {
        toast.error('No submissions available to export');
        return;
      }

      await exportStructuredSubmissionsPdf(targetSubmissions, {
        formTitle: exportForm.title || 'Form Submissions',
        formSlug: exportForm.slug,
        formId,
        fields: exportForm.fields,
        fileLabel: exportForm.title || formId,
      });

      toast.success(
        `Exported structured PDF dossier with ${targetSubmissions.length} submissions`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  }, [form, formId, sortedFilteredSubmissions, allSubmissions]);

  // Official Server-rendered Go Backend PDF Export
  const handleExportServerPdf = useCallback(async () => {
    if (!formId) return;
    try {
      setExportingServerPdf(true);
      const blob = await apiClient.downloadFormSubmissionsPdf(formId);
      const safeTitle = (form?.title || 'form')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      triggerBlobDownload(blob, `${safeTitle || 'submissions'}-official-backend.pdf`);
      toast.success('Official server PDF downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download server PDF');
    } finally {
      setExportingServerPdf(false);
    }
  }, [form?.title, formId]);

  // CSV Export
  const handleExportCsv = useCallback(async () => {
    if (!formId) return;
    try {
      setExportingCsv(true);
      const exportForm =
        form?.id === formId && (form.fields?.length || 0) > 0
          ? form
          : await apiClient.getAdminForm(formId);

      const targetSubmissions =
        sortedFilteredSubmissions.length > 0 ? sortedFilteredSubmissions : allSubmissions;

      if (targetSubmissions.length === 0) {
        toast.error('No submissions to export');
        return;
      }

      exportFormSubmissionsCsv(targetSubmissions, exportForm.title || formId, exportForm.fields);
      toast.success('CSV spreadsheet exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExportingCsv(false);
    }
  }, [form, formId, sortedFilteredSubmissions, allSubmissions]);

  // Excel (.xlsx) Multi-sheet Workbook Export
  const handleExportXlsx = useCallback(async () => {
    if (!formId) return;
    try {
      setExportingXlsx(true);
      const exportForm =
        form?.id === formId && (form.fields?.length || 0) > 0
          ? form
          : await apiClient.getAdminForm(formId);

      const targetSubmissions =
        sortedFilteredSubmissions.length > 0 ? sortedFilteredSubmissions : allSubmissions;

      if (targetSubmissions.length === 0) {
        toast.error('No submissions to export');
        return;
      }

      const analytics = buildFormAnalytics(targetSubmissions, exportForm.fields);
      await exportFormSubmissionsXlsx(
        targetSubmissions,
        { title: exportForm.title, fields: exportForm.fields },
        analytics,
        exportForm.title || formId
      );
      toast.success('Excel workbook downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export Excel');
    } finally {
      setExportingXlsx(false);
    }
  }, [form, formId, sortedFilteredSubmissions, allSubmissions]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-[var(--color-accent-primary)]" />
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Loading form submissions portal...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          title={form?.title ? `${form.title} — Submissions` : 'Form Submissions'}
          subtitle="Inspect attendee entries, verify check-in codes, search responses, and export executive reports."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={handleExportStructuredPdf}
            loading={exportingPdf}
            disabled={exportingPdf || totalCount === 0}
            icon={<Download className="h-4 w-4" />}
          >
            Export PDF Report
          </Button>
          <Button
            variant="outline"
            onClick={handleExportServerPdf}
            loading={exportingServerPdf}
            disabled={exportingServerPdf || totalCount === 0}
            icon={<FileDown className="h-4 w-4" />}
            title="Download official server-rendered PDF generated by backend"
          >
            Server PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleExportXlsx}
            loading={exportingXlsx}
            disabled={exportingXlsx || totalCount === 0}
            icon={<FileSpreadsheet className="h-4 w-4" />}
          >
            Excel
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCsv}
            loading={exportingCsv}
            disabled={exportingCsv || totalCount === 0}
            icon={<FileText className="h-4 w-4" />}
          >
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/forms/${formId}/report`)}
            icon={<BarChart3 className="h-4 w-4" />}
          >
            Analytics
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/forms/${formId}/campaigns`)}
            icon={<Send className="h-4 w-4" />}
          >
            Email Outreach
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyLink}
            icon={<Copy className="h-4 w-4" />}
            title="Copy public analytics link"
          >
            Copy Link
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/forms')}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Forms
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Registrations"
          value={totalCount}
          icon={<Users className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="Check-in Passcodes"
          value={withCodeCount}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Media Attachments"
          value={withMediaCount}
          icon={<Paperclip className="h-5 w-5" />}
        />
        <StatCard
          label="Filtered Matches"
          value={sortedFilteredSubmissions.length}
          icon={<Filter className="h-5 w-5" />}
          tone={isFilterActive ? 'warning' : 'default'}
        />
      </div>

      {/* Analytics Chart & Latest Registrations */}
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel>
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">
            Latest Registrations
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
            Recently received responses for this form
          </p>
          <div className="mt-4 space-y-2.5">
            {latestSubmissions.length > 0 ? (
              latestSubmissions.map((submission) => (
                <button
                  type="button"
                  key={submission.id}
                  onClick={() => setSelectedSubmission(submission)}
                  className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3.5 text-left transition hover:border-[var(--color-accent-primary)] hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold text-[var(--color-text-primary)]">
                      {resolveFormSubmissionName(submission, 'Anonymous Attendee')}
                      {submissionHasMedia(submission) ? (
                        <Paperclip className="h-3 w-3 text-amber-600" />
                      ) : null}
                    </p>
                    {submission.registrationCode ? (
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                        {submission.registrationCode}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                    {resolveFormSubmissionEmail(submission) ||
                      submission.contactNumber ||
                      'No contact info provided'}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                    {new Date(submission.createdAt).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </button>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-[var(--color-text-tertiary)]">
                No registrations received yet.
              </p>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                Registrations Over Time
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                Daily attendee enrollment activity series
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant={range === 7 ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setRange(7)}
              >
                7 days
              </Button>
              <Button
                variant={range === 30 ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setRange(30)}
              >
                30 days
              </Button>
              <Button
                variant={range === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setRange('all')}
              >
                All time
              </Button>
            </div>
          </div>
          <div className="mt-5 h-[260px]">
            {totalCount === 0 ? (
              <div className="grid h-full place-items-center text-center text-sm text-[var(--color-text-tertiary)]">
                No activity yet. This chart fills in automatically as submissions arrive.
              </div>
            ) : (
              <Line
                data={chartData}
                options={{
                  maintainAspectRatio: false,
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            )}
          </div>
        </Panel>
      </div>

      {/* Main Submissions Table & Live Search/Filter Controls */}
      <Panel>
        <div className="flex flex-col gap-4 border-b border-[var(--color-border-secondary)] pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                Attendee Records & Responses
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                Showing {sortedFilteredSubmissions.length} of {totalCount} total attendee submissions
              </p>
            </div>

            {/* Live Search Input */}
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone, code, answers..."
                className="h-10 w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] pl-10 pr-9 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] transition focus:border-[var(--color-accent-primary)] focus:outline-none"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Filter Pills & Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">
                Filters:
              </span>

              <button
                type="button"
                onClick={() => setRange(range === 'all' ? 7 : 'all')}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  range !== 'all'
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]'
                    : 'border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)]'
                }`}
              >
                <CalendarDays className="h-3 w-3" />
                {range === 'all' ? 'All dates' : `Past ${range} days`}
              </button>

              <button
                type="button"
                onClick={() => setOnlyWithCode(!onlyWithCode)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  onlyWithCode
                    ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    : 'border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)]'
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                Has Passcode ({withCodeCount})
              </button>

              <button
                type="button"
                onClick={() => setOnlyWithMedia(!onlyWithMedia)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  onlyWithMedia
                    ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    : 'border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)]'
                }`}
              >
                <Paperclip className="h-3 w-3" />
                Has Attachments ({withMediaCount})
              </button>
            </div>

            {isFilterActive ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-danger-text)] hover:underline"
              >
                <X className="h-3.5 w-3.5" />
                Clear all filters
              </button>
            ) : null}
          </div>
        </div>

        {/* Data Table with Clickable Rows */}
        <div className="mt-4">
          <Table
            data={paginatedSubmissions}
            columns={columns}
            rowKey={(row) => row.id}
            total={sortedFilteredSubmissions.length}
            page={page}
            pageSize={limit}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            onRowClick={(row) => setSelectedSubmission(row)}
            emptyTitle={
              isFilterActive
                ? 'No submissions matched your search filters'
                : 'No submissions recorded yet'
            }
            emptyDescription={
              isFilterActive
                ? 'Try broadening your search term or clearing date/attachment filters.'
                : 'As visitors or congregants submit this form, their full details and responses will appear here.'
            }
          />
        </div>
      </Panel>

      {/* Attendee Details & Single Receipt Download Modal */}
      <SubmissionDetailModal
        isOpen={selectedSubmission !== null}
        onClose={() => setSelectedSubmission(null)}
        submission={selectedSubmission}
        form={form}
      />
    </div>
  );
}

export default withAuth(SubmissionsPage, { requiredRole: 'admin' });
