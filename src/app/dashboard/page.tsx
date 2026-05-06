'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Command,
  Download,
  Eye,
  Filter,
  LayoutDashboard,
  LineChart,
  Mail,
  Megaphone,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
);

type TabKey = 'overview' | 'analytics' | 'records' | 'activity';
type RecordType = 'event' | 'submission' | 'campaign' | 'product' | 'order' | 'audit';
type SortDirection = 'asc' | 'desc';
type SortKey = 'title' | 'type' | 'status' | 'date';

type ApiEnvelope<T> = {
  status?: string;
  message?: string;
  data?: T;
  items?: T;
  total?: number;
};

type RawRecord = Record<string, unknown>;

type AuditLogRecord = {
  id: string;
  action?: string;
  actor?: string;
  resource?: string;
  description?: string;
  createdAt?: string;
  created_at?: string;
  status?: string;
};

type DashboardRecord = {
  id: string;
  type: RecordType;
  title: string;
  subtitle: string;
  status: string;
  date?: string;
  href?: string;
  payload: unknown;
};

type TimelineItem = {
  id: string;
  type: RecordType;
  title: string;
  description: string;
  time?: string;
  status?: string;
};

type DashboardSnapshot = {
  analytics: DashboardAnalytics | null;
  events: EventData[];
  formStats: FormStatsResponse | null;
  marketing: AdminEmailMarketingSummary | null;
  memberStats: MemberStatsResponse | null;
  newMembers: NewMemberDashboardResponse | null;
  workforceStats: WorkforceStatsResponse | null;
  storeProducts: StoreProductAdmin[];
  storeOrders: StoreOrdersPaginated | null;
  auditLogs: AuditLogRecord[];
};

const numberFormatter = new Intl.NumberFormat('en-US');
const PAGE_SIZE = 8;
const RAW_API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  ''
).replace(/\/+$/, '');

const chartColors = {
  blue: '#2563eb',
  blueSoft: 'rgba(37, 99, 235, 0.14)',
  emerald: '#059669',
  emeraldSoft: 'rgba(5, 150, 105, 0.16)',
  amber: '#d97706',
  amberSoft: 'rgba(217, 119, 6, 0.18)',
  violet: '#7c3aed',
  rose: '#e11d48',
  cyan: '#0891b2',
  slate: '#0f172a',
};

const tabs: Array<{ key: TabKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'analytics', label: 'Analytics', icon: LineChart },
  { key: 'records', label: 'Records', icon: ClipboardList },
  { key: 'activity', label: 'Activity', icon: Activity },
];

