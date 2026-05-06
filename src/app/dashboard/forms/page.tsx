'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Activity,
  BarChart3,
  CalendarClock,
  Eye,
  FileText,
  Link as LinkIcon,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Users,
} from 'lucide-react';

import { Button } from '@/ui/Button';
import { DataTable } from '@/components/DateTable';
import { PageHeader } from '@/layouts';
import { Input } from '@/ui/input';
import { VerifyActionModal } from '@/ui/VerifyActionModal';

import { apiClient } from '@/lib/api';
import {
  buildFormSubmissionsReportPath,
  copyFormSubmissionsReportLink,
  exportFormSubmissionsCsv,
  exportFormSubmissionsPdf,
  fetchAllFormSubmissions,
  filterFormSubmissions,
  resolveFormSubmissionEmail,
  resolveFormSubmissionName,
} from '@/lib/formSubmissions';
import type { AdminForm, EventData, FormStatsResponse, FormStatus, FormSubmission } from '@/lib/types';
import { buildPublicFormUrl } from '@/lib/utils';

import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';
import { getServerErrorMessage } from '@/lib/serverValidation';

type Column<T> = {
  key: keyof T;
  header: string;
  cell?: (item: T) => ReactNode;
};

type DashboardTab = 'forms' | 'submissions';

const buildPublicUrl = buildPublicFormUrl;

function normalizeFormStatus(status?: string): FormStatus | undefined {
  if (status === 'draft' || status === 'published' || status === 'invalid') return status;
  return undefined;
}

function isExpiredForm(form: AdminForm): boolean {
  if (form.status === 'invalid') return true;
  const closesAt = form.settings?.closesAt;
  if (!closesAt) return false;
  const date = new Date(closesAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatRemaining(value?: string): string {
  if (!value) return 'No expiry';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No expiry';
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days > 0) return `${days}d ${remHours}h left`;
  return `${remHours}h left`;
}

function getFormStatus(form: AdminForm): 'draft' | 'published' | 'invalid' {
  if (form.status === 'invalid') return 'invalid';
  if (isExpiredForm(form)) return 'invalid';
  if (form.isPublished || form.status === 'published') return 'published';
  return 'draft';
}

function getFormCount(form: AdminForm, formCounts: Record<string, number>) {
  return formCounts[form.id] ?? 0;
}

function statusClass(status: 'draft' | 'published' | 'invalid'): string {
  if (status === 'published') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'invalid') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
}

