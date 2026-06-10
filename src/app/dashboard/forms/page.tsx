'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Edit3,
  FileText,
  Mail,
  Megaphone,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import toast from 'react-hot-toast';

import { apiClient } from '@/lib/api';
import { withAuth } from '@/providers/withAuth';
import type {
  AdminEmailMarketingSummary,
  DashboardAnalytics,
  EventData,
  FormStatsResponse,
  MemberStatsResponse,
  NewMemberDashboardResponse,
  StoreOrdersPaginated,
  StoreProductAdmin,
  WorkforceStatsResponse,
} from '@/lib/types';
import { Button } from '@/ui/Button';

type DashboardFormField = {
  id?: string;
  key?: string;
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  order?: number;
  options?: unknown;
  validation?: unknown;
  visibility?: unknown;
  placeholder?: string;
  helpText?: string;
};

type DashboardForm = {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  description?: string;
  status?: string;
  submissionTarget?: string;
  published?: boolean;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
  fields?: DashboardFormField[];
  formFields?: DashboardFormField[];
  totalSubmissions?: number;
  submissionsCount?: number;
  _count?: { submissions?: number };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getCookieValue(name: string): string {
  if (typeof document === 'undefined') return '';

  return document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=') || '';
}

function normalizeField(raw: unknown): DashboardFormField {
  if (!isRecord(raw)) return {};

  return {
    id: asString(raw.id),
    key: asString(raw.key),
    name: asString(raw.name),
    label: asString(raw.label),
    type: asString(raw.type),
    required: typeof raw.required === 'boolean' ? raw.required : undefined,
    order: asNumber(raw.order),
    options: raw.options,
    validation: raw.validation,
    visibility: raw.visibility,
    placeholder: asString(raw.placeholder),
    helpText: asString(raw.helpText) || asString(raw.help_text),
  };
}

function normalizeForm(raw: unknown): DashboardForm | null {
  if (!isRecord(raw)) return null;

  const id = asString(raw.id);
  if (!id) return null;

  const rawFields = Array.isArray(raw.fields)
    ? raw.fields
    : Array.isArray(raw.formFields)
      ? raw.formFields
      : Array.isArray(raw.form_fields)
        ? raw.form_fields
        : [];

  const countRecord = isRecord(raw._count) ? raw._count : undefined;

  return {
    id,
    title: asString(raw.title),
    name: asString(raw.name),
    slug: asString(raw.slug),
    description: asString(raw.description),
    status: asString(raw.status),
    submissionTarget: asString(raw.submissionTarget) || asString(raw.submission_target),
    published: typeof raw.published === 'boolean' ? raw.published : undefined,
    isPublished: typeof raw.isPublished === 'boolean' ? raw.isPublished : typeof raw.is_published === 'boolean' ? raw.is_published : undefined,
    createdAt: asString(raw.createdAt) || asString(raw.created_at),
    updatedAt: asString(raw.updatedAt) || asString(raw.updated_at),
    fields: rawFields.map(normalizeField),
    formFields: rawFields.map(normalizeField),
    totalSubmissions: asNumber(raw.totalSubmissions) || asNumber(raw.total_submissions),
    submissionsCount: asNumber(raw.submissionsCount) || asNumber(raw.submissions_count),
    _count: countRecord ? { submissions: asNumber(countRecord.submissions) } : undefined,
  };
}

function extractFormsFromResponse(payload: unknown): DashboardForm[] {
  const direct = Array.isArray(payload) ? payload : null;
  if (direct) return direct.map(normalizeForm).filter((item): item is DashboardForm => Boolean(item));

  if (!isRecord(payload)) return [];

  const possibleArrays = [
    payload.data,
    payload.forms,
    payload.items,
    payload.results,
    payload.records,
    isRecord(payload.data) ? payload.data.forms : undefined,
    isRecord(payload.data) ? payload.data.items : undefined,
    isRecord(payload.data) ? payload.data.data : undefined,
  ];

  for (const value of possibleArrays) {
    if (Array.isArray(value)) {
      return value.map(normalizeForm).filter((item): item is DashboardForm => Boolean(item));
    }
  }

  return [];
}

async function loadAdminForms(): Promise<DashboardForm[]> {
  const client = apiClient as typeof apiClient & Record<string, unknown>;
  const methodNames = ['getAdminForms', 'listAdminForms', 'getForms', 'listForms'];

  for (const methodName of methodNames) {
    const method = client[methodName];
    if (typeof method !== 'function') continue;

    const response = await (method as (params?: { page: number; limit: number }) => Promise<unknown>)({
      page: 1,
      limit: 100,
    });
    return extractFormsFromResponse(response);
  }

  const configuredBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'https://api.wisdomchurchhq.org/api/v1';
  const baseUrl = configuredBase.replace(/\/$/, '');
  const csrfToken = decodeURIComponent(getCookieValue('csrf_secret'));

  const response = await fetch(`${baseUrl}/admin/forms?page=1&limit=100`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Forms request failed with ${response.status}`);
  }

  return extractFormsFromResponse(await response.json());
}

function getFormTitle(form: DashboardForm): string {
  return form.title || form.name || 'Untitled form';
}

function getFormFields(form: DashboardForm): DashboardFormField[] {
  return Array.isArray(form.fields) ? form.fields : Array.isArray(form.formFields) ? form.formFields : [];
}

function getFormSubmissionCount(form: DashboardForm): number {
  return form.totalSubmissions || form.submissionsCount || form._count?.submissions || 0;
}

function getFormStatus(form: DashboardForm): string {
  if (form.status) return form.status;
  if (form.published || form.isPublished) return 'published';
  return 'draft';
}

function fieldOptionsLabel(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} option${value.length === 1 ? '' : 's'}`;
  if (isRecord(value)) return `${Object.keys(value).length} option group${Object.keys(value).length === 1 ? '' : 's'}`;
  if (typeof value === 'string' && value.trim()) return value;
  return '—';
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
);

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value?: number | null): string {
  return numberFormatter.format(typeof value === 'number' && Number.isFinite(value) ? value : 0);
}

function formatDate(value?: string): string {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function dayKey(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {value}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{hint}</p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[var(--color-accent-primary)]">
          {icon}
        </div>
      </div>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-[var(--radius-button)] border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-6 text-center text-sm text-[var(--color-text-tertiary)]">
      {message}
    </div>
  );
}

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [formStats, setFormStats] = useState<FormStatsResponse | null>(null);
  const [marketing, setMarketing] = useState<AdminEmailMarketingSummary | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStatsResponse | null>(null);
  const [newMembers, setNewMembers] = useState<NewMemberDashboardResponse | null>(null);
  const [workforceStats, setWorkforceStats] = useState<WorkforceStatsResponse | null>(null);
  const [storeProducts, setStoreProducts] = useState<StoreProductAdmin[]>([]);
  const [storeOrders, setStoreOrders] = useState<StoreOrdersPaginated | null>(null);
  const [createdForms, setCreatedForms] = useState<DashboardForm[]>([]);
  const [formsLoadError, setFormsLoadError] = useState('');
  const [formsSearch, setFormsSearch] = useState('');
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        analyticsResult,
        eventsResult,
        formStatsResult,
        marketingResult,
        memberStatsResult,
        newMembersResult,
        workforceStatsResult,
        storeProductsResult,
        storeOrdersResult,
        createdFormsResult,
      ] = await Promise.allSettled([
        apiClient.getAnalytics(),
        apiClient.getEvents({ page: 1, limit: 10 }),
        apiClient.getFormStats(),
        apiClient.getEmailMarketingSummary(),
        apiClient.getMemberStats(),
        apiClient.getNewMemberDashboard(),
        apiClient.getWorkforceStats(),
        apiClient.listStoreProductsAdmin(true),
        apiClient.listStoreOrders({ page: 1, limit: 20 }),
        loadAdminForms(),
      ]);

      setAnalytics(analyticsResult.status === 'fulfilled' ? analyticsResult.value : null);
      setEvents(
        eventsResult.status === 'fulfilled' && Array.isArray(eventsResult.value.data)
          ? eventsResult.value.data
          : []
      );
      setFormStats(formStatsResult.status === 'fulfilled' ? formStatsResult.value : null);
      setMarketing(marketingResult.status === 'fulfilled' ? marketingResult.value : null);
      setMemberStats(memberStatsResult.status === 'fulfilled' ? memberStatsResult.value : null);
      setNewMembers(newMembersResult.status === 'fulfilled' ? newMembersResult.value : null);
      setWorkforceStats(workforceStatsResult.status === 'fulfilled' ? workforceStatsResult.value : null);
      setStoreProducts(storeProductsResult.status === 'fulfilled' ? storeProductsResult.value : []);
      setStoreOrders(storeOrdersResult.status === 'fulfilled' ? storeOrdersResult.value : null);
      setCreatedForms(createdFormsResult.status === 'fulfilled' ? createdFormsResult.value : []);
      setFormsLoadError(createdFormsResult.status === 'rejected' ? 'Created forms could not be loaded.' : '');

      const failed = [
        analyticsResult,
        eventsResult,
        formStatsResult,
        marketingResult,
        memberStatsResult,
        newMembersResult,
        workforceStatsResult,
        storeProductsResult,
        storeOrdersResult,
        createdFormsResult,
      ].some(
        (result) => result.status === 'rejected'
      );

      if (failed) {
        toast.error('Some dashboard data could not be loaded');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const deleteForm = useCallback(
    async (form: DashboardForm) => {
      const title = getFormTitle(form);
      const confirmed = window.confirm(`Delete "${title}"? This removes the form and its saved fields.`);
      if (!confirmed) return;

      try {
        setDeletingFormId(form.id);
        await apiClient.deleteAdminForm(form.id);
        setCreatedForms((current) => current.filter((item) => item.id !== form.id));
        toast.success('Form deleted');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete form');
      } finally {
        setDeletingFormId(null);
      }
    },
    []
  );

  const safeEvents = useMemo(() => (Array.isArray(events) ? events : []), [events]);
  const recentSubmissions = useMemo(() => formStats?.recent ?? [], [formStats]);
  const recentCampaigns = useMemo(() => marketing?.recentCampaigns ?? [], [marketing]);
  const monthlyStats = useMemo(() => analytics?.monthlyStats ?? [], [analytics]);
  const eventsByCategory = useMemo(() => analytics?.eventsByCategory ?? {}, [analytics]);
  const activeProducts = useMemo(() => storeProducts.filter((item) => item.isActive).length, [storeProducts]);
  const lowStockProducts = useMemo(() => storeProducts.filter((item) => item.stock > 0 && item.stock <= 5).length, [storeProducts]);
  const publishedForms = useMemo(
    () => createdForms.filter((form) => ['published', 'active', 'approved'].includes(getFormStatus(form).toLowerCase())).length,
    [createdForms]
  );
  const totalCreatedFields = useMemo(
    () => createdForms.reduce((total, form) => total + getFormFields(form).length, 0),
    [createdForms]
  );
  const filteredCreatedForms = useMemo(() => {
    const query = formsSearch.trim().toLowerCase();
    if (!query) return createdForms;

    return createdForms.filter((form) => {
      const searchable = [
        getFormTitle(form),
        form.slug,
        form.description,
        form.submissionTarget,
        getFormStatus(form),
        ...getFormFields(form).flatMap((field) => [field.label, field.key, field.name, field.type]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [createdForms, formsSearch]);
  const workforceDepartments = useMemo(
    () => Object.entries(workforceStats?.byDepartment || {}).sort((a, b) => b[1] - a[1]).slice(0, 6),
    [workforceStats]
  );

  const upcomingEvents = useMemo(() => {
    const now = Date.now();

    return safeEvents
      .filter((event) => {
        const rawDate = event.startDate || event.date || event.createdAt;
        if (!rawDate) return false;
        const parsed = new Date(rawDate);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed.getTime() >= now;
      })
      .slice(0, 5);
  }, [safeEvents]);

  const submissionsTrend = useMemo(() => {
    const counts: Record<string, number> = {};

    recentSubmissions.forEach((submission) => {
      const key = dayKey(submission.createdAt);
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });

    const labels = Object.keys(counts).sort();

    return {
      labels,
      values: labels.map((label) => counts[label]),
    };
  }, [recentSubmissions]);

  const monthlyChartData = useMemo(
    () => ({
      labels: monthlyStats.map((row) => row.month),
      datasets: [
        {
          label: 'Events',
          data: monthlyStats.map((row) => row.events),
          borderColor: '#0f766e',
          backgroundColor: 'rgba(15,118,110,0.18)',
          borderWidth: 2,
          tension: 0.35,
        },
        {
          label: 'Attendees',
          data: monthlyStats.map((row) => row.attendees),
          borderColor: '#1d4ed8',
          backgroundColor: 'rgba(29,78,216,0.16)',
          borderWidth: 2,
          tension: 0.35,
        },
      ],
    }),
    [monthlyStats]
  );

  const categoryChartData = useMemo(
    () => ({
      labels: Object.keys(eventsByCategory),
      datasets: [
        {
          data: Object.values(eventsByCategory),
          backgroundColor: ['#1d4ed8', '#0f766e', '#ca8a04', '#7c3aed', '#dc2626', '#0891b2'],
          borderWidth: 1,
        },
      ],
    }),
    [eventsByCategory]
  );

  const submissionsChartData = useMemo(
    () => ({
      labels: submissionsTrend.labels,
      datasets: [
        {
          label: 'Submissions',
          data: submissionsTrend.values,
          backgroundColor: 'rgba(202,138,4,0.45)',
          borderColor: '#ca8a04',
          borderWidth: 1,
        },
      ],
    }),
    [submissionsTrend]
  );

  const kpis = [
    {
      label: 'Events',
      value: formatNumber(analytics?.totalEvents),
      hint: `${formatNumber(analytics?.upcomingEvents)} upcoming`,
      icon: <CalendarDays className="h-5 w-5" />,
    },
    {
      label: 'Attendees',
      value: formatNumber(analytics?.totalAttendees),
      hint: 'Across recorded events',
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: 'Audience',
      value: formatNumber(marketing?.reachableRecipients),
      hint: `${formatNumber(publishedForms || marketing?.publishedForms)} live forms`,
      icon: <Mail className="h-5 w-5" />,
    },
    {
      label: 'Submissions',
      value: formatNumber(formStats?.totalSubmissions),
      hint: 'Captured form responses',
      icon: <ClipboardList className="h-5 w-5" />,
    },
    {
      label: 'Members',
      value: formatNumber(memberStats?.total),
      hint: `${formatNumber(memberStats?.active)} active profiles`,
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: 'New Members',
      value: formatNumber(newMembers?.thisMonth),
      hint: `${formatNumber(newMembers?.thisYear)} this year`,
      icon: <UserPlus className="h-5 w-5" />,
    },
    {
      label: 'Workforce',
      value: formatNumber(workforceStats?.byStatus?.serving),
      hint: `${formatNumber(workforceStats?.total)} total profiles`,
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      label: 'Store',
      value: formatNumber(activeProducts),
      hint: `${formatNumber(storeOrders?.total)} orders · ${formatNumber(lowStockProducts)} low stock`,
      icon: <ShoppingBag className="h-5 w-5" />,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-44 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`dashboard-skeleton-${index}`}
              className="h-32 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]"
            />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-80 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
          <div className="h-80 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-gradient-to-br from-[var(--color-background-secondary)] to-[var(--color-background-primary)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              <Activity className="h-3.5 w-3.5" />
              Admin Dashboard
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-3xl">
              Real-time church operations, registrations, and outreach overview.
            </h1>

            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)] md:text-base">
              Monitor events, forms, submissions, and email campaigns from one connected operations workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => loadDashboard(true)}
              loading={refreshing}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>

            <Link
              href="/dashboard/forms"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
            >
              Forms
            </Link>

            <Link
              href="/dashboard/email-marketing"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-[var(--color-accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-onprimary)] hover:bg-[var(--color-accent-primaryhover)]"
            >
              Campaigns
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        {kpis.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              <FileText className="h-3.5 w-3.5" />
              Created Forms
            </div>
            <h2 className="mt-3 text-lg font-semibold text-[var(--color-text-primary)]">
              Forms and field management
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Review every form created in the system, expand each form to inspect its fields, then jump into the forms
              editor to adjust labels, field types, requirements, and ordering.
            </p>
          </div>

          <div className="grid min-w-full grid-cols-3 gap-2 sm:min-w-[360px]">
            <MiniMetric label="Forms" value={createdForms.length} />
            <MiniMetric label="Live" value={publishedForms} />
            <MiniMetric label="Fields" value={totalCreatedFields} />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              value={formsSearch}
              onChange={(event) => setFormsSearch(event.target.value)}
              placeholder="Search forms, fields, status, target..."
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-primary)]"
            />
          </div>

          <Link
            href="/dashboard/forms"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[var(--color-accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-onprimary)] hover:bg-[var(--color-accent-primaryhover)]"
          >
            Open Forms Manager
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5 overflow-hidden rounded-[var(--radius-button)] border border-[var(--color-border-secondary)]">
          <div className="hidden grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.8fr_0.7fr] gap-3 border-b border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] lg:grid">
            <span>Form</span>
            <span>Slug / Target</span>
            <span>Status</span>
            <span>Fields</span>
            <span>Updated</span>
            <span className="text-right">Action</span>
          </div>

          <div className="divide-y divide-[var(--color-border-secondary)]">
            {formsLoadError ? (
              <div className="p-5">
                <EmptyState message={formsLoadError} />
              </div>
            ) : filteredCreatedForms.length > 0 ? (
              filteredCreatedForms.map((form) => (
                <FormAccordionRow
                  key={form.id}
                  form={form}
                  deleting={deletingFormId === form.id}
                  onDelete={deleteForm}
                />
              ))
            ) : (
              <div className="p-5">
                <EmptyState message={createdForms.length === 0 ? 'No forms have been created yet.' : 'No form matched your search.'} />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Membership Pulse</h2>
          <div className="mt-4 space-y-2">
            <PulseRow label="Total members" value={memberStats?.total || 0} />
            <PulseRow label="New this week" value={newMembers?.thisWeek || 0} />
            <PulseRow label="New this quarter" value={newMembers?.thisQuarter || 0} />
            <PulseRow label="New this year" value={newMembers?.thisYear || 0} />
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Workforce Coverage</h2>
          <div className="mt-4 space-y-2">
            <PulseRow label="Serving" value={workforceStats?.byStatus?.serving || 0} />
            <PulseRow label="New / pending" value={(workforceStats?.byStatus?.new || 0) + (workforceStats?.byStatus?.pending || 0)} />
            <PulseRow label="No longer serving" value={workforceStats?.byStatus?.not_serving || 0} />
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Department Load</h2>
          <div className="mt-4 space-y-2">
            {workforceDepartments.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No department records yet.</p>
            ) : (
              workforceDepartments.map(([department, count]) => <PulseRow key={department} label={department} value={count} />)
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Monthly Performance
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Events and attendees from live analytics.</p>
            </div>
          </div>

          <div className="mt-4 h-[300px]">
            {monthlyStats.length > 0 ? (
              <Line
                data={monthlyChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { precision: 0 },
                    },
                  },
                }}
              />
            ) : (
              <EmptyState message="No monthly analytics available yet." />
            )}
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Event Categories
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Distribution by event category.</p>
            </div>
          </div>

          <div className="mt-4 h-[300px]">
            {Object.keys(eventsByCategory).length > 0 ? (
              <Pie
                data={categoryChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' },
                  },
                }}
              />
            ) : (
              <EmptyState message="No event category data available." />
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Submission Velocity
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Recent form responses grouped by day.</p>
            </div>
          </div>

          <div className="mt-4 h-[270px]">
            {submissionsTrend.labels.length > 0 ? (
              <Bar
                data={submissionsChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { precision: 0 },
                    },
                  },
                }}
              />
            ) : (
              <EmptyState message="No recent submissions captured yet." />
            )}
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Upcoming Events
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Latest event records.</p>
            </div>
            <CalendarDays className="h-5 w-5 text-[var(--color-accent-primary)]" />
          </div>

          <div className="mt-4 space-y-3">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{event.title}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    {formatDate(event.startDate || event.date || event.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState message="No upcoming events found." />
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Recent Campaigns
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Email delivery activity from campaign history.</p>
            </div>
            <Megaphone className="h-5 w-5 text-[var(--color-accent-primary)]" />
          </div>

          <div className="mt-4 space-y-3">
            {recentCampaigns.length > 0 ? (
              recentCampaigns.slice(0, 6).map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {campaign.subject || 'Untitled campaign'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    Sent {formatNumber(campaign.sent)} / {formatNumber(campaign.targeted)} · Failed{' '}
                    {formatNumber(campaign.failed)} · {formatDate(campaign.startedAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState message="No campaign history yet." />
            )}
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Latest Registrations
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Most recent form responses from form statistics.</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-[var(--color-accent-primary)]" />
          </div>

          <div className="mt-4 space-y-3">
            {recentSubmissions.length > 0 ? (
              recentSubmissions.slice(0, 6).map((submission) => (
                <div
                  key={submission.id}
                  className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {submission.formTitle || 'Form response'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    {submission.name || submission.email || 'Anonymous'} · {formatDate(submission.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState message="No registrations captured yet." />
            )}
          </div>
        </article>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Operational Shortcuts</h2>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Go directly to the core admin workflows.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/event"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
            >
              Events
            </Link>
            <Link
              href="/dashboard/forms"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
            >
              Forms
            </Link>
            <Link
              href="/dashboard/administration"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
            >
              Administration
            </Link>
            <Link
              href="/dashboard/store"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
            >
              Store
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">{formatNumber(value)}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.replaceAll('_', ' ');

  return (
    <span className="inline-flex w-fit items-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2.5 py-1 text-xs font-semibold capitalize text-[var(--color-text-secondary)]">
      {normalized}
    </span>
  );
}

function FormAccordionRow({
  form,
  deleting,
  onDelete,
}: {
  form: DashboardForm;
  deleting: boolean;
  onDelete: (form: DashboardForm) => void;
}) {
  const fields = getFormFields(form).sort((a, b) => (a.order || 0) - (b.order || 0));
  const editHref = `/dashboard/forms/${encodeURIComponent(form.id)}/edit`;

  return (
    <details className="group bg-[var(--color-background-primary)]">
      <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 transition hover:bg-[var(--color-background-hover)] lg:grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.8fr_0.7fr] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition group-open:rotate-180" />
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{getFormTitle(form)}</p>
          </div>
          <p className="mt-1 line-clamp-1 pl-6 text-xs text-[var(--color-text-tertiary)]">
            {form.description || 'No description provided.'}
          </p>
        </div>

        <div className="text-xs text-[var(--color-text-secondary)]">
          <p className="truncate font-medium">{form.slug || 'No slug'}</p>
          <p className="mt-1 truncate text-[var(--color-text-tertiary)]">{form.submissionTarget || 'General form'}</p>
        </div>

        <StatusPill status={getFormStatus(form)} />

        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
          {formatNumber(fields.length)}
          <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">fields</span>
        </div>

        <div className="text-xs text-[var(--color-text-tertiary)]">
          {formatDate(form.updatedAt || form.createdAt)}
          <p className="mt-1">{formatNumber(getFormSubmissionCount(form))} submissions</p>
        </div>

        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          <Link
            href={editHref}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit fields
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDelete(form);
            }}
            className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </summary>

      <div className="border-t border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-4">
        {fields.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border-secondary)] text-xs uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                <tr>
                  <th className="px-3 py-3 font-semibold">Order</th>
                  <th className="px-3 py-3 font-semibold">Label</th>
                  <th className="px-3 py-3 font-semibold">Key</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Required</th>
                  <th className="px-3 py-3 font-semibold">Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-secondary)]">
                {fields.map((field, index) => (
                  <tr key={field.id || field.key || `${form.id}-field-${index}`}>
                    <td className="px-3 py-3 text-xs text-[var(--color-text-tertiary)]">
                      {field.order ?? index + 1}
                    </td>
                    <td className="px-3 py-3 font-medium text-[var(--color-text-primary)]">
                      {field.label || field.name || 'Untitled field'}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                      {field.key || field.name || '—'}
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">
                      {field.type || 'text'}
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">
                      {field.required ? 'Yes' : 'No'}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--color-text-tertiary)]">
                      {fieldOptionsLabel(field.options)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="This form has no fields yet. Open the forms manager to add fields." />
        )}
      </div>
    </details>
  );
}

function PulseRow({ label, value }: { label: string; value: number }) {
  return (
    <details className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-semibold text-[var(--color-text-primary)]">{formatNumber(value)}</span>
      </summary>
      <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">Live count from saved operational records.</p>
    </details>
  );
}

export default withAuth(DashboardPage, { requiredRole: 'admin' });
