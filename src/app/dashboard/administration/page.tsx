'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Heart,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { fetchAllFormSubmissions } from '@/lib/formSubmissions';
import { buildPublicFormUrl } from '@/lib/utils';
import type {
  CreateLeadershipRequest,
  CreateFormRequest,
  AdminForm,
  FormSubmission,
  LeadershipMember,
  LeadershipRole,
  Member,
  WorkforceMember,
} from '@/lib/types';

type SectionKey = 'workforce' | 'members' | 'leadership';
type TabKey = 'overview' | SectionKey;

const ALL_FORMS = '__all__';

const roleOptions: Array<{ value: LeadershipRole; label: string }> = [
  { value: 'senior_pastor', label: 'Senior Pastor' },
  { value: 'associate_pastor', label: 'Associate Pastor' },
  { value: 'reverend', label: 'Reverend' },
  { value: 'deacon', label: 'Deacon' },
  { value: 'deaconess', label: 'Deaconness' },
];

const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;
const dashedDate = /^(\d{2})-(\d{2})-(\d{4})$/;

function buildLeadershipFormPayload(): CreateFormRequest {
  return {
    title: 'Leadership Biodata',
    description: 'Collect leadership profile details for review and publication.',
    slug: 'leadership-biodata',
    fields: [
      { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
      { key: 'email', label: 'Email Address', type: 'email', required: true, order: 2 },
      { key: 'phone', label: 'Contact Number', type: 'tel', required: true, order: 3 },
      {
        key: 'leadership_role',
        label: 'Leadership Role',
        type: 'select',
        required: true,
        order: 4,
        options: [
          { label: 'Pastor', value: 'pastor' },
          { label: 'Associate Pastor', value: 'associate_pastor' },
          { label: 'Reverend', value: 'reverend' },
          { label: 'Deacon', value: 'deacon' },
          { label: 'Deaconess', value: 'deaconess' },
        ],
      },
      {
        key: 'bio',
        label: 'Short Bio',
        type: 'textarea',
        required: false,
        order: 5,
        validation: { maxWords: 400 },
      },
      { key: 'birthday', label: 'Birthday (DD/MM/YYYY)', type: 'text', required: false, order: 6 },
      {
        key: 'wedding_anniversary',
        label: 'Wedding Anniversary (DD/MM/YYYY)',
        type: 'text',
        required: false,
        order: 7,
      },
      { key: 'photo', label: 'Profile Photo', type: 'image', required: false, order: 8 },
    ],
    settings: {
      formType: 'leadership',
      submissionTarget: 'leadership',
      responseEmailEnabled: false,
      successTitle: 'Leadership biodata received',
      successSubtitle: 'Thank you. Your profile details have been sent for review.',
      successMessage: 'The administration team will review this submission before it appears on the public leadership page.',
      introTitle: 'Leadership Biodata',
      introSubtitle: 'Provide accurate profile details for review and publication.',
      introBullets: ['Profile review', 'Public leadership page', 'Secure submission'],
      introBulletSubtexts: ['Reviewed by administration', 'Published only after approval', 'Submitted through Wisdom Church'],
      layoutMode: 'split',
      dateFormat: 'dd/mm/yyyy',
      footerText: 'Powered by Wisdom Church',
      footerBg: '#f5c400',
      footerTextColor: '#111827',
      submitButtonText: 'Submit Biodata',
      submitButtonBg: '#f59e0b',
      submitButtonTextColor: '#111827',
      submitButtonIcon: 'send',
      formHeaderNote: 'Leadership submissions are reviewed before publication.',
    },
  };
}

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data as T[];
    if (record.data && typeof record.data === 'object') {
      const nested = record.data as Record<string, unknown>;
      if (Array.isArray(nested.data)) return nested.data as T[];
      if (Array.isArray(nested.items)) return nested.items as T[];
    }
    if (Array.isArray(record.items)) return record.items as T[];
  }
  return [];
}

