'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  Cake,
  Crown,
  Download,
  Eye,
  Heart,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  X,
} from 'lucide-react';

type SegmentKey = 'leadership' | 'members' | 'workforce';
type TrackerMode = 'birthdays' | 'anniversaries';

type ApiEnvelope<T> = {
  status?: string;
  message?: string;
  data?: T;
  items?: unknown;
  total?: number;
  page?: number;
  limit?: number;
};

type RawRecord = Record<string, unknown>;

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

type OverviewData = {
  leadership: PersonRecord[];
  members: PersonRecord[];
  workforce: PersonRecord[];
  allPeople: PersonRecord[];
  birthdayMonths: MonthCount[];
  anniversaryMonths: MonthCount[];
  upcomingBirthdays: TrackerItem[];
  upcomingAnniversaries: TrackerItem[];
  todayBirthdays: TrackerItem[];
  todayAnniversaries: TrackerItem[];
};

type LoadState = {
  loading: boolean;
  error: string;
  data: OverviewData | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TRACKING_WINDOW_DAYS = 45;

const segmentMeta: Record<SegmentKey, { label: string; description: string; icon: React.ElementType; tone: string }> = {
  leadership: {
    label: 'Leadership',
    description: 'Pastoral and leadership profile records',
    icon: Crown,
    tone: 'from-amber-500/20 to-yellow-500/5 text-amber-700 border-amber-200',
  },
  members: {
    label: 'Membership',
    description: 'Church membership records and birthday profile data',
    icon: Users,
    tone: 'from-blue-500/20 to-cyan-500/5 text-blue-700 border-blue-200',
  },
  workforce: {
    label: 'Workforce',
    description: 'Workers, departments, and serving profile records',
    icon: BriefcaseBusiness,
    tone: 'from-emerald-500/20 to-green-500/5 text-emerald-700 border-emerald-200',
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
    headers: {
      Accept: 'application/json',
    },
  });

  const json = await readJson<ApiEnvelope<T>>(res);

  if (!res.ok) {
    throw new Error(json.message || `Request failed with status ${res.status}`);
  }

  return unwrapData<T>(json);
}

