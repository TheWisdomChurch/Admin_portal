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
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/input';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { fetchAllFormSubmissions } from '@/lib/formSubmissions';
import { buildPublicFormUrl } from '@/lib/utils';

import type {
  CreateLeadershipRequest,
  CreateFormRequest,
  UpdateLeadershipRequest,
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
const LEADERSHIP_FORM_SLUG = 'leadership-biodata';

const roleOptions: Array<{ value: LeadershipRole; label: string }> = [
  { value: 'senior_pastor', label: 'Senior Pastor' },
  { value: 'associate_pastor', label: 'Associate Pastor' },
  { value: 'reverend', label: 'Reverend' },
  { value: 'deacon', label: 'Deacon' },
  { value: 'deaconess', label: 'Deaconess' },
];

const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;
const dashedDate = /^(\d{2})-(\d{2})-(\d{4})$/;
const slashDate = /^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/;

function buildLeadershipFormPayload(): CreateFormRequest {
  return {
    title: 'Leadership Biodata',
    description: 'Collect leadership profile details for review and publication.',
    slug: LEADERSHIP_FORM_SLUG,
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
          { label: 'Senior Pastor', value: 'senior_pastor' },
          { label: 'Associate Pastor', value: 'associate_pastor' },
          { label: 'Reverend', value: 'reverend' },
          { label: 'Deacon', value: 'deacon' },
          { label: 'Deaconess', value: 'deaconess' },
        ],
      },
      { key: 'bio', label: 'Short Bio', type: 'textarea', required: false, order: 5, validation: { maxWords: 400 } },
      { key: 'birthday', label: 'Birthday (DD/MM)', type: 'text', required: false, order: 6 },
      { key: 'wedding_anniversary', label: 'Wedding Anniversary (DD/MM)', type: 'text', required: false, order: 7 },
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
      dateFormat: 'dd/mm',
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

function formatMonthDay(month?: number, day?: number) {
  if (!month || !day) return '—';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

function roleLabel(role: LeadershipRole) {
  return roleOptions.find((item) => item.value === role)?.label || role;
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
  const slug = form.slug || '';
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
    return target === 'member' || formType === 'membership' || surface.includes('member') || surface.includes('membership');
  }

  return slug === LEADERSHIP_FORM_SLUG || target === 'leadership' || formType === 'leadership' || surface.includes('leadership');
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
  const phone =
    submission.contactNumber ||
    values.phone ||
    values.contactPhone ||
    values.phone_number ||
    values.contact_number ||
    values.contactNumber;

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

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  }

  const parts = trimmed
    .replace(/,/g, '')
    .replace(/\s+/g, '/')
    .replace(/-/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    let day = parts[0];
    let month = parts[1];

    // Handles YYYY/MM/DD
    if (parts[0].length === 4 && parts[2]) {
      day = parts[2];
      month = parts[1];
    }

    // Handles MM/DD/YYYY from browser/locale values where month comes first.
    const dayNum = Number(day);
    const monthNum = Number(month);
    if (dayNum <= 12 && monthNum > 12) {
      day = parts[1];
      month = parts[0];
    }

    day = String(Number(day)).padStart(2, '0');
    month = String(Number(month)).padStart(2, '0');

    if (/^\d{2}$/.test(day) && /^\d{2}$/.test(month)) {
      return `${day}/${month}`;
    }
  }

  return undefined;
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
    status: 'awaiting_super_admin_approval' as LeadershipMember['status'],
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const response = record.response as Record<string, unknown> | undefined;
    const data = response?.data as Record<string, unknown> | undefined;

    if (typeof data?.message === 'string') return data.message;
    if (typeof data?.error === 'string') return data.error;
    if (typeof record.message === 'string') return record.message;
  }

  return 'Request failed';
}