function formatNumber(value?: number | null): string {
  return numberFormatter.format(typeof value === 'number' && Number.isFinite(value) ? value : 0);
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
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

function formatDateTime(value?: string): string {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dayKey(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function normalizeLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function asRecord(value: unknown): RawRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RawRecord) : {};
}

function unwrapData<T>(payload: unknown): T | null {
  if (!payload) return null;
  if (typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!RAW_API_BASE) return normalized;

  const baseHasApiV1 = /\/api\/v1$/.test(RAW_API_BASE);
  if (baseHasApiV1 && normalized.startsWith('/api/v1/')) {
    return `${RAW_API_BASE}${normalized.replace('/api/v1', '')}`;
  }

  return `${RAW_API_BASE}${normalized}`;
}

async function optionalGet<T>(path: string): Promise<T | null> {
  if (!RAW_API_BASE) return null;

  try {
    const response = await fetch(apiUrl(path), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;

    const payload = (await response.json().catch(() => null)) as unknown;
    return unwrapData<T>(payload);
  } catch {
    return null;
  }
}

function extractArray<T = unknown>(payload: unknown): T[] {
  const data = unwrapData<unknown>(payload);

  if (Array.isArray(data)) return data as T[];

  const record = asRecord(data);
  const candidates = [record.items, record.results, record.records, record.data, record.logs];
  const firstArray = candidates.find(Array.isArray);
  return Array.isArray(firstArray) ? (firstArray as T[]) : [];
}

function metricDelta(current: number, previous: number): { label: string; positive: boolean } {
  if (!previous && !current) return { label: 'No change', positive: true };
  if (!previous) return { label: '+100% growth', positive: true };

  const percent = ((current - previous) / previous) * 100;
  const rounded = Math.round(percent);
  return {
    label: `${rounded >= 0 ? '+' : ''}${rounded}%`,
    positive: rounded >= 0,
  };
}

function forecastNext(values: number[]): number | null {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length < 2) return null;

  const window = usable.slice(-3);
  const average = window.reduce((sum, value) => sum + value, 0) / window.length;
  const previous = usable[usable.length - 2] || 0;
  const current = usable[usable.length - 1] || 0;
  const momentum = current - previous;

  return Math.max(0, Math.round(average + momentum * 0.35));
}

function toDateValue(value?: string): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getEventDate(event: EventData): string | undefined {
  const raw = asRecord(event);
  return stringValue(raw.startDate) || stringValue(raw.date) || stringValue(raw.createdAt);
}

function getSubmissionDate(submission: unknown): string | undefined {
  const raw = asRecord(submission);
  return stringValue(raw.createdAt) || stringValue(raw.created_at) || stringValue(raw.submittedAt) || stringValue(raw.submitted_at);
}

function getCampaignDate(campaign: unknown): string | undefined {
  const raw = asRecord(campaign);
  return stringValue(raw.startedAt) || stringValue(raw.createdAt) || stringValue(raw.sentAt);
}

function getOrderDate(order: unknown): string | undefined {
  const raw = asRecord(order);
  return stringValue(raw.createdAt) || stringValue(raw.created_at) || stringValue(raw.orderedAt);
}

function buildOperationalRecords(snapshot: DashboardSnapshot): DashboardRecord[] {
  const recentSubmissions = extractArray<unknown>((snapshot.formStats as RawRecord | null)?.recent ?? []);
  const recentCampaigns = extractArray<unknown>((snapshot.marketing as RawRecord | null)?.recentCampaigns ?? []);
  const orderItems = extractArray<unknown>(snapshot.storeOrders);

  const events = snapshot.events.map((event) => {
    const raw = asRecord(event);
    const id = stringValue(raw.id) || stringValue(raw.uuid) || `event-${stringValue(raw.title)}`;
    const title = stringValue(raw.title) || 'Untitled event';
    const date = getEventDate(event);

    return {
      id: `event-${id}`,
      type: 'event' as RecordType,
      title,
      subtitle: `${stringValue(raw.category) || 'Event'} · ${formatDate(date)}`,
      status: stringValue(raw.status) || 'scheduled',
      date,
      href: '/dashboard/event',
      payload: event,
    };
  });

  const submissions = recentSubmissions.map((submission) => {
    const raw = asRecord(submission);
    const id = stringValue(raw.id) || stringValue(raw.uuid) || `submission-${stringValue(raw.email)}-${stringValue(raw.createdAt)}`;
    const title = stringValue(raw.formTitle) || stringValue(raw.form_title) || 'Form response';
    const date = getSubmissionDate(submission);

    return {
      id: `submission-${id}`,
      type: 'submission' as RecordType,
      title,
      subtitle: `${stringValue(raw.name) || stringValue(raw.email) || 'Anonymous'} · ${formatDate(date)}`,
      status: stringValue(raw.status) || 'received',
      date,
      href: '/dashboard/forms',
      payload: submission,
    };
  });

  const campaigns = recentCampaigns.map((campaign) => {
    const raw = asRecord(campaign);
    const id = stringValue(raw.id) || stringValue(raw.uuid) || `campaign-${stringValue(raw.subject)}`;
    const sent = numberValue(raw.sent);
    const targeted = numberValue(raw.targeted);
    const failed = numberValue(raw.failed);
    const date = getCampaignDate(campaign);

    return {
      id: `campaign-${id}`,
      type: 'campaign' as RecordType,
      title: stringValue(raw.subject) || 'Untitled campaign',
      subtitle: `Sent ${formatNumber(sent)} / ${formatNumber(targeted)} · Failed ${formatNumber(failed)}`,
      status: failed > 0 ? 'attention' : 'sent',
      date,
      href: '/dashboard/email-marketing',
      payload: campaign,
    };
  });

  const products = snapshot.storeProducts.slice(0, 20).map((product) => {
    const raw = asRecord(product);
    const id = stringValue(raw.id) || stringValue(raw.uuid) || `product-${stringValue(raw.name)}`;
    const stock = numberValue(raw.stock);
    const isActive = Boolean(raw.isActive ?? raw.is_active);

    return {
      id: `product-${id}`,
      type: 'product' as RecordType,
      title: stringValue(raw.name) || stringValue(raw.title) || 'Store product',
      subtitle: `${formatNumber(stock)} in stock`,
      status: !isActive ? 'inactive' : stock > 0 && stock <= 5 ? 'low stock' : 'active',
      date: stringValue(raw.updatedAt) || stringValue(raw.createdAt),
      href: '/dashboard/store',
      payload: product,
    };
  });

  const orders = orderItems.slice(0, 20).map((order) => {
    const raw = asRecord(order);
    const id = stringValue(raw.id) || stringValue(raw.orderId) || stringValue(raw.order_id) || `order-${stringValue(raw.createdAt)}`;
    const date = getOrderDate(order);

    return {
      id: `order-${id}`,
      type: 'order' as RecordType,
      title: stringValue(raw.customerName) || stringValue(raw.customer_name) || stringValue(raw.name) || 'Store order',
      subtitle: `${stringValue(raw.email) || 'No email'} · ${formatDate(date)}`,
      status: stringValue(raw.status) || 'order',
      date,
      href: '/dashboard/store',
      payload: order,
    };
  });

  const audits = snapshot.auditLogs.slice(0, 40).map((audit) => {
    const raw = asRecord(audit);
    const id = stringValue(raw.id) || `audit-${stringValue(raw.createdAt) || stringValue(raw.created_at)}`;
    const date = stringValue(raw.createdAt) || stringValue(raw.created_at);

    return {
      id: `audit-${id}`,
      type: 'audit' as RecordType,
      title: stringValue(raw.action) || stringValue(raw.description) || 'Audit event',
      subtitle: `${stringValue(raw.actor) || 'System'} · ${stringValue(raw.resource) || 'Platform'}`,
      status: stringValue(raw.status) || 'logged',
      date,
      payload: audit,
    };
  });

  return [...events, ...submissions, ...campaigns, ...products, ...orders, ...audits].sort(
    (a, b) => toDateValue(b.date) - toDateValue(a.date)
  );
}

function buildTimeline(snapshot: DashboardSnapshot): TimelineItem[] {
  return buildOperationalRecords(snapshot)
    .slice(0, 16)
    .map((record) => ({
      id: record.id,
      type: record.type,
      title: record.title,
      description: record.subtitle,
      time: record.date,
      status: record.status,
    }));
}

function buildInsights(snapshot: DashboardSnapshot): Array<{ title: string; description: string; tone: string }> {
  const insights: Array<{ title: string; description: string; tone: string }> = [];
  const upcoming = numberValue((snapshot.analytics as RawRecord | null)?.upcomingEvents);
  const totalMembers = numberValue((snapshot.memberStats as RawRecord | null)?.total);
  const newThisMonth = numberValue((snapshot.newMembers as RawRecord | null)?.thisMonth);
  const totalWorkforce = numberValue((snapshot.workforceStats as RawRecord | null)?.total);
  const serving = numberValue(asRecord((snapshot.workforceStats as RawRecord | null)?.byStatus).serving);
  const lowStock = snapshot.storeProducts.filter((item) => numberValue(asRecord(item).stock) > 0 && numberValue(asRecord(item).stock) <= 5).length;

  if (upcoming === 0) {
    insights.push({
      title: 'Event pipeline needs attention',
      description: 'There are no upcoming events in the live event feed. Add upcoming services, outreach, or programs to keep planning visible.',
      tone: 'border-amber-200 bg-amber-50 text-amber-800',
    });
  }

  if (totalMembers > 0 && newThisMonth === 0) {
    insights.push({
      title: 'Membership acquisition is flat this month',
      description: 'No new members are recorded this month. Review follow-up workflows, forms, and outreach conversion.',
      tone: 'border-blue-200 bg-blue-50 text-blue-800',
    });
  }

  if (totalWorkforce > 0 && serving / Math.max(totalWorkforce, 1) < 0.5) {
    insights.push({
      title: 'Workforce engagement is below target',
      description: 'Less than half of workforce profiles are currently marked as serving. Review onboarding and departmental assignment.',
      tone: 'border-rose-200 bg-rose-50 text-rose-800',
    });
  }

  if (lowStock > 0) {
    insights.push({
      title: 'Store stock action required',
      description: `${formatNumber(lowStock)} active product${lowStock === 1 ? '' : 's'} are at low stock level. Restock or pause visibility before orders are affected.`,
      tone: 'border-violet-200 bg-violet-50 text-violet-800',
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: 'Operations are stable',
      description: 'No immediate attention flags were detected from the current live dashboard data.',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    });
  }

  return insights;
}

function getRecordIcon(type: RecordType) {
  switch (type) {
    case 'event':
      return CalendarDays;
    case 'submission':
      return ClipboardList;
    case 'campaign':
      return Megaphone;
    case 'product':
    case 'order':
      return ShoppingBag;
    case 'audit':
      return Activity;
    default:
      return Sparkles;
  }
}

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [commandOpen, setCommandOpen] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState<DashboardRecord | null>(null);
  const [query, setQuery] = useState('');
  const [recordType, setRecordType] = useState<RecordType | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    events: true,
    campaigns: true,
    registrations: true,
    store: false,
  });

  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    analytics: null,
    events: [],
    formStats: null,
    marketing: null,
    memberStats: null,
    newMembers: null,
    workforceStats: null,
    storeProducts: [],
    storeOrders: null,
    auditLogs: [],
  });

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
        auditLogsResult,
      ] = await Promise.allSettled([
        apiClient.getAnalytics(),
        apiClient.getEvents({ page: 1, limit: 12 }),
        apiClient.getFormStats(),
        apiClient.getEmailMarketingSummary(),
        apiClient.getMemberStats(),
        apiClient.getNewMemberDashboard(),
        apiClient.getWorkforceStats(),
        apiClient.listStoreProductsAdmin(true),
        apiClient.listStoreOrders({ page: 1, limit: 20 }),
        optionalGet<AuditLogRecord[]>('/api/v1/admin/audit-logs?page=1&limit=50'),
      ]);

      const nextSnapshot: DashboardSnapshot = {
        analytics: analyticsResult.status === 'fulfilled' ? analyticsResult.value : null,
        events:
          eventsResult.status === 'fulfilled' && Array.isArray(eventsResult.value.data)
            ? eventsResult.value.data
            : [],
        formStats: formStatsResult.status === 'fulfilled' ? formStatsResult.value : null,
        marketing: marketingResult.status === 'fulfilled' ? marketingResult.value : null,
        memberStats: memberStatsResult.status === 'fulfilled' ? memberStatsResult.value : null,
        newMembers: newMembersResult.status === 'fulfilled' ? newMembersResult.value : null,
        workforceStats: workforceStatsResult.status === 'fulfilled' ? workforceStatsResult.value : null,
        storeProducts: storeProductsResult.status === 'fulfilled' ? storeProductsResult.value : [],
        storeOrders: storeOrdersResult.status === 'fulfilled' ? storeOrdersResult.value : null,
        auditLogs: auditLogsResult.status === 'fulfilled' && Array.isArray(auditLogsResult.value) ? auditLogsResult.value : [],
      };

      setSnapshot(nextSnapshot);

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
      ].some((result) => result.status === 'rejected');

      if (failed) {
        toast.error('Some dashboard data could not be loaded');
      } else if (silent) {
        toast.success('Dashboard refreshed');
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

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const pressed = isMac ? event.metaKey && event.key.toLowerCase() === 'k' : event.ctrlKey && event.key.toLowerCase() === 'k';
      if (pressed) {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        setDrawerRecord(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, recordType, sortKey, sortDirection]);

  const monthlyStats = useMemo(() => snapshot.analytics?.monthlyStats ?? [], [snapshot.analytics]);
  const eventsByCategory = useMemo(() => snapshot.analytics?.eventsByCategory ?? {}, [snapshot.analytics]);
  const recentSubmissions = useMemo(() => extractArray<unknown>((snapshot.formStats as RawRecord | null)?.recent ?? []), [snapshot.formStats]);
  // const recentCampaigns = useMemo(() => extractArray<unknown>((snapshot.marketing as RawRecord | null)?.recentCampaigns ?? []), [snapshot.marketing]);
  // const orderItems = useMemo(() => extractArray<unknown>(snapshot.storeOrders), [snapshot.storeOrders]);
  const activeProducts = useMemo(() => snapshot.storeProducts.filter((item) => Boolean(asRecord(item).isActive ?? asRecord(item).is_active)).length, [snapshot.storeProducts]);
  const lowStockProducts = useMemo(
    () => snapshot.storeProducts.filter((item) => {
      const stock = numberValue(asRecord(item).stock);
      return stock > 0 && stock <= 5;
    }).length,
    [snapshot.storeProducts]
  );

  const workforceDepartments = useMemo(
    () => Object.entries(asRecord((snapshot.workforceStats as RawRecord | null)?.byDepartment))
      .map(([department, count]) => [department, numberValue(count)] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
    [snapshot.workforceStats]
  );

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return snapshot.events
      .filter((event) => {
        const rawDate = getEventDate(event);
        if (!rawDate) return false;
        const parsed = new Date(rawDate);
        return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= now;
      })
      .sort((a, b) => toDateValue(getEventDate(a)) - toDateValue(getEventDate(b)))
      .slice(0, 6);
  }, [snapshot.events]);

  const records = useMemo(() => buildOperationalRecords(snapshot), [snapshot]);
  const timeline = useMemo(() => buildTimeline(snapshot), [snapshot]);
  const insights = useMemo(() => buildInsights(snapshot), [snapshot]);

  const submissionsTrend = useMemo(() => {
    const counts: Record<string, number> = {};
    recentSubmissions.forEach((submission) => {
      const key = dayKey(getSubmissionDate(submission));
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });

    const labels = Object.keys(counts).sort().slice(-14);
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
          borderColor: chartColors.emerald,
          backgroundColor: chartColors.emeraldSoft,
          borderWidth: 3,
          fill: true,
          tension: 0.42,
          pointRadius: 3,
        },
        {
          label: 'Attendees',
          data: monthlyStats.map((row) => row.attendees),
          borderColor: chartColors.blue,
          backgroundColor: chartColors.blueSoft,
          borderWidth: 3,
          fill: true,
          tension: 0.42,
          pointRadius: 3,
        },
      ],
    }),
    [monthlyStats]
  );

  const categoryChartData = useMemo(
    () => ({
      labels: Object.keys(eventsByCategory).map(normalizeLabel),
      datasets: [
        {
          data: Object.values(eventsByCategory),
          backgroundColor: [chartColors.blue, chartColors.emerald, chartColors.amber, chartColors.violet, chartColors.rose, chartColors.cyan],
          borderColor: '#ffffff',
          borderWidth: 4,
          hoverOffset: 8,
        },
      ],
    }),
    [eventsByCategory]
  );

  const submissionsChartData = useMemo(
    () => ({
      labels: submissionsTrend.labels.map((label) => formatDate(label)),
      datasets: [
        {
          label: 'Submissions',
          data: submissionsTrend.values,
          backgroundColor: chartColors.amberSoft,
          borderColor: chartColors.amber,
          borderWidth: 2,
          borderRadius: 12,
        },
      ],
    }),
    [submissionsTrend]
  );

  const workforceChartData = useMemo(
    () => ({
      labels: workforceDepartments.map(([department]) => normalizeLabel(department)),
      datasets: [
        {
          label: 'Workers',
          data: workforceDepartments.map(([, count]) => count),
          backgroundColor: chartColors.blueSoft,
          borderColor: chartColors.blue,
          borderWidth: 2,
          borderRadius: 10,
        },
      ],
    }),
    [workforceDepartments]
  );

  const totalEvents = numberValue((snapshot.analytics as RawRecord | null)?.totalEvents);
  const upcomingEventCount = numberValue((snapshot.analytics as RawRecord | null)?.upcomingEvents);
  const totalAttendees = numberValue((snapshot.analytics as RawRecord | null)?.totalAttendees);
  const reachableRecipients = numberValue((snapshot.marketing as RawRecord | null)?.reachableRecipients);
  const publishedForms = numberValue((snapshot.marketing as RawRecord | null)?.publishedForms);
  const totalSubmissions = numberValue((snapshot.formStats as RawRecord | null)?.totalSubmissions);
  const totalMembers = numberValue((snapshot.memberStats as RawRecord | null)?.total);
  const activeMembers = numberValue((snapshot.memberStats as RawRecord | null)?.active);
  const newMembersThisMonth = numberValue((snapshot.newMembers as RawRecord | null)?.thisMonth);
  const newMembersThisYear = numberValue((snapshot.newMembers as RawRecord | null)?.thisYear);
  const workforceServing = numberValue(asRecord((snapshot.workforceStats as RawRecord | null)?.byStatus).serving);
  const workforceTotal = numberValue((snapshot.workforceStats as RawRecord | null)?.total);
  const totalOrders = numberValue((snapshot.storeOrders as RawRecord | null)?.total);

  const currentMonthEvents = monthlyStats[monthlyStats.length - 1]?.events ?? 0;
  const previousMonthEvents = monthlyStats[monthlyStats.length - 2]?.events ?? 0;
  const eventDelta = metricDelta(currentMonthEvents, previousMonthEvents);
  const forecastEvents = forecastNext(monthlyStats.map((row) => row.events));
  const forecastAttendees = forecastNext(monthlyStats.map((row) => row.attendees));

  const kpis = [
    {
      label: 'Events',
      value: formatNumber(totalEvents),
      hint: `${formatNumber(upcomingEventCount)} upcoming`,
      icon: CalendarDays,
      accent: 'from-blue-500/20 to-cyan-500/5 text-blue-700 border-blue-200',
      delta: eventDelta.label,
      positive: eventDelta.positive,
    },
    {
      label: 'Attendees',
      value: formatNumber(totalAttendees),
      hint: 'Across recorded events',
      icon: Users,
      accent: 'from-emerald-500/20 to-green-500/5 text-emerald-700 border-emerald-200',
    },
    {
      label: 'Audience',
      value: formatNumber(reachableRecipients),
      hint: `${formatNumber(publishedForms)} published forms`,
      icon: Mail,
      accent: 'from-violet-500/20 to-fuchsia-500/5 text-violet-700 border-violet-200',
    },
    {
      label: 'Submissions',
      value: formatNumber(totalSubmissions),
      hint: 'Captured form responses',
      icon: ClipboardList,
      accent: 'from-amber-500/20 to-yellow-500/5 text-amber-700 border-amber-200',
    },
    {
      label: 'Members',
      value: formatNumber(totalMembers),
      hint: `${formatNumber(activeMembers)} active profiles`,
      icon: Users,
      accent: 'from-sky-500/20 to-blue-500/5 text-sky-700 border-sky-200',
    },
    {
      label: 'New Members',
      value: formatNumber(newMembersThisMonth),
      hint: `${formatNumber(newMembersThisYear)} this year`,
      icon: UserPlus,
      accent: 'from-rose-500/20 to-pink-500/5 text-rose-700 border-rose-200',
    },
    {
      label: 'Workforce',
      value: formatNumber(workforceServing),
      hint: `${formatNumber(workforceTotal)} total profiles`,
      icon: TrendingUp,
      accent: 'from-lime-500/20 to-emerald-500/5 text-lime-700 border-lime-200',
    },
    {
      label: 'Store',
      value: formatNumber(activeProducts),
      hint: `${formatNumber(totalOrders)} orders · ${formatNumber(lowStockProducts)} low stock`,
      icon: ShoppingBag,
      accent: 'from-slate-300 to-white text-slate-800 border-slate-200',
    },
  ];

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = records.filter((record) => {
      const matchesType = recordType === 'all' || record.type === recordType;
      const haystack = `${record.title} ${record.subtitle} ${record.status} ${record.type}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      return matchesType && matchesQuery;
    });

    filtered.sort((a, b) => {
      let left = '';
      let right = '';

      if (sortKey === 'title') {
        left = a.title;
        right = b.title;
      } else if (sortKey === 'type') {
        left = a.type;
        right = b.type;
      } else if (sortKey === 'status') {
        left = a.status;
        right = b.status;
      } else {
        const result = toDateValue(a.date) - toDateValue(b.date);
        return sortDirection === 'asc' ? result : -result;
      }

      const result = left.localeCompare(right);
      return sortDirection === 'asc' ? result : -result;
    });

    return filtered;
  }, [records, query, recordType, sortDirection, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const runCommand = (nextTab: TabKey) => {
    setActiveTab(nextTab);
    setCommandOpen(false);
  };

  const toggleAccordion = (key: string) => {
    setExpandedSections((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 pb-10">
      <HeroSection refreshing={refreshing} onRefresh={() => void loadDashboard(true)} onCommand={() => setCommandOpen(true)} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
        <ExecutiveSummary
          insights={insights}
          forecastEvents={forecastEvents}
          forecastAttendees={forecastAttendees}
          upcomingEvents={upcomingEvents.length}
          lowStock={lowStockProducts}
        />
        <CommandCenter onTab={setActiveTab} onRefresh={() => void loadDashboard(true)} onCommand={() => setCommandOpen(true)} />
      </section>

      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' ? (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <ChartCard title="Monthly performance" subtitle="Events and attendees from live analytics." icon={LineChart}>
            {monthlyStats.length > 0 ? <Line data={monthlyChartData} options={lineOptions} /> : <EmptyState message="No monthly analytics available yet." />}
          </ChartCard>

          <ChartCard title="Event category mix" subtitle="Distribution by event category." icon={BarChart3}>
            {Object.keys(eventsByCategory).length > 0 ? <Doughnut data={categoryChartData} options={doughnutOptions} /> : <EmptyState message="No event category data available." />}
          </ChartCard>

          <AccordionSection
            title="Upcoming events"
            description="Live event schedule from backend records."
            open={expandedSections.events}
            onToggle={() => toggleAccordion('events')}
          >
            <CompactRecordList
              records={records.filter((record) => record.type === 'event').slice(0, 8)}
              empty="No event records found."
              onOpen={setDrawerRecord}
            />
          </AccordionSection>

          <AccordionSection
            title="Recent registrations"
            description="Latest form responses and captured church data."
            open={expandedSections.registrations}
            onToggle={() => toggleAccordion('registrations')}
          >
            <CompactRecordList
              records={records.filter((record) => record.type === 'submission').slice(0, 8)}
              empty="No recent registrations found."
              onOpen={setDrawerRecord}
            />
          </AccordionSection>
        </div>
      ) : null}

      {activeTab === 'analytics' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Submission velocity" subtitle="Recent form responses grouped by day." icon={ClipboardList}>
            {submissionsTrend.labels.length > 0 ? <Bar data={submissionsChartData} options={barOptions} /> : <EmptyState message="No recent submissions captured yet." />}
          </ChartCard>

          <ChartCard title="Workforce department coverage" subtitle="Department load from workforce records." icon={Users}>
            {workforceDepartments.length > 0 ? <Bar data={workforceChartData} options={horizontalBarOptions} /> : <EmptyState message="No department records yet." />}
          </ChartCard>

          <MetricPanel title="Membership pulse">
            <PulseRow label="Total members" value={totalMembers} />
            <PulseRow label="Active members" value={activeMembers} />
            <PulseRow label="New this month" value={newMembersThisMonth} />
            <PulseRow label="New this year" value={newMembersThisYear} />
          </MetricPanel>

          <MetricPanel title="Workforce and store health">
            <PulseRow label="Serving workforce" value={workforceServing} />
            <PulseRow label="Total workforce" value={workforceTotal} />
            <PulseRow label="Active products" value={activeProducts} />
            <PulseRow label="Low stock products" value={lowStockProducts} />
          </MetricPanel>
        </div>
      ) : null}

      {activeTab === 'records' ? (
        <RecordsWorkspace
          query={query}
          onQuery={setQuery}
          recordType={recordType}
          onRecordType={setRecordType}
          sortKey={sortKey}
          onSortKey={setSortKey}
          sortDirection={sortDirection}
          onSortDirection={setSortDirection}
          records={pagedRecords}
          total={filteredRecords.length}
          page={currentPage}
          pageCount={pageCount}
          onPage={setPage}
          onOpen={setDrawerRecord}
        />
      ) : null}

      {activeTab === 'activity' ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <ActivityTimeline items={timeline} onOpen={(id) => setDrawerRecord(records.find((record) => record.id === id) ?? null)} />
          <AccordionSection
            title="Campaign and store activity"
            description="Backend-driven campaign, product, and order movement."
            open={expandedSections.campaigns}
            onToggle={() => toggleAccordion('campaigns')}
          >
            <CompactRecordList
              records={records.filter((record) => ['campaign', 'product', 'order'].includes(record.type)).slice(0, 12)}
              empty="No campaign or store activity found."
              onOpen={setDrawerRecord}
            />
          </AccordionSection>
        </div>
      ) : null}

      <OperationalShortcuts />

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onRun={runCommand} onRefresh={() => void loadDashboard(true)} />
      <RecordDrawer record={drawerRecord} onClose={() => setDrawerRecord(null)} />
    </div>
  );
}

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const },
    tooltip: { mode: 'index' as const, intersect: false },
  },
  scales: {
    y: { beginAtZero: true, ticks: { precision: 0 } },
    x: { grid: { display: false } },
  },
  interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
};

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, ticks: { precision: 0 } },
    x: { grid: { display: false } },
  },
};

const horizontalBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 } },
    y: { grid: { display: false } },
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: { position: 'bottom' as const },
  },
};

function HeroSection({ refreshing, onRefresh, onCommand }: { refreshing: boolean; onRefresh: () => void; onCommand: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[calc(var(--radius-card)+8px)] border border-[var(--color-border-secondary)] bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_34%),linear-gradient(135deg,var(--color-background-secondary),var(--color-background-primary))] p-5 shadow-sm sm:p-6 xl:p-7">
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[var(--color-accent-primary)]/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]/80 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)] shadow-sm backdrop-blur">
            <Activity className="h-3.5 w-3.5" />
            Main Admin Command Dashboard
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)] md:text-4xl">
            Real-time church operations, growth intelligence, and outreach control center.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)] md:text-base">
            Monitor events, members, forms, submissions, campaigns, workforce, and store operations from live backend data. No mock or placeholder data is used.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row xl:flex-col 2xl:flex-row">
          <button
            type="button"
            onClick={onCommand}
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-4 py-2.5 text-sm font-black text-[var(--color-text-primary)] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-[var(--color-background-hover)]"
          >
            <Command className="h-4 w-4" />
            Command palette
            <span className="rounded-md border border-[var(--color-border-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">⌘K</span>
          </button>

          <Button
            variant="outline"
            onClick={onRefresh}
            loading={refreshing}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh live data
          </Button>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  delta,
  positive,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Activity;
  accent: string;
  delta?: string;
  positive?: boolean;
}) {
  return (
    <article className={`group overflow-hidden rounded-[var(--radius-card)] border bg-gradient-to-br p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md ${accent}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">{hint}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/85 shadow-sm transition duration-300 group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {delta ? (
        <div className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {delta} vs previous month
        </div>
      ) : null}
    </article>
  );
}

