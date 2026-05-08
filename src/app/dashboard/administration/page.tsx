'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Cake,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Command,
  Crown,
  Download,
  Eye,
  Heart,
  LayoutDashboard,
  Loader2,
  Mail,
  Megaphone,
  MoreHorizontal,
  PanelRightOpen,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  TrendingUp,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type ChartConfiguration,
  type ChartData,
  type ChartOptions,
  type ChartType,
} from 'chart.js';

ChartJS.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
);

type SegmentKey = 'leadership' | 'members' | 'workforce';
type TrackerMode = 'birthdays' | 'anniversaries';
type SortDirection = 'asc' | 'desc';
type SortKey = 'name' | 'segment' | 'status' | 'createdAt' | 'birthday' | 'anniversary';
type DashboardTab = 'overview' | 'people' | 'analytics' | 'activity';

type RawRecord = Record<string, unknown>;

type ApiEnvelope<T> = {
  status?: string;
  message?: string;
  data?: T;
  items?: unknown;
  results?: unknown;
  records?: unknown;
  total?: number;
  page?: number;
  limit?: number;
};

type EndpointState<T> = {
  items: T[];
  total: number;
  available: boolean;
  error?: string;
};

type PersonRecord = {
  id: string;
  segment: SegmentKey;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  status?: string;
  imageUrl?: string;
  birthdayMonth?: number;
  birthdayDay?: number;
  anniversaryMonth?: number;
  anniversaryDay?: number;
  createdAt?: string;
  updatedAt?: string;
  source?: RawRecord;
};

type MonthCount = {
  month: number;
  label: string;
  count: number;
};

type TrackerItem = {
  id: string;
  segment: SegmentKey;
  type: TrackerMode;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  imageUrl?: string;
  month: number;
  day: number;
  dateLabel: string;
  daysUntil: number;
};

type TimelineItem = {
  id: string;
  title: string;
  description: string;
  actor?: string;
  action?: string;
  createdAt?: string;
  tone: 'slate' | 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';
};

type DashboardData = {
  leadership: PersonRecord[];
  members: PersonRecord[];
  workforce: PersonRecord[];
  allPeople: PersonRecord[];
  forms: RawRecord[];
  campaigns: RawRecord[];
  events: RawRecord[];
  storeItems: RawRecord[];
  auditLogs: TimelineItem[];
  birthdayMonths: MonthCount[];
  anniversaryMonths: MonthCount[];
  upcomingBirthdays: TrackerItem[];
  upcomingAnniversaries: TrackerItem[];
  todayBirthdays: TrackerItem[];
  todayAnniversaries: TrackerItem[];
  endpointHealth: Array<{ label: string; available: boolean; total: number; error?: string }>;
};

type LoadState = {
  loading: boolean;
  refreshing: boolean;
  error: string;
  data: DashboardData | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TRACKING_WINDOW_DAYS = 45;
const PAGE_SIZE_OPTIONS = [8, 12, 20, 40];
const PEOPLE_DISTRIBUTION_LABELS = ['Leadership', 'Members', 'Workforce'] as const;

const PEOPLE_DISTRIBUTION_COLORS = [
  'rgba(245, 158, 11, 0.8)',
  'rgba(37, 99, 235, 0.8)',
  'rgba(16, 185, 129, 0.8)',
] as const;


const segmentMeta: Record<SegmentKey, { label: string; description: string; icon: React.ElementType; tone: string; badge: string }> = {
  leadership: {
    label: 'Leadership',
    description: 'Pastoral and leadership profile records',
    icon: Crown,
    tone: 'from-amber-500/15 via-white to-yellow-500/10 text-amber-700 border-amber-200',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  members: {
    label: 'Members',
    description: 'Church membership records and profile data',
    icon: Users,
    tone: 'from-blue-500/15 via-white to-cyan-500/10 text-blue-700 border-blue-200',
    badge: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  workforce: {
    label: 'Workforce',
    description: 'Workers, departments, and serving records',
    icon: BriefcaseBusiness,
    tone: 'from-emerald-500/15 via-white to-green-500/10 text-emerald-700 border-emerald-200',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
};

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text } as T;
  }
}

function unwrapData<T = unknown>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
}

async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  const json = await readJson<ApiEnvelope<T>>(res);

  if (!res.ok) {
    throw new Error(json.message || `Request failed with status ${res.status}`);
  }

  return unwrapData<T>(json);
}

async function apiGetEndpoint<T = RawRecord>(label: string, path: string): Promise<EndpointState<T>> {
  try {
    const payload = await apiGet(path);
    const list = extractList(payload);
    return {
      items: list.items as T[],
      total: list.total,
      available: true,
    };
  } catch (error) {
    return {
      items: [],
      total: 0,
      available: false,
      error: error instanceof Error ? error.message : `${label} endpoint unavailable`,
    };
  }
}

async function getCSRFToken(): Promise<string> {
  try {
    const payload = await apiGet<RawRecord>('/api/v1/auth/csrf-token');
    return (
      stringValue(payload.csrfToken) ||
      stringValue(payload.csrf_token) ||
      stringValue(payload.token) ||
      stringValue((payload.data as RawRecord | undefined)?.csrfToken) ||
      ''
    );
  } catch {
    return '';
  }
}

async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const csrfToken = await getCSRFToken();
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });

  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);

  const res = await fetch(apiUrl(path), {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers,
    body: JSON.stringify(body ?? {}),
  });

  const json = await readJson<ApiEnvelope<T>>(res);

  if (!res.ok) {
    throw new Error(json.message || `Request failed with status ${res.status}`);
  }

  return unwrapData<T>(json);
}

async function apiGetOptional<T = unknown>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }

  return undefined;
}

