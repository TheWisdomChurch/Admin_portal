'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  ListChecks,
  RefreshCw,
  Table as TableIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/ui/Button';
import { PageHeader } from '@/layouts';
import { Panel } from '@/ui/Panel';
import { StatCard } from '@/ui/StatCard';
import { apiClient } from '@/lib/api';
import { getChartPalette } from '@/lib/charts/palette';
import { buildFormAnalytics, type Severity } from '@/lib/forms/formAnalytics';
import {
  exportFormReportPdf,
  exportFormSubmissionsCsv,
  exportFormSubmissionsXlsx,
  fetchAllFormSubmissions,
  filterFormSubmissions,
} from '@/lib/forms/formSubmissions';
import type { AdminForm, FormSubmission } from '@/lib/types';
import { useTheme } from '@/providers/ThemeProviders';
import { withAuth } from '@/providers/withAuth';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const SEVERITY_STYLES: Record<
  Severity,
  { icon: typeof Info; className: string }
> = {
  info: { icon: Info, className: 'text-[var(--color-text-secondary)]' },
  warn: { icon: AlertTriangle, className: 'text-amber-600' },
  critical: { icon: AlertTriangle, className: 'text-red-600' },
};

function FormReportPage() {
  const { resolvedTheme } = useTheme();
  const palette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);
  const router = useRouter();
  const params = useParams();
  const formId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  }, [params]);

  const [form, setForm] = useState<AdminForm | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | 'csv' | null>(null);

  const load = useCallback(async () => {
    if (!formId) return;
    try {
      setLoading(true);
      const [formRes, all] = await Promise.all([
        apiClient.getAdminForm(formId),
        fetchAllFormSubmissions(formId),
      ]);
      setForm(formRes);
      setSubmissions(filterFormSubmissions(all));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  const analytics = useMemo(
    () => buildFormAnalytics(submissions, form?.fields),
    [submissions, form?.fields]
  );

  const breakdownFields = useMemo(
    () => analytics.fields.filter((f) => f.ageGroups || f.options),
    [analytics.fields]
  );

  const trendData = useMemo(
    () => ({
      labels: analytics.dailySeries.map((d) => d.date.slice(5)),
      datasets: [
        {
          label: 'Submissions',
          data: analytics.dailySeries.map((d) => d.count),
          borderColor: palette.series.amber.line,
          backgroundColor: palette.series.amber.fill,
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    }),
    [analytics.dailySeries, palette]
  );

  const runExport = async (kind: 'pdf' | 'xlsx' | 'csv') => {
    if (!form) return;
    try {
      setBusy(kind);
      if (kind === 'pdf') await exportFormReportPdf(analytics, form, form.title);
      else if (kind === 'xlsx')
        await exportFormSubmissionsXlsx(
          submissions,
          { title: form.title, fields: form.fields },
          analytics,
          form.title
        );
      else exportFormSubmissionsCsv(submissions, form.title, form.fields);
      toast.success(`${kind.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-[var(--color-text-tertiary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          title="Form Report"
          subtitle={form ? form.title : 'Submission analysis'}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/forms/${formId}/submissions`)} icon={<TableIcon className="h-4 w-4" />}>
            All submissions
          </Button>
          <Button variant="outline" loading={busy === 'pdf'} disabled={busy !== null} onClick={() => void runExport('pdf')} icon={<Download className="h-4 w-4" />}>
            PDF report
          </Button>
          <Button variant="outline" loading={busy === 'xlsx'} disabled={busy !== null} onClick={() => void runExport('xlsx')} icon={<FileSpreadsheet className="h-4 w-4" />}>
            Excel
          </Button>
          <Button variant="outline" loading={busy === 'csv'} disabled={busy !== null} onClick={() => void runExport('csv')} icon={<Download className="h-4 w-4" />}>
            CSV
          </Button>
          <Button variant="outline" onClick={() => router.back()} icon={<ArrowLeft className="h-4 w-4" />}>
            Back
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total submissions" value={analytics.total} tone="info" />
        <StatCard
          label="Last 7 days"
          value={analytics.last7}
          trend={
            analytics.trend7 === null
              ? undefined
              : `${analytics.trend7 > 0 ? '+' : ''}${analytics.trend7}% vs previous 7`
          }
        />
        <StatCard label="Completion rate" value={`${Math.round(analytics.completionRate * 100)}%`} />
        <StatCard label="Avg. questions answered" value={analytics.avgFieldsCompleted} />
      </div>

      <Panel>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Submissions over time</h2>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          Last 30 days.
          {analytics.busiestWeekday ? ` Most submissions come in on ${analytics.busiestWeekday}.` : ''}
        </p>
        <div className="mt-5 h-[280px]">
          <Line
            data={trendData}
            options={{
              maintainAspectRatio: false,
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
            }}
          />
        </div>
      </Panel>

      {breakdownFields.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {breakdownFields.map((field) => {
            const entries = field.ageGroups
              ? field.ageGroups.map((g) => ({ label: g.bucket, count: g.count, percent: g.percent }))
              : (field.options || []).map((o) => ({ label: o.label, count: o.count, percent: o.percent }));
            const isGender = /gender|sex/i.test(field.label);
            return (
              <Panel key={field.key}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-[var(--color-text-primary)]">{field.label}</h3>
                  <span className="shrink-0 text-xs font-semibold text-[var(--color-text-tertiary)]">
                    {field.responded} answered · {Math.round(field.responseRate * 100)}%
                    {field.meanAgeYears !== undefined ? ` · avg age ${field.meanAgeYears}` : ''}
                  </span>
                </div>
                <div className="mt-4 h-[240px]">
                  {isGender ? (
                    <Doughnut
                      data={{
                        labels: entries.map((e) => e.label),
                        datasets: [
                          {
                            data: entries.map((e) => e.count),
                            backgroundColor: entries.map(
                              (_, i) => palette.categorical[i % palette.categorical.length]
                            ),
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                    />
                  ) : (
                    <Bar
                      data={{
                        labels: entries.map((e) => e.label),
                        datasets: [
                          {
                            label: 'Responses',
                            data: entries.map((e) => e.count),
                            backgroundColor: palette.series.amber.line,
                            borderRadius: 8,
                          },
                        ],
                      }}
                      options={{
                        indexAxis: 'y' as const,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
                      }}
                    />
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      ) : null}

      <Panel>
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-text-primary)]">
          <ListChecks className="h-5 w-5" /> Data quality &amp; recommendations
        </h2>
        <ul className="mt-4 space-y-4">
          {analytics.recommendations.map((rec, index) => {
            const style = SEVERITY_STYLES[rec.severity];
            const Icon = rec.severity === 'info' && rec.title === 'Nothing to flag' ? CheckCircle2 : style.icon;
            return (
              <li key={`${rec.title}-${index}`} className="flex gap-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.className}`} />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{rec.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{rec.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

export default withAuth(FormReportPage, { requiredRole: 'admin' });