function ExecutiveSummary({
  insights,
  forecastEvents,
  forecastAttendees,
  upcomingEvents,
  lowStock,
}: {
  insights: Array<{ title: string; description: string; tone: string }>;
  forecastEvents: number | null;
  forecastAttendees: number | null;
  upcomingEvents: number;
  lowStock: number;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-[var(--color-text-primary)]">Smart executive summary</h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Computed from live platform data, not assumptions.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
          <Sparkles className="h-3.5 w-3.5" />
          Smart system
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <SummaryWidget label="Next month event forecast" value={forecastEvents === null ? 'Insufficient data' : formatNumber(forecastEvents)} />
        <SummaryWidget label="Next month attendee forecast" value={forecastAttendees === null ? 'Insufficient data' : formatNumber(forecastAttendees)} />
        <SummaryWidget label="Operational watch" value={`${formatNumber(upcomingEvents)} events · ${formatNumber(lowStock)} stock alerts`} />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {insights.map((insight) => (
          <div key={insight.title} className={`rounded-2xl border p-4 ${insight.tone}`}>
            <div className="text-sm font-black">{insight.title}</div>
            <p className="mt-1 text-sm leading-6 opacity-85">{insight.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryWidget({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-2 text-lg font-black text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function CommandCenter({ onTab, onRefresh, onCommand }: { onTab: (tab: TabKey) => void; onRefresh: () => void; onCommand: () => void }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-slate-950 p-5 text-white shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black">Command center</h2>
          <p className="mt-1 text-sm text-white/60">Fast access to the operational layers of the dashboard.</p>
        </div>
        <Command className="h-5 w-5 text-white/60" />
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <CommandButton label="Open records" icon={ClipboardList} onClick={() => onTab('records')} />
        <CommandButton label="Open activity" icon={Activity} onClick={() => onTab('activity')} />
        <CommandButton label="Analytics" icon={LineChart} onClick={() => onTab('analytics')} />
        <CommandButton label="Refresh data" icon={RefreshCw} onClick={onRefresh} />
      </div>

      <button
        type="button"
        onClick={onCommand}
        className="mt-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left text-sm font-bold text-white/85 transition hover:bg-white/15"
      >
        Search commands and pages
        <span className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/50">Ctrl/⌘ K</span>
      </button>
    </section>
  );
}

function CommandButton({ label, icon: Icon, onClick }: { label: string; icon: typeof Activity; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-bold text-white/85 transition duration-300 hover:-translate-y-0.5 hover:bg-white/10"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function TabNavigation({ activeTab, onChange }: { activeTab: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-2 shadow-sm">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition duration-300 ${
                active
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Activity; children: ReactNode }) {
  return (
    <article className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm transition duration-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-[var(--color-text-primary)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-slate-950 p-3 text-white">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 h-[320px]">{children}</div>
    </article>
  );
}

function AccordionSection({ title, description, open, onToggle, children }: { title: string; description: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[var(--color-background-hover)]"
      >
        <div>
          <h2 className="text-base font-black text-[var(--color-text-primary)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{description}</p>
        </div>
        <ChevronDown className={`h-5 w-5 text-[var(--color-text-tertiary)] transition duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-[var(--color-border-secondary)] p-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

function CompactRecordList({ records, empty, onOpen }: { records: DashboardRecord[]; empty: string; onOpen: (record: DashboardRecord) => void }) {
  if (records.length === 0) return <EmptyState message={empty} />;

  return (
    <div className="space-y-3">
      {records.map((record) => {
        const Icon = getRecordIcon(record.type);
        return (
          <button
            key={record.id}
            type="button"
            onClick={() => onOpen(record)}
            className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3 text-left transition duration-300 hover:-translate-y-0.5 hover:border-[var(--color-border-primary)] hover:bg-[var(--color-background-hover)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-[var(--color-text-primary)]">{record.title}</p>
              <p className="truncate text-xs text-[var(--color-text-tertiary)]">{record.subtitle}</p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
              {normalizeLabel(record.status)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RecordsWorkspace({
  query,
  onQuery,
  recordType,
  onRecordType,
  sortKey,
  onSortKey,
  sortDirection,
  onSortDirection,
  records,
  total,
  page,
  pageCount,
  onPage,
  onOpen,
}: {
  query: string;
  onQuery: (value: string) => void;
  recordType: RecordType | 'all';
  onRecordType: (value: RecordType | 'all') => void;
  sortKey: SortKey;
  onSortKey: (value: SortKey) => void;
  sortDirection: SortDirection;
  onSortDirection: (value: SortDirection) => void;
  records: DashboardRecord[];
  total: number;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  onOpen: (record: DashboardRecord) => void;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-[var(--color-text-primary)]">Operational records</h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Search, filter, sort, paginate, and inspect live records.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--color-text-tertiary)]" />
            <input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search records..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)] sm:w-64"
            />
          </div>
          <select
            value={recordType}
            onChange={(event) => onRecordType(event.target.value as RecordType | 'all')}
            className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm font-bold text-[var(--color-text-primary)] outline-none"
          >
            <option value="all">All records</option>
            <option value="event">Events</option>
            <option value="submission">Submissions</option>
            <option value="campaign">Campaigns</option>
            <option value="product">Products</option>
            <option value="order">Orders</option>
            <option value="audit">Audit logs</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <Filter className="h-4 w-4 text-[var(--color-text-tertiary)]" />
        {(['date', 'title', 'type', 'status'] as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onSortKey(key)}
            className={`rounded-full px-3 py-1.5 font-black transition ${sortKey === key ? 'bg-slate-950 text-white' : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)]'}`}
          >
            Sort: {normalizeLabel(key)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
          className="rounded-full bg-[var(--color-background-secondary)] px-3 py-1.5 font-black text-[var(--color-text-secondary)] transition hover:bg-[var(--color-background-hover)]"
        >
          {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--color-border-secondary)]">
        <div className="hidden grid-cols-[1.35fr_120px_140px_150px_90px] gap-4 bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wide text-white lg:grid">
          <div>Record</div>
          <div>Type</div>
          <div>Status</div>
          <div>Date</div>
          <div className="text-right">Action</div>
        </div>
        <div className="divide-y divide-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
          {records.map((record) => {
            const Icon = getRecordIcon(record.type);
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => onOpen(record)}
                className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[var(--color-background-hover)] lg:grid-cols-[1.35fr_120px_140px_150px_90px] lg:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--color-text-primary)]">{record.title}</p>
                    <p className="truncate text-xs text-[var(--color-text-tertiary)]">{record.subtitle}</p>
                  </div>
                </div>
                <div className="text-sm font-bold text-[var(--color-text-secondary)]">{normalizeLabel(record.type)}</div>
                <div>
                  <span className="rounded-full bg-[var(--color-background-secondary)] px-3 py-1 text-xs font-black text-[var(--color-text-secondary)]">
                    {normalizeLabel(record.status)}
                  </span>
                </div>
                <div className="text-sm text-[var(--color-text-tertiary)]">{formatDate(record.date)}</div>
                <div className="text-left lg:text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-black text-[var(--color-accent-primary)]">
                    View <Eye className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
          {records.length === 0 ? <div className="p-5"><EmptyState message="No records match your current filters." /></div> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[var(--color-text-tertiary)]">
          Showing {formatNumber(records.length)} of {formatNumber(total)} records
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-2xl border border-[var(--color-border-secondary)] p-2 transition hover:bg-[var(--color-background-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-black text-[var(--color-text-primary)]">Page {page} of {pageCount}</span>
          <button
            type="button"
            onClick={() => onPage(Math.min(pageCount, page + 1))}
            disabled={page >= pageCount}
            className="rounded-2xl border border-[var(--color-border-secondary)] p-2 transition hover:bg-[var(--color-background-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function ActivityTimeline({ items, onOpen }: { items: TimelineItem[]; onOpen: (id: string) => void }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-[var(--color-text-primary)]">Activity timeline / audit trail</h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Latest platform movement from live events, campaigns, forms, store and audit endpoints.</p>
        </div>
        <Activity className="h-5 w-5 text-[var(--color-accent-primary)]" />
      </div>

      <div className="mt-6 space-y-4">
        {items.map((item, index) => {
          const Icon = getRecordIcon(item.type);
          return (
            <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="group grid w-full grid-cols-[40px_1fr] gap-3 text-left">
              <div className="relative flex justify-center">
                <div className="z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white transition group-hover:scale-105">
                  <Icon className="h-4 w-4" />
                </div>
                {index < items.length - 1 ? <div className="absolute top-10 h-[calc(100%+1rem)] w-px bg-[var(--color-border-secondary)]" /> : null}
              </div>
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3 transition duration-300 group-hover:-translate-y-0.5 group-hover:bg-[var(--color-background-hover)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-[var(--color-text-primary)]">{item.title}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">{normalizeLabel(item.status || item.type)}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{item.description}</p>
                <p className="mt-2 text-xs font-bold text-[var(--color-text-secondary)]">{formatDateTime(item.time)}</p>
              </div>
            </button>
          );
        })}
        {items.length === 0 ? <EmptyState message="No activity records are available yet." /> : null}
      </div>
    </section>
  );
}

function MetricPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
      <h2 className="text-base font-black text-[var(--color-text-primary)]">{title}</h2>
      <div className="mt-4 space-y-2">{children}</div>
    </section>
  );
}

function PulseRow({ label, value }: { label: string; value: number }) {
  return (
    <details className="group rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 transition hover:bg-[var(--color-background-hover)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
        <span className="font-bold text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-black text-[var(--color-text-primary)]">{formatNumber(value)}</span>
      </summary>
      <p className="mt-2 text-xs leading-5 text-[var(--color-text-tertiary)]">Live count from saved backend operational records.</p>
    </details>
  );
}

function OperationalShortcuts() {
  const shortcuts = [
    { href: '/dashboard/event', label: 'Events', icon: CalendarDays },
    { href: '/dashboard/forms', label: 'Forms', icon: ClipboardList },
    { href: '/dashboard/administration', label: 'Administration', icon: Users },
    { href: '/dashboard/email-marketing', label: 'Campaigns', icon: Megaphone },
    { href: '/dashboard/store', label: 'Store', icon: ShoppingBag },
  ];

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black text-[var(--color-text-primary)]">Operational shortcuts</h2>
          <p className="text-sm text-[var(--color-text-tertiary)]">Go directly to the core admin workflows.</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-sm font-black text-[var(--color-text-primary)] transition hover:bg-[var(--color-background-hover)]"
        >
          <Download className="h-4 w-4" />
          Print / Export
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3 text-sm font-black text-[var(--color-text-primary)] transition duration-300 hover:-translate-y-0.5 hover:bg-[var(--color-background-hover)]"
            >
              <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4" /> {shortcut.label}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function CommandPalette({ open, onClose, onRun, onRefresh }: { open: boolean; onClose: () => void; onRun: (tab: TabKey) => void; onRefresh: () => void }) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  if (!open) return null;

  const commands = [
    { label: 'Open overview', hint: 'Dashboard home', action: () => onRun('overview') },
    { label: 'Open analytics', hint: 'Charts and trends', action: () => onRun('analytics') },
    { label: 'Open records', hint: 'Searchable operational table', action: () => onRun('records') },
    { label: 'Open activity', hint: 'Timeline and audit movement', action: () => onRun('activity') },
    { label: 'Refresh dashboard', hint: 'Reload live backend data', action: onRefresh },
  ].filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(search.toLowerCase().trim()));

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && commands[0]) {
      commands[0].action();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-3 pt-20 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[var(--color-background-primary)] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--color-border-secondary)] px-4 py-3">
          <Command className="h-5 w-5 text-[var(--color-text-tertiary)]" />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleKey}
            placeholder="Search commands, pages, actions..."
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
          <button type="button" onClick={onClose} className="rounded-2xl p-2 transition hover:bg-[var(--color-background-hover)]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {commands.map((command) => (
            <button
              key={command.label}
              type="button"
              onClick={() => {
                command.action();
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-[var(--color-background-hover)]"
            >
              <div>
                <p className="text-sm font-black text-[var(--color-text-primary)]">{command.label}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">{command.hint}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--color-text-tertiary)]" />
            </button>
          ))}
          {commands.length === 0 ? <EmptyState message="No command matches your search." /> : null}
        </div>
      </div>
    </div>
  );
}

function RecordDrawer({ record, onClose }: { record: DashboardRecord | null; onClose: () => void }) {
  if (!record) return null;

  const Icon = getRecordIcon(record.type);
  const payload = asRecord(record.payload);
  const rows = Object.entries(payload)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value === null)
    .slice(0, 18);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm" onMouseDown={onClose}>
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-[var(--color-background-primary)] shadow-2xl transition duration-300"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">{normalizeLabel(record.type)}</p>
                <h2 className="mt-1 text-xl font-black text-[var(--color-text-primary)]">{record.title}</h2>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-2xl border border-[var(--color-border-secondary)] p-2 transition hover:bg-[var(--color-background-hover)]">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
            <p className="text-sm font-bold text-[var(--color-text-secondary)]">{record.subtitle}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">{normalizeLabel(record.status)}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">{formatDateTime(record.date)}</span>
            </div>
            {record.href ? (
              <Link href={record.href} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800">
                Open workflow <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Record fields</h3>
            <div className="mt-3 divide-y divide-[var(--color-border-secondary)] overflow-hidden rounded-2xl border border-[var(--color-border-secondary)]">
              {rows.map(([key, value]) => (
                <div key={key} className="grid grid-cols-[150px_1fr] gap-3 bg-[var(--color-background-primary)] px-4 py-3 text-sm">
                  <div className="font-black text-[var(--color-text-secondary)]">{normalizeLabel(key)}</div>
                  <div className="break-words text-[var(--color-text-primary)]">{String(value ?? '—')}</div>
                </div>
              ))}
              {rows.length === 0 ? <div className="p-4"><EmptyState message="No simple fields are available for this record." /></div> : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-6 text-center text-sm font-semibold text-[var(--color-text-tertiary)]">
      {message}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-56 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={`dashboard-skeleton-${index}`} className="h-36 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-96 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
        <div className="h-96 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]" />
      </div>
    </div>
  );
}

export default withAuth(DashboardPage, { requiredRole: 'admin' });
