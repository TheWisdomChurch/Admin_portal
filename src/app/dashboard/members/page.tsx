'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Send,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { apiClient } from '@/lib/api';
import type { AdminForm, FormSubmission, Member } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type SubmissionValues = Record<string, unknown>;

type NewMemberLead = {
  id: string;
  submissionId: string;
  formId: string;
  formTitle: string;
  formSlug: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  birthday: string;
  gender: string;
  submittedAt: string;
  isPublishedMember: boolean;
  hasContact: boolean;
  values: SubmissionValues;
};

type FormSourceSummary = {
  id: string;
  title: string;
  slug: string;
  status: string;
  backendSubmissionCount: number;
  loadedSubmissionCount: number;
};

type OutreachFilter = 'all' | 'this_week' | 'unpublished' | 'needs_contact';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SUBMISSION_PAGE_LIMIT = 100;
const MAX_SUBMISSION_PAGES_PER_FORM = 15;

const MEMBER_FORM_KEYWORDS = [
  'member',
  'membership',
  'new member',
  'new-member',
  'first timer',
  'first-timer',
  'visitor',
  'convert',
];

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.items)) return record.items as T[];

    if (record.data && typeof record.data === 'object') {
      const nested = record.data as Record<string, unknown>;
      if (Array.isArray(nested.data)) return nested.data as T[];
      if (Array.isArray(nested.items)) return nested.items as T[];
      if (Array.isArray(nested.results)) return nested.results as T[];
    }
  }

  return [];
}

function toPagedArray<T>(value: unknown): { data: T[]; total: number } {
  const data = toArray<T>(value);
  let total = data.length;

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.total === 'number') total = record.total;
    if (typeof record.count === 'number') total = record.count;

    if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
      const nested = record.data as Record<string, unknown>;
      if (typeof nested.total === 'number') total = nested.total;
      if (typeof nested.count === 'number') total = nested.count;
    }
  }

  return { data, total };
}

function normalizeToken(value?: string | null): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isMembershipForm(form: AdminForm): boolean {
  const settings = form.settings || {};
  const target = normalizeToken(String(settings.submissionTarget || ''));
  const formType = normalizeToken(String(settings.formType || ''));
  const surface = normalizeToken(`${form.title || ''} ${form.slug || ''} ${target} ${formType}`);

  if (target === 'member' || target === 'members' || target === 'membership') return true;
  if (formType === 'member' || formType === 'membership') return true;

  return MEMBER_FORM_KEYWORDS.some((keyword) => surface.includes(normalizeToken(keyword)));
}

function getSubmissionValues(submission: FormSubmission): SubmissionValues {
  const values = (submission.values || {}) as SubmissionValues;
  return values && typeof values === 'object' ? values : {};
}