function formatMonthDay(month?: number, day?: number) {
  if (!month || !day) return '—';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

function roleLabel(role: LeadershipRole) {
  const found = roleOptions.find((item) => item.value === role);
  return found ? found.label : role;
}

function normalizeToken(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getSubmissionCount(form: AdminForm) {
  const record = form as AdminForm & {
    submissionCount?: number;
    submissionsCount?: number;
    responseCount?: number;
    responsesCount?: number;
    totalSubmissions?: number;
    total?: number;
    count?: number;
  };

  const count =
    record.submissionCount ??
    record.submissionsCount ??
    record.responseCount ??
    record.responsesCount ??
    record.totalSubmissions ??
    record.total ??
    record.count ??
    0;

  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

function formMatchesSection(form: AdminForm, section: SectionKey) {
  const target = form.settings?.submissionTarget;
  const formType = form.settings?.formType;
  const surface = normalizeToken(`${form.slug || ''} ${form.title || ''}`);

  if (section === 'workforce') {
    return (
      target === 'workforce' ||
      target === 'workforce_new' ||
      target === 'workforce_serving' ||
      formType === 'workforce' ||
      surface.includes('workforce') ||
      surface.includes('worker')
    );
  }

  if (section === 'members') {
    return (
      target === 'member' ||
      formType === 'membership' ||
      surface.includes('member') ||
      surface.includes('membership')
    );
  }

  return target === 'leadership' || formType === 'leadership' || surface.includes('leadership');
}

function resolveSubmissionName(submission: FormSubmission) {
  const values = submission.values || {};
  const direct = submission.name || values.fullName || values.full_name || values.name;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const first = typeof values.firstName === 'string' ? values.firstName : values.first_name;
  const last = typeof values.lastName === 'string' ? values.lastName : values.last_name;
  const combined = `${typeof first === 'string' ? first : ''} ${typeof last === 'string' ? last : ''}`.trim();
  return combined || 'Anonymous';
}

function resolveSubmissionEmail(submission: FormSubmission) {
  const values = submission.values || {};
  const email = submission.email || values.email || values.contactEmail || values.email_address;
  return typeof email === 'string' && email.trim() ? email.trim() : 'No email';
}

function resolveSubmissionPhone(submission: FormSubmission) {
  const values = submission.values || {};
  const phone = submission.contactNumber || values.phone || values.contactPhone || values.phone_number || values.contact_number;
  return typeof phone === 'string' && phone.trim() ? phone.trim() : '—';
}

function readSubmissionText(submission: FormSubmission, keys: string[]) {
  const values = submission.values || {};
  for (const key of keys) {
    const raw = values[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
    if (Array.isArray(raw) && raw.length > 0) return raw.join(', ');
  }
  return '';
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Unknown' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normalizeLeadershipRole(value: string): LeadershipRole {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (normalized === 'senior_pastor' || normalized === 'pastor') return 'senior_pastor';
  if (normalized === 'associate_pastor') return 'associate_pastor';
  if (normalized === 'reverend' || normalized === 'rev') return 'reverend';
  if (normalized === 'deacon') return 'deacon';
  if (normalized === 'deaconess' || normalized === 'deaconness') return 'deaconess';
  return 'associate_pastor';
}

function normalizeLeadershipDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const isoMatch = trimmed.match(isoDate);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const dashedMatch = trimmed.match(dashedDate);
  if (dashedMatch) return `${dashedMatch[1]}/${dashedMatch[2]}/${dashedMatch[3]}`;
  return trimmed.replace(/-/g, '/');
}

function buildLeadershipPayloadFromSubmission(submission: FormSubmission): CreateLeadershipRequest {
  const fullName = resolveSubmissionName(submission);
  const split = splitFullName(fullName);
  const firstName = readSubmissionText(submission, ['first_name', 'firstName']) || split.firstName;
  const lastName = readSubmissionText(submission, ['last_name', 'lastName']) || split.lastName;
  const role = readSubmissionText(submission, ['leadership_role', 'role', 'position', 'title']);
  const birthday = readSubmissionText(submission, ['birthday', 'date_of_birth', 'birth_date', 'dob']);
  const anniversary = readSubmissionText(submission, ['anniversary', 'wedding_anniversary', 'marriage_anniversary']);
  const imageUrl = readSubmissionText(submission, ['imageUrl', 'image_url', 'profile_image', 'photo']);

  return {
    firstName,
    lastName,
    email: resolveSubmissionEmail(submission) !== 'No email' ? resolveSubmissionEmail(submission) : undefined,
    phone: resolveSubmissionPhone(submission) !== '—' ? resolveSubmissionPhone(submission) : undefined,
    role: normalizeLeadershipRole(role),
    status: 'approved',
    bio: readSubmissionText(submission, ['bio', 'short_bio', 'profile', 'about']) || undefined,
    birthday: birthday ? normalizeLeadershipDate(birthday) : undefined,
    anniversary: anniversary ? normalizeLeadershipDate(anniversary) : undefined,
    imageUrl: imageUrl.startsWith('http://') || imageUrl.startsWith('https://') ? imageUrl : undefined,
  };
}

function leadershipSubmissionAlreadyPublished(submission: FormSubmission, leaders: LeadershipMember[]) {
  const email = resolveSubmissionEmail(submission).toLowerCase();
  const name = resolveSubmissionName(submission).toLowerCase();

  return leaders.some((leader) => {
    const leaderEmail = (leader.email || '').toLowerCase();
    const leaderName = `${leader.firstName} ${leader.lastName}`.trim().toLowerCase();
    return (email !== 'no email' && leaderEmail === email) || (name !== 'anonymous' && leaderName === name);
  });
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function AccordionRow({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--color-text-primary)] truncate">{title}</p>
          {subtitle && <p className="text-xs text-[var(--color-text-tertiary)] truncate">{subtitle}</p>}
        </div>
        {badge}
      </div>
      <div className="pt-3">{children}</div>
    </div>
  );
}

export default function AdministrationPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const [workforce, setWorkforce] = useState<WorkforceMember[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [leaders, setLeaders] = useState<LeadershipMember[]>([]);
  const [forms, setForms] = useState<AdminForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFormIds, setSelectedFormIds] = useState<Record<SectionKey, string>>({
    workforce: ALL_FORMS,
    members: ALL_FORMS,
    leadership: ALL_FORMS,
  });
  const [formSubmissions, setFormSubmissions] = useState<FormSubmission[]>([]);
  const [formSubmissionsTotal, setFormSubmissionsTotal] = useState(0);
  const [formSubmissionsPage, setFormSubmissionsPage] = useState(1);
  const [formSubmissionsLoading, setFormSubmissionsLoading] = useState(false);
  const [publishingSubmissionId, setPublishingSubmissionId] = useState<string | null>(null);
  const [creatingLeadershipForm, setCreatingLeadershipForm] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [workforceRes, membersRes, leadershipRes, formsRes] = await Promise.all([
        apiClient.listWorkforce({ page: 1, limit: 200 }),
        apiClient.listMembers({ page: 1, limit: 200 }),
        apiClient.listLeadership({ page: 1, limit: 200 }),
        apiClient.getAdminForms({ page: 1, limit: 300 }),
      ]);

      setWorkforce(toArray<WorkforceMember>(workforceRes));
      setMembers(toArray<Member>(membersRes));
      setLeaders(toArray<LeadershipMember>(leadershipRes));
      setForms(Array.isArray(formsRes.data) ? formsRes.data : []);
    } catch (error) {
      console.error('Failed to load administration data:', error);
      toast.error('Unable to load administration records');
      setWorkforce([]);
      setMembers([]);
      setLeaders([]);
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const workforceStats = useMemo(() => {
    return workforce.reduce(
      (acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [workforce]);

  const leadershipStats = useMemo(() => {
    return leaders.reduce(
      (acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [leaders]);

  const sectionForms = useMemo(() => {
    const sortByResponses = (items: AdminForm[]) =>
      items.slice().sort((left, right) => getSubmissionCount(right) - getSubmissionCount(left));

    return {
      workforce: sortByResponses(forms.filter((form) => formMatchesSection(form, 'workforce'))),
      members: sortByResponses(forms.filter((form) => formMatchesSection(form, 'members'))),
      leadership: sortByResponses(forms.filter((form) => formMatchesSection(form, 'leadership'))),
    };
  }, [forms]);
  const primaryLeadershipForm = sectionForms.leadership[0] || null;

  const activeSection = activeTab === 'overview' ? null : activeTab;
  const activeSectionForms = useMemo(
    () => (activeSection ? sectionForms[activeSection] : []),
    [activeSection, sectionForms]
  );
  const selectedFormId = activeSection ? selectedFormIds[activeSection] : ALL_FORMS;
  const selectedForm =
    selectedFormId === ALL_FORMS
      ? null
      : activeSectionForms.find((form) => form.id === selectedFormId) || null;
  const selectedSectionFormId = selectedFormId === ALL_FORMS ? ALL_FORMS : selectedForm?.id || '';

  useEffect(() => {
    setSelectedFormIds((prev) => {
      const next = { ...prev };
      (Object.keys(sectionForms) as SectionKey[]).forEach((key) => {
        const current = next[key];
        if (current === ALL_FORMS) return;
        if (current && sectionForms[key].some((form) => form.id === current)) return;
        next[key] = ALL_FORMS;
      });
      return next;
    });
  }, [sectionForms]);

  const loadSectionSubmissions = useCallback(async () => {
    if (!activeSection || !selectedSectionFormId || activeSectionForms.length === 0) {
      setFormSubmissions([]);
      setFormSubmissionsTotal(0);
      return;
    }

    setFormSubmissionsLoading(true);
    try {
      if (selectedSectionFormId === ALL_FORMS) {
        const results = await Promise.all(
          activeSectionForms.map((form) => fetchAllFormSubmissions(form.id))
        );
        const merged = results
          .flat()
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
        const start = (formSubmissionsPage - 1) * 8;
        setFormSubmissions(merged.slice(start, start + 8));
        setFormSubmissionsTotal(merged.length);
        return;
      }

      const res = await apiClient.getFormSubmissions(selectedSectionFormId, {
        page: formSubmissionsPage,
        limit: 8,
      });
      setFormSubmissions(Array.isArray(res.data) ? res.data : []);
      setFormSubmissionsTotal(typeof res.total === 'number' ? res.total : 0);
    } catch (error) {
      console.error('Failed to load form submissions:', error);
      toast.error('Unable to load form responses');
      setFormSubmissions([]);
      setFormSubmissionsTotal(0);
    } finally {
      setFormSubmissionsLoading(false);
    }
  }, [activeSection, activeSectionForms, selectedSectionFormId, formSubmissionsPage]);

  useEffect(() => {
    loadSectionSubmissions();
  }, [loadSectionSubmissions]);

  const publishLeadershipSubmission = useCallback(
    async (submission: FormSubmission) => {
      const payload = buildLeadershipPayloadFromSubmission(submission);
      if (!payload.firstName.trim() || !payload.lastName.trim()) {
        toast.error('This response needs a name before it can be published.');
        return;
      }

      setPublishingSubmissionId(submission.id);
      try {
        await apiClient.createLeadership(payload);
        toast.success('Leadership profile published');
        await loadAll();
      } catch (error) {
        console.error('Failed to publish leadership submission:', error);
        toast.error('Unable to publish leadership profile');
      } finally {
        setPublishingSubmissionId(null);
      }
    },
    [loadAll]
  );

  const createLeadershipForm = useCallback(async () => {
    if (sectionForms.leadership.length > 0) return;

    setCreatingLeadershipForm(true);
    try {
      const created = await apiClient.createAdminForm(buildLeadershipFormPayload());
      const published = await apiClient.publishAdminForm(created.id);
      const nextForm = {
        ...created,
        isPublished: true,
        status: published.status || 'published',
        publishedAt: published.publishedAt || created.publishedAt,
        slug: published.slug || created.slug,
        publicUrl: published.publicUrl || created.publicUrl,
      } as AdminForm;

      setForms((current) => [nextForm, ...current.filter((form) => form.id !== nextForm.id)]);
      setSelectedFormIds((current) => ({ ...current, leadership: nextForm.id }));
      setActiveTab('leadership');
      setFormSubmissionsPage(1);

      const publicUrl = buildPublicFormUrl(nextForm.slug, nextForm.publicUrl);
      toast.success(publicUrl ? `Leadership form created: ${publicUrl}` : 'Leadership form created');
    } catch (error) {
      console.error('Failed to create leadership form:', error);
      toast.error('Unable to create leadership form');
    } finally {
      setCreatingLeadershipForm(false);
    }
  }, [sectionForms.leadership.length]);

  const tabButton = (key: TabKey, label: string, icon: ReactNode) => (
    <button
      key={key}
      onClick={() => {
        setActiveTab(key);
        setFormSubmissionsPage(1);
      }}
      className={`
        inline-flex items-center gap-2 rounded-[var(--radius-button)] border px-3 py-2 text-sm font-semibold transition-colors
        ${activeTab === key
          ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]'
          : 'border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-primary)]'}
      `}
    >
      {icon}
      {label}
    </button>
  );

  const renderOverview = () => {
    const totalForms = forms.length;
    const mappedForms = sectionForms.workforce.length + sectionForms.members.length + sectionForms.leadership.length;
    const responseTotal = forms.reduce((sum, form) => sum + getSubmissionCount(form), 0);
    const activeMembers = members.filter((member) => member.isActive).length;
    const overviewItems = [
      { label: 'Workforce', value: workforce.length, meta: `${workforceStats.serving || 0} serving` },
      { label: 'Members', value: members.length, meta: `${activeMembers} active` },
      { label: 'Leadership', value: leaders.length, meta: `${leadershipStats.approved || 0} published` },
      { label: 'Responses', value: responseTotal, meta: `${mappedForms} mapped forms` },
    ];
    const leadershipFormUrl = primaryLeadershipForm
      ? buildPublicFormUrl(primaryLeadershipForm.slug, primaryLeadershipForm.publicUrl)
      : null;

    return (
      <div className="space-y-4">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)] lg:items-center">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary" size="sm">Administration</Badge>
                <Badge variant={primaryLeadershipForm ? 'success' : 'warning'} size="sm">
                  {primaryLeadershipForm ? 'Leadership form active' : 'Leadership form needed'}
                </Badge>
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Review form submissions, then publish approved records.
              </h2>
              <p className="max-w-2xl text-sm text-[var(--color-text-tertiary)]">
                Workforce, member, and leadership data should enter through mapped forms so every record keeps a submission trail before it appears in public-facing sections.
              </p>
            </div>

            <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {primaryLeadershipForm ? primaryLeadershipForm.title : 'Leadership Biodata'}
                  </p>
                  <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                    {leadershipFormUrl || 'Create from the Leadership tab'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewItems.map((item) => (
            <Card key={item.label}>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{item.value}</p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{item.meta}</p>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Leadership Review">
            <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between gap-3">
                <span>Approved</span>
                <Badge variant="success" size="sm">{leadershipStats.approved || 0}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Pending</span>
                <Badge variant="warning" size="sm">{leadershipStats.pending || 0}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Declined</span>
                <Badge variant="danger" size="sm">{leadershipStats.declined || 0}</Badge>
              </div>
            </div>
          </Card>

          <Card title="Workforce Status">
            <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between gap-3">
                <span>Serving</span>
                <Badge variant="success" size="sm">{workforceStats.serving || 0}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Pending</span>
                <Badge variant="warning" size="sm">{workforceStats.pending || 0}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Other</span>
                <Badge variant="default" size="sm">{Math.max(0, workforce.length - (workforceStats.serving || 0) - (workforceStats.pending || 0))}</Badge>
              </div>
            </div>
          </Card>

          <Card title="Form Routing">
            <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between gap-3">
                <span>Workforce</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{sectionForms.workforce.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Members</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{sectionForms.members.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Leadership</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{sectionForms.leadership.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-secondary)] pt-3">
                <span>Total forms</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{totalForms}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderFormResponses = (section: SectionKey, label: string) => {
    const relatedForms = sectionForms[section];
    const currentFormId = selectedFormIds[section];
    const currentForm = currentFormId === ALL_FORMS ? null : relatedForms.find((form) => form.id === currentFormId) || null;
    const totalPages = Math.max(1, Math.ceil(formSubmissionsTotal / 8));
    const isLeadershipSection = section === 'leadership';
    const columnCount = isLeadershipSection ? 6 : 4;

    return (
      <Card
        title={`${label} Form Responses`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={loadSectionSubmissions}
              loading={formSubmissionsLoading}
              disabled={relatedForms.length === 0}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<ExternalLink className="h-4 w-4" />}
              onClick={() => currentForm && router.push(`/dashboard/forms/${currentForm.id}/submissions`)}
              disabled={!currentForm}
            >
              Full View
            </Button>
          </div>
        }
      >
        {relatedForms.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 text-sm text-[var(--color-text-tertiary)]">
            No {label.toLowerCase()} forms found. Set a form&apos;s type or submission target to {section === 'members' ? 'member' : section} to show responses here.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  {label} form
                </span>
                <select
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                  value={currentFormId}
                  onChange={(event) => {
                    setSelectedFormIds((prev) => ({ ...prev, [section]: event.target.value }));
                    setFormSubmissionsPage(1);
                  }}
                >
                  <option value={ALL_FORMS}>All {label.toLowerCase()} forms</option>
                  {relatedForms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.title} ({getSubmissionCount(form)})
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 py-2 text-sm">
                <p className="text-xs text-[var(--color-text-tertiary)]">Responses</p>
                <p className="font-semibold text-[var(--color-text-primary)]">{formSubmissionsTotal}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <FileText className="h-4 w-4" />
              {currentForm ? (
                <>
                  <span className="font-medium text-[var(--color-text-secondary)]">{currentForm.title}</span>
                  {currentForm.slug && <span>/forms/{currentForm.slug}</span>}
                </>
              ) : (
                <span className="font-medium text-[var(--color-text-secondary)]">Showing responses from every mapped {label.toLowerCase()} form</span>
              )}
            </div>

            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border-secondary)]">
              <table className="min-w-full divide-y divide-[var(--color-border-secondary)] text-sm">
                <thead className="bg-[var(--color-background-tertiary)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Phone</th>
                    {isLeadershipSection && (
                      <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Role</th>
                    )}
                    <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Submitted</th>
                    {isLeadershipSection && (
                      <th className="px-4 py-3 text-right font-semibold text-[var(--color-text-secondary)]">Review</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
                  {formSubmissionsLoading ? (
                    <tr>
                      <td colSpan={columnCount} className="px-4 py-8 text-center text-[var(--color-text-tertiary)]">
                        Loading responses...
                      </td>
                    </tr>
                  ) : formSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="px-4 py-8 text-center text-[var(--color-text-tertiary)]">
                        No responses for this form yet.
                      </td>
                    </tr>
                  ) : (
                    formSubmissions.map((submission) => {
                      const leadershipPayload = isLeadershipSection
                        ? buildLeadershipPayloadFromSubmission(submission)
                        : null;
                      const alreadyPublished =
                        isLeadershipSection && leadershipSubmissionAlreadyPublished(submission, leaders);

                      return (
                        <tr key={submission.id}>
                          <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                            {resolveSubmissionName(submission)}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{resolveSubmissionEmail(submission)}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{resolveSubmissionPhone(submission)}</td>
                          {isLeadershipSection && (
                            <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                              {leadershipPayload ? roleLabel(leadershipPayload.role) : '—'}
                            </td>
                          )}
                          <td className="px-4 py-3 text-[var(--color-text-tertiary)]">{formatDateTime(submission.createdAt)}</td>
                          {isLeadershipSection && (
                            <td className="px-4 py-3 text-right">
                              {alreadyPublished ? (
                                <Badge variant="success" size="sm">Published</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={<CheckCircle2 className="h-4 w-4" />}
                                  onClick={() => publishLeadershipSubmission(submission)}
                                  loading={publishingSubmissionId === submission.id}
                                  disabled={Boolean(publishingSubmissionId)}
                                >
                                  Publish
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Page {formSubmissionsPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFormSubmissionsPage((page) => Math.max(1, page - 1))}
                  disabled={formSubmissionsPage <= 1 || formSubmissionsLoading}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFormSubmissionsPage((page) => Math.min(totalPages, page + 1))}
                  disabled={formSubmissionsPage >= totalPages || formSubmissionsLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        subtitle="Review form responses and publish approved records to the public frontend."
      />

      <Card>
        <div className="flex flex-wrap gap-3">
          {tabButton('overview', 'Overview', <FileText className="h-4 w-4" />)}
          {tabButton('workforce', 'Workforce', <Shield className="h-4 w-4" />)}
          {tabButton('members', 'Members', <Users className="h-4 w-4" />)}
          {tabButton('leadership', 'Leadership', <Sparkles className="h-4 w-4" />)}
        </div>
      </Card>

      {activeTab === 'overview' && renderOverview()}

      {activeTab === 'workforce' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Total workforce</p>
              <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{workforce.length}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Serving</p>
              <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{workforceStats.serving || 0}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Pending</p>
              <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{workforceStats.pending || 0}</p>
            </Card>
          </div>

          <div className="space-y-3">
            {workforce.length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  {loading ? 'Loading workforce...' : 'No workforce entries yet.'}
                </p>
              </Card>
            ) : (
              workforce.map((row) => (
                <AccordionRow
                  key={row.id}
                  title={`${row.firstName} ${row.lastName}`}
                  subtitle={row.email}
                  badge={<Badge variant={row.status === 'serving' ? 'success' : 'warning'} size="sm">{row.status}</Badge>}
                >
                  <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                      {row.phone || '—'}
                    </div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">Department: {row.department}</div>
                  </div>
                </AccordionRow>
              ))
            )}
          </div>

          {renderFormResponses('workforce', 'Workforce')}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-4">
          {members.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {loading ? 'Loading members...' : 'No members available yet.'}
              </p>
            </Card>
          ) : (
            members.map((row) => (
              <AccordionRow
                key={row.id}
                title={`${row.firstName} ${row.lastName}`}
                subtitle={row.email}
                badge={<Badge variant={row.isActive ? 'success' : 'warning'} size="sm">{row.isActive ? 'Active' : 'Inactive'}</Badge>}
              >
                <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    {row.phone || '—'}
                  </div>
                </div>
              </AccordionRow>
            ))
          )}
          {renderFormResponses('members', 'Member')}
        </div>
      )}

      {activeTab === 'leadership' && (
        <div className="space-y-4">
          <Card
            title="Leadership Form"
            actions={
              primaryLeadershipForm ? undefined : (
                <Button
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={createLeadershipForm}
                  loading={creatingLeadershipForm}
                >
                  Create leadership form
                </Button>
              )
            }
          >
            {primaryLeadershipForm ? (
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success" size="sm">Active</Badge>
                    <p className="font-semibold text-[var(--color-text-primary)]">{primaryLeadershipForm.title}</p>
                  </div>
                  <p className="mt-1 truncate text-sm text-[var(--color-text-tertiary)]">
                    {buildPublicFormUrl(primaryLeadershipForm.slug, primaryLeadershipForm.publicUrl) || 'Published leadership form'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  icon={<ExternalLink className="h-4 w-4" />}
                  onClick={() => router.push(`/dashboard/forms/${primaryLeadershipForm.id}/edit`)}
                >
                  Manage form
                </Button>
              </div>
            ) : (
              <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 text-sm text-[var(--color-text-tertiary)]">
                Create the Leadership Biodata form from here. Once it exists, this button is hidden until that leadership form is deleted.
              </div>
            )}
          </Card>

          {leaders.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {loading ? 'Loading leadership...' : 'No leadership records yet.'}
              </p>
            </Card>
          ) : (
            leaders.map((row) => (
              <AccordionRow
                key={row.id}
                title={`${row.firstName} ${row.lastName}`}
                subtitle={row.email}
                badge={<Badge variant={row.status === 'approved' ? 'success' : row.status === 'declined' ? 'danger' : 'warning'} size="sm">{row.status}</Badge>}
              >
                <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                  <div className="text-xs text-[var(--color-text-tertiary)]">Role: {roleLabel(row.role)}</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    Birthday: {formatMonthDay(row.birthdayMonth, row.birthdayDay)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    Anniversary: {formatMonthDay(row.anniversaryMonth, row.anniversaryDay)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    {row.email || 'No email'}
                  </div>
                  {row.bio && <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{row.bio}</p>}
                </div>
              </AccordionRow>
            ))
          )}
          {renderFormResponses('leadership', 'Leadership')}
        </div>
      )}
    </div>
  );
}