function dateValue(value: unknown): string | undefined {
  const raw = stringValue(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function normalizeStatus(value: unknown): string {
  const status = stringValue(value).toLowerCase().replace(/[_-]+/g, ' ');
  return status || 'unknown';
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function firstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = stringValue(value);
    if (text) return text;
  }

  return undefined;
}

function extractList(payload: unknown): { items: RawRecord[]; total: number } {
  const data = unwrapData(payload);

  if (Array.isArray(data)) {
    return { items: data.filter(isRecord), total: data.length };
  }

  if (isRecord(data)) {
    const possibleItems = data.items ?? data.results ?? data.records ?? data.rows ?? data.data;

    if (Array.isArray(possibleItems)) {
      const items = possibleItems.filter(isRecord);
      return { items, total: numberValue(data.total ?? data.count ?? data.totalCount ?? data.total_count) ?? items.length };
    }
  }

  return { items: [], total: 0 };
}

function normalizePerson(record: RawRecord, segment: SegmentKey, index: number): PersonRecord {
  const firstName = firstNonEmpty(record.firstName, record.first_name, record.firstname);
  const lastName = firstNonEmpty(record.lastName, record.last_name, record.lastname);
  const joinedName = [firstName, lastName].filter(Boolean).join(' ');
  const fullName = firstNonEmpty(record.name, record.fullName, record.full_name, joinedName);
  const email = firstNonEmpty(record.email, record.emailAddress, record.email_address);
  const phone = firstNonEmpty(record.phone, record.phoneNumber, record.phone_number, record.contactNumber, record.contact_number);
  const id = firstNonEmpty(record.id, record.uuid, record.userId, record.user_id, email, phone, `${segment}-${index}`) || `${segment}-${index}`;

  return {
    id,
    segment,
    name: fullName || 'Unnamed profile',
    email,
    phone,
    role: firstNonEmpty(record.role, record.leadershipRole, record.leadership_role, record.position, record.title),
    department: firstNonEmpty(record.department, record.ministry, record.unit, record.team),
    status: normalizeStatus(record.status ?? record.approvalStatus ?? record.approval_status ?? record.is_active),
    imageUrl: firstNonEmpty(record.imageUrl, record.image_url, record.photoUrl, record.photo_url, record.photo, record.profileImage, record.profile_image),
    birthdayMonth: numberValue(record.birthdayMonth ?? record.birthday_month),
    birthdayDay: numberValue(record.birthdayDay ?? record.birthday_day),
    anniversaryMonth: numberValue(record.anniversaryMonth ?? record.anniversary_month),
    anniversaryDay: numberValue(record.anniversaryDay ?? record.anniversary_day),
    createdAt: dateValue(record.createdAt ?? record.created_at ?? record.joinedAt ?? record.joined_at),
    updatedAt: dateValue(record.updatedAt ?? record.updated_at),
    source: record,
  };
}

function emptyMonthCounts(): MonthCount[] {
  return MONTH_LABELS.map((label, index) => ({ month: index + 1, label, count: 0 }));
}

function makeMonthCounts(items: PersonRecord[], mode: TrackerMode): MonthCount[] {
  const months = emptyMonthCounts();

  items.forEach((item) => {
    const month = mode === 'birthdays' ? item.birthdayMonth : item.anniversaryMonth;
    if (!month || month < 1 || month > 12) return;
    months[month - 1].count += 1;
  });

  return months;
}

function mergeBackendMonthStats(fallback: MonthCount[], payload: unknown): MonthCount[] {
  if (!payload) return fallback;

  const months = emptyMonthCounts();
  let used = false;
  const data = unwrapData(payload);

  const apply = (month: unknown, count: unknown) => {
    const monthNumber = numberValue(month);
    const countNumber = numberValue(count);
    if (!monthNumber || monthNumber < 1 || monthNumber > 12 || countNumber === undefined) return;
    months[monthNumber - 1].count = countNumber;
    used = true;
  };

  if (Array.isArray(data)) {
    data.forEach((row) => {
      if (!isRecord(row)) return;
      apply(row.month ?? row.monthNumber ?? row.month_number, row.count ?? row.total);
    });
  } else if (isRecord(data)) {
    const rows = data.months ?? data.items ?? data.data;
    if (Array.isArray(rows)) {
      rows.forEach((row) => {
        if (!isRecord(row)) return;
        apply(row.month ?? row.monthNumber ?? row.month_number, row.count ?? row.total);
      });
    }

    const byMonth = data.byMonth ?? data.by_month;
    if (isRecord(byMonth)) {
      Object.entries(byMonth).forEach(([month, count]) => apply(month, count));
    }
  }

  return used ? months : fallback;
}

function combineMonthCounts(groups: MonthCount[][]): MonthCount[] {
  const months = emptyMonthCounts();
  groups.forEach((group) => {
    group.forEach((item) => {
      if (item.month < 1 || item.month > 12) return;
      months[item.month - 1].count += item.count;
    });
  });
  return months;
}

function daysUntilMonthDay(month: number, day: number): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(today.getFullYear(), month - 1, day);

  if (Number.isNaN(target.getTime())) return 9999;
  if (target < today) target = new Date(today.getFullYear() + 1, month - 1, day);

  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function dateLabel(month: number, day: number): string {
  const label = MONTH_LABELS[month - 1] || 'Month';
  return `${label} ${String(day).padStart(2, '0')}`;
}

function buildTrackerItems(items: PersonRecord[], mode: TrackerMode, windowDays = TRACKING_WINDOW_DAYS): TrackerItem[] {
  const results: TrackerItem[] = [];

  for (const item of items) {
    const month = mode === 'birthdays' ? item.birthdayMonth : item.anniversaryMonth;
    const day = mode === 'birthdays' ? item.birthdayDay : item.anniversaryDay;

    if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) continue;

    const daysUntil = daysUntilMonthDay(month, day);
    if (daysUntil > windowDays) continue;

    results.push({
      id: `${mode}-${item.segment}-${item.id}`,
      segment: item.segment,
      type: mode,
      name: item.name,
      email: item.email,
      phone: item.phone,
      role: item.role || item.department,
      imageUrl: item.imageUrl,
      month,
      day,
      daysUntil,
      dateLabel: dateLabel(month, day),
    });
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
}

function extractTodayItems(payload: unknown, mode: TrackerMode, segment: SegmentKey): TrackerItem[] {
  if (!payload) return [];

  const { items } = extractList(payload);
  const results: TrackerItem[] = [];

  items.forEach((record, index) => {
    const person = normalizePerson(record, segment, index);
    const month = mode === 'birthdays' ? person.birthdayMonth : person.anniversaryMonth;
    const day = mode === 'birthdays' ? person.birthdayDay : person.anniversaryDay;

    if (!month || !day) return;

    results.push({
      id: `today-${mode}-${segment}-${person.id}`,
      segment,
      type: mode,
      name: person.name,
      email: person.email,
      phone: person.phone,
      role: person.role || person.department,
      imageUrl: person.imageUrl,
      month,
      day,
      daysUntil: 0,
      dateLabel: dateLabel(month, day),
    });
  });

  return results;
}

function recordCreatedAt(record: RawRecord): string | undefined {
  return dateValue(record.createdAt ?? record.created_at ?? record.sentAt ?? record.sent_at ?? record.startAt ?? record.start_at ?? record.date);
}

function countThisYear(items: Array<{ createdAt?: string; updatedAt?: string } | RawRecord>): number {
  const year = new Date().getFullYear();

  return items.filter((item) => {
    let created: string | undefined;

    if ('createdAt' in item || 'updatedAt' in item) {
      created = dateValue(item.createdAt ?? item.updatedAt);
    } else {
      created = recordCreatedAt(item);
    }

    if (!created) return false;

    const parsed = new Date(created);
    if (Number.isNaN(parsed.getTime())) return false;

    return parsed.getFullYear() === year;
  }).length;
}

function countUpcomingEvents(events: RawRecord[]): number {
  const now = Date.now();
  return events.filter((event) => {
    const raw = dateValue(event.startAt ?? event.start_at ?? event.eventDate ?? event.event_date ?? event.date);
    if (!raw) return false;
    return new Date(raw).getTime() >= now;
  }).length;
}

function extractSubmissionTotal(forms: RawRecord[]): number {
  return forms.reduce((sum, form) => {
    const count = numberValue(
      form.submissionCount ??
        form.submission_count ??
        form.submissionsCount ??
        form.submissions_count ??
        form.totalSubmissions ??
        form.total_submissions ??
        form.responses ??
        form.total,
    );
    return sum + (count ?? 0);
  }, 0);
}

function publishedCount(items: RawRecord[]): number {
  return items.filter((item) => {
    const status = normalizeStatus(item.status ?? item.state ?? item.visibility);
    const published = item.published ?? item.isPublished ?? item.is_published;
    return status === 'published' || status === 'active' || published === true;
  }).length;
}

function lowStockCount(items: RawRecord[]): number {
  return items.filter((item) => {
    const stock = numberValue(item.stock ?? item.quantity ?? item.inventory ?? item.availableQuantity ?? item.available_quantity);
    const threshold = numberValue(item.lowStockThreshold ?? item.low_stock_threshold) ?? 5;
    return stock !== undefined && stock <= threshold;
  }).length;
}

function makeMonthlyGrowth(items: PersonRecord[], forms: RawRecord[], events: RawRecord[]): MonthCount[] {
  const months = emptyMonthCounts();
  const currentYear = new Date().getFullYear();
  const dates: string[] = [
    ...items.map((item) => item.createdAt || item.updatedAt || '').filter(Boolean),
    ...forms.map((item) => recordCreatedAt(item) || '').filter(Boolean),
    ...events.map((item) => recordCreatedAt(item) || '').filter(Boolean),
  ];

  dates.forEach((raw) => {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== currentYear) return;
    months[parsed.getMonth()].count += 1;
  });

  return months;
}