function readText(values: SubmissionValues, keys: string[]): string {
  for (const key of keys) {
    const raw = values[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  }

  return '';
}

function readSubmissionText(submission: FormSubmission, values: SubmissionValues, keys: string[]): string {
  const submissionRecord = submission as unknown as Record<string, unknown>;

  for (const key of keys) {
    const raw = submissionRecord[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }

  return readText(values, keys);
}

function resolveLeadName(submission: FormSubmission, values: SubmissionValues): { name: string; firstName: string; lastName: string } {
  const direct =
    readSubmissionText(submission, values, ['name', 'fullName', 'full_name']) ||
    readText(values, ['memberName', 'member_name', 'applicantName', 'applicant_name']);

  const firstName = readText(values, ['firstName', 'first_name', 'firstname', 'givenName', 'given_name']);
  const lastName = readText(values, ['lastName', 'last_name', 'lastname', 'surname', 'familyName', 'family_name']);

  const combined = `${firstName} ${lastName}`.trim();

  return {
    name: direct || combined || 'Unnamed member',
    firstName,
    lastName,
  };
}

function resolveSubmittedAt(submission: FormSubmission): string {
  const record = submission as unknown as Record<string, unknown>;
  const value = record.createdAt || record.created_at || record.submittedAt || record.submitted_at;

  if (typeof value === 'string' && value.trim()) return value.trim();

  return new Date().toISOString();
}

function normalizeLead(submission: FormSubmission, form: AdminForm, publishedEmails: Set<string>): NewMemberLead {
  const values = getSubmissionValues(submission);
  const { name, firstName, lastName } = resolveLeadName(submission, values);

  const email = readSubmissionText(submission, values, [
    'email',
    'emailAddress',
    'email_address',
    'contactEmail',
    'contact_email',
  ]);

  const phone = readSubmissionText(submission, values, [
    'contactNumber',
    'contact_number',
    'phone',
    'phoneNumber',
    'phone_number',
    'mobile',
    'mobileNumber',
    'mobile_number',
    'whatsapp',
  ]);

  const address = readSubmissionText(submission, values, [
    'contactAddress',
    'contact_address',
    'address',
    'homeAddress',
    'home_address',
    'location',
  ]);

  const birthday = readText(values, ['birthday', 'birthDay', 'birth_date', 'dateOfBirth', 'date_of_birth', 'dob']);
  const gender = readText(values, ['gender', 'sex']);

  const submittedAt = resolveSubmittedAt(submission);
  const normalizedEmail = normalizeEmail(email);

  return {
    id: `${form.id}:${submission.id}`,
    submissionId: submission.id,
    formId: form.id,
    formTitle: form.title || 'Membership form',
    formSlug: form.slug || '',
    name,
    firstName,
    lastName,
    email,
    phone,
    address,
    birthday,
    gender,
    submittedAt,
    isPublishedMember: Boolean(normalizedEmail && publishedEmails.has(normalizedEmail)),
    hasContact: Boolean(email || phone),
    values,
  };
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const diff = next.getDate() - day + (day === 0 ? -6 : 1);
  next.setDate(diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfQuarter(date: Date): Date {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function isOnOrAfter(value: string, boundary: Date): boolean {
  const date = parseDate(value);
  return Boolean(date && date >= boundary);
}

function formatDate(value?: string): string {
  const date = parseDate(value);
  if (!date) return '—';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatDateTime(value?: string): string {
  const date = parseDate(value);
  if (!date) return '—';

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysSince(value: string): number {
  const date = parseDate(value);
  if (!date) return 9999;

  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const value = `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.trim();
  return value ? value.toUpperCase() : 'NM';
}

function countSince(leads: NewMemberLead[], boundary: Date): number {
  return leads.filter((lead) => isOnOrAfter(lead.submittedAt, boundary)).length;
}

function buildWeeklySeries(leads: NewMemberLead[], now: Date): { labels: string[]; values: number[] } {
  const weekStarts = Array.from({ length: 8 }, (_, index) => {
    const date = startOfWeek(now);
    date.setDate(date.getDate() - (7 - index) * 7);
    return date;
  });

  const labels = weekStarts.map((date) =>
    date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
  );

  const values = weekStarts.map((start, index) => {
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    return leads.filter((lead) => {
      const submitted = parseDate(lead.submittedAt);
      return Boolean(submitted && submitted >= start && submitted < end);
    }).length;
  });

  return { labels, values };
}

function buildMonthlySeries(leads: NewMemberLead[], year: number): number[] {
  const values = new Array(12).fill(0) as number[];

  leads.forEach((lead) => {
    const date = parseDate(lead.submittedAt);
    if (!date || date.getFullYear() !== year) return;
    values[date.getMonth()] += 1;
  });

  return values;
}

function exportCsv(filename: string, leads: NewMemberLead[]): void {
  const headers = ['Name', 'Email', 'Phone', 'Birthday', 'Address', 'Source Form', 'Submitted At', 'Published'];
  const rows = leads.map((lead) => [
    lead.name,
    lead.email,
    lead.phone,
    lead.birthday,
    lead.address,
    lead.formTitle,
    lead.submittedAt,
    lead.isPublishedMember ? 'Yes' : 'No',
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => {
          const safe = String(value || '').replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [membershipForms, setMembershipForms] = useState<AdminForm[]>([]);
  const [leads, setLeads] = useState<NewMemberLead[]>([]);
  const [sourceSummaries, setSourceSummaries] = useState<FormSourceSummary[]>([]);
  const [query, setQuery] = useState('');
  const [sourceFormId, setSourceFormId] = useState('all');
  const [outreachFilter, setOutreachFilter] = useState<OutreachFilter>('all');
  const [selectedLead, setSelectedLead] = useState<NewMemberLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<string>('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    try {
      const [membersRes, formsRes] = await Promise.all([
        apiClient.listMembers({ page: 1, limit: 1000 }),
        apiClient.getAdminForms({ page: 1, limit: 500 }),
      ]);

      const memberRows = toArray<Member>(membersRes);
      const allForms = toArray<AdminForm>(formsRes);
      const memberForms = allForms.filter(isMembershipForm);

      const publishedEmails = new Set(
        memberRows
          .map((member) => normalizeEmail(member.email || ''))
          .filter(Boolean)
      );

      const allLeads: NewMemberLead[] = [];
      const summaries: FormSourceSummary[] = [];

      for (const form of memberForms) {
        let page = 1;
        let loadedCount = 0;
        const backendSubmissionCount = typeof form.submissionCount === 'number' ? form.submissionCount : 0;

        while (page <= MAX_SUBMISSION_PAGES_PER_FORM) {
          const submissionRes = await apiClient.getFormSubmissions(form.id, {
            page,
            limit: SUBMISSION_PAGE_LIMIT,
          });

          const { data } = toPagedArray<FormSubmission>(submissionRes);
          if (data.length === 0) break;

          loadedCount += data.length;
          data.forEach((submission) => {
            allLeads.push(normalizeLead(submission, form, publishedEmails));
          });

          if (data.length < SUBMISSION_PAGE_LIMIT) break;
          page += 1;
        }

        summaries.push({
          id: form.id,
          title: form.title || 'Membership form',
          slug: form.slug || '',
          status: String(form.status || (form.isPublished ? 'published' : 'draft')),
          backendSubmissionCount,
          loadedSubmissionCount: loadedCount,
        });
      }

      allLeads.sort((left, right) => {
        const leftDate = parseDate(left.submittedAt)?.getTime() || 0;
        const rightDate = parseDate(right.submittedAt)?.getTime() || 0;
        return rightDate - leftDate;
      });

      setMembers(memberRows);
      setMembershipForms(memberForms);
      setSourceSummaries(summaries);
      setLeads(allLeads);
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to load member intelligence dashboard:', error);
      toast.error('Unable to load member form data');
      setMembers([]);
      setMembershipForms([]);
      setSourceSummaries([]);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const now = useMemo(() => new Date(), [lastLoadedAt]);
  const weekStart = useMemo(() => startOfWeek(now), [now]);
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);
  const quarterStart = useMemo(() => startOfQuarter(now), [now]);
  const yearStart = useMemo(() => new Date(now.getFullYear(), 0, 1), [now]);

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return leads.filter((lead) => {
      if (sourceFormId !== 'all' && lead.formId !== sourceFormId) return false;

      if (outreachFilter === 'this_week' && !isOnOrAfter(lead.submittedAt, weekStart)) return false;
      if (outreachFilter === 'unpublished' && lead.isPublishedMember) return false;
      if (outreachFilter === 'needs_contact' && lead.hasContact) return false;

      if (!needle) return true;

      return `${lead.name} ${lead.email} ${lead.phone} ${lead.formTitle} ${lead.address}`
        .toLowerCase()
        .includes(needle);
    });
  }, [leads, outreachFilter, query, sourceFormId, weekStart]);

  const stats = useMemo(() => {
    const total = leads.length;
    const thisWeek = countSince(leads, weekStart);
    const thisMonth = countSince(leads, monthStart);
    const thisQuarter = countSince(leads, quarterStart);
    const thisYear = countSince(leads, yearStart);
    const unpublished = leads.filter((lead) => !lead.isPublishedMember).length;
    const needsContact = leads.filter((lead) => !lead.hasContact).length;
    const withBirthday = leads.filter((lead) => Boolean(lead.birthday)).length;

    return {
      total,
      thisWeek,
      thisMonth,
      thisQuarter,
      thisYear,
      unpublished,
      needsContact,
      withBirthday,
      publishedRegistry: members.length,
    };
  }, [leads, members.length, monthStart, quarterStart, weekStart, yearStart]);

  const weeklySeries = useMemo(() => buildWeeklySeries(leads, now), [leads, now]);
  const monthlySeries = useMemo(() => buildMonthlySeries(leads, now.getFullYear()), [leads, now]);

  const topSources = useMemo(() => {
    return sourceSummaries
      .slice()
      .sort((left, right) => right.loadedSubmissionCount - left.loadedSubmissionCount)
      .slice(0, 6);
  }, [sourceSummaries]);

  const urgentFollowUps = useMemo(() => {
    return leads
      .filter((lead) => !lead.isPublishedMember && lead.hasContact && daysSince(lead.submittedAt) <= 30)
      .slice(0, 8);
  }, [leads]);

  const copyLead = async (lead: NewMemberLead) => {
    const text = [
      `Name: ${lead.name}`,
      `Email: ${lead.email || '—'}`,
      `Phone: ${lead.phone || '—'}`,
      `Source: ${lead.formTitle}`,
      `Submitted: ${formatDateTime(lead.submittedAt)}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Follow-up details copied');
    } catch {
      toast.error('Unable to copy details');
    }
  };

  const openMail = (lead: NewMemberLead) => {
    if (!lead.email) {
      toast.error('This response has no email address');
      return;
    }

    const subject = encodeURIComponent('Welcome to Wisdom House Church');
    const body = encodeURIComponent(
      `Hello ${lead.name},\n\nThank you for submitting your membership details. We would love to connect with you and help you settle into the church family.\n\nBlessings,\nWisdom House Church`
    );

    window.location.href = `mailto:${lead.email}?subject=${subject}&body=${body}`;
  };

  const openCall = (lead: NewMemberLead) => {
    if (!lead.phone) {
      toast.error('This response has no phone number');
      return;
    }

    window.location.href = `tel:${lead.phone}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members Intelligence"
        subtitle="Backend-driven new-member growth, membership form submissions, and outreach follow-up pipeline."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={loadDashboard}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              icon={<ExternalLink className="h-4 w-4" />}
              onClick={() => window.location.assign('/dashboard/forms')}
            >
              Manage forms
            </Button>
            <Button
              icon={<ClipboardCopy className="h-4 w-4" />}
              onClick={() => exportCsv('new-member-form-submissions.csv', filteredLeads)}
              disabled={filteredLeads.length === 0}
            >
              Export outreach list
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          label="This week"
          value={stats.thisWeek}
          meta="New member form submissions"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="This month"
          value={stats.thisMonth}
          meta={`${stats.thisQuarter} this quarter`}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          label="This year"
          value={stats.thisYear}
          meta={`${stats.total} total form submissions loaded`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Outreach queue"
          value={stats.unpublished}
          meta={`${stats.needsContact} need contact cleanup`}
          icon={<Send className="h-5 w-5" />}
          tone={stats.unpublished > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card
          title="New members by week"
          actions={
            <span className="text-xs text-[var(--color-text-tertiary)]">
              Last 8 weeks from membership form submissions
            </span>
          }
        >
          <div className="h-[320px]">
            <Bar
              data={{
                labels: weeklySeries.labels,
                datasets: [
                  {
                    label: 'New member submissions',
                    data: weeklySeries.values,
                    backgroundColor: '#16a34a',
                    borderRadius: 8,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { enabled: true },
                },
                scales: {
                  y: { beginAtZero: true, ticks: { precision: 0 } },
                },
              }}
            />
          </div>
        </Card>

        <Card title="Membership sources">
          <div className="space-y-3">
            {loading ? (
              <EmptyBlock text="Loading membership forms..." />
            ) : topSources.length === 0 ? (
              <EmptyBlock text="No membership forms were found. Create or tag a form as membership/member." />
            ) : (
              topSources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--color-text-primary)]">{source.title}</p>
                      <p className="truncate text-xs text-[var(--color-text-tertiary)]">/{source.slug || 'no-slug'}</p>
                    </div>
                    <Badge variant={source.status === 'published' ? 'success' : 'warning'}>{source.status}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-[var(--color-background-primary)] p-3">
                      <p className="text-[var(--color-text-tertiary)]">Loaded</p>
                      <p className="text-lg font-bold text-[var(--color-text-primary)]">{source.loadedSubmissionCount}</p>
                    </div>
                    <div className="rounded-lg bg-[var(--color-background-primary)] p-3">
                      <p className="text-[var(--color-text-tertiary)]">Backend count</p>
                      <p className="text-lg font-bold text-[var(--color-text-primary)]">{source.backendSubmissionCount}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card
          title={`${now.getFullYear()} monthly intake`}
          actions={
            <span className="text-xs text-[var(--color-text-tertiary)]">
              Based on submitted date, not manually-created records
            </span>
          }
        >
          <div className="h-[300px]">
            <Bar
              data={{
                labels: MONTH_LABELS,
                datasets: [
                  {
                    label: 'New member submissions',
                    data: monthlySeries,
                    backgroundColor: '#eab308',
                    borderRadius: 8,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { enabled: true },
                },
                scales: {
                  y: { beginAtZero: true, ticks: { precision: 0 } },
                },
              }}
            />
          </div>
        </Card>

        <Card
          title="Immediate outreach priorities"
          actions={<Badge variant={urgentFollowUps.length > 0 ? 'warning' : 'success'}>{urgentFollowUps.length} pending</Badge>}
        >
          <div className="space-y-3">
            {loading ? (
              <EmptyBlock text="Loading outreach queue..." />
            ) : urgentFollowUps.length === 0 ? (
              <EmptyBlock text="No urgent new-member follow-ups at the moment." />
            ) : (
              urgentFollowUps.map((lead) => (
                <ProfileRow
                  key={lead.id}
                  lead={lead}
                  onOpen={() => setSelectedLead(lead)}
                  onCopy={() => copyLead(lead)}
                  onMail={() => openMail(lead)}
                  onCall={() => openCall(lead)}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">New member outreach table</p>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Every row comes from a membership form submission. No mock records and no manual-only records are used for growth stats.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px] xl:min-w-[560px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, phone, address..."
                className="pl-10"
              />
            </div>

            <select
              value={sourceFormId}
              onChange={(event) => setSourceFormId(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="all">All membership forms</option>
              {membershipForms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title || form.slug || form.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <FilterButton active={outreachFilter === 'all'} onClick={() => setOutreachFilter('all')}>
            All responses ({leads.length})
          </FilterButton>
          <FilterButton active={outreachFilter === 'this_week'} onClick={() => setOutreachFilter('this_week')}>
            This week ({stats.thisWeek})
          </FilterButton>
          <FilterButton active={outreachFilter === 'unpublished'} onClick={() => setOutreachFilter('unpublished')}>
            Not in registry ({stats.unpublished})
          </FilterButton>
          <FilterButton active={outreachFilter === 'needs_contact'} onClick={() => setOutreachFilter('needs_contact')}>
            Needs contact cleanup ({stats.needsContact})
          </FilterButton>
        </div>

        <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border-secondary)]">
          <table className="min-w-full divide-y divide-[var(--color-border-secondary)] text-sm">
            <thead className="bg-[var(--color-background-tertiary)]">
              <tr className="text-left text-[var(--color-text-secondary)]">
                <th className="px-4 py-3 font-semibold">Profile</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Outreach</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-border-secondary)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-[var(--color-text-tertiary)]">
                    Loading new member form submissions...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-[var(--color-text-tertiary)]">
                    No new member form submissions match this filter.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-primary)]/10 text-sm font-bold text-[var(--color-accent-primary)]">
                          {initials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--color-text-primary)]">{lead.name}</p>
                          <p className="text-xs text-[var(--color-text-tertiary)]">
                            {lead.birthday ? `Birthday: ${lead.birthday}` : 'Birthday not supplied'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      <div className="space-y-1">
                        <span className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                          {lead.email || 'No email'}
                        </span>
                        <span className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                          {lead.phone || 'No phone'}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <p className="max-w-[240px] truncate font-medium text-[var(--color-text-primary)]">{lead.formTitle}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">/{lead.formSlug || 'no-slug'}</p>
                    </td>

                    <td className="px-4 py-3 text-[var(--color-text-tertiary)]">
                      <div>{formatDate(lead.submittedAt)}</div>
                      <div className="text-xs">{daysSince(lead.submittedAt)} day(s) ago</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <Badge variant={lead.isPublishedMember ? 'success' : 'warning'}>
                          {lead.isPublishedMember ? 'In registry' : 'Needs follow-up'}
                        </Badge>
                        {!lead.hasContact ? (
                          <div className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Missing contact
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setSelectedLead(lead)}>
                          View
                        </Button>
                        <Button variant="outline" icon={<Send className="h-4 w-4" />} onClick={() => openMail(lead)}>
                          Follow up
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedLead ? (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onCopy={() => copyLead(selectedLead)}
          onMail={() => openMail(selectedLead)}
          onCall={() => openCall(selectedLead)}
        />
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  meta,
  icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  meta: string;
  icon: ReactNode;
  tone?: 'default' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-500/10 text-emerald-600'
      : tone === 'warning'
      ? 'bg-amber-500/10 text-amber-600'
      : 'bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]';

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-text-tertiary)]">{label}</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-text-primary)]">{value}</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{meta}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-[var(--radius-button)] ${toneClass}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
      {text}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]'
          : 'border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-primary)]'
      }`}
    >
      {children}
    </button>
  );
}

function ProfileRow({
  lead,
  onOpen,
  onCopy,
  onMail,
  onCall,
}: {
  lead: NewMemberLead;
  onOpen: () => void;
  onCopy: () => void;
  onMail: () => void;
  onCall: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-primary)]/10 text-sm font-bold text-[var(--color-accent-primary)]">
            {initials(lead.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--color-text-primary)]">{lead.name}</p>
            <p className="truncate text-xs text-[var(--color-text-tertiary)]">{lead.formTitle}</p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Submitted {formatDate(lead.submittedAt)}</p>
          </div>
        </div>

        <Badge variant={lead.isPublishedMember ? 'success' : 'warning'}>
          {lead.isPublishedMember ? 'In registry' : 'Follow up'}
        </Badge>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          {lead.email || 'No email'}
        </span>
        <span className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          {lead.phone || 'No phone'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={onOpen}>
          View
        </Button>
        <Button variant="outline" onClick={onCopy} icon={<ClipboardCopy className="h-4 w-4" />}>
          Copy
        </Button>
        <Button variant="outline" onClick={onMail} icon={<Mail className="h-4 w-4" />}>
          Email
        </Button>
        <Button variant="outline" onClick={onCall} icon={<Phone className="h-4 w-4" />}>
          Call
        </Button>
      </div>
    </div>
  );
}

function LeadModal({
  lead,
  onClose,
  onCopy,
  onMail,
  onCall,
}: {
  lead: NewMemberLead;
  onClose: () => void;
  onCopy: () => void;
  onMail: () => void;
  onCall: () => void;
}) {
  const dynamicRows = Object.entries(lead.values)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    .slice(0, 30);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-secondary)] px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-primary)]/10 text-base font-bold text-[var(--color-accent-primary)]">
              {initials(lead.name)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-[var(--color-text-primary)]">{lead.name}</h2>
              <p className="text-sm text-[var(--color-text-tertiary)]">{lead.formTitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-160px)] overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoTile icon={<Mail className="h-4 w-4" />} label="Email" value={lead.email || 'No email supplied'} />
            <InfoTile icon={<Phone className="h-4 w-4" />} label="Phone" value={lead.phone || 'No phone supplied'} />
            <InfoTile icon={<CalendarDays className="h-4 w-4" />} label="Birthday" value={lead.birthday || 'Not supplied'} />
            <InfoTile icon={<FileText className="h-4 w-4" />} label="Submitted" value={formatDateTime(lead.submittedAt)} />
            <InfoTile icon={<UserCheck className="h-4 w-4" />} label="Registry status" value={lead.isPublishedMember ? 'Already in member registry' : 'Not yet in member registry'} />
            <InfoTile icon={<CheckCircle2 className="h-4 w-4" />} label="Contact quality" value={lead.hasContact ? 'Contact details available' : 'Missing email and phone'} />
          </div>

          <div className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)]">
            <div className="border-b border-[var(--color-border-secondary)] px-4 py-3">
              <p className="font-semibold text-[var(--color-text-primary)]">Submitted form values</p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                This section is rendered from the backend form submission values.
              </p>
            </div>

            <div className="divide-y divide-[var(--color-border-secondary)]">
              {dynamicRows.length === 0 ? (
                <div className="px-4 py-4 text-sm text-[var(--color-text-tertiary)]">No additional values supplied.</div>
              ) : (
                dynamicRows.map(([key, value]) => (
                  <div key={key} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[180px_1fr]">
                    <span className="font-medium text-[var(--color-text-secondary)]">{key}</span>
                    <span className="break-words text-[var(--color-text-primary)]">{String(value)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border-secondary)] px-5 py-4">
          <Button variant="outline" onClick={onCopy} icon={<ClipboardCopy className="h-4 w-4" />}>
            Copy details
          </Button>
          <Button variant="outline" onClick={onCall} icon={<Phone className="h-4 w-4" />}>
            Call
          </Button>
          <Button onClick={onMail} icon={<Send className="h-4 w-4" />}>
            Follow up by email
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {icon}
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-medium text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
