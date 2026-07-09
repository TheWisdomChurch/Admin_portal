'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  Calendar,
  CheckCircle,
  Download,
  FileDown,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Panel } from '@/ui/Panel';
import { StatCard } from '@/ui/StatCard';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { apiClient } from '@/lib/api';
import type { ApprovalRequest, DashboardAnalytics } from '@/lib/types';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return numberFormatter.format(value);
}

function escapeCsv(value: unknown): string {
  const raw = String(value ?? '');
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
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
  const [selectedMonth, setSelectedMonth] = useState<string>(months[new Date().getMonth()]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, requestsRes] = await Promise.allSettled([
        apiClient.getAnalytics(),
        apiClient.listApprovalRequests({ limit: 200 }),
      ]);

      setAnalytics(analyticsRes.status === 'fulfilled' ? (analyticsRes.value as DashboardAnalytics) : null);
      setRequests(requestsRes.status === 'fulfilled' && Array.isArray(requestsRes.value) ? requestsRes.value : []);

      if (analyticsRes.status === 'rejected' || requestsRes.status === 'rejected') {
        toast.error('Some report sections could not be loaded.');
      }
    } catch (error) {
      console.error('Failed to load report workspace:', error);
      toast.error('Failed to load report workspace.');
      setAnalytics(null);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingRequests = useMemo(() => requests.filter((item) => item.status === 'pending').length, [requests]);
  const approvedRequests = useMemo(() => requests.filter((item) => item.status === 'approved').length, [requests]);
  const categoryEntries = useMemo(() => Object.entries(analytics?.eventsByCategory ?? {}).sort((a, b) => Number(b[1]) - Number(a[1])), [analytics?.eventsByCategory]);
  const monthlyRows = useMemo(() => analytics?.monthlyStats ?? [], [analytics?.monthlyStats]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const lines: string[] = [];
      lines.push(['Wisdom House Executive Report', selectedMonth, new Date().toISOString()].map(escapeCsv).join(','));
      lines.push('');
      lines.push(['Section', 'Metric', 'Value'].map(escapeCsv).join(','));
      lines.push(['Overview', 'Total events', analytics?.totalEvents ?? 0].map(escapeCsv).join(','));
      lines.push(['Overview', 'Upcoming events', analytics?.upcomingEvents ?? 0].map(escapeCsv).join(','));
      lines.push(['Overview', 'Total attendees', analytics?.totalAttendees ?? 0].map(escapeCsv).join(','));
      lines.push(['Approvals', 'Total requests', requests.length].map(escapeCsv).join(','));
      lines.push(['Approvals', 'Pending requests', pendingRequests].map(escapeCsv).join(','));
      lines.push(['Approvals', 'Approved requests', approvedRequests].map(escapeCsv).join(','));
      lines.push('');
      lines.push(['Category', 'Events'].map(escapeCsv).join(','));
      categoryEntries.forEach(([category, count]) => lines.push([category, count].map(escapeCsv).join(',')));
      lines.push('');
      lines.push(['Month', 'Events', 'Attendees'].map(escapeCsv).join(','));
      monthlyRows.forEach((row) => lines.push([row.month, row.events, row.attendees].map(escapeCsv).join(',')));
      lines.push('');
      lines.push(['Ticket', 'Type', 'Status', 'Label', 'Requester', 'Created'].map(escapeCsv).join(','));
      requests.forEach((request) => {
        lines.push([
          request.ticketCode,
          request.type,
          request.status,
          request.entityLabel || '',
          request.requestedByName || request.requestedByEmail || 'System',
          request.createdAt,
        ].map(escapeCsv).join(','));
      });

      downloadTextFile(`wisdom-executive-report-${selectedMonth.toLowerCase()}.csv`, lines.join('\n'));
      toast.success('Executive report exported as CSV.');
    } finally {
      setExporting(false);
    }
  };

  const handlePdfNotice = async () => {
    toast.error('PDF export is not available yet. The CSV export is active now.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Reports"
        subtitle="Executive summaries for events, attendance, content approvals, and platform governance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<RefreshCcw className="h-4 w-4" />} loading={loading} onClick={() => void load()}>
              Refresh
            </Button>
            <Button variant="outline" icon={<Download className="h-4 w-4" />} loading={exporting} onClick={handleExportCsv}>
              Export CSV
            </Button>
          </div>
        }
      />

      <Panel className="overflow-hidden" padded={false}>
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6 md:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
                <FileDown className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Executive reporting</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-[var(--color-text-primary)] md:text-3xl">
                  Super-admin command reports
                </h1>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--color-text-secondary)]">
                  Pull together data that only super admins should use for final decisions: operations, requests, approvals, and performance indicators.
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5 xl:border-l xl:border-t-0">
            <div className="rounded-3xl bg-[var(--color-background-primary)] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Report period</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="min-h-10 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 text-sm font-semibold text-[var(--color-text-primary)]"
                >
                  {months.map((month) => <option key={month} value={month}>{month}</option>)}
                </select>
                <Button icon={<FileDown className="h-4 w-4" />} onClick={handlePdfNotice}>
                  PDF
                </Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--color-text-tertiary)]">
                CSV is client-ready. PDF should be generated server-side for professional letterhead and audit records.
              </p>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Events" value={formatNumber(analytics?.totalEvents)} icon={<Calendar className="h-5 w-5" />} trend="Total tracked events." />
        <StatCard label="Registrations" value={formatNumber(analytics?.totalAttendees)} icon={<CheckCircle className="h-5 w-5" />} trend="Attendance/registration volume." tone="info" />
        <StatCard label="Pending requests" value={formatNumber(pendingRequests)} icon={<ShieldCheck className="h-5 w-5" />} trend="Approval tickets awaiting decision." tone="warning" />
        <StatCard label="Approved requests" value={formatNumber(approvedRequests)} icon={<BarChart2 className="h-5 w-5" />} trend="Completed approval decisions." tone="success" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card title="Governance snapshot">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
              <span className="text-sm text-[var(--color-text-secondary)]">Total tickets loaded</span>
              <strong className="text-[var(--color-text-primary)]">{requests.length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
              <span className="text-sm text-[var(--color-text-secondary)]">Pending executive action</span>
              <Badge variant={pendingRequests > 0 ? 'warning' : 'success'}>{pendingRequests}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
              <span className="text-sm text-[var(--color-text-secondary)]">Categories tracked</span>
              <strong className="text-[var(--color-text-primary)]">{categoryEntries.length}</strong>
            </div>
          </div>
        </Card>

        <Card title="Monthly summary">
          <div className="overflow-hidden rounded-3xl border border-[var(--color-border-secondary)]">
            <div className="hidden grid-cols-3 bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] md:grid">
              <div>Month</div><div>Events</div><div>Attendees</div>
            </div>
            <div className="divide-y divide-[var(--color-border-secondary)]">
              {monthlyRows.length === 0 ? (
                <div className="p-5 text-sm text-[var(--color-text-tertiary)]">No monthly stats available yet.</div>
              ) : (
                monthlyRows.map((row) => (
                  <div key={row.month} className="grid gap-2 px-4 py-4 text-sm md:grid-cols-3 md:items-center">
                    <div className="font-black text-[var(--color-text-primary)]">{row.month}</div>
                    <div className="text-[var(--color-text-secondary)]">{formatNumber(row.events)}</div>
                    <div className="text-[var(--color-text-secondary)]">{formatNumber(row.attendees)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default withAuth(ReportsPage, { requiredRole: 'super_admin' });