function normalizeTimelineRecord(record: RawRecord, index: number): TimelineItem {
  const action = firstNonEmpty(record.action, record.event, record.type, record.activity, record.operation) || 'activity';
  const actor = firstNonEmpty(record.actorName, record.actor_name, record.userName, record.user_name, record.email, record.actorEmail, record.actor_email);
  const subject = firstNonEmpty(record.subject, record.entity, record.resource, record.target, record.description, record.message);
  const createdAt = dateValue(record.createdAt ?? record.created_at ?? record.timestamp ?? record.time ?? record.date);

  return {
    id: firstNonEmpty(record.id, record.uuid, `${action}-${index}`) || `${action}-${index}`,
    title: titleCase(action),
    description: subject || 'System activity recorded.',
    actor,
    action,
    createdAt,
    tone: timelineTone(action),
  };
}

function timelineTone(action: string): TimelineItem['tone'] {
  const normalized = action.toLowerCase();
  if (normalized.includes('approve') || normalized.includes('create') || normalized.includes('success')) return 'emerald';
  if (normalized.includes('update') || normalized.includes('edit')) return 'blue';
  if (normalized.includes('delete') || normalized.includes('fail') || normalized.includes('reject')) return 'rose';
  if (normalized.includes('login') || normalized.includes('auth')) return 'violet';
  if (normalized.includes('send') || normalized.includes('campaign')) return 'amber';
  return 'slate';
}

function buildDerivedTimeline(data: Pick<DashboardData, 'allPeople' | 'forms' | 'campaigns' | 'events'>): TimelineItem[] {
  const peopleEvents = data.allPeople.map((person) => ({
    id: `person-${person.segment}-${person.id}`,
    title: `${segmentMeta[person.segment].label} profile`,
    description: person.name,
    actor: person.email || person.phone,
    action: 'profile_created',
    createdAt: person.createdAt || person.updatedAt,
    tone: 'blue' as const,
  }));

  const formEvents = data.forms.map((form, index) => ({
    id: `form-${firstNonEmpty(form.id, form.slug, index)}`,
    title: 'Form activity',
    description: firstNonEmpty(form.title, form.name, form.slug) || 'Saved form record',
    actor: `${numberValue(form.submissionCount ?? form.submissions_count ?? form.totalSubmissions) ?? 0} responses`,
    action: 'form_activity',
    createdAt: recordCreatedAt(form),
    tone: 'emerald' as const,
  }));

  const campaignEvents = data.campaigns.map((campaign, index) => ({
    id: `campaign-${firstNonEmpty(campaign.id, index)}`,
    title: 'Campaign activity',
    description: firstNonEmpty(campaign.title, campaign.name, campaign.subject) || 'Saved campaign record',
    actor: firstNonEmpty(campaign.status, campaign.state),
    action: 'campaign_activity',
    createdAt: recordCreatedAt(campaign),
    tone: 'amber' as const,
  }));

  const eventEvents = data.events.map((event, index) => ({
    id: `event-${firstNonEmpty(event.id, index)}`,
    title: 'Event record',
    description: firstNonEmpty(event.title, event.name, event.eventName, event.event_name) || 'Saved event record',
    actor: firstNonEmpty(event.location, event.venue),
    action: 'event_activity',
    createdAt: recordCreatedAt(event),
    tone: 'violet' as const,
  }));

  return [...peopleEvents, ...formEvents, ...campaignEvents, ...eventEvents]
    .filter((item) => item.createdAt)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 20);
}

