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
import { Clipboard, ExternalLink, FileSpreadsheet, FileText, Plus, RefreshCw, Search, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { Panel } from '@/ui/Panel';
import { StatCard } from '@/ui/StatCard';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import { getChartPalette } from '@/lib/charts/palette';
import { buildNewMembersExcelXml, toNewMemberExportRecord, type NewMemberExportRecord } from '@/lib/newMemberExports';
import { useTheme } from '@/providers/ThemeProviders';
import { withAuth } from '@/providers/withAuth';
import type { AdminUserAdmin, NewMemberContact, NewMemberDashboardResponse, NewMemberFormSummary, NewMemberSubmission, NewMemberWorkflow, NewMemberWorkflowStage } from '@/lib/types';

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

function downloadFile(filename: string, content: BlobPart, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'new-member';
}

async function downloadMembersPdf(records: NewMemberExportRecord[], filename: string) {
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 18;
  let y = 20;

  const addPageHeader = () => {
    document.setFillColor(202, 138, 4);
    document.rect(0, 0, pageWidth, 5, 'F');
    document.setTextColor(28, 25, 23);
    document.setFont('helvetica', 'bold');
    document.setFontSize(18);
    document.text(records.length === 1 ? 'New Member Profile' : 'New Members Directory', margin, 18);
    document.setFont('helvetica', 'normal');
    document.setTextColor(87, 83, 78);
    document.setFontSize(9);
    document.text(`Prepared ${new Date().toLocaleString('en-GB')} · ${records.length} ${records.length === 1 ? 'record' : 'records'}`, margin, 24);
    y = 34;
  };

  addPageHeader();
  records.forEach((record, recordIndex) => {
    if (y > pageHeight - 40) { document.addPage(); addPageHeader(); }
    document.setFillColor(250, 250, 249);
    document.roundedRect(margin, y - 6, pageWidth - margin * 2, 12, 2, 2, 'F');
    document.setFont('helvetica', 'bold');
    document.setTextColor(28, 25, 23);
    document.setFontSize(12);
    document.text(record.displayName, margin + 4, y + 1.5);
    y += 13;

    record.fields.filter((field) => field.label !== 'Full Name').forEach((field) => {
      const valueLines = document.splitTextToSize(field.value, pageWidth - margin * 2 - 52) as string[];
      const rowHeight = Math.max(7, valueLines.length * 4.5 + 2);
      if (y + rowHeight > pageHeight - 18) { document.addPage(); addPageHeader(); }
      document.setFont('helvetica', 'bold');
      document.setTextColor(87, 83, 78);
      document.setFontSize(8.5);
      document.text(field.label, margin + 4, y);
      document.setFont('helvetica', 'normal');
      document.setTextColor(41, 37, 36);
      document.setFontSize(9.5);
      document.text(valueLines, margin + 50, y);
      y += rowHeight;
    });
    if (recordIndex < records.length - 1) y += 6;
  });

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setFontSize(8);
    document.setTextColor(120, 113, 108);
    document.text(`The Wisdom Church · New Members · Page ${page} of ${pageCount}`, margin, pageHeight - 8);
  }
  document.save(filename);
}

function FormLinkRow({ form }: { form: NewMemberFormSummary }) {
  const publicUrl = buildPublicFormUrl(form.slug);

  const copy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Form link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  return (
    <article className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{form.formTitle}</p></div>
        <Badge variant={form.isPublished ? 'success' : 'secondary'}>{form.isPublished ? 'Live' : 'Draft'}</Badge>
      </div>

      {publicUrl ? (
        <div className="mt-3 flex items-center gap-1 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] py-1 pl-3 pr-1 text-xs">
          <span className="truncate font-mono text-[var(--color-text-secondary)]">{publicUrl}</span>
          <button type="button" onClick={() => void copy()} aria-label="Copy public form link" className="shrink-0 rounded-full p-1.5 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]">
            <Clipboard className="h-3.5 w-3.5" />
          </button>
          <a href={publicUrl} target="_blank" rel="noreferrer" aria-label="Open public form" className="shrink-0 rounded-full p-1.5 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : (
        <p className="mt-3 truncate text-xs text-[var(--color-text-tertiary)]">No slug configured for this form yet.</p>
      )}

      <p className="mt-3 text-sm font-semibold text-[var(--color-text-secondary)]">{form.submissionCount} submissions</p>
    </article>
  );
}