function Panel({ title, subtitle, icon: Icon, actions, children }: { title: string; subtitle?: string; icon?: ComponentType<{ className?: string }>; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:shadow-md">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon ? <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-sm"><Icon className="h-5 w-5" /></div> : null}
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
            {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <article className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <strong className="mt-3 block text-3xl font-black tracking-tight text-slate-950">{value}</strong>
        </div>
        <div className="rounded-2xl bg-slate-950 p-3 text-white"><Icon className="h-5 w-5" /></div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{hint}</p>
    </article>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl px-4 py-2 text-sm font-black transition ${active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
      {children}
    </button>
  );
}

export default withAuth(
  function FormsPage() {
    const router = useRouter();
    const auth = useAuthContext();

    const [activeTab, setActiveTab] = useState<DashboardTab>('forms');
    const [forms, setForms] = useState<AdminForm[]>([]);
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [deleteTarget, setDeleteTarget] = useState<AdminForm | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [formCounts, setFormCounts] = useState<Record<string, number>>({});
    const [formStats, setFormStats] = useState<FormStatsResponse | null>(null);

    const [selectedFormId, setSelectedFormId] = useState('');
    const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
    const [submissionsTotal, setSubmissionsTotal] = useState(0);
    const [submissionsPage, setSubmissionsPage] = useState(1);
    const [submissionsLimit, setSubmissionsLimit] = useState(10);
    const [submissionsLoading, setSubmissionsLoading] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [filterStart, setFilterStart] = useState('');
    const [filterEnd, setFilterEnd] = useState('');
    const [liveUpdates, setLiveUpdates] = useState(true);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingCsv, setExportingCsv] = useState(false);
    const [formSearch, setFormSearch] = useState('');

    const authBlocked = useMemo(() => !auth.isInitialized || auth.isLoading, [auth.isInitialized, auth.isLoading]);
    const selectedForm = useMemo(() => forms.find((form) => form.id === selectedFormId) ?? null, [forms, selectedFormId]);
    const perFormStats = useMemo(() => formStats?.perForm ?? [], [formStats]);

    const maxPerForm = useMemo(() => {
      const counts = perFormStats.map((item) => item.count);
      return counts.length > 0 ? Math.max(...counts) : 1;
    }, [perFormStats]);

    const eventMap = useMemo(() => events.reduce((acc, event) => ({ ...acc, [event.id]: event.title }), {} as Record<string, string>), [events]);

    const eventCounts = useMemo(() => {
      const bucket = new Map<string, { eventId: string; name: string; count: number }>();
      perFormStats.forEach((stat) => {
        const form = forms.find((item) => item.id === stat.formId);
        const linkedEventId = form?.eventId || 'no_event';
        const name = linkedEventId === 'no_event' ? 'No event attached' : eventMap[linkedEventId] || linkedEventId;
        const current = bucket.get(linkedEventId) || { eventId: linkedEventId, name, count: 0 };
        current.count += stat.count;
        bucket.set(linkedEventId, current);
      });
      return Array.from(bucket.values()).sort((a, b) => b.count - a.count);
    }, [perFormStats, forms, eventMap]);

    const maxEventCount = useMemo(() => {
      const counts = eventCounts.map((item) => item.count);
      return counts.length > 0 ? Math.max(...counts) : 1;
    }, [eventCounts]);

    const trendSource = useMemo(() => {
      const source = formStats?.recent ?? [];
      if (!selectedFormId) return source;
      return source.filter((item) => item.formId === selectedFormId);
    }, [formStats, selectedFormId]);

    const trendData = useMemo(() => {
      const today = new Date();
      const buckets = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (6 - index));
        return { label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), dateKey: date.toDateString(), count: 0 };
      });
      trendSource.forEach((item) => {
        const created = new Date(item.createdAt);
        if (Number.isNaN(created.getTime())) return;
        const bucket = buckets.find((entry) => entry.dateKey === created.toDateString());
        if (bucket) bucket.count += 1;
      });
      return buckets;
    }, [trendSource]);

    const maxTrendCount = useMemo(() => {
      const counts = trendData.map((item) => item.count);
      return counts.length > 0 ? Math.max(...counts) : 1;
    }, [trendData]);

    const load = useCallback(async () => {
      try {
        setLoading(true);
        const [formsResult, statsResult] = await Promise.allSettled([apiClient.getAdminForms({ page, limit }), apiClient.getFormStats()]);

        if (formsResult.status === 'fulfilled') {
          setForms(Array.isArray(formsResult.value.data) ? formsResult.value.data : []);
          setTotal(typeof formsResult.value.total === 'number' ? formsResult.value.total : 0);
        } else {
          console.error(formsResult.reason);
          setForms([]);
          setTotal(0);
        }

        if (statsResult.status === 'fulfilled') {
          setFormStats(statsResult.value);
          const map: Record<string, number> = {};
          statsResult.value.perForm?.forEach((row) => { map[row.formId] = row.count; });
          setFormCounts(map);
        } else {
          console.warn('Form stats unavailable:', statsResult.reason);
          setFormCounts({});
          setFormStats(null);
        }
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Failed to load forms');
        setForms([]);
        setTotal(0);
        setFormCounts({});
        setFormStats(null);
      } finally {
        setLoading(false);
      }
    }, [page, limit]);

    useEffect(() => { if (!authBlocked) void load(); }, [authBlocked, load]);

    useEffect(() => {
      if (selectedFormId) return;
      if (forms.length > 0) setSelectedFormId(forms[0].id);
    }, [forms, selectedFormId]);

    useEffect(() => {
      const loadEvents = async () => {
        try {
          const res = await apiClient.getEvents({ page: 1, limit: 200 });
          setEvents(Array.isArray(res.data) ? res.data : []);
        } catch {
          setEvents([]);
        }
      };
      void loadEvents();
    }, []);

    const confirmDelete = useCallback(async () => {
      if (!deleteTarget) return;
      setDeleteLoading(true);
      try {
        await apiClient.deleteAdminForm(deleteTarget.id);
        toast.success('Form deleted');
        setDeleteTarget(null);
        await load();
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Failed to delete form');
      } finally {
        setDeleteLoading(false);
      }
    }, [deleteTarget, load]);

    const loadSubmissions = useCallback(async () => {
      if (!selectedFormId) {
        setSubmissions([]);
        setSubmissionsTotal(0);
        return;
      }

      try {
        setSubmissionsLoading(true);
        const res = await apiClient.getFormSubmissions(selectedFormId, { page: submissionsPage, limit: submissionsLimit });
        setSubmissions(Array.isArray(res.data) ? res.data : []);
        setSubmissionsTotal(typeof res.total === 'number' ? res.total : 0);
        setLastUpdatedAt(new Date().toISOString());
      } catch (error) {
        console.error(error);
        toast.error('Failed to load submissions');
        setSubmissions([]);
        setSubmissionsTotal(0);
      } finally {
        setSubmissionsLoading(false);
      }
    }, [selectedFormId, submissionsPage, submissionsLimit]);

    useEffect(() => { if (activeTab === 'submissions') void loadSubmissions(); }, [activeTab, loadSubmissions]);

    useEffect(() => {
      if (activeTab !== 'submissions' || !liveUpdates) return;
      const interval = setInterval(() => { void load(); void loadSubmissions(); }, 15000);
      return () => clearInterval(interval);
    }, [activeTab, liveUpdates, load, loadSubmissions]);

    const filteredSubmissions = useMemo(() => filterFormSubmissions(submissions, { query: filterText, from: filterStart, to: filterEnd }), [submissions, filterText, filterStart, filterEnd]);

    const filteredTotal = useMemo(() => {
      const hasFilters = filterText.trim() || filterStart || filterEnd;
      return hasFilters ? filteredSubmissions.length : submissionsTotal;
    }, [filterText, filterStart, filterEnd, filteredSubmissions.length, submissionsTotal]);

    const visibleForms = useMemo(() => {
      const term = formSearch.trim().toLowerCase();
      if (!term) return forms;
      return forms.filter((form) => `${form.title} ${form.slug || ''} ${form.status || ''}`.toLowerCase().includes(term));
    }, [forms, formSearch]);

    const exportSubmissions = useCallback(async () => {
      if (!selectedFormId) {
        toast.error('Select a form first');
        return;
      }
      try {
        setExportingPdf(true);
        const exportForm = selectedForm?.id === selectedFormId && (selectedForm.fields?.length || 0) > 0 ? selectedForm : await apiClient.getAdminForm(selectedFormId);
        const source = submissions.length >= submissionsTotal && !filterText.trim() && !filterStart && !filterEnd ? submissions : await fetchAllFormSubmissions(selectedFormId);
        const filtered = filterFormSubmissions(source, { query: filterText, from: filterStart, to: filterEnd });
        if (filtered.length === 0) {
          toast.error('No submissions to export');
          return;
        }
        await exportFormSubmissionsPdf(filtered, exportForm.title || selectedFormId, { query: filterText, from: filterStart, to: filterEnd }, exportForm.fields);
        toast.success('PDF exported');
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Failed to export PDF');
      } finally {
        setExportingPdf(false);
      }
    }, [filterEnd, filterStart, filterText, selectedForm, selectedFormId, submissions, submissionsTotal]);

    const exportSubmissionsCsvHandler = useCallback(async () => {
      if (!selectedFormId) {
        toast.error('Select a form first');
        return;
      }
      try {
        setExportingCsv(true);
        const exportForm = selectedForm?.id === selectedFormId && (selectedForm.fields?.length || 0) > 0 ? selectedForm : await apiClient.getAdminForm(selectedFormId);
        const source = submissions.length >= submissionsTotal && !filterText.trim() && !filterStart && !filterEnd ? submissions : await fetchAllFormSubmissions(selectedFormId);
        const filtered = filterFormSubmissions(source, { query: filterText, from: filterStart, to: filterEnd });
        if (filtered.length === 0) {
          toast.error('No submissions to export');
          return;
        }
        exportFormSubmissionsCsv(filtered, exportForm.title || selectedFormId, exportForm.fields);
        toast.success('CSV exported. You can open it in Excel.');
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Failed to export CSV');
      } finally {
        setExportingCsv(false);
      }
    }, [filterEnd, filterStart, filterText, selectedForm, selectedFormId, submissions, submissionsTotal]);

    const handleCopyReportLink = useCallback(async () => {
      if (!selectedFormId) {
        toast.error('Select a form first');
        return;
      }
      try {
        await copyFormSubmissionsReportLink(selectedFormId);
        toast.success('Client report link copied');
      } catch {
        toast.error('Failed to copy report link');
      }
    }, [selectedFormId]);

    const handlePublish = useCallback(async (form: AdminForm) => {
      try {
        const res = await apiClient.publishAdminForm(form.id);
        toast.success('Form published');
        const nextSlug = res?.slug || form.slug || '';
        const nextPublicUrl = buildPublicUrl(nextSlug, res?.publicUrl || form.publicUrl || undefined);
        setForms((prev) => prev.map((item) => item.id === form.id ? { ...item, slug: nextSlug || item.slug, publicUrl: nextPublicUrl || item.publicUrl, isPublished: true, status: normalizeFormStatus(res?.status) ?? 'published', publishedAt: res?.publishedAt || item.publishedAt } : item));
        if (nextPublicUrl) {
          try {
            await navigator.clipboard.writeText(nextPublicUrl);
            toast.success('Link copied to clipboard');
          } catch {
            toast.success('Form published');
          }
        }
        await load();
      } catch (error) {
        console.error(error);
        toast.error(getServerErrorMessage(error, 'Failed to publish form'));
      }
    }, [load]);

    const handleCopyLink = useCallback(async (form: AdminForm) => {
      const status = getFormStatus(form);
      if (status === 'invalid') {
        toast.error('This form has expired and is no longer available.');
        return;
      }
      if (status !== 'published') {
        toast.error('This form is not published yet');
        return;
      }
      const link = buildPublicUrl(form.slug, form.publicUrl);
      if (!link) {
        toast.error('This form is not published yet');
        return;
      }
      try {
        await navigator.clipboard.writeText(link);
        toast.success('Link copied');
      } catch {
        toast.error('Failed to copy link');
      }
    }, []);

    const handleEdit = (form: AdminForm) => router.push(`/dashboard/forms/${form.id}/edit`);

    const columns = useMemo<Column<AdminForm>[]>(() => [
      {
        key: 'title',
        header: 'Title',
        cell: (form) => {
          const status = getFormStatus(form);
          return (
            <div className="space-y-1">
              <div className="font-black text-slate-950">{form.title}</div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black capitalize ring-1 ${statusClass(status)}`}>{status}</span>
            </div>
          );
        },
      },
      { key: 'id', header: 'Registrations', cell: (form) => <span className="text-sm font-black text-slate-700">{getFormCount(form, formCounts)}</span> },
      {
        key: 'slug',
        header: 'Link',
        cell: (form) => {
          const status = getFormStatus(form);
          return (
            <div className="flex items-center gap-2">
              {status === 'invalid' ? (
                <span className="text-xs font-bold text-red-500">Expired</span>
              ) : status !== 'published' ? (
                <button type="button" onClick={() => void handlePublish(form)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700 hover:bg-slate-50">Publish</button>
              ) : (
                <>
                  <span className="max-w-[220px] truncate text-xs font-semibold text-slate-600">{buildPublicUrl(form.slug, form.publicUrl) || `/forms/${form.slug}`}</span>
                  <button type="button" onClick={() => void handleCopyLink(form)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700 hover:bg-slate-50"><LinkIcon className="h-3.5 w-3.5" />Copy</button>
                </>
              )}
            </div>
          );
        },
      },
      { key: 'settings', header: 'Active Until', cell: (form) => <div className="text-xs font-semibold text-slate-600"><div>{formatDateTime(form.settings?.closesAt)}</div><div className="text-[0.7rem] text-slate-400">{formatRemaining(form.settings?.closesAt)}</div></div> },
      { key: 'updatedAt', header: 'Updated', cell: (form) => <span className="text-sm font-semibold text-slate-600">{form.updatedAt ? new Date(form.updatedAt).toLocaleString() : '-'}</span> },
    ], [handleCopyLink, handlePublish, formCounts]);

    const submissionColumns = useMemo<Column<FormSubmission>[]>(() => [
      {
        key: 'name' as keyof FormSubmission,
        header: 'Name',
        cell: (item) => <div className="space-y-1"><div className="text-sm font-black text-slate-950">{resolveFormSubmissionName(item, 'Anonymous')}</div><div className="text-xs font-semibold text-slate-500">{resolveFormSubmissionEmail(item) || 'No email'}</div></div>,
      },
      { key: 'contactNumber' as keyof FormSubmission, header: 'Contact', cell: (item) => <div className="text-xs font-semibold text-slate-600">{item.contactNumber || item.contactAddress || '—'}</div> },
      { key: 'values' as keyof FormSubmission, header: 'Responses', cell: (item) => <span className="text-xs font-semibold text-slate-600">{Object.keys(item.values || {}).length} fields</span> },
      { key: 'createdAt' as keyof FormSubmission, header: 'Submitted', cell: (item) => <span className="text-xs font-semibold text-slate-600">{formatDateTime(item.createdAt)}</span> },
    ], []);

    const deletePhrase = deleteTarget ? `DELETE ${deleteTarget.title || deleteTarget.id}` : 'DELETE';

    const stats = useMemo(() => ({
      totalSubmissions: formStats?.totalSubmissions ?? 0,
      published: forms.filter((form) => getFormStatus(form) === 'published').length,
      expired: forms.filter((form) => getFormStatus(form) === 'invalid').length,
      totalForms: total || forms.length,
    }), [formStats?.totalSubmissions, forms, total]);

    if (authBlocked) return <div className="flex min-h-[300px] w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-slate-950" /></div>;

    return (
      <main className="space-y-6">
        <PageHeader
          title="Forms"
          subtitle="Create, publish, monitor, and export form submissions from one professional operations workspace."
          actions={<div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => void load()} icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}>Refresh</Button><Button onClick={() => router.push('/dashboard/forms/new')} icon={<Plus className="h-4 w-4" />}>Create Form</Button></div>}
        />

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/65"><FileText className="h-4 w-4" />Registration intelligence</div>
              <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">Forms, registrations, reports, outreach, and public links in one organized place.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">Use forms for publishing and links. Use submissions for analytics, exports, client reports, and outreach.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white/70">Last updated: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : '—'}</div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={FileText} label="Total forms" value={stats.totalForms} hint="All forms available in the admin workspace." />
          <StatCard icon={Users} label="Registrations" value={stats.totalSubmissions} hint="Total submissions across tracked forms." />
          <StatCard icon={Send} label="Published" value={stats.published} hint="Forms currently available to public users." />
          <StatCard icon={CalendarClock} label="Expired / invalid" value={stats.expired} hint="Forms closed or no longer available." />
        </section>

        <section className="sticky top-2 z-20 rounded-3xl border border-slate-200 bg-white/85 p-2 shadow-sm backdrop-blur">
          <div className="flex gap-2 overflow-x-auto"><TabButton active={activeTab === 'forms'} onClick={() => setActiveTab('forms')}>Forms</TabButton><TabButton active={activeTab === 'submissions'} onClick={() => setActiveTab('submissions')}>Submissions</TabButton></div>
        </section>

        {activeTab === 'forms' ? (
          <>
            <Panel title="Published forms and draft queue" subtitle="Manage form lifecycle, copy public links, edit records, and inspect registrations." icon={FileText} actions={<div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={formSearch} onChange={(event) => setFormSearch(event.target.value)} placeholder="Search forms..." className="pl-10" /></div>}>
              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
                <DataTable data={visibleForms ?? []} columns={columns} total={total} page={page} limit={limit} onPageChange={setPage} onLimitChange={(next) => { setLimit(next); setPage(1); }} onEdit={handleEdit} onDelete={setDeleteTarget} onView={(form: AdminForm) => router.push(buildFormSubmissionsReportPath(form.id))} isLoading={loading} />
              </div>
            </Panel>
            <div className="text-xs font-semibold text-slate-500">Tip: Click “View” to open the client-ready registration report. Click “Edit” to adjust the form builder.</div>
          </>
        ) : null}

        {activeTab === 'submissions' ? (
          <>
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_420px]">
              <Panel title="Registration insights" subtitle="Live form analytics from backend submission data." icon={BarChart3}>
                <div className="grid gap-4 md:grid-cols-3"><MiniMetric label="Total registrations" value={formStats?.totalSubmissions ?? 0} /><MiniMetric label="Active forms" value={stats.published} /><MiniMetric label="Invalid / expired" value={stats.expired} /></div>
                <div className="mt-6 grid gap-6 xl:grid-cols-2"><MetricBars title="Registrations per form" rows={perFormStats.slice(0, 6).map((item) => ({ label: item.formTitle, value: item.count }))} max={maxPerForm} /><MetricBars title="Event registrations" rows={eventCounts.slice(0, 6).map((item) => ({ label: item.name, value: item.count }))} max={maxEventCount} /></div>
                <div className="mt-6">
                  <p className="text-sm font-black text-slate-950">Registration trend</p>
                  <div className="mt-3 grid grid-cols-7 gap-2">
                    {trendData.map((item) => <div key={item.label} className="flex flex-col items-center gap-2"><div className="flex h-24 w-full items-end rounded-2xl bg-slate-100 p-1"><div className="w-full rounded-xl bg-slate-950" style={{ height: `${Math.max(6, (item.count / maxTrendCount) * 100)}%` }} /></div><div className="text-[0.7rem] font-bold text-slate-400">{item.label}</div><div className="text-[0.7rem] font-black text-slate-600">{item.count}</div></div>)}
                  </div>
                </div>
              </Panel>
              <Panel title="Recent submissions" subtitle="Latest captured registration activity." icon={Activity}>
                {formStats?.recent?.length ? <div className="space-y-3">{formStats.recent.slice(0, 7).map((submission) => <article key={submission.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white hover:shadow-sm"><p className="text-sm font-black text-slate-950">{resolveFormSubmissionName(submission, 'Anonymous')}</p><p className="mt-1 text-xs font-semibold text-slate-500">{submission.formTitle}</p><p className="mt-2 text-[0.7rem] font-bold text-slate-400">{formatDateTime(submission.createdAt)}</p></article>)}</div> : <EmptyState label="No submissions yet." />}
              </Panel>
            </section>

            <Panel title="Submission explorer" subtitle="Filter registrations, open reports, launch outreach, and export clean PDF/CSV files." icon={Eye}>
              <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.2fr)_repeat(3,minmax(150px,0.8fr))]">
                <div>
                  <label className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">Form</label>
                  <select className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-400" value={selectedFormId} onChange={(event) => { setSelectedFormId(event.target.value); setSubmissionsPage(1); }}>
                    <option value="">Select a form</option>
                    {forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}
                  </select>
                </div>
                <Input label="Search" value={filterText} onChange={(event) => setFilterText(event.target.value)} placeholder="Name, email, phone..." />
                <Input label="From" type="date" value={filterStart} onChange={(event) => setFilterStart(event.target.value)} />
                <Input label="To" type="date" value={filterEnd} onChange={(event) => setFilterEnd(event.target.value)} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"><input type="checkbox" checked={liveUpdates} onChange={(event) => setLiveUpdates(event.target.checked)} />Live updates</label>
                <Button variant="outline" onClick={() => void loadSubmissions()}>Refresh</Button>
                <Button variant="outline" onClick={() => selectedFormId ? router.push(buildFormSubmissionsReportPath(selectedFormId)) : toast.error('Select a form first')} disabled={!selectedFormId}>Open Report</Button>
                <Button variant="outline" onClick={() => void handleCopyReportLink()} disabled={!selectedFormId}>Copy Client Report Link</Button>
                <Button variant="outline" onClick={() => selectedFormId ? router.push(`/dashboard/forms/${selectedFormId}/campaigns`) : toast.error('Select a form first')} disabled={!selectedFormId}>Open Outreach</Button>
                <Button variant="outline" onClick={() => void exportSubmissions()} loading={exportingPdf} disabled={exportingPdf || filteredSubmissions.length === 0 || !selectedFormId}>Export PDF</Button>
                <Button variant="outline" onClick={() => void exportSubmissionsCsvHandler()} loading={exportingCsv} disabled={exportingCsv || !selectedFormId || submissionsTotal === 0}>Export CSV</Button>
             
              </div>
              {!selectedFormId ? <div className="mt-5"><EmptyState label="Select a form to view registrations." /></div> : <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200"><DataTable data={filteredSubmissions} columns={submissionColumns} total={filteredTotal} page={submissionsPage} limit={submissionsLimit} onPageChange={setSubmissionsPage} onLimitChange={(next) => { setSubmissionsLimit(next); setSubmissionsPage(1); }} isLoading={submissionsLoading} /></div>}
            </Panel>
          </>
        ) : null}

        <VerifyActionModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete Form" description="This action permanently removes the form and its configuration." confirmText="Delete Form" cancelText="Cancel" variant="danger" loading={deleteLoading} verifyText={deletePhrase} />
      </main>
    );
  },
  { requiredRole: 'admin' },
);

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>;
}

function MetricBars({ title, rows, max }: { title: string; rows: Array<{ label: string; value: number }>; max: number }) {
  return (
    <div>
      <p className="text-sm font-black text-slate-950">{title}</p>
      {rows.length === 0 ? <p className="mt-2 text-xs font-semibold text-slate-400">No data yet.</p> : <div className="mt-3 space-y-3">{rows.map((item) => <div key={item.label} className="space-y-1"><div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500"><span className="truncate">{item.label}</span><span>{item.value}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-slate-950" style={{ width: `${Math.max(5, (item.value / max) * 100)}%` }} /></div></div>)}</div>}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><p className="text-sm font-bold text-slate-500">{label}</p></div>;
}
