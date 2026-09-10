'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Download,
  FileDown,
  FileSpreadsheet,
  RefreshCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Panel } from '@/ui/Panel';
import { Select } from '@/ui/Select';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { useChurchOverview } from '@/hooks/useChurchOverview';
import {
  buildExecutiveReportCsv,
  downloadExecutiveReportPdf,
  downloadExecutiveReportXlsx,
} from '@/lib/executiveReport';
import {
  formatDeltaPct,
  formatNaira,
} from '@/lib/analytics/churchOverview';
import {
  AttentionPanel,
  ChurchOverviewKpis,
  ReadinessPanel,
} from '@/features/analytics/ChurchOverviewSections';

const PERIOD_LABELS: Record<string, string> = {
  month: `${new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`,
  last30: 'Last 30 days',
  year: `${new Date().getFullYear()}`,
};

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const { overview, loading, refreshedAt, refresh } = useChurchOverview();
  const [period, setPeriod] = useState<'month' | 'last30' | 'year'>('month');
  const [exporting, setExporting] = useState<'csv' | 'pdf' | 'xlsx' | null>(null);

  const periodLabel = PERIOD_LABELS[period];

  const monthlyRows = useMemo(() => overview?.monthly.members ?? [], [overview]);

  const runExport = async (kind: 'csv' | 'pdf' | 'xlsx') => {
    if (!overview) return;
    setExporting(kind);
    try {
      if (kind === 'csv') {
        downloadTextFile(
          `wisdom-house-executive-report-${period}.csv`,
          buildExecutiveReportCsv(overview, periodLabel)
        );
      } else if (kind === 'pdf') {
        await downloadExecutiveReportPdf(overview, periodLabel);
      } else {
        await downloadExecutiveReportXlsx(overview, periodLabel);
      }
      toast.success(`${kind.toUpperCase()} downloaded`);
    } catch (error) {
      console.error('Executive export failed:', error);
      toast.error('The export could not be generated. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Reports"
        subtitle="A church-wide executive summary — growth, giving, engagement backlogs, and decision readiness — ready to export for leadership."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<RefreshCcw className="h-4 w-4" />} loading={loading} onClick={() => void refresh()}>
              Refresh
            </Button>
            <Link
              href="/dashboard/super/analytics"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
            >
              <BarChart3 className="h-4 w-4" /> Live analytics
            </Link>
          </div>
        }
      />

      <Panel className="overflow-hidden" padded={false}>
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6 md:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Executive reporting</p>
            <h1 className="heading-page mt-2 text-[var(--color-text-primary)]">Church health report</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)]">
              One compiled view for final decisions: how the church is growing, where giving stands, what is waiting on the team, and what to act on next.
              {overview && overview.missing.length > 0
                ? ` Partial — could not load: ${overview.missing.join(', ')}.`
                : ''}
            </p>
            {refreshedAt ? (
              <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">Data as of {refreshedAt.toLocaleString('en-GB')}</p>
            ) : null}
          </div>
          <div className="border-t border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5 xl:border-l xl:border-t-0">
            <div className="rounded-3xl bg-[var(--color-background-primary)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Report period</p>
              <Select
                className="mt-3"
                value={period}
                onChange={(event) => setPeriod(event.target.value as 'month' | 'last30' | 'year')}
              >
                <option value="month">This month</option>
                <option value="last30">Last 30 days</option>
                <option value="year">This year</option>
              </Select>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} loading={exporting === 'csv'} disabled={!overview || exporting !== null} onClick={() => void runExport('csv')}>
                  CSV
                </Button>
                <Button variant="outline" size="sm" icon={<FileSpreadsheet className="h-4 w-4" />} loading={exporting === 'xlsx'} disabled={!overview || exporting !== null} onClick={() => void runExport('xlsx')}>
                  Excel
                </Button>
                <Button size="sm" icon={<FileDown className="h-4 w-4" />} loading={exporting === 'pdf'} disabled={!overview || exporting !== null} onClick={() => void runExport('pdf')}>
                  PDF
                </Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--color-text-tertiary)]">
                PDF for leadership, Excel for analysis, CSV for a quick pull.
              </p>
            </div>
          </div>
        </div>
      </Panel>

      {loading && !overview ? (
        <Panel>
          <div className="h-40 animate-pulse rounded-xl bg-[var(--color-background-tertiary)]" />
        </Panel>
      ) : overview ? (
        <>
          <ChurchOverviewKpis overview={overview} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <AttentionPanel overview={overview} />
            <ReadinessPanel overview={overview} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card title="Giving">
              {overview.giving.hasData ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
                    <span className="text-[var(--color-text-secondary)]">This month</span>
                    <strong className="text-[var(--color-text-primary)]">{formatNaira(overview.giving.thisMonthNaira)}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
                    <span className="text-[var(--color-text-secondary)]">Last month</span>
                    <strong className="text-[var(--color-text-primary)]">{formatNaira(overview.giving.lastMonthNaira)}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
                    <span className="text-[var(--color-text-secondary)]">Year to date</span>
                    <strong className="text-[var(--color-text-primary)]">{formatNaira(overview.giving.ytdNaira)}</strong>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {formatDeltaPct(overview.giving.trend.deltaPct)} vs last month. Recorded successful giving only.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-tertiary)]">No giving has been recorded yet.</p>
              )}
            </Card>

            <Card title="12-month trend">
              <div className="overflow-hidden rounded-3xl border border-[var(--color-border-secondary)]">
                <div className="grid grid-cols-4 bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                  <div>Month</div><div>New members</div><div>Intake</div><div>Giving (₦)</div>
                </div>
                <div className="divide-y divide-[var(--color-border-secondary)]">
                  {monthlyRows.map((row, i) => (
                    <div key={row.key} className="grid grid-cols-4 px-4 py-3 text-sm">
                      <div className="font-semibold text-[var(--color-text-primary)]">{row.label}</div>
                      <div className="text-[var(--color-text-secondary)]">{row.value}</div>
                      <div className="text-[var(--color-text-secondary)]">{overview.monthly.newMemberIntake[i]?.value ?? 0}</div>
                      <div className="text-[var(--color-text-secondary)]">{(overview.monthly.giving[i]?.value ?? 0).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <Card title="Form intake">
            <div className="overflow-hidden rounded-3xl border border-[var(--color-border-secondary)]">
              <div className="grid grid-cols-[minmax(0,1fr)_120px] bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                <div>Form</div><div>Submissions</div>
              </div>
              <div className="divide-y divide-[var(--color-border-secondary)]">
                {overview.intake.perForm.length === 0 ? (
                  <div className="p-5 text-sm text-[var(--color-text-tertiary)]">No form submissions yet.</div>
                ) : (
                  overview.intake.perForm.map((f) => (
                    <div key={f.formId} className="grid grid-cols-[minmax(0,1fr)_120px] px-4 py-3 text-sm">
                      <div className="truncate font-semibold text-[var(--color-text-primary)]">{f.title}</div>
                      <div className="text-[var(--color-text-secondary)]">{f.count}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card title="Report unavailable">
          <p className="text-sm text-[var(--color-text-secondary)]">
            The analytics sources did not respond. Check the API connection and refresh.
          </p>
        </Card>
      )}
    </div>
  );
}

export default withAuth(ReportsPage, { requiredRole: 'super_admin' });