async function getCSRFToken(): Promise<string> {
  try {
    const payload = await apiGet<RawRecord>('/api/v1/auth/csrf-token');
    const token =
      stringValue(payload.csrfToken) ||
      stringValue(payload.csrf_token) ||
      stringValue(payload.token) ||
      stringValue((payload.data as RawRecord | undefined)?.csrfToken) ||
      '';

    return token;
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

  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

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

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
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

function normalizeStatus(value: unknown): string {
  const status = stringValue(value).toLowerCase().replace(/[_-]+/g, ' ');
  if (!status) return 'unknown';
  return status;
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
    const possibleItems = data.items ?? data.results ?? data.records ?? data.data;

    if (Array.isArray(possibleItems)) {
      const items = possibleItems.filter(isRecord);
      return { items, total: numberValue(data.total) ?? items.length };
    }
  }

  return { items: [], total: 0 };
}

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizePerson(record: RawRecord, segment: SegmentKey): PersonRecord {
  const firstName = firstNonEmpty(record.firstName, record.first_name, record.firstname);
  const lastName = firstNonEmpty(record.lastName, record.last_name, record.lastname);
  const fullName = firstNonEmpty(record.name, record.fullName, record.full_name, [firstName, lastName].filter(Boolean).join(' '));

  return {
    id: firstNonEmpty(record.id, record.uuid, record.email, `${segment}-${fullName || 'record'}-${Math.random()}`) || `${segment}-record`,
    segment,
    name: fullName || 'Unnamed profile',
    email: firstNonEmpty(record.email, record.emailAddress, record.email_address),
    phone: firstNonEmpty(record.phone, record.phoneNumber, record.phone_number, record.contactNumber, record.contact_number),
    role: firstNonEmpty(record.role, record.leadershipRole, record.leadership_role, record.position, record.title),
    department: firstNonEmpty(record.department, record.ministry, record.unit, record.team),
    status: normalizeStatus(record.status ?? record.approvalStatus ?? record.approval_status),
    imageUrl: firstNonEmpty(record.imageUrl, record.image_url, record.photoUrl, record.photo_url, record.photo, record.profileImage, record.profile_image),
    birthdayMonth: numberValue(record.birthdayMonth ?? record.birthday_month),
    birthdayDay: numberValue(record.birthdayDay ?? record.birthday_day),
    anniversaryMonth: numberValue(record.anniversaryMonth ?? record.anniversary_month),
    anniversaryDay: numberValue(record.anniversaryDay ?? record.anniversary_day),
    createdAt: firstNonEmpty(record.createdAt, record.created_at),
    updatedAt: firstNonEmpty(record.updatedAt, record.updated_at),
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

function daysUntilMonthDay(month: number, day: number): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(today.getFullYear(), month - 1, day);

  if (Number.isNaN(target.getTime())) return 9999;

  if (target < today) {
    target = new Date(today.getFullYear() + 1, month - 1, day);
  }

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

  for (const record of items) {
    const person = normalizePerson(record, segment);
    const month = mode === 'birthdays' ? person.birthdayMonth : person.anniversaryMonth;
    const day = mode === 'birthdays' ? person.birthdayDay : person.anniversaryDay;
    
    if (!month || !day) continue;

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
  }

  return results;
}

function statusCounts(items: PersonRecord[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const status = item.status || 'unknown';
    counts.set(status, (counts.get(status) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function latestProfiles(items: PersonRecord[], limit = 8): PersonRecord[] {
  return items
    .slice()
    .sort((a, b) => {
      const left = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const right = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return right - left;
    })
    .slice(0, limit);
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'WH';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

async function loadOverviewData(): Promise<OverviewData> {
  const [leadershipPayload, membersPayload, workforcePayload] = await Promise.all([
    apiGet('/api/v1/admin/leadership?page=1&limit=500'),
    apiGet('/api/v1/admin/members?page=1&limit=500'),
    apiGet('/api/v1/admin/workforce?page=1&limit=500'),
  ]);

  const leadership = extractList(leadershipPayload).items.map((item) => normalizePerson(item, 'leadership'));
  const members = extractList(membersPayload).items.map((item) => normalizePerson(item, 'members'));
  const workforce = extractList(workforcePayload).items.map((item) => normalizePerson(item, 'workforce'));
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

  const anniversaryMonths = mergeBackendMonthStats(
    makeMonthCounts(leadership, 'anniversaries'),
    leadershipAnniversaryStats,
  );

  const upcomingBirthdays = buildTrackerItems(allPeople, 'birthdays');
  const upcomingAnniversaries = buildTrackerItems(leadership, 'anniversaries');

  const todayBirthdays = [
    ...extractTodayItems(leadershipBirthdaysToday, 'birthdays', 'leadership'),
    ...extractTodayItems(memberBirthdaysToday, 'birthdays', 'members'),
    ...extractTodayItems(workforceBirthdaysToday, 'birthdays', 'workforce'),
  ];

  const todayAnniversaries = extractTodayItems(leadershipAnniversariesToday, 'anniversaries', 'leadership');

  return {
    leadership,
    members,
    workforce,
    allPeople,
    birthdayMonths,
    anniversaryMonths,
    upcomingBirthdays,
    upcomingAnniversaries,
    todayBirthdays: todayBirthdays.length > 0 ? todayBirthdays : upcomingBirthdays.filter((item) => item.daysUntil === 0),
    todayAnniversaries: todayAnniversaries.length > 0 ? todayAnniversaries : upcomingAnniversaries.filter((item) => item.daysUntil === 0),
  };
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

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className={`overflow-hidden rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</div>
          <p className="mt-2 text-sm font-medium text-slate-600">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function MonthBarChart({ title, subtitle, data, icon: Icon }: { title: string; subtitle: string; data: MonthCount[]; icon: React.ElementType }) {
  const max = Math.max(1, ...data.map((item) => item.count));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-slate-950 p-3 text-white">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-6 gap-3 sm:grid-cols-12">
        {data.map((item) => {
          const height = Math.max(12, Math.round((item.count / max) * 110));

          return (
            <div key={item.month} className="flex flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end justify-center rounded-2xl bg-slate-50 px-1 py-2">
                <div
                  className="w-full rounded-xl bg-slate-950 transition-all"
                  style={{ height }}
                  title={`${item.label}: ${item.count}`}
                />
              </div>
              <div className="text-[11px] font-bold uppercase text-slate-500">{item.label}</div>
              <div className="text-xs font-black text-slate-900">{item.count}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SegmentCard({ segment, items, onOpen }: { segment: SegmentKey; items: PersonRecord[]; onOpen: (person: PersonRecord) => void }) {
  const meta = segmentMeta[segment];
  const Icon = meta.icon;
  const counts = statusCounts(items);
  const activeCount = items.filter((item) => ['active', 'approved', 'published'].includes(item.status || '')).length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-2xl border bg-gradient-to-br p-3 ${meta.tone}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-950">{meta.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{meta.description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-slate-950">{items.length}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Records</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase text-slate-500">Active/Approved</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{activeCount}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase text-slate-500">With Birthdays</div>
          <div className="mt-2 text-2xl font-black text-slate-950">
            {items.filter((item) => item.birthdayMonth && item.birthdayDay).length}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {counts.length === 0 ? (
          <EmptyState label="No status data available." />
        ) : (
          counts.slice(0, 4).map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-100 px-3 py-2">
              <span className="text-sm font-semibold text-slate-700">{titleCase(item.label)}</span>
              <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-white">{item.count}</span>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 space-y-3">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Recent profiles</div>
        {latestProfiles(items, 3).map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => onOpen(person)}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Avatar person={person} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-slate-950">{person.name}</div>
              <div className="truncate text-xs text-slate-500">{person.role || person.department || titleCase(person.status || 'profile')}</div>
            </div>
            <Eye className="h-4 w-4 text-slate-400" />
          </button>
        ))}
        {items.length === 0 ? <EmptyState label={`No ${meta.label.toLowerCase()} records found from backend.`} /> : null}
      </div>
    </section>
  );
}

function Avatar({ person, size = 'md' }: { person: PersonRecord | TrackerItem; size?: 'sm' | 'md' | 'lg' }) {
  const dimension = size === 'lg' ? 'h-16 w-16 text-lg' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';

  if (person.imageUrl) {
    return (
      <div className={`${dimension} shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200`}>
        <Image src={person.imageUrl} alt={person.name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`${dimension} flex shrink-0 items-center justify-center rounded-2xl bg-slate-950 font-black text-white`}>
      {initials(person.name)}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">{label}</div>;
}

function TrackerList({ title, items, icon: Icon, onOpen }: { title: string; items: TrackerItem[]; icon: React.ElementType; onOpen: (item: TrackerItem) => void }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">Live tracker from backend profile data.</p>
        </div>
        <div className="rounded-2xl bg-slate-950 p-3 text-white">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.slice(0, 8).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Avatar person={item} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-slate-950">{item.name}</div>
              <div className="truncate text-xs text-slate-500">
                {segmentMeta[item.segment].label} • {item.role || 'Profile'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-black text-slate-950">{item.dateLabel}</div>
              <div className="text-[11px] font-semibold text-slate-500">{item.daysUntil === 0 ? 'Today' : `${item.daysUntil} days`}</div>
            </div>
          </button>
        ))}
        {items.length === 0 ? <EmptyState label="No upcoming records found for this tracker." /> : null}
      </div>
    </section>
  );
}

function ProfileModal({ person, onClose }: { person: PersonRecord | null; onClose: () => void }) {
  if (!person) return null;

  return (
    <Modal title="Profile overview" onClose={onClose}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar person={person} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-2xl font-black text-slate-950">{person.name}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{segmentMeta[person.segment].label}</p>
          <div className="mt-3 inline-flex rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
            {titleCase(person.status || 'Unknown')}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <InfoRow icon={Mail} label="Email" value={person.email || 'Not provided'} />
        <InfoRow icon={Phone} label="Phone" value={person.phone || 'Not provided'} />
        <InfoRow icon={UserRound} label="Role / Department" value={person.role || person.department || 'Not provided'} />
        <InfoRow icon={Cake} label="Birthday" value={person.birthdayMonth && person.birthdayDay ? dateLabel(person.birthdayMonth, person.birthdayDay) : 'Not provided'} />
        <InfoRow icon={Heart} label="Wedding Anniversary" value={person.anniversaryMonth && person.anniversaryDay ? dateLabel(person.anniversaryMonth, person.anniversaryDay) : 'Not provided'} />
        <InfoRow icon={CalendarDays} label="Created" value={person.createdAt ? new Date(person.createdAt).toLocaleDateString() : 'Not provided'} />
      </div>
    </Modal>
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
    <Modal title={title} onClose={onClose} wide>
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-950 p-3 text-white">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-black text-slate-950">Backend-driven celebration workflow</div>
              <p className="mt-1 text-sm text-slate-500">
                This list is generated from saved leadership, membership, and workforce records. No mock records are used.
              </p>
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
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, email, segment, role..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_120px] gap-4 bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wide text-white md:grid">
          <div>Profile</div>
          <div>Segment</div>
          <div>Contact</div>
          <div className="text-right">Date</div>
        </div>

        <div className="divide-y divide-slate-100 bg-white">
          {filtered.map((item) => (
            <div key={item.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1.4fr_1fr_1fr_120px] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar person={item} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-950">{item.name}</div>
                  <div className="truncate text-xs text-slate-500">{item.role || 'Profile'}</div>
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-600">{segmentMeta[item.segment].label}</div>
              <div className="min-w-0 text-sm text-slate-500">
                <div className="truncate">{item.email || 'No email'}</div>
                <div className="truncate text-xs">{item.phone || 'No phone'}</div>
              </div>
              <div className="text-left md:text-right">
                <div className="text-sm font-black text-slate-950">{item.dateLabel}</div>
                <div className="text-xs text-slate-500">{item.daysUntil === 0 ? 'Today' : `${item.daysUntil} days`}</div>
              </div>
            </div>
          ))}

          {filtered.length === 0 ? <div className="p-4"><EmptyState label="No records match your search." /></div> : null}
        </div>
      </div>
    </Modal>
  );
}

function ActionButton({ children, loading, onClick }: { children: React.ReactNode; loading?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {children}
    </button>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [state, setState] = useState<LoadState>({ loading: true, error: '', data: null });
  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(null);
  const [trackerMode, setTrackerMode] = useState<TrackerMode | null>(null);
  const [toast, setToast] = useState('');

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await loadOverviewData();
      setState({ loading: false, error: '', data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load dashboard overview.';
      setState({ loading: false, error: message, data: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendToday = useCallback(async (mode: TrackerMode, segment?: SegmentKey) => {
    const requests: string[] = [];

    if (mode === 'birthdays') {
      if (!segment || segment === 'leadership') requests.push('/api/v1/admin/leadership/birthdays/send-today');
      if (!segment || segment === 'members') requests.push('/api/v1/admin/members/birthdays/send-today');
      if (!segment || segment === 'workforce') requests.push('/api/v1/admin/workforce/birthdays/send-today');
    }

    if (mode === 'anniversaries') {
      requests.push('/api/v1/admin/leadership/anniversaries/send-today');
    }

    await Promise.all(requests.map((path) => apiPost(path)));
    setToast(mode === 'birthdays' ? 'Birthday greetings triggered successfully.' : 'Anniversary greetings triggered successfully.');
    window.setTimeout(() => setToast(''), 3500);
    await refresh();
  }, [refresh]);

  const data = state.data;

  const searchedProfiles = useMemo(() => data?.allPeople ?? [], [data]);
  const trackerItems = trackerMode === 'birthdays' ? data?.upcomingBirthdays ?? [] : data?.upcomingAnniversaries ?? [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-none space-y-5">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-950 px-5 py-5 text-white sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/70">
                  <ShieldCheck className="h-4 w-4" />
                  Backend-driven overview
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Church Management Overview</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-white/65">
                  Live leadership, membership, workforce, birthdays, and wedding anniversary intelligence from backend records. Use the dedicated Leadership, Members, New Members, and Workforce screens for daily operations.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTrackerMode('birthdays')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-slate-100"
                >
                  <Cake className="h-4 w-4" />
                  Birthday scheduler
                </button>
                <button
                  type="button"
                  onClick={() => setTrackerMode('anniversaries')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-300"
                >
                  <Heart className="h-4 w-4" />
                  Anniversary tracker
                </button>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                >
                  <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </header>

        {toast ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {toast}
          </div>
        ) : null}

        {state.error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            {state.error}
          </div>
        ) : null}

        {state.loading && !data ? (
          <div className="flex min-h-[45vh] items-center justify-center rounded-3xl border border-slate-200 bg-white">
            <div className="text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-slate-950" />
              <p className="mt-3 text-sm font-bold text-slate-500">Loading backend overview...</p>
            </div>
          </div>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total profiles"
                value={data.allPeople.length}
                subtitle="Leadership, membership, and workforce records"
                icon={Activity}
                tone="from-slate-200 to-white text-slate-800 border-slate-200"
              />
              <StatCard
                title="Today birthdays"
                value={data.todayBirthdays.length}
                subtitle="Due for birthday greetings today"
                icon={Cake}
                tone="from-pink-500/20 to-rose-500/5 text-pink-700 border-pink-200"
              />
              <StatCard
                title="Today anniversaries"
                value={data.todayAnniversaries.length}
                subtitle="Leadership wedding anniversaries due today"
                icon={Heart}
                tone="from-red-500/20 to-orange-500/5 text-red-700 border-red-200"
              />
              <StatCard
                title="Upcoming events"
                value={data.upcomingBirthdays.length + data.upcomingAnniversaries.length}
                subtitle={`Next ${TRACKING_WINDOW_DAYS} days across tracked records`}
                icon={TrendingUp}
                tone="from-violet-500/20 to-purple-500/5 text-violet-700 border-violet-200"
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-3">
              <SegmentCard segment="leadership" items={data.leadership} onOpen={setSelectedPerson} />
              <SegmentCard segment="members" items={data.members} onOpen={setSelectedPerson} />
              <SegmentCard segment="workforce" items={data.workforce} onOpen={setSelectedPerson} />
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <MonthBarChart
                title="Birthday distribution"
                subtitle="Monthly birthday counts from leadership, membership, and workforce records."
                data={data.birthdayMonths}
                icon={Cake}
              />
              <MonthBarChart
                title="Wedding anniversary distribution"
                subtitle="Monthly anniversary counts from leadership records."
                data={data.anniversaryMonths}
                icon={Heart}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <TrackerList title="Upcoming birthdays" items={data.upcomingBirthdays} icon={Cake} onOpen={(item) => {
                const person = searchedProfiles.find((profile) => profile.id === item.id.replace(`birthdays-${item.segment}-`, ''));
                if (person) setSelectedPerson(person);
              }} />
              <TrackerList title="Upcoming wedding anniversaries" items={data.upcomingAnniversaries} icon={Heart} onOpen={(item) => {
                const person = searchedProfiles.find((profile) => profile.id === item.id.replace(`anniversaries-${item.segment}-`, ''));
                if (person) setSelectedPerson(person);
              }} />
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-950">Profile intelligence table</h2>
                  <p className="mt-1 text-sm text-slate-500">A responsive operational table from backend profile records.</p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Print / Export
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_120px] gap-4 bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wide text-white lg:grid">
                  <div>Profile</div>
                  <div>Segment</div>
                  <div>Birthday</div>
                  <div>Anniversary</div>
                  <div className="text-right">Status</div>
                </div>
                <div className="divide-y divide-slate-100 bg-white">
                  {data.allPeople.slice(0, 20).map((person) => (
                    <button
                      key={`${person.segment}-${person.id}`}
                      type="button"
                      onClick={() => setSelectedPerson(person)}
                      className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-slate-50 lg:grid-cols-[1.4fr_1fr_1fr_1fr_120px] lg:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar person={person} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-950">{person.name}</div>
                          <div className="truncate text-xs text-slate-500">{person.email || person.phone || 'No contact recorded'}</div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-slate-600">{segmentMeta[person.segment].label}</div>
                      <div className="text-sm text-slate-500">{person.birthdayMonth && person.birthdayDay ? dateLabel(person.birthdayMonth, person.birthdayDay) : '—'}</div>
                      <div className="text-sm text-slate-500">{person.anniversaryMonth && person.anniversaryDay ? dateLabel(person.anniversaryMonth, person.anniversaryDay) : '—'}</div>
                      <div className="text-left lg:text-right">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{titleCase(person.status || 'Unknown')}</span>
                      </div>
                    </button>
                  ))}
                  {data.allPeople.length === 0 ? <div className="p-4"><EmptyState label="No backend records found." /></div> : null}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <ProfileModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      <TrackerModal mode={trackerMode} items={trackerItems} onClose={() => setTrackerMode(null)} onSendToday={sendToday} />
    </main>
  );
}