function NewMembersPage() {
  const { resolvedTheme } = useTheme();
  const chartPalette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);
  const [dashboard, setDashboard] = useState<NewMemberDashboardResponse | null>(null);
  const [submissions, setSubmissions] = useState<NewMemberSubmission[]>([]);
  const [workflows, setWorkflows] = useState<NewMemberWorkflow[]>([]);
  const [workflowStages, setWorkflowStages] = useState<Record<string, NewMemberWorkflowStage>>({});
  const [workflowOwners, setWorkflowOwners] = useState<Record<string, string>>({});
  const [workflowNextActions, setWorkflowNextActions] = useState<Record<string, string>>({});
  const [contactDrafts, setContactDrafts] = useState<Record<string, { channel: NewMemberContact['channel']; outcome: string; notes: string }>>({});
  const [adminUsers, setAdminUsers] = useState<AdminUserAdmin[]>([]);
  const [savingWorkflow, setSavingWorkflow] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [section, setSection] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [dashboardRes, submissionsRes, workflowsRes, usersRes] = await Promise.all([
        apiClient.getNewMemberDashboard(),
        apiClient.listNewMemberSubmissions({ page: 1, limit: 100 }),
        apiClient.listNewMemberWorkflows({ page: 1, limit: 100 }),
        apiClient.listAdminUsers(),
      ]);
      setDashboard(dashboardRes);
      setSubmissions(submissionsRes.data);
      setWorkflows(workflowsRes.data);
      setWorkflowStages(Object.fromEntries(workflowsRes.data.map((item) => [item.id, item.stage])));
      setWorkflowOwners(Object.fromEntries(workflowsRes.data.map((item) => [item.id, item.assignedOwnerId || ''])));
      setWorkflowNextActions(Object.fromEntries(workflowsRes.data.map((item) => [item.id, item.nextActionAt ? item.nextActionAt.slice(0, 16) : ''])));
      setAdminUsers(usersRes.filter((item) => item.is_active && item.admin_approved));
    } catch (error) {
      console.error('Failed to load new member dashboard:', error);
      toast.error('Unable to load new-member dashboard. Please sign in again if your session expired.');
      setDashboard(null);
      setSubmissions([]);
      setWorkflows([]);
      setAdminUsers([]);
      setLoadError(true);
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
  const primaryForm = useMemo(() => dashboard?.forms?.find((form) => form.isPublished && form.slug) || dashboard?.forms?.find((form) => form.slug), [dashboard]);
  const primaryFormUrl = buildPublicFormUrl(primaryForm?.slug);
  const submissionsById = useMemo(() => new Map(submissions.map((item) => [item.id, item])), [submissions]);

  const saveWorkflowStage = async (workflow: NewMemberWorkflow) => {
    const stage = workflowStages[workflow.id] || workflow.stage;
    const owner = workflowOwners[workflow.id] ?? workflow.assignedOwnerId ?? '';
    const nextAction = workflowNextActions[workflow.id];
    setSavingWorkflow(workflow.id);
    try {
      const updated = await apiClient.updateNewMemberWorkflow(workflow.id, { stage, assignedOwnerId: owner, nextActionAt: nextAction ? new Date(nextAction).toISOString() : undefined });
      setWorkflows((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success('Follow-up stage updated.');
    } catch (error) {
      console.error('Workflow update failed:', error);
      toast.error('Unable to update the persisted workflow.');
    } finally {
      setSavingWorkflow(null);
    }
  };

  const recordContact = async (workflow: NewMemberWorkflow) => {
    const draft = contactDrafts[workflow.id] || { channel: 'phone' as const, outcome: '', notes: '' };
    if (!draft.outcome.trim()) return toast.error('Enter the real contact outcome.');
    setSavingWorkflow(workflow.id);
    try {
      await apiClient.addNewMemberContact(workflow.id, { channel: draft.channel, outcome: draft.outcome.trim(), notes: draft.notes.trim() || undefined });
      setContactDrafts((current) => ({ ...current, [workflow.id]: { channel: 'phone', outcome: '', notes: '' } }));
      await load();
      toast.success('Contact history recorded.');
    } catch (error) {
      console.error('Contact history update failed:', error);
      toast.error('Unable to persist the contact history.');
    } finally { setSavingWorkflow(null); }
  };

  const exportPdf = async (items: NewMemberSubmission[]) => {
    if (items.length === 0) return toast.error('There are no member details to export.');
    setExporting('pdf');
    try {
      const records = items.map(toNewMemberExportRecord);
      const filename = items.length === 1 ? `${safeFilename(records[0].displayName)}.pdf` : 'new-members-directory.pdf';
      await downloadMembersPdf(records, filename);
      toast.success(items.length === 1 ? 'Member PDF downloaded.' : 'New members PDF downloaded.');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('Unable to create the PDF right now.');
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = (items: NewMemberSubmission[]) => {
    if (items.length === 0) return toast.error('There are no member details to export.');
    setExporting('excel');
    try {
      const records = items.map(toNewMemberExportRecord);
      const filename = items.length === 1 ? `${safeFilename(records[0].displayName)}-excel.xml` : 'new-members-excel.xml';
      downloadFile(filename, buildNewMembersExcelXml(records), 'application/vnd.ms-excel;charset=utf-8');
      toast.success(items.length === 1 ? 'Member Excel file downloaded.' : 'New members Excel file downloaded.');
    } catch (error) {
      console.error('Excel export failed:', error);
      toast.error('Unable to create the Excel file right now.');
    } finally {
      setExporting(null);
    }
  };

  const growthSets = useMemo(() => ({
    weekly: dashboard?.weeklyGrowth?.slice(-12) || [],
    monthly: dashboard?.monthlyGrowth?.slice(-12) || [],
    quarterly: dashboard?.quarterlyGrowth?.slice(-8) || [],
    yearly: dashboard?.yearlyGrowth?.slice(-6) || [],
  }), [dashboard]);

  const activeGrowth = growthSets[section] as GrowthPoint[];
  const chartData = useMemo(() => ({
    labels: activeGrowth.map((item) => shortPeriod(item.period, section === 'yearly' ? 'Year' : section === 'quarterly' ? 'Quarter' : undefined)),
    datasets: [{ label: 'New members', data: activeGrowth.map((item) => item.count), backgroundColor: chartPalette.series.blue.line, borderRadius: 10, maxBarThickness: 36 }],
  }), [activeGrowth, section, chartPalette]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Members"
        subtitle="Intake, growth trends, and follow-up records, separated from the main member registry."
        actions={<div className="flex flex-wrap gap-2"><Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()} loading={loading}>Refresh</Button>{primaryFormUrl ? <Button icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.open(primaryFormUrl, '_blank', 'noopener,noreferrer')}>Open member form</Button> : <Button icon={<Plus className="h-4 w-4" />} onClick={() => window.location.assign('/dashboard/forms/new?preset=member')}>Prepare form</Button>}</div>}
      />

      {loadError ? <Panel className="border-[var(--color-danger-border)] bg-[var(--color-danger-surface)]"><p className="text-sm font-semibold text-[var(--color-danger-text)]">Authoritative new-member data is unavailable. No substitute or placeholder values are being shown.</p></Panel> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total" value={dashboard ? dashboard.totalSubmissions : 'Unavailable'} trend="All intake submissions" />
        <StatCard label="This week" value={dashboard ? dashboard.thisWeek : 'Unavailable'} trend="Current week intake" />
        <StatCard label="This month" value={dashboard ? dashboard.thisMonth : 'Unavailable'} trend="Current month intake" />
        <StatCard label="This quarter" value={dashboard ? dashboard.thisQuarter : 'Unavailable'} trend="Quarterly movement" />
        <StatCard label="This year" value={dashboard ? dashboard.thisYear : 'Unavailable'} trend="Annual growth" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">New-member growth</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Switch between available periods.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((key) => <Button key={key} size="sm" variant={section === key ? 'primary' : 'outline'} onClick={() => setSection(key)}>{key}</Button>)}
            </div>
          </div>
          <div className="mt-5 h-80">
            {activeGrowth.length === 0 ? <p className="text-sm text-[var(--color-text-tertiary)]">{loadError ? 'Growth data unavailable.' : 'No growth data has been recorded.'}</p> : <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }} />}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Add New Member forms</h2>
          <div className="mt-4 space-y-3">
            {(dashboard?.forms || []).length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--color-border-secondary)] p-4 text-center">
                <p className="text-sm text-[var(--color-text-tertiary)]">No Add New Member form detected.</p>
                <Button size="sm" className="mt-3" icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.location.assign('/dashboard/forms/new?preset=member')}>
                  Prepare form
                </Button>
              </div>
            ) : (
              dashboard?.forms.map((form) => <FormLinkRow key={form.formId} form={form} />)
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-bold text-[var(--color-text-primary)]">Automated follow-up queue</h2><p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Persisted ownership, next actions, reminders, and escalation state from the backend.</p></div>
          <Badge variant={workflows.some((item) => item.escalationStatus === 'escalated') ? 'danger' : 'success'}>{workflows.filter((item) => item.escalationStatus === 'escalated').length} escalated</Badge>
        </div>
        <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--color-border-secondary)]">
          <div className="hidden grid-cols-[minmax(180px,1fr)_180px_180px_190px_120px] gap-4 bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] lg:grid">
            <div>Member</div><div>Stage</div><div>Owner</div><div>Next action</div><div>State</div>
          </div>
          <div className="divide-y divide-[var(--color-border-secondary)]">
            {!loading && workflows.length === 0 ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">{loadError ? 'Workflow data unavailable.' : 'No persisted workflows have been created.'}</div> : null}
            {workflows.map((workflow) => {
              const submission = submissionsById.get(workflow.submissionId);
              const draft = contactDrafts[workflow.id] || { channel: 'phone' as const, outcome: '', notes: '' };
              return <article key={workflow.id} className="px-4 py-4"><div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_180px_180px_190px_120px] lg:items-center">
                <div><p className="text-sm font-bold text-[var(--color-text-primary)]">{submission ? displayName(submission) : workflow.submissionId}</p><p className="text-xs text-[var(--color-text-tertiary)]">{workflow.assignedOwnerName || (workflow.assignedOwnerId ? `Owner ${workflow.assignedOwnerId}` : 'Unassigned')}</p></div>
                <Select aria-label="Follow-up stage" value={workflowStages[workflow.id] || workflow.stage} onChange={(event) => setWorkflowStages((current) => ({ ...current, [workflow.id]: event.target.value as NewMemberWorkflowStage }))}><option value="new">New</option><option value="contact_attempted">Contact attempted</option><option value="contacted">Contacted</option><option value="orientation_scheduled">Orientation scheduled</option><option value="orientation_completed">Orientation completed</option><option value="integrated">Integrated</option><option value="closed">Closed</option></Select>
                <Select aria-label="Assigned owner" value={workflowOwners[workflow.id] || ''} onChange={(event) => setWorkflowOwners((current) => ({ ...current, [workflow.id]: event.target.value }))}><option value="">Unassigned</option>{adminUsers.map((user) => <option key={user.id} value={user.id}>{user.first_name} {user.last_name}</option>)}</Select>
                <Input type="datetime-local" aria-label="Next follow-up action" value={workflowNextActions[workflow.id] || ''} onChange={(event) => setWorkflowNextActions((current) => ({ ...current, [workflow.id]: event.target.value }))} />
                <div className="flex items-center gap-2"><Badge variant={workflow.escalationStatus === 'escalated' ? 'danger' : workflow.escalationStatus === 'due' ? 'warning' : 'secondary'}>{workflow.escalationStatus}</Badge><Button size="sm" loading={savingWorkflow === workflow.id} onClick={() => void saveWorkflowStage(workflow)}>Save</Button></div>
              </div><details className="mt-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3"><summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">Record contact</summary><div className="mt-3 grid gap-3 md:grid-cols-[150px_1fr_1fr_auto]"><Select aria-label="Contact channel" value={draft.channel} onChange={(event) => setContactDrafts((current) => ({ ...current, [workflow.id]: { ...draft, channel: event.target.value as NewMemberContact['channel'] } }))}><option value="phone">Phone</option><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="in_person">In person</option><option value="other">Other</option></Select><Input placeholder="Actual outcome" value={draft.outcome} onChange={(event) => setContactDrafts((current) => ({ ...current, [workflow.id]: { ...draft, outcome: event.target.value } }))} /><Input placeholder="Notes (optional)" value={draft.notes} onChange={(event) => setContactDrafts((current) => ({ ...current, [workflow.id]: { ...draft, notes: event.target.value } }))} /><Button loading={savingWorkflow === workflow.id} onClick={() => void recordContact(workflow)}>Record</Button></div></details></article>;
            })}
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-bold text-[var(--color-text-primary)]">Period summaries</h2><p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Compact accordions prevent dashboard overcrowding.</p></div>
          <TrendingUp className="h-5 w-5 text-[var(--color-text-tertiary)]" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <GrowthAccordion title="Weekly" data={growthSets.weekly} />
          <GrowthAccordion title="Monthly" data={growthSets.monthly} open />
          <GrowthAccordion title="Quarterly" data={growthSets.quarterly} />
          <GrowthAccordion title="Yearly" data={growthSets.yearly} />
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-bold text-[var(--color-text-primary)]">Add New Member submissions</h2><p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Latest form-driven intake records. Downloads contain readable member information only.</p></div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" icon={<FileText className="h-4 w-4" />} loading={exporting === 'pdf'} disabled={loading || filtered.length === 0 || exporting !== null} onClick={() => void exportPdf(filtered)}>Download PDF</Button><Button size="sm" variant="outline" icon={<FileSpreadsheet className="h-4 w-4" />} loading={exporting === 'excel'} disabled={loading || filtered.length === 0 || exporting !== null} onClick={() => exportExcel(filtered)}>Download Excel</Button></div><div className="relative w-full sm:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" /><Input aria-label="Search new member submissions" className="pl-9" placeholder="Search submissions" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--color-border-secondary)]">
          <div className="hidden grid-cols-[minmax(200px,1fr)_minmax(200px,1fr)_150px_160px_110px] gap-4 bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] lg:grid">
            <div>Profile</div><div>Contact</div><div>Source</div><div>Submitted</div><div className="text-right">Download</div>
          </div>
          <div className="divide-y divide-[var(--color-border-secondary)]">
            {loading ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">Loading new members...</div> : null}
            {!loading && filtered.length === 0 ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">{loadError ? 'Submission data unavailable.' : 'No new-member submissions were found.'}</div> : null}
            {!loading && filtered.map((item) => (
              <article key={item.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(200px,1fr)_minmax(200px,1fr)_150px_160px_110px] lg:items-center">
                <div className="min-w-0"><p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{displayName(item)}</p><p className="truncate text-xs text-[var(--color-text-tertiary)]">{item.registrationCode || item.id}</p></div>
                <div className="min-w-0 text-sm text-[var(--color-text-secondary)]"><p className="truncate">{item.email || valueFromSubmission(item, ['email', 'emailAddress']) || 'No email'}</p><p className="truncate text-xs text-[var(--color-text-tertiary)]">{item.contactNumber || valueFromSubmission(item, ['phone', 'phoneNumber', 'mobile']) || 'No phone'}</p></div>
                <Badge variant="info">{item.formTitle}</Badge>
                <div className="text-sm text-[var(--color-text-secondary)]">{formatDate(item.createdAt)}</div>
                <div className="flex items-center gap-1 lg:justify-end"><Button size="sm" variant="ghost" aria-label={`Download ${displayName(item)} as PDF`} title="Download PDF" onClick={() => void exportPdf([item])}><FileText className="h-4 w-4" /></Button><Button size="sm" variant="ghost" aria-label={`Download ${displayName(item)} for Excel`} title="Download Excel" onClick={() => exportExcel([item])}><FileSpreadsheet className="h-4 w-4" /></Button></div>
              </article>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

export default withAuth(NewMembersPage, { requiredRole: 'admin' });

function GrowthAccordion({ title, data, open }: { title: string; data: GrowthPoint[]; open?: boolean }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return (
    <details className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 open:bg-[var(--color-background-primary)]" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-[var(--color-text-primary)]"><span>{title}</span><span className="rounded-full bg-[var(--color-background-primary)] px-3 py-1 text-xs text-[var(--color-text-tertiary)]">{total}</span></summary>
      <div className="mt-4 space-y-2">
        {data.length === 0 ? <p className="text-xs text-[var(--color-text-tertiary)]">No records yet.</p> : data.map((item) => <div key={`${title}-${item.period}`} className="flex items-center justify-between rounded-2xl bg-[var(--color-background-secondary)] px-3 py-2 text-xs"><span className="text-[var(--color-text-secondary)]">{shortPeriod(item.period)}</span><span className="font-bold text-[var(--color-text-primary)]">{item.count}</span></div>)}
      </div>
    </details>
  );
}