function StatCard({ label, value, meta, icon }: { label: string; value: number | string; meta: string; icon: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{value}</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{meta}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[var(--color-accent-primary)]">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function AccordionRow({ title, subtitle, badge, children }: { title: string; subtitle?: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 shadow-sm transition hover:border-[var(--color-border-primary)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--color-text-primary)]">{title}</p>
          {subtitle && <p className="truncate text-xs text-[var(--color-text-tertiary)]">{subtitle}</p>}
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
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null);
  const [creatingLeadershipForm, setCreatingLeadershipForm] = useState(false);

  const [editingLeaderId, setEditingLeaderId] = useState<string | null>(null);
  const [deletingLeaderId, setDeletingLeaderId] = useState<string | null>(null);
  const [leaderDraft, setLeaderDraft] = useState<Partial<UpdateLeadershipRequest>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);

    try {
      const [workforceRes, membersRes, leadershipRes, formsRes] = await Promise.allSettled([
        apiClient.listWorkforce({ page: 1, limit: 200 }),
        apiClient.listMembers({ page: 1, limit: 200 }),
        apiClient.listLeadership({ page: 1, limit: 200 }),
        apiClient.getAdminForms({ page: 1, limit: 300 }),
      ]);

      setWorkforce(workforceRes.status === 'fulfilled' ? toArray<WorkforceMember>(workforceRes.value) : []);
      setMembers(membersRes.status === 'fulfilled' ? toArray<Member>(membersRes.value) : []);
      setLeaders(leadershipRes.status === 'fulfilled' ? toArray<LeadershipMember>(leadershipRes.value) : []);
      setForms(formsRes.status === 'fulfilled' && Array.isArray(formsRes.value.data) ? formsRes.value.data : []);

      if ([workforceRes, membersRes, leadershipRes, formsRes].some((result) => result.status === 'rejected')) {
        toast.error('Some administration records could not be loaded');
      }
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

  const workforceStats = useMemo(
    () =>
      workforce.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    [workforce]
  );

  const leadershipStats = useMemo(
    () =>
      leaders.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    [leaders]
  );

  const sectionForms = useMemo(() => {
    const sortByResponses = (items: AdminForm[]) =>
      items.slice().sort((left, right) => getSubmissionCount(right) - getSubmissionCount(left));

    return {
      workforce: sortByResponses(forms.filter((form) => formMatchesSection(form, 'workforce'))),
      members: sortByResponses(forms.filter((form) => formMatchesSection(form, 'members'))),
      leadership: sortByResponses(forms.filter((form) => formMatchesSection(form, 'leadership'))),
    };
  }, [forms]);

  const primaryLeadershipForm =
    forms.find((form) => form.slug === LEADERSHIP_FORM_SLUG) || sectionForms.leadership[0] || null;

  const activeSection = activeTab === 'overview' ? null : activeTab;
  const activeSectionForms = useMemo(() => (activeSection ? sectionForms[activeSection] : []), [activeSection, sectionForms]);
  const selectedFormId = activeSection ? selectedFormIds[activeSection] : ALL_FORMS;
  const selectedForm = selectedFormId === ALL_FORMS ? null : activeSectionForms.find((form) => form.id === selectedFormId) || null;
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
    if (!activeSection || activeSectionForms.length === 0) {
      setFormSubmissions([]);
      setFormSubmissionsTotal(0);
      return;
    }

    setFormSubmissionsLoading(true);

    try {
      if (selectedSectionFormId === ALL_FORMS) {
        const results = await Promise.all(activeSectionForms.map((form) => fetchAllFormSubmissions(form.id)));
        const merged = results.flat().sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
        const start = (formSubmissionsPage - 1) * 8;

        setFormSubmissions(merged.slice(start, start + 8));
        setFormSubmissionsTotal(merged.length);
        return;
      }

      const res = await apiClient.getFormSubmissions(selectedSectionFormId, { page: formSubmissionsPage, limit: 8 });
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

      if (!payload.firstName?.trim() || !payload.lastName?.trim()) {
        toast.error('This response needs a name before it can be published.');
        return;
      }

      setPublishingSubmissionId(submission.id);

      try {
        await apiClient.createLeadership(payload);
        toast.success('Sent to Super Admin for final approval');
        await loadAll();
        await loadSectionSubmissions();
      } catch (error) {
        console.error('Failed to send leadership submission for review:', error);
        toast.error(getErrorMessage(error) || 'Unable to send leadership profile for review');
      } finally {
        setPublishingSubmissionId(null);
      }
    },
    [loadAll, loadSectionSubmissions]
  );

  const deleteFormSubmission = useCallback(
    async (submissionId: string) => {
      const ok = window.confirm('Delete this form response? This cannot be undone.');
      if (!ok) return;

      setDeletingSubmissionId(submissionId);

      try {
        await apiClient.deleteFormSubmission(submissionId);
        toast.success('Form response deleted');
        await loadSectionSubmissions();
      } catch (error) {
        console.error('Failed to delete form response:', error);
        toast.error(getErrorMessage(error) || 'Unable to delete form response');
      } finally {
        setDeletingSubmissionId(null);
      }
    },
    [loadSectionSubmissions]
  );

  const createLeadershipForm = useCallback(async () => {
    setCreatingLeadershipForm(true);

    try {
      const freshFormsRes = await apiClient.getAdminForms({ page: 1, limit: 300 });
      const freshForms = Array.isArray(freshFormsRes.data) ? freshFormsRes.data : [];

      const existingLeadershipForm =
        freshForms.find((form) => form.slug === LEADERSHIP_FORM_SLUG) ||
        freshForms.find((form) => formMatchesSection(form, 'leadership'));

      if (existingLeadershipForm) {
        let nextForm = existingLeadershipForm;

        if (!nextForm.isPublished && nextForm.status !== 'published') {
          try {
            const published = await apiClient.publishAdminForm(nextForm.id);
            nextForm = {
              ...nextForm,
              isPublished: true,
              status: published.status || 'published',
              publishedAt: published.publishedAt || nextForm.publishedAt,
              slug: published.slug || nextForm.slug,
              publicUrl: published.publicUrl || nextForm.publicUrl,
            };
          } catch (publishError) {
            console.warn('Leadership form exists but could not be published automatically:', publishError);
          }
        }

        setForms((current) => [nextForm, ...current.filter((form) => form.id !== nextForm.id)]);
        setSelectedFormIds((current) => ({ ...current, leadership: nextForm.id }));
        setActiveTab('leadership');
        setFormSubmissionsPage(1);
        toast.success('Existing leadership form loaded');
        return;
      }

      const created = await apiClient.createAdminForm(buildLeadershipFormPayload());
      let nextForm = created;

      try {
        const published = await apiClient.publishAdminForm(created.id);
        nextForm = {
          ...created,
          isPublished: true,
          status: published.status || 'published',
          publishedAt: published.publishedAt || created.publishedAt,
          slug: published.slug || created.slug,
          publicUrl: published.publicUrl || created.publicUrl,
        };
      } catch (publishError) {
        console.warn('Leadership form created but publish failed:', publishError);
      }

      setForms((current) => [nextForm, ...current.filter((form) => form.id !== nextForm.id)]);
      setSelectedFormIds((current) => ({ ...current, leadership: nextForm.id }));
      setActiveTab('leadership');
      setFormSubmissionsPage(1);

      const publicUrl = buildPublicFormUrl(nextForm.slug, nextForm.publicUrl);
      toast.success(publicUrl ? `Leadership form ready: ${publicUrl}` : 'Leadership form ready');
    } catch (error) {
      console.error('Failed to create/load leadership form:', error);
      toast.error(getErrorMessage(error) || 'Unable to prepare leadership form');
      await loadAll();
    } finally {
      setCreatingLeadershipForm(false);
    }
  }, [loadAll]);

 const beginEditLeader = (leader: LeadershipMember) => {
  const birthday = formatMonthDay(leader.birthdayMonth, leader.birthdayDay);
  const anniversary = formatMonthDay(leader.anniversaryMonth, leader.anniversaryDay);

  setEditingLeaderId(leader.id);
  setLeaderDraft({
    firstName: leader.firstName ?? '',
    lastName: leader.lastName ?? '',
    email: leader.email ?? undefined,
    phone: leader.phone ?? undefined,
    role: leader.role,
    status: leader.status,
    bio: leader.bio ?? undefined,
    birthday: birthday === '—' ? undefined : birthday,
    anniversary: anniversary === '—' ? undefined : anniversary,
    imageUrl: leader.imageUrl ?? undefined,
  });
};

  const cancelEditLeader = () => {
    setEditingLeaderId(null);
    setLeaderDraft({});
  };

  const saveLeaderEdit = async (leaderId: string) => {
    try {
      await apiClient.updateLeadership(leaderId, leaderDraft as UpdateLeadershipRequest);
      toast.success('Leadership profile updated');
      cancelEditLeader();
      await loadAll();
    } catch (error) {
      console.error('Failed to update leadership profile:', error);
      toast.error(getErrorMessage(error) || 'Unable to update leadership profile');
    }
  };

  const deleteLeader = async (leaderId: string) => {
    const ok = window.confirm('Delete this leadership profile? This cannot be undone.');
    if (!ok) return;

    setDeletingLeaderId(leaderId);

    try {
      await apiClient.deleteLeadership(leaderId);
      toast.success('Leadership profile deleted');
      await loadAll();
    } catch (error) {
      console.error('Failed to delete leadership profile:', error);
      toast.error(getErrorMessage(error) || 'Unable to delete leadership profile');
    } finally {
      setDeletingLeaderId(null);
    }
  };

  const tabButton = (key: TabKey, label: string, icon: ReactNode) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        setActiveTab(key);
        setFormSubmissionsPage(1);
      }}
      className={`inline-flex items-center gap-2 rounded-[var(--radius-button)] border px-4 py-2.5 text-sm font-semibold transition ${
        activeTab === key
          ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-white shadow-sm'
          : 'border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-primary)] hover:bg-[var(--color-background-tertiary)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const renderOverview = () => {
    const totalForms = forms.length;
    const mappedForms = sectionForms.workforce.length + sectionForms.members.length + sectionForms.leadership.length;
    const responseTotal =
      sectionForms.workforce.reduce((sum, form) => sum + getSubmissionCount(form), 0) +
      sectionForms.members.reduce((sum, form) => sum + getSubmissionCount(form), 0) +
      sectionForms.leadership.reduce((sum, form) => sum + getSubmissionCount(form), 0);

    const activeMembers = members.filter((member) => member.isActive).length;
    const leadershipFormUrl = primaryLeadershipForm ? buildPublicFormUrl(primaryLeadershipForm.slug, primaryLeadershipForm.publicUrl) : null;

    return (
      <div className="space-y-5">
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] shadow-sm">
          <div className="relative p-6 lg:p-7">
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)] lg:items-center">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="primary" size="sm">Administration</Badge>
                  <Badge variant={primaryLeadershipForm ? 'success' : 'warning'} size="sm">
                    {primaryLeadershipForm ? 'Leadership form active' : 'Leadership form needed'}
                  </Badge>
                </div>

                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
                    Manage church records from one professional review desk.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-tertiary)]">
                    Review workforce, membership, and leadership submissions before publishing approved records to the public frontend.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" icon={<RefreshCw className="h-4 w-4" />} onClick={loadAll} loading={loading}>
                    Refresh records
                  </Button>

                  <Button
                    size="sm"
                    variant={primaryLeadershipForm ? 'outline' : 'secondary'}
                    icon={primaryLeadershipForm ? <ExternalLink className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    onClick={() => {
                      if (primaryLeadershipForm && leadershipFormUrl) {
                        window.open(leadershipFormUrl, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      createLeadershipForm();
                    }}
                    loading={creatingLeadershipForm}
                  >
                    {primaryLeadershipForm ? 'Open leadership form' : 'Prepare leadership form'}
                  </Button>
                </div>
              </div>

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]">
                    <ClipboardList className="h-6 w-6" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {primaryLeadershipForm ? primaryLeadershipForm.title : 'Leadership Biodata'}
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                      {leadershipFormUrl || 'No connected leadership form yet'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-[var(--radius-button)] bg-[var(--color-background-secondary)] p-3">
                    <p className="text-xs text-[var(--color-text-tertiary)]">Mapped forms</p>
                    <p className="font-bold text-[var(--color-text-primary)]">{mappedForms}</p>
                  </div>

                  <div className="rounded-[var(--radius-button)] bg-[var(--color-background-secondary)] p-3">
                    <p className="text-xs text-[var(--color-text-tertiary)]">Responses</p>
                    <p className="font-bold text-[var(--color-text-primary)]">{responseTotal}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Workforce" value={workforce.length} meta={`${workforceStats.serving || 0} serving`} icon={<Shield className="h-5 w-5" />} />
          <StatCard label="Members" value={members.length} meta={`${activeMembers} active`} icon={<Users className="h-5 w-5" />} />
          <StatCard label="Leadership" value={leaders.length} meta={`${leadershipStats.approved || 0} published`} icon={<Sparkles className="h-5 w-5" />} />
          <StatCard label="Responses" value={responseTotal} meta={`${totalForms} total forms`} icon={<FileText className="h-5 w-5" />} />
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
            <Button size="sm" variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={loadSectionSubmissions} loading={formSubmissionsLoading} disabled={relatedForms.length === 0}>
              Refresh
            </Button>

            <Button
              size="sm"
              variant="ghost"
              icon={<ExternalLink className="h-4 w-4" />}
              onClick={() => {
                const target = currentForm || relatedForms[0];
                if (target) router.push(`/dashboard/forms/${target.id}/submissions`);
              }}
              disabled={relatedForms.length === 0}
            >
              Full View
            </Button>
          </div>
        }
      >
        {relatedForms.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 text-sm text-[var(--color-text-tertiary)]">
            No {label.toLowerCase()} forms found. Create or connect the {label.toLowerCase()} form first.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                  {label} form
                </span>

                <select
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-primary)]"
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

            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border-secondary)]">
              <table className="min-w-full divide-y divide-[var(--color-border-secondary)] text-sm">
                <thead className="bg-[var(--color-background-tertiary)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Phone</th>
                    {isLeadershipSection && <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Role</th>}
                    <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Submitted</th>
                    {isLeadershipSection && <th className="px-4 py-3 text-right font-semibold text-[var(--color-text-secondary)]">Review</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
                  {formSubmissionsLoading ? (
                    <tr>
                      <td colSpan={columnCount} className="px-4 py-8 text-center text-[var(--color-text-tertiary)]">Loading responses...</td>
                    </tr>
                  ) : formSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="px-4 py-8 text-center text-[var(--color-text-tertiary)]">No responses for this form yet.</td>
                    </tr>
                  ) : (
                    formSubmissions.map((submission) => {
                      const leadershipPayload = isLeadershipSection ? buildLeadershipPayloadFromSubmission(submission) : null;
                      const alreadyPublished = isLeadershipSection && leadershipSubmissionAlreadyPublished(submission, leaders);

                      return (
                        <tr key={submission.id} className="transition hover:bg-[var(--color-background-secondary)]">
                          <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{resolveSubmissionName(submission)}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{resolveSubmissionEmail(submission)}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{resolveSubmissionPhone(submission)}</td>
                          {isLeadershipSection && <td className="px-4 py-3 text-[var(--color-text-secondary)]">{leadershipPayload ? roleLabel(leadershipPayload.role) : '—'}</td>}
                          <td className="px-4 py-3 text-[var(--color-text-tertiary)]">{formatDateTime(submission.createdAt)}</td>

                          {isLeadershipSection && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                {alreadyPublished ? (
                                  <Badge variant="success" size="sm">Sent</Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    icon={<CheckCircle2 className="h-4 w-4" />}
                                    onClick={() => publishLeadershipSubmission(submission)}
                                    loading={publishingSubmissionId === submission.id}
                                    disabled={Boolean(publishingSubmissionId || deletingSubmissionId)}
                                  >
                                    Send to Super Admin
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="outline"
                                  icon={<Trash2 className="h-4 w-4" />}
                                  onClick={() => deleteFormSubmission(submission.id)}
                                  loading={deletingSubmissionId === submission.id}
                                  disabled={Boolean(publishingSubmissionId || deletingSubmissionId)}
                                >
                                  Delete
                                </Button>
                              </div>
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
              <p className="text-xs text-[var(--color-text-tertiary)]">Page {formSubmissionsPage} of {totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setFormSubmissionsPage((page) => Math.max(1, page - 1))} disabled={formSubmissionsPage <= 1 || formSubmissionsLoading}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFormSubmissionsPage((page) => Math.min(totalPages, page + 1))} disabled={formSubmissionsPage >= totalPages || formSubmissionsLoading}>
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
      <PageHeader title="Administration" subtitle="Review form responses and publish approved records to the public frontend." />

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
            <StatCard label="Total workforce" value={workforce.length} meta="All workforce records" icon={<Shield className="h-5 w-5" />} />
            <StatCard label="Serving" value={workforceStats.serving || 0} meta="Currently active" icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="Pending" value={workforceStats.pending || 0} meta="Awaiting review" icon={<ClipboardList className="h-5 w-5" />} />
          </div>

          <div className="space-y-3">
            {workforce.length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--color-text-tertiary)]">{loading ? 'Loading workforce...' : 'No workforce entries yet.'}</p>
              </Card>
            ) : (
              workforce.map((row) => (
                <AccordionRow key={row.id} title={`${row.firstName} ${row.lastName}`} subtitle={row.email} badge={<Badge variant={row.status === 'serving' ? 'success' : 'warning'} size="sm">{row.status}</Badge>}>
                  <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />{row.phone || '—'}</div>
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
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Total members" value={members.length} meta="All member records" icon={<Users className="h-5 w-5" />} />
            <StatCard label="Active" value={members.filter((member) => member.isActive).length} meta="Currently active" icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="Inactive" value={members.filter((member) => !member.isActive).length} meta="Needs attention" icon={<ClipboardList className="h-5 w-5" />} />
          </div>

          {members.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--color-text-tertiary)]">{loading ? 'Loading members...' : 'No members available yet.'}</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {members.map((row) => (
                <AccordionRow key={row.id} title={`${row.firstName} ${row.lastName}`} subtitle={row.email} badge={<Badge variant={row.isActive ? 'success' : 'warning'} size="sm">{row.isActive ? 'Active' : 'Inactive'}</Badge>}>
                  <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />{row.phone || '—'}</div>
                  </div>
                </AccordionRow>
              ))}
            </div>
          )}

          {renderFormResponses('members', 'Member')}
        </div>
      )}

      {activeTab === 'leadership' && (
        <div className="space-y-4">
          <Card
            title="Leadership Form"
            actions={
              <Button variant={primaryLeadershipForm ? 'outline' : 'primary'} icon={primaryLeadershipForm ? <RefreshCw className="h-4 w-4" /> : <Plus className="h-4 w-4" />} onClick={createLeadershipForm} loading={creatingLeadershipForm}>
                {primaryLeadershipForm ? 'Reload leadership form' : 'Create leadership form'}
              </Button>
            }
          >
            {primaryLeadershipForm ? (
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-gradient-to-br from-[var(--color-background-primary)] to-[var(--color-background-secondary)] p-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="success" size="sm">Active</Badge>
                      <Badge variant="primary" size="sm">Leadership</Badge>
                      <Badge variant="default" size="sm">{getSubmissionCount(primaryLeadershipForm)} responses</Badge>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{primaryLeadershipForm.title}</h3>
                      <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-tertiary)]">
                        This form collects leadership biodata, profile details, photos, birthdays, anniversaries, and ministry role information for review before publication.
                      </p>
                    </div>

                    <p className="truncate rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
                      {buildPublicFormUrl(primaryLeadershipForm.slug, primaryLeadershipForm.publicUrl) || 'Published leadership form'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button variant="outline" icon={<ExternalLink className="h-4 w-4" />} onClick={() => {
                      const url = buildPublicFormUrl(primaryLeadershipForm.slug, primaryLeadershipForm.publicUrl);
                      if (url) window.open(url, '_blank', 'noopener,noreferrer');
                    }}>
                      Open public form
                    </Button>
                    <Button variant="secondary" icon={<ClipboardList className="h-4 w-4" />} onClick={() => router.push(`/dashboard/forms/${primaryLeadershipForm.id}/submissions`)}>
                      View responses
                    </Button>
                    <Button variant="primary" icon={<Sparkles className="h-4 w-4" />} onClick={() => router.push(`/dashboard/forms/${primaryLeadershipForm.id}/edit`)}>
                      Manage form
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6">
                <div className="max-w-2xl space-y-3">
                  <Badge variant="warning" size="sm">Setup required</Badge>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Leadership biodata form is not connected yet</h3>
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    Create or reload the leadership form so submitted biodata can appear here for review and publication.
                  </p>
                  <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={createLeadershipForm} loading={creatingLeadershipForm}>
                    Create leadership form
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Total leaders"
              value={leaders.filter((leader) => leader.status !== 'declined').length}
              meta="Active leadership records"
              icon={<Sparkles className="h-5 w-5" />}
            />
            <StatCard
              label="Pending"
              value={formSubmissions.filter((submission) => !leadershipSubmissionAlreadyPublished(submission, leaders)).length + (leadershipStats.pending || 0)}
              meta="Admin needs to review"
              icon={<ClipboardList className="h-5 w-5" />}
            />
            <StatCard
              label="Awaiting Super Admin"
              value={leaders.filter((leader) => leader.status === 'awaiting_super_admin_approval').length}
              meta="Submitted for final approval"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
          </div>

          {leaders.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {loading ? 'Loading leadership...' : 'No leadership records yet. Form responses below are pending admin review. Send reviewed responses to Super Admin for final approval.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {leaders.filter((leader) => leader.status !== 'declined').map((row) => {
                const isEditing = editingLeaderId === row.id;

                return (
                  <AccordionRow
                    key={row.id}
                    title={`${row.firstName} ${row.lastName}`}
                    subtitle={row.email}
                    badge={<Badge variant={row.status === 'approved' ? 'success' : row.status === 'declined' ? 'danger' : 'warning'} size="sm">{row.status}</Badge>}
                  >
                    {isEditing ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input label="First name" value={String(leaderDraft.firstName || '')} onChange={(e) => setLeaderDraft((prev) => ({ ...prev, firstName: e.target.value }))} />
                        <Input label="Last name" value={String(leaderDraft.lastName || '')} onChange={(e) => setLeaderDraft((prev) => ({ ...prev, lastName: e.target.value }))} />
                        <Input label="Email" value={String(leaderDraft.email || '')} onChange={(e) => setLeaderDraft((prev) => ({ ...prev, email: e.target.value }))} />
                        <Input label="Phone" value={String(leaderDraft.phone || '')} onChange={(e) => setLeaderDraft((prev) => ({ ...prev, phone: e.target.value }))} />

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Role</label>
                          <select
                            className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                            value={String(leaderDraft.role || row.role)}
                            onChange={(e) => setLeaderDraft((prev) => ({ ...prev, role: e.target.value as LeadershipRole }))}
                          >
                            {roleOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>

                        <Input label="Birthday (DD/MM)" value={String(leaderDraft.birthday || '')} onChange={(e) => setLeaderDraft((prev) => ({ ...prev, birthday: e.target.value }))} />
                        <Input label="Anniversary (DD/MM)" value={String(leaderDraft.anniversary || '')} onChange={(e) => setLeaderDraft((prev) => ({ ...prev, anniversary: e.target.value }))} />

                        <div className="space-y-2 md:col-span-2">
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Bio</label>
                          <textarea
                            className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                            rows={3}
                            value={String(leaderDraft.bio || '')}
                            onChange={(e) => setLeaderDraft((prev) => ({ ...prev, bio: e.target.value }))}
                          />
                        </div>

                        <div className="flex flex-wrap gap-2 md:col-span-2">
                          <Button size="sm" variant="primary" onClick={() => saveLeaderEdit(row.id)} icon={<CheckCircle2 className="h-4 w-4" />}>
                            Save changes
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditLeader} icon={<X className="h-4 w-4" />}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                        <div className="text-xs text-[var(--color-text-tertiary)]">Role: {roleLabel(row.role)}</div>
                        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-[var(--color-text-tertiary)]" />Birthday: {formatMonthDay(row.birthdayMonth, row.birthdayDay)}</div>
                        <div className="flex items-center gap-2"><Heart className="h-4 w-4 text-[var(--color-text-tertiary)]" />Anniversary: {formatMonthDay(row.anniversaryMonth, row.anniversaryDay)}</div>
                        <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />{row.email || 'No email'}</div>
                        {row.bio && <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">{row.bio}</p>}

                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button size="sm" variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => beginEditLeader(row)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" icon={<Trash2 className="h-4 w-4" />} onClick={() => deleteLeader(row.id)} loading={deletingLeaderId === row.id}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </AccordionRow>
                );
              })}
            </div>
          )}

          {renderFormResponses('leadership', 'Leadership')}
        </div>
      )}
    </div>
  );
}