import { Crown, Users, BriefcaseBusiness, type LucideIcon } from 'lucide-react';

export type SegmentKey = 'leadership' | 'members' | 'workforce';
export type TrackerMode = 'birthdays' | 'anniversaries';
export type SortDirection = 'asc' | 'desc';
export type SortKey = 'name' | 'segment' | 'status' | 'createdAt' | 'birthday' | 'anniversary';
export type DashboardTab = 'overview' | 'people' | 'analytics' | 'activity';

export type RawRecord = Record<string, unknown>;

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

export type PersonRecord = {
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

export type MonthCount = {
  month: number;
  label: string;
  count: number;
};

export type TrackerItem = {
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

export type TimelineTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export type TimelineItem = {
  id: string;
  title: string;
  description: string;
  actor?: string;
  action?: string;
  createdAt?: string;
  tone: TimelineTone;
};

export type DashboardData = {
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

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TRACKING_WINDOW_DAYS = 45;
export const PAGE_SIZE_OPTIONS = [8, 12, 20, 40];
export const PEOPLE_DISTRIBUTION_LABELS = ['Leadership', 'Members', 'Workforce'] as const;

export const segmentMeta: Record<SegmentKey, { label: string; description: string; icon: LucideIcon; badgeVariant: 'warning' | 'info' | 'success' }> = {
  leadership: {
    label: 'Leadership',
    description: 'Pastoral and leadership profile records',
    icon: Crown,
    badgeVariant: 'warning',
  },
  members: {
    label: 'Members',
    description: 'Church membership records and profile data',
    icon: Users,
    badgeVariant: 'info',
  },
  workforce: {
    label: 'Workforce',
    description: 'Workers, departments, and serving records',
    icon: BriefcaseBusiness,
    badgeVariant: 'success',
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

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
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

export function isRecord(value: unknown): value is RawRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

export function numberValue(value: unknown): number | undefined {
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

export function titleCase(value: string): string {
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

function mergeRemoteMonthStats(fallback: MonthCount[], payload: unknown): MonthCount[] {
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

export function dateLabel(month: number, day: number): string {
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

export function countThisYear(items: Array<{ createdAt?: string; updatedAt?: string } | RawRecord>): number {
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

export function countUpcomingEvents(events: RawRecord[]): number {
  const now = Date.now();
  return events.filter((event) => {
    const raw = dateValue(event.startAt ?? event.start_at ?? event.eventDate ?? event.event_date ?? event.date);
    if (!raw) return false;
    return new Date(raw).getTime() >= now;
  }).length;
}

export function extractSubmissionTotal(forms: RawRecord[]): number {
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

export function publishedCount(items: RawRecord[]): number {
  return items.filter((item) => {
    const status = normalizeStatus(item.status ?? item.state ?? item.visibility);
    const published = item.published ?? item.isPublished ?? item.is_published;
    return status === 'published' || status === 'active' || published === true;
  }).length;
}

export function lowStockCount(items: RawRecord[]): number {
  return items.filter((item) => {
    const stock = numberValue(item.stock ?? item.quantity ?? item.inventory ?? item.availableQuantity ?? item.available_quantity);
    const threshold = numberValue(item.lowStockThreshold ?? item.low_stock_threshold) ?? 5;
    return stock !== undefined && stock <= threshold;
  }).length;
}

export function makeMonthlyGrowth(items: PersonRecord[], forms: RawRecord[], events: RawRecord[]): MonthCount[] {
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
  if (normalized.includes('approve') || normalized.includes('create') || normalized.includes('success')) return 'success';
  if (normalized.includes('update') || normalized.includes('edit')) return 'info';
  if (normalized.includes('delete') || normalized.includes('fail') || normalized.includes('reject')) return 'danger';
  if (normalized.includes('login') || normalized.includes('auth')) return 'info';
  if (normalized.includes('send') || normalized.includes('campaign')) return 'warning';
  return 'default';
}

function buildDerivedTimeline(data: Pick<DashboardData, 'allPeople' | 'forms' | 'campaigns' | 'events'>): TimelineItem[] {
  const peopleEvents: TimelineItem[] = data.allPeople.map((person) => ({
    id: `person-${person.segment}-${person.id}`,
    title: `${segmentMeta[person.segment].label} profile`,
    description: person.name,
    actor: person.email || person.phone,
    action: 'profile_created',
    createdAt: person.createdAt || person.updatedAt,
    tone: 'info',
  }));

  const formEvents: TimelineItem[] = data.forms.map((form, index) => ({
    id: `form-${firstNonEmpty(form.id, form.slug, index)}`,
    title: 'Form activity',
    description: firstNonEmpty(form.title, form.name, form.slug) || 'Saved form record',
    actor: `${numberValue(form.submissionCount ?? form.submissions_count ?? form.totalSubmissions) ?? 0} responses`,
    action: 'form_activity',
    createdAt: recordCreatedAt(form),
    tone: 'success',
  }));

  const campaignEvents: TimelineItem[] = data.campaigns.map((campaign, index) => ({
    id: `campaign-${firstNonEmpty(campaign.id, index)}`,
    title: 'Campaign activity',
    description: firstNonEmpty(campaign.title, campaign.name, campaign.subject) || 'Saved campaign record',
    actor: firstNonEmpty(campaign.status, campaign.state),
    action: 'campaign_activity',
    createdAt: recordCreatedAt(campaign),
    tone: 'warning',
  }));

  const eventEvents: TimelineItem[] = data.events.map((event, index) => ({
    id: `event-${firstNonEmpty(event.id, index)}`,
    title: 'Event record',
    description: firstNonEmpty(event.title, event.name, event.eventName, event.event_name) || 'Saved event record',
    actor: firstNonEmpty(event.location, event.venue),
    action: 'event_activity',
    createdAt: recordCreatedAt(event),
    tone: 'info',
  }));

  return [...peopleEvents, ...formEvents, ...campaignEvents, ...eventEvents]
    .filter((item) => item.createdAt)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 20);
}

export function formatDate(value?: string): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value?: string): string {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No timestamp';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'WH';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
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

export async function loadOverviewData(): Promise<DashboardData> {
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
  birthdayMonths = mergeRemoteMonthStats(birthdayMonths, leadershipBirthdayStats);
  birthdayMonths = combineMonthCounts([
    birthdayMonths,
    mergeRemoteMonthStats(emptyMonthCounts(), memberBirthdayStats),
    mergeRemoteMonthStats(emptyMonthCounts(), workforceBirthdayStats),
  ]);

  const anniversaryMonths = mergeRemoteMonthStats(makeMonthCounts(leadership, 'anniversaries'), leadershipAnniversaryStats);
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