function formatDate(value?: string): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value?: string): string {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No timestamp';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'WH';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

async function loadOverviewData(): Promise<DashboardData> {
  const [leadershipEndpoint, membersEndpoint, workforceEndpoint, formsEndpoint, campaignsEndpoint, eventsEndpoint, storeEndpoint, auditEndpoint] = await Promise.all([
    apiGetEndpoint<RawRecord>('Leadership', '/api/v1/admin/leadership?page=1&limit=500'),
    apiGetEndpoint<RawRecord>('Members', '/api/v1/admin/members?page=1&limit=500'),
    apiGetEndpoint<RawRecord>('Workforce', '/api/v1/admin/workforce?page=1&limit=500'),
    apiGetEndpoint<RawRecord>('Forms', '/api/v1/admin/forms?page=1&limit=500'),
    apiGetEndpoint<RawRecord>('Campaigns', '/api/v1/admin/email/compose/history?page=1&limit=500'),
    apiGetEndpoint<RawRecord>('Events', '/api/v1/admin/events?page=1&limit=500'),
    apiGetEndpoint<RawRecord>('Store', '/api/v1/admin/store/products?page=1&limit=500'),
    loadAuditLogs(),
  ]);

  const leadership = leadershipEndpoint.items.map((item, index) => normalizePerson(item, 'leadership', index));
  const members = membersEndpoint.items.map((item, index) => normalizePerson(item, 'members', index));
  const workforce = workforceEndpoint.items.map((item, index) => normalizePerson(item, 'workforce', index));
  const allPeople = [...leadership, ...members, ...workforce];

  const [
    leadershipBirthdayStats,
    memberBirthdayStats,
    workforceBirthdayStats,
    leadershipAnniversaryStats,
    leadershipBirthdaysToday,
    memberBirthdaysToday,
    workforceBirthdaysToday,
    leadershipAnniversariesToday,
  ] = await Promise.all([
    apiGetOptional('/api/v1/admin/leadership/birthdays/stats'),
    apiGetOptional('/api/v1/admin/members/birthdays/stats'),
    apiGetOptional('/api/v1/admin/workforce/birthdays/stats'),
    apiGetOptional('/api/v1/admin/leadership/anniversaries/stats'),
    apiGetOptional('/api/v1/admin/leadership/birthdays/today'),
    apiGetOptional('/api/v1/admin/members/birthdays/today'),
    apiGetOptional('/api/v1/admin/workforce/birthdays/today'),
    apiGetOptional('/api/v1/admin/leadership/anniversaries/today'),
  ]);

  let birthdayMonths = makeMonthCounts(allPeople, 'birthdays');
  birthdayMonths = mergeBackendMonthStats(birthdayMonths, leadershipBirthdayStats);
  birthdayMonths = combineMonthCounts([
    birthdayMonths,
    mergeBackendMonthStats(emptyMonthCounts(), memberBirthdayStats),
    mergeBackendMonthStats(emptyMonthCounts(), workforceBirthdayStats),
  ]);

  const anniversaryMonths = mergeBackendMonthStats(makeMonthCounts(leadership, 'anniversaries'), leadershipAnniversaryStats);
  const upcomingBirthdays = buildTrackerItems(allPeople, 'birthdays');
  const upcomingAnniversaries = buildTrackerItems(leadership, 'anniversaries');
  const todayBirthdays = [
    ...extractTodayItems(leadershipBirthdaysToday, 'birthdays', 'leadership'),
    ...extractTodayItems(memberBirthdaysToday, 'birthdays', 'members'),
    ...extractTodayItems(workforceBirthdaysToday, 'birthdays', 'workforce'),
  ];
  const todayAnniversaries = extractTodayItems(leadershipAnniversariesToday, 'anniversaries', 'leadership');

  const baseData = {
    leadership,
    members,
    workforce,
    allPeople,
    forms: formsEndpoint.items,
    campaigns: campaignsEndpoint.items,
    events: eventsEndpoint.items,
    storeItems: storeEndpoint.items,
  };

  const auditLogs = auditEndpoint.items.length > 0 ? auditEndpoint.items : buildDerivedTimeline(baseData);

  return {
    ...baseData,
    auditLogs,
    birthdayMonths,
    anniversaryMonths,
    upcomingBirthdays,
    upcomingAnniversaries,
    todayBirthdays: todayBirthdays.length > 0 ? todayBirthdays : upcomingBirthdays.filter((item) => item.daysUntil === 0),
    todayAnniversaries: todayAnniversaries.length > 0 ? todayAnniversaries : upcomingAnniversaries.filter((item) => item.daysUntil === 0),
    endpointHealth: [
      { label: 'Leadership', available: leadershipEndpoint.available, total: leadershipEndpoint.total, error: leadershipEndpoint.error },
      { label: 'Members', available: membersEndpoint.available, total: membersEndpoint.total, error: membersEndpoint.error },
      { label: 'Workforce', available: workforceEndpoint.available, total: workforceEndpoint.total, error: workforceEndpoint.error },
      { label: 'Forms', available: formsEndpoint.available, total: formsEndpoint.total, error: formsEndpoint.error },
      { label: 'Campaigns', available: campaignsEndpoint.available, total: campaignsEndpoint.total, error: campaignsEndpoint.error },
      { label: 'Events', available: eventsEndpoint.available, total: eventsEndpoint.total, error: eventsEndpoint.error },
      { label: 'Store', available: storeEndpoint.available, total: storeEndpoint.total, error: storeEndpoint.error },
      { label: 'Audit logs', available: auditEndpoint.available, total: auditEndpoint.total, error: auditEndpoint.error },
    ],
  };
}

async function loadAuditLogs(): Promise<EndpointState<TimelineItem>> {
  const endpoints = ['/api/v1/admin/audit-logs?page=1&limit=40', '/api/v1/admin/audit?page=1&limit=40', '/api/v1/admin/activity?page=1&limit=40'];

  for (const endpoint of endpoints) {
    const result = await apiGetEndpoint<RawRecord>('Audit logs', endpoint);
    if (result.available) {
      return {
        items: result.items.map((item, index) => normalizeTimelineRecord(item, index)),
        total: result.total,
        available: true,
      };
    }
  }

  return { items: [], total: 0, available: false, error: 'Audit endpoint unavailable' };
}

function ChartCanvas<T extends ChartType>({
  type,
  data,
  options,
  className,
}: {
  type: T;
  data: ChartData<T>;
  options?: ChartOptions<T>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartJS<T> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    chartRef.current?.destroy();

    const defaultPlugins = {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 18,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        padding: 12,
      },
    };

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: 'easeOutQuart' as const,
      },
      plugins: defaultPlugins,
    };

    const mergedOptions = {
      ...defaultOptions,
      ...(options ?? {}),
      plugins: {
        ...defaultPlugins,
        ...(options?.plugins ?? {}),
      },
    } as ChartOptions<T>;

    const config: ChartConfiguration<T> = {
      type,
      data,
      options: mergedOptions,
    };

    chartRef.current = new ChartJS(canvas, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [type, data, options]);

  return (
    <div className={`relative min-h-[280px] ${className || ''}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}

function KPI({ title, value, subtitle, icon: Icon, tone, trend }: { title: string; value: number | string; subtitle: string; icon: React.ElementType; tone: string; trend?: string }) {
  return (
    <div className={`group overflow-hidden rounded-[1.75rem] border bg-gradient-to-br p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{value}</div>
          <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-600">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-white/85 p-3 shadow-sm ring-1 ring-black/5 transition group-hover:scale-105">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {trend ? <div className="mt-4 rounded-2xl bg-white/70 px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-black/5">{trend}</div> : null}
    </div>
  );
}

function Panel({ title, subtitle, icon: Icon, children, right }: { title: string; subtitle?: string; icon?: React.ElementType; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-sm">
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
          <div>
            <h2 className="text-base font-black text-slate-950 sm:text-lg">{title}</h2>
            {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'red' | 'blue' | 'amber' | 'violet' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-rose-50 text-rose-700 ring-rose-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  } as const;

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1 ${tones[tone]}`}>{children}</span>;
}

function Avatar({ person, size = 'md' }: { person: PersonRecord | TrackerItem; size?: 'sm' | 'md' | 'lg' }) {
  const dimension = size === 'lg' ? 'h-16 w-16 text-lg' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';

  if (person.imageUrl) {
    return (
      <div className={`${dimension} shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={person.imageUrl} alt={person.name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return <div className={`${dimension} flex shrink-0 items-center justify-center rounded-2xl bg-slate-950 font-black text-white`}>{initials(person.name)}</div>;
}

function EmptyState({ label, description }: { label: string; description?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <MoreHorizontal className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-black text-slate-700">{label}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

function SummaryStrip({ data }: { data: DashboardData }) {
  const healthy = data.endpointHealth.filter((item) => item.available).length;
  const total = data.endpointHealth.length;
  const upcomingEvents = countUpcomingEvents(data.events);
  const submissions = extractSubmissionTotal(data.forms);

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <SummaryItem icon={ShieldCheck} label="API health" value={`${healthy}/${total}`} detail="connected data modules" />
      <SummaryItem icon={CalendarDays} label="Upcoming events" value={upcomingEvents} detail={`${data.events.length} event records loaded`} />
      <SummaryItem icon={ClipboardList} label="Form responses" value={submissions} detail={`${publishedCount(data.forms)} published forms`} />
      <SummaryItem icon={Store} label="Store low stock" value={lowStockCount(data.storeItems)} detail={`${data.storeItems.length} products loaded`} />
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur transition hover:bg-white/15">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">{label}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3 text-white">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-white/60">{detail}</p>
    </div>
  );
}

function CommandPalette({ open, onClose, onRefresh, onTab }: { open: boolean; onClose: () => void; onRefresh: () => void; onTab: (tab: DashboardTab) => void }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;

  const actions = [
    { label: 'Refresh dashboard data', icon: RefreshCw, run: onRefresh },
    { label: 'Open overview', icon: LayoutDashboard, run: () => onTab('overview') },
    { label: 'Open people table', icon: Users, run: () => onTab('people') },
    { label: 'Open analytics charts', icon: BarChart3, run: () => onTab('analytics') },
    { label: 'Open activity timeline', icon: Activity, run: () => onTab('activity') },
    { label: 'Print or export dashboard', icon: Download, run: () => window.print() },
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase().trim()));

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/50 px-3 py-20 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Command className="h-5 w-5 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Search commands..." className="w-full bg-transparent py-2 text-sm font-semibold outline-none placeholder:text-slate-400" />
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-950">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  action.run();
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="rounded-xl bg-slate-950 p-2 text-white"><Icon className="h-4 w-4" /></div>
                <span className="text-sm font-black text-slate-800">{action.label}</span>
              </button>
            );
          })}
          {actions.length === 0 ? <EmptyState label="No command found." /> : null}
        </div>
      </div>
    </div>
  );
}

function TabButton({ tab, active, onClick, children }: { tab: DashboardTab; active: DashboardTab; onClick: (tab: DashboardTab) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      className={`rounded-2xl px-4 py-2 text-sm font-black transition ${active === tab ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
    >
      {children}
    </button>
  );
}

function DashboardCharts({ data }: { data: DashboardData }) {
  const growth = useMemo(
    () => makeMonthlyGrowth(data.allPeople, data.forms, data.events),
    [data.allPeople, data.forms, data.events]
  );

  const peopleValues = useMemo(
    () => [data.leadership.length, data.members.length, data.workforce.length],
    [data.leadership.length, data.members.length, data.workforce.length]
  );

  const submissions = useMemo(
    () => extractSubmissionTotal(data.forms),
    [data.forms]
  );

  const birthdayMonthValues = useMemo(
    () => data.birthdayMonths.map((item) => item.count),
    [data.birthdayMonths]
  );

  const anniversaryMonthValues = useMemo(
    () => data.anniversaryMonths.map((item) => item.count),
    [data.anniversaryMonths]
  );

  const growthValues = useMemo(
    () => growth.map((item) => item.count),
    [growth]
  );

  const operationsValues = useMemo(
    () => [data.forms.length, data.campaigns.length, data.events.length, submissions, data.storeItems.length],
    [data.forms.length, data.campaigns.length, data.events.length, submissions, data.storeItems.length]
  );

  const doughnutData = useMemo<ChartData<'doughnut'>>(
    () => ({
      labels: [...PEOPLE_DISTRIBUTION_LABELS],
      datasets: [
        {
          data: peopleValues,
          backgroundColor: [...PEOPLE_DISTRIBUTION_COLORS],
          borderColor: '#ffffff',
          borderWidth: 4,
          hoverOffset: 12,
        },
      ],
    }),
    [peopleValues]
  );

  const monthBarData = useMemo<ChartData<'bar'>>(
    () => ({
      labels: MONTH_LABELS,
      datasets: [
        {
          label: 'Birthdays',
          data: birthdayMonthValues,
          backgroundColor: 'rgba(236, 72, 153, 0.75)',
          borderRadius: 12,
        },
        {
          label: 'Anniversaries',
          data: anniversaryMonthValues,
          backgroundColor: 'rgba(249, 115, 22, 0.75)',
          borderRadius: 12,
        },
      ],
    }),
    [birthdayMonthValues, anniversaryMonthValues]
  );

  const growthLineData = useMemo<ChartData<'line'>>(
    () => ({
      labels: MONTH_LABELS,
      datasets: [
        {
          label: 'Recorded growth activity',
          data: growthValues,
          borderColor: 'rgba(15, 23, 42, 0.95)',
          backgroundColor: 'rgba(15, 23, 42, 0.12)',
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 7,
          tension: 0.42,
          fill: true,
        },
      ],
    }),
    [growthValues]
  );

  const operationsData = useMemo<ChartData<'bar'>>(
    () => ({
      labels: ['Forms', 'Campaigns', 'Events', 'Submissions', 'Products'],
      datasets: [
        {
          label: 'Operations volume',
          data: operationsValues,
          backgroundColor: [
            'rgba(59, 130, 246, 0.78)',
            'rgba(245, 158, 11, 0.78)',
            'rgba(139, 92, 246, 0.78)',
            'rgba(16, 185, 129, 0.78)',
            'rgba(15, 23, 42, 0.78)',
          ],
          borderRadius: 14,
        },
      ],
    }),
    [operationsValues]
  );

  const barAxisOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    }),
    []
  );

  const lineAxisOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    }),
    []
  );

  const operationsOptions = useMemo<ChartOptions<'bar'>>(
    () => ({ ...barAxisOptions, plugins: { legend: { display: false } } }),
    [barAxisOptions]
  );

  const doughnutOptions = useMemo<ChartOptions<'doughnut'>>(
    () => ({ cutout: '66%' }),
    []
  );

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <Panel title="People distribution" subtitle="Live split between leadership, members, and workforce." icon={Users}>
        <ChartCanvas type="doughnut" data={doughnutData} className="min-h-[320px]" options={doughnutOptions} />
      </Panel>

      <div className="xl:col-span-3">
        <Panel title="Growth intelligence" subtitle="Monthly growth activity from saved profiles, forms, and events for the current year." icon={TrendingUp}>
          <ChartCanvas type="line" data={growthLineData} className="min-h-[320px]" options={lineAxisOptions} />
        </Panel>
      </div>

      <div className="xl:col-span-1">
        <Panel title="Today" subtitle="Celebration queue." icon={Cake}>
          <div className="space-y-3">
            <MiniMetric label="Birthdays" value={data.todayBirthdays.length} />
            <MiniMetric label="Anniversaries" value={data.todayAnniversaries.length} />
            <MiniMetric label="Upcoming" value={data.upcomingBirthdays.length + data.upcomingAnniversaries.length} />
          </div>
        </Panel>
      </div>

      <div className="xl:col-span-3">
        <Panel title="Birthday and anniversary distribution" subtitle="Month-by-month record intelligence from backend profile data." icon={BarChart3}>
          <ChartCanvas type="bar" data={monthBarData} className="min-h-[330px]" options={barAxisOptions} />
        </Panel>
      </div>

      <div className="xl:col-span-2">
        <Panel title="Operations volume" subtitle="Forms, campaigns, events, submissions, and store records from connected endpoints." icon={Activity}>
          <ChartCanvas type="bar" data={operationsData} className="min-h-[330px]" options={operationsOptions} />
        </Panel>
      </div>
    </div>
  );
}


function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function SegmentAccordion({ data, onOpen }: { data: DashboardData; onOpen: (person: PersonRecord) => void }) {
  const [open, setOpen] = useState<SegmentKey>('leadership');

  const groups: Array<{ key: SegmentKey; items: PersonRecord[] }> = [
    { key: 'leadership', items: data.leadership },
    { key: 'members', items: data.members },
    { key: 'workforce', items: data.workforce },
  ];

  return (
    <Panel title="People intelligence accordions" subtitle="Segmented profile summaries with recent records and status distribution." icon={PanelRightOpen}>
      <div className="space-y-3">
        {groups.map((group) => {
          const meta = segmentMeta[group.key];
          const Icon = meta.icon;
          const activeCount = group.items.filter((item) => ['active', 'approved', 'published', 'true'].includes(item.status || '')).length;
          const isOpen = open === group.key;

          return (
            <div key={group.key} className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <button type="button" onClick={() => setOpen(group.key)} className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`rounded-2xl border bg-gradient-to-br p-3 ${meta.tone}`}><Icon className="h-5 w-5" /></div>
                  <div>
                    <div className="font-black text-slate-950">{meta.label}</div>
                    <div className="text-sm text-slate-500">{group.items.length} records · {activeCount} active/approved</div>
                  </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="grid gap-4 border-t border-slate-100 p-4 lg:grid-cols-3">
                    <MiniMetric label="Records" value={group.items.length} />
                    <MiniMetric label="Birthdays" value={group.items.filter((item) => item.birthdayMonth && item.birthdayDay).length} />
                    <MiniMetric label="Active" value={activeCount} />
                  </div>
                  <div className="grid gap-3 px-4 pb-4 md:grid-cols-3">
                    {latestProfiles(group.items, 6).map((person) => (
                      <button key={`${person.segment}-${person.id}`} type="button" onClick={() => onOpen(person)} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50">
                        <Avatar person={person} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black text-slate-950">{person.name}</div>
                          <div className="truncate text-xs text-slate-500">{person.role || person.department || titleCase(person.status || 'profile')}</div>
                        </div>
                        <Eye className="h-4 w-4 text-slate-400" />
                      </button>
                    ))}
                    {group.items.length === 0 ? <div className="md:col-span-3"><EmptyState label={`No ${meta.label.toLowerCase()} records found.`} /></div> : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function latestProfiles(items: PersonRecord[], limit = 8): PersonRecord[] {
  return items
    .slice()
    .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime())
    .slice(0, limit);
}

function PeopleTable({ people, onOpen }: { people: PersonRecord[]; onOpen: (person: PersonRecord) => void }) {
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<'all' | SegmentKey>('all');
  const [status, setStatus] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const statuses = useMemo(() => ['all', ...Array.from(new Set(people.map((item) => item.status || 'unknown'))).sort()], [people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = people.filter((person) => {
      if (segment !== 'all' && person.segment !== segment) return false;
      if (status !== 'all' && (person.status || 'unknown') !== status) return false;
      if (!q) return true;
      return `${person.name} ${person.email || ''} ${person.phone || ''} ${person.role || ''} ${person.department || ''} ${person.status || ''} ${person.segment}`.toLowerCase().includes(q);
    });

    rows.sort((a, b) => comparePeople(a, b, sortKey, sortDirection));
    return rows;
  }, [people, query, segment, sortDirection, sortKey, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => setPage(1), [query, segment, status, pageSize]);

  const setSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'name' || key === 'segment' ? 'asc' : 'desc');
  };

  return (
    <Panel
      title="Professional profile table"
      subtitle="Responsive accordion table with backend-driven filtering, sorting, pagination, and profile drawer actions."
      icon={SlidersHorizontal}
      right={<Badge tone="blue">{filtered.length} visible</Badge>}
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_130px]">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, phone, role..." className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400" />
        </div>
        <Select value={segment} onChange={(value) => setSegment(value as 'all' | SegmentKey)} options={[{ label: 'All segments', value: 'all' }, { label: 'Leadership', value: 'leadership' }, { label: 'Members', value: 'members' }, { label: 'Workforce', value: 'workforce' }]} />
        <Select value={status} onChange={setStatus} options={statuses.map((item) => ({ label: item === 'all' ? 'All statuses' : titleCase(item), value: item }))} />
        <Select value={String(pageSize)} onChange={(value) => setPageSize(Number(value))} options={PAGE_SIZE_OPTIONS.map((item) => ({ label: `${item} / page`, value: String(item) }))} />
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_120px_80px] gap-4 bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wide text-white xl:grid">
          <SortHeader label="Profile" active={sortKey === 'name'} onClick={() => setSort('name')} />
          <SortHeader label="Segment" active={sortKey === 'segment'} onClick={() => setSort('segment')} />
          <SortHeader label="Birthday" active={sortKey === 'birthday'} onClick={() => setSort('birthday')} />
          <SortHeader label="Anniversary" active={sortKey === 'anniversary'} onClick={() => setSort('anniversary')} />
          <SortHeader label="Status" active={sortKey === 'status'} onClick={() => setSort('status')} align="right" />
          <div className="text-right">Open</div>
        </div>

        <div className="divide-y divide-slate-100 bg-white">
          {paged.map((person) => (
            <button key={`${person.segment}-${person.id}`} type="button" onClick={() => onOpen(person)} className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-slate-50 xl:grid-cols-[1.4fr_1fr_1fr_1fr_120px_80px] xl:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar person={person} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-950">{person.name}</div>
                  <div className="truncate text-xs text-slate-500">{person.email || person.phone || 'No contact recorded'}</div>
                </div>
              </div>
              <div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${segmentMeta[person.segment].badge}`}>{segmentMeta[person.segment].label}</span></div>
              <div className="text-sm font-semibold text-slate-500">{person.birthdayMonth && person.birthdayDay ? dateLabel(person.birthdayMonth, person.birthdayDay) : '—'}</div>
              <div className="text-sm font-semibold text-slate-500">{person.anniversaryMonth && person.anniversaryDay ? dateLabel(person.anniversaryMonth, person.anniversaryDay) : '—'}</div>
              <div className="xl:text-right"><Badge>{titleCase(person.status || 'Unknown')}</Badge></div>
              <div className="hidden justify-end xl:flex"><Eye className="h-4 w-4 text-slate-400" /></div>
            </button>
          ))}
          {paged.length === 0 ? <div className="p-4"><EmptyState label="No profiles match your filters." /></div> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-500">Showing {paged.length} of {filtered.length} records</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1} className="rounded-2xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-5 w-5" /></button>
          <span className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white">{currentPage} / {totalPages}</span>
          <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages} className="rounded-2xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    </Panel>
  );
}

function comparePeople(a: PersonRecord, b: PersonRecord, sortKey: SortKey, direction: SortDirection): number {
  const modifier = direction === 'asc' ? 1 : -1;
  const value = (person: PersonRecord): string | number => {
    switch (sortKey) {
      case 'name': return person.name.toLowerCase();
      case 'segment': return person.segment;
      case 'status': return person.status || 'unknown';
      case 'birthday': return (person.birthdayMonth || 99) * 100 + (person.birthdayDay || 99);
      case 'anniversary': return (person.anniversaryMonth || 99) * 100 + (person.anniversaryDay || 99);
      case 'createdAt':
      default: return new Date(person.createdAt || person.updatedAt || 0).getTime();
    }
  };

  const left = value(a);
  const right = value(b);
  if (left < right) return -1 * modifier;
  if (left > right) return 1 * modifier;
  return 0;
}

function SortHeader({ label, active, onClick, align }: { label: string; active: boolean; onClick: () => void; align?: 'right' }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end text-right' : ''} ${active ? 'text-white' : 'text-white/70'}`}>
      {label}
      <ChevronsUpDown className="h-3.5 w-3.5" />
    </button>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 outline-none transition focus:border-slate-400">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function Timeline({ items, endpointAvailable }: { items: TimelineItem[]; endpointAvailable: boolean }) {
  const tones: Record<TimelineItem['tone'], string> = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  };

  return (
    <Panel
      title="Activity timeline / audit log"
      subtitle={endpointAvailable ? 'Live audit data from the backend.' : 'Audit endpoint was not available; showing a timeline derived from saved backend records.'}
      icon={Activity}
      right={<Badge tone={endpointAvailable ? 'green' : 'amber'}>{endpointAvailable ? 'Audit connected' : 'Derived activity'}</Badge>}
    >
      <div className="space-y-3">
        {items.slice(0, 16).map((item) => (
          <div key={item.id} className="relative rounded-3xl border border-slate-100 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white hover:shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${tones[item.tone]}`}>{item.title}</span>
                  <span className="text-xs font-bold text-slate-400">{formatDateTime(item.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-black text-slate-900">{item.description}</p>
                {item.actor ? <p className="mt-1 text-sm text-slate-500">By {item.actor}</p> : null}
              </div>
              {item.action ? <Badge>{titleCase(item.action)}</Badge> : null}
            </div>
          </div>
        ))}
        {items.length === 0 ? <EmptyState label="No activity records found." description="Connect an audit endpoint to show security and operations events here." /> : null}
      </div>
    </Panel>
  );
}

function TrackerList({ title, items, icon: Icon, onOpen }: { title: string; items: TrackerItem[]; icon: React.ElementType; onOpen: (item: TrackerItem) => void }) {
  return (
    <Panel title={title} subtitle="Live tracker from saved profile data." icon={Icon}>
      <div className="space-y-3">
        {items.slice(0, 8).map((item) => (
          <button key={item.id} type="button" onClick={() => onOpen(item)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50">
            <Avatar person={item} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-slate-950">{item.name}</div>
              <div className="truncate text-xs text-slate-500">{segmentMeta[item.segment].label} • {item.role || 'Profile'}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-black text-slate-950">{item.dateLabel}</div>
              <div className="text-[11px] font-semibold text-slate-500">{item.daysUntil === 0 ? 'Today' : `${item.daysUntil} days`}</div>
            </div>
          </button>
        ))}
        {items.length === 0 ? <EmptyState label="No upcoming records found." /> : null}
      </div>
    </Panel>
  );
}

function ProfileDrawer({ person, onClose }: { person: PersonRecord | null; onClose: () => void }) {
  if (!person) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/45 backdrop-blur-sm">
      <button type="button" aria-label="Close profile drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Profile drawer</p>
            <h2 className="text-lg font-black text-slate-950">{person.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5">
          <div className="rounded-[2rem] bg-slate-950 p-5 text-white">
            <div className="flex items-start gap-4">
              <Avatar person={person} size="lg" />
              <div className="min-w-0">
                <h3 className="text-2xl font-black">{person.name}</h3>
                <p className="mt-1 text-sm font-semibold text-white/60">{segmentMeta[person.segment].label}</p>
                <div className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white ring-1 ring-white/10">{titleCase(person.status || 'Unknown')}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Mail} label="Email" value={person.email || 'Not provided'} />
            <InfoRow icon={Phone} label="Phone" value={person.phone || 'Not provided'} />
            <InfoRow icon={UserRound} label="Role / Department" value={person.role || person.department || 'Not provided'} />
            <InfoRow icon={Cake} label="Birthday" value={person.birthdayMonth && person.birthdayDay ? dateLabel(person.birthdayMonth, person.birthdayDay) : 'Not provided'} />
            <InfoRow icon={Heart} label="Wedding anniversary" value={person.anniversaryMonth && person.anniversaryDay ? dateLabel(person.anniversaryMonth, person.anniversaryDay) : 'Not provided'} />
            <InfoRow icon={CalendarDays} label="Created" value={formatDate(person.createdAt)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Raw backend source</p>
            <pre className="mt-3 max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(person.source || {}, null, 2)}</pre>
          </div>
        </div>
      </aside>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}

function TrackerModal({ mode, items, onClose, onSendToday }: { mode: TrackerMode | null; items: TrackerItem[]; onClose: () => void; onSendToday: (mode: TrackerMode, segment?: SegmentKey) => Promise<void> }) {
  const [sending, setSending] = useState<string>('');
  const [query, setQuery] = useState('');

  if (!mode) return null;

  const filtered = items.filter((item) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return `${item.name} ${item.email || ''} ${item.role || ''} ${item.segment}`.toLowerCase().includes(q);
  });

  const title = mode === 'birthdays' ? 'Birthday scheduler' : 'Wedding anniversary tracker';
  const Icon = mode === 'birthdays' ? Cake : Heart;

  const runSend = async (segment?: SegmentKey) => {
    const key = `${mode}-${segment || 'all'}`;
    setSending(key);
    try {
      await onSendToday(mode, segment);
    } finally {
      setSending('');
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-slate-950 p-3 text-white"><Icon className="h-5 w-5" /></div>
                <div>
                  <div className="font-black text-slate-950">Celebration workflow</div>
                  <p className="mt-1 text-sm text-slate-500">Generated from saved backend profile data. No mock records are used.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {mode === 'birthdays' ? (
                  <>
                    <ActionButton loading={sending === 'birthdays-leadership'} onClick={() => runSend('leadership')}>Leadership</ActionButton>
                    <ActionButton loading={sending === 'birthdays-members'} onClick={() => runSend('members')}>Members</ActionButton>
                    <ActionButton loading={sending === 'birthdays-workforce'} onClick={() => runSend('workforce')}>Workforce</ActionButton>
                  </>
                ) : (
                  <ActionButton loading={sending === 'anniversaries-leadership'} onClick={() => runSend('leadership')}>Send anniversaries</ActionButton>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email, segment, role..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <Avatar person={item} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-slate-950">{item.name}</div>
                    <div className="truncate text-xs text-slate-500">{segmentMeta[item.segment].label} · {item.role || 'Profile'}</div>
                  </div>
                  <Badge tone={item.daysUntil === 0 ? 'green' : 'slate'}>{item.daysUntil === 0 ? 'Today' : `${item.daysUntil}d`}</Badge>
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-black text-slate-700">{item.dateLabel}</div>
              </div>
            ))}
            {filtered.length === 0 ? <div className="md:col-span-2 xl:col-span-3"><EmptyState label="No records match your search." /></div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ children, loading, onClick }: { children: React.ReactNode; loading?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {children}
    </button>
  );
}

export default function AdminDashboardPage() {
  const [state, setState] = useState<LoadState>({ loading: true, refreshing: false, error: '', data: null });
  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(null);
  const [trackerMode, setTrackerMode] = useState<TrackerMode | null>(null);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [paletteOpen, setPaletteOpen] = useState(false);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: !prev.data, refreshing: Boolean(prev.data), error: '' }));
    try {
      const data = await loadOverviewData();
      setState({ loading: false, refreshing: false, error: '', data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load dashboard overview.';
      setState((prev) => ({ ...prev, loading: false, refreshing: false, error: message }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sendToday = useCallback(async (mode: TrackerMode, segment?: SegmentKey) => {
    const requests: string[] = [];

    if (mode === 'birthdays') {
      if (!segment || segment === 'leadership') requests.push('/api/v1/admin/leadership/birthdays/send-today');
      if (!segment || segment === 'members') requests.push('/api/v1/admin/members/birthdays/send-today');
      if (!segment || segment === 'workforce') requests.push('/api/v1/admin/workforce/birthdays/send-today');
    }

    if (mode === 'anniversaries') requests.push('/api/v1/admin/leadership/anniversaries/send-today');

    await Promise.all(requests.map((path) => apiPost(path)));
    setToast(mode === 'birthdays' ? 'Birthday greetings triggered successfully.' : 'Anniversary greetings triggered successfully.');
    window.setTimeout(() => setToast(''), 3500);
    await refresh();
  }, [refresh]);

  const data = state.data;
  const trackerItems = trackerMode === 'birthdays' ? data?.upcomingBirthdays ?? [] : data?.upcomingAnniversaries ?? [];
  const auditEndpointAvailable = Boolean(data?.endpointHealth.find((item) => item.label === 'Audit logs')?.available);

  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      { title: 'Profiles', value: data.allPeople.length, subtitle: 'Leadership, members, and workforce', icon: Users, tone: 'from-slate-200 to-white text-slate-800 border-slate-200', trend: `${countThisYear(data.allPeople)} added this year` },
      { title: 'Members', value: data.members.length, subtitle: 'Saved membership records', icon: UserRound, tone: 'from-blue-500/15 to-cyan-500/5 text-blue-700 border-blue-200', trend: `${data.members.filter((item) => ['active', 'approved'].includes(item.status || '')).length} active/approved` },
      { title: 'Workforce', value: data.workforce.length, subtitle: 'Workers and serving profiles', icon: BriefcaseBusiness, tone: 'from-emerald-500/15 to-green-500/5 text-emerald-700 border-emerald-200', trend: `${data.workforce.filter((item) => item.department).length} with departments` },
      { title: 'Leadership', value: data.leadership.length, subtitle: 'Pastoral and leadership profiles', icon: Crown, tone: 'from-amber-500/15 to-yellow-500/5 text-amber-700 border-amber-200', trend: `${data.leadership.filter((item) => item.anniversaryMonth).length} anniversary records` },
      { title: 'Forms', value: data.forms.length, subtitle: `${publishedCount(data.forms)} published forms`, icon: ClipboardList, tone: 'from-indigo-500/15 to-blue-500/5 text-indigo-700 border-indigo-200', trend: `${extractSubmissionTotal(data.forms)} captured submissions` },
      { title: 'Campaigns', value: data.campaigns.length, subtitle: 'Email and outreach campaigns', icon: Megaphone, tone: 'from-orange-500/15 to-amber-500/5 text-orange-700 border-orange-200', trend: `${publishedCount(data.campaigns)} active/published` },
      { title: 'Events', value: countUpcomingEvents(data.events), subtitle: `${data.events.length} total event records`, icon: CalendarDays, tone: 'from-violet-500/15 to-purple-500/5 text-violet-700 border-violet-200', trend: 'Upcoming events only' },
      { title: 'Store', value: data.storeItems.length, subtitle: `${lowStockCount(data.storeItems)} low stock items`, icon: Store, tone: 'from-rose-500/15 to-pink-500/5 text-rose-700 border-rose-200', trend: 'Inventory intelligence' },
    ];
  }, [data]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-3 py-4 text-slate-950 sm:px-5 lg:px-7">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-xl">
          <div className="relative p-5 text-white sm:p-7 lg:p-8">
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="relative grid gap-6 xl:grid-cols-[1.2fr_1fr] xl:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/70">
                  <ShieldCheck className="h-4 w-4" />
                  Backend driven admin intelligence
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl xl:text-5xl">Admin Dashboard</h1>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-white/65 sm:text-base">
                  Real-time church operations, people intelligence, celebrations, forms, events, campaigns, store data, and audit activity. No placeholder or mock data is rendered here.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPaletteOpen(true)} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-slate-100"><Command className="h-4 w-4" /> Command palette</button>
                  <button type="button" onClick={() => setTrackerMode('birthdays')} className="inline-flex items-center gap-2 rounded-2xl bg-pink-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-pink-300"><Cake className="h-4 w-4" /> Birthday scheduler</button>
                  <button type="button" onClick={() => setTrackerMode('anniversaries')} className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-300"><Heart className="h-4 w-4" /> Anniversary tracker</button>
                  <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"><RefreshCw className={`h-4 w-4 ${state.refreshing ? 'animate-spin' : ''}`} /> Refresh</button>
                </div>
              </div>
              {data ? <SummaryStrip data={data} /> : null}
            </div>
          </div>
        </header>

        <div className="sticky top-2 z-30 rounded-3xl border border-slate-200 bg-white/85 p-2 shadow-sm backdrop-blur">
          <div className="flex gap-2 overflow-x-auto">
            <TabButton tab="overview" active={tab} onClick={setTab}>Overview</TabButton>
            <TabButton tab="people" active={tab} onClick={setTab}>People table</TabButton>
            <TabButton tab="analytics" active={tab} onClick={setTab}>Analytics</TabButton>
            <TabButton tab="activity" active={tab} onClick={setTab}>Activity timeline</TabButton>
          </div>
        </div>

        {toast ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{toast}</div> : null}
        {state.error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{state.error}</div> : null}

        {state.loading && !data ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-[2rem] border border-slate-200 bg-white">
            <div className="text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-slate-950" />
              <p className="mt-3 text-sm font-bold text-slate-500">Loading backend dashboard data...</p>
            </div>
          </div>
        ) : null}

        {data ? (
          <>
            {tab === 'overview' ? (
              <div className="space-y-5">
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {kpis.map((kpi) => <KPI key={kpi.title} {...kpi} />)}
                </section>
                <DashboardCharts data={data} />
                <div className="grid gap-5 xl:grid-cols-2">
                  <TrackerList title="Upcoming birthdays" items={data.upcomingBirthdays} icon={Cake} onOpen={(item) => {
                    const person = data.allPeople.find((profile) => profile.id === item.id.replace(`birthdays-${item.segment}-`, ''));
                    if (person) setSelectedPerson(person);
                  }} />
                  <TrackerList title="Upcoming wedding anniversaries" items={data.upcomingAnniversaries} icon={Heart} onOpen={(item) => {
                    const person = data.allPeople.find((profile) => profile.id === item.id.replace(`anniversaries-${item.segment}-`, ''));
                    if (person) setSelectedPerson(person);
                  }} />
                </div>
                <SegmentAccordion data={data} onOpen={setSelectedPerson} />
              </div>
            ) : null}

            {tab === 'people' ? <PeopleTable people={data.allPeople} onOpen={setSelectedPerson} /> : null}
            {tab === 'analytics' ? <DashboardCharts data={data} /> : null}
            {tab === 'activity' ? <Timeline items={data.auditLogs} endpointAvailable={auditEndpointAvailable} /> : null}
          </>
        ) : null}
      </div>

      <ProfileDrawer person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      <TrackerModal mode={trackerMode} items={trackerItems} onClose={() => setTrackerMode(null)} onSendToday={sendToday} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onRefresh={() => void refresh()} onTab={setTab} />
    </main>
  );
}
