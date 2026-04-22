'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  Eye,
  Heart,
  LayoutGrid,
  Mail,
  Phone,
  Shield,
  Sparkles,
  UploadCloud,
  UserPlus,
  Users,
  Link2,
  Copy,
  Pencil,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { Badge } from '@/ui/Badge';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import type {
  AdminForm,
  CreateLeadershipRequest,
  CreateMemberRequest,
  LeadershipMember,
  LeadershipRole,
  Member,
  WorkforceMember,
  WorkforceStatsResponse,
} from '@/lib/types';

type TabKey = 'workforce' | 'members' | 'leadership' | 'forms';

const roleOptions: Array<{ value: LeadershipRole; label: string }> = [
  { value: 'senior_pastor', label: 'Senior Pastor' },
  { value: 'associate_pastor', label: 'Associate Pastor' },
  { value: 'reverend', label: 'Reverend' },
  { value: 'deacon', label: 'Deacon' },
  { value: 'deaconess', label: 'Deaconness' },
];

const ddmmyyyy = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;

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

function normalizeTargetKey(form: AdminForm): string {
  const explicitTarget = form.settings?.submissionTarget?.trim().toLowerCase();
  if (explicitTarget) return explicitTarget;

  const formType = String(form.settings?.formType || '').trim().toLowerCase();
  if (formType) return formType;

  return 'general';
}

function toTargetLabel(key: string): string {
  const labelMap: Record<string, string> = {
    workforce: 'Workforce',
    workforce_new: 'Workforce (New)',
    workforce_serving: 'Workforce (Serving)',
    member: 'Members',
    members: 'Members',
    membership: 'Membership',
    leadership: 'Leadership',
    testimonial: 'Testimonials',
    event: 'Events',
    registration: 'Registration',
    contact: 'Contact',
    application: 'Applications',
    general: 'General',
  };
  return labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function isTargetMatch(form: AdminForm, allowed: string[]): boolean {
  const normalized = normalizeTargetKey(form);
  if (allowed.includes(normalized)) return true;
  const slug = (form.slug || '').trim().toLowerCase();
  const title = (form.title || '').trim().toLowerCase();
  if (allowed.includes('leadership') && (slug.includes('leadership') || title.includes('leadership'))) return true;
  if (
    (allowed.includes('member') || allowed.includes('members') || allowed.includes('membership')) &&
    (slug.includes('member') || slug.includes('membership') || title.includes('member') || title.includes('membership'))
  ) {
    return true;
  }
  return allowed.includes(normalized);
}

function buildNewFormRouteForTarget(targetKey: string): string {
  if (targetKey === 'member' || targetKey === 'members' || targetKey === 'membership') {
    return '/dashboard/forms/new?preset=member';
  }
  if (targetKey === 'leadership') {
    return '/dashboard/forms/new?preset=leadership';
  }
  if (targetKey === 'workforce' || targetKey === 'workforce_new' || targetKey === 'workforce_serving') {
    return '/dashboard/forms/new?preset=workforce';
  }
  return '/dashboard/forms/new';
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
  const [activeTab, setActiveTab] = useState<TabKey>('workforce');

  const [workforce, setWorkforce] = useState<WorkforceMember[]>([]);
  const [workforceStatsApi, setWorkforceStatsApi] = useState<WorkforceStatsResponse | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [leaders, setLeaders] = useState<LeadershipMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [formsLoading, setFormsLoading] = useState(false);
  const [adminForms, setAdminForms] = useState<AdminForm[]>([]);
  const [memberForms, setMemberForms] = useState<AdminForm[]>([]);
  const [leadershipForms, setLeadershipForms] = useState<AdminForm[]>([]);

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [leaderModalOpen, setLeaderModalOpen] = useState(false);
  const [memberReviewTarget, setMemberReviewTarget] = useState<Member | null>(null);
  const [leadershipReviewTarget, setLeadershipReviewTarget] = useState<LeadershipMember | null>(null);
  const [memberActivatingId, setMemberActivatingId] = useState<string | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [savingLeader, setSavingLeader] = useState(false);

  const [memberForm, setMemberForm] = useState<CreateMemberRequest>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    isActive: true,
  });

  const [leaderForm, setLeaderForm] = useState<CreateLeadershipRequest>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'associate_pastor',
    status: 'approved',
    bio: '',
    birthday: '',
    anniversary: '',
    imageUrl: '',
  });
  const [leaderImageFile, setLeaderImageFile] = useState<File | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setFormsLoading(true);
    try {
      const [workforceRes, workforceStatsRes, membersRes, leadershipRes, formsRes] = await Promise.all([
        apiClient.listWorkforce({ page: 1, limit: 200 }),
        apiClient.getWorkforceStats(),
        apiClient.listMembers({ page: 1, limit: 200 }),
        apiClient.listLeadership({ page: 1, limit: 200 }),
        apiClient.getAdminForms({ page: 1, limit: 300 }),
      ]);

      setWorkforce(toArray<WorkforceMember>(workforceRes));
      setWorkforceStatsApi(workforceStatsRes);
      setMembers(toArray<Member>(membersRes));
      setLeaders(toArray<LeadershipMember>(leadershipRes));
      const forms = Array.isArray(formsRes.data) ? formsRes.data : [];
      setAdminForms(forms);
      setMemberForms(forms.filter((form) => isTargetMatch(form, ['member', 'members', 'membership'])));
      setLeadershipForms(forms.filter((form) => isTargetMatch(form, ['leadership'])));
    } catch (error) {
      console.error('Failed to load administration data:', error);
      toast.error('Unable to load administration records');
      setWorkforce([]);
      setWorkforceStatsApi(null);
      setMembers([]);
      setLeaders([]);
      setAdminForms([]);
      setMemberForms([]);
      setLeadershipForms([]);
    } finally {
      setLoading(false);
      setFormsLoading(false);
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

  const workforceSections = useMemo(() => {
    const fromApi = workforceStatsApi?.frontendByDepartment || {};
    const hasApiData = Object.keys(fromApi).length > 0;
    const source = hasApiData
      ? fromApi
      : workforce.reduce<Record<string, number>>((acc, row) => {
          const key = row.department?.trim() || 'Unspecified';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

    return Object.entries(source)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [workforce, workforceStatsApi]);

  const formGroups = useMemo(() => {
    const grouped = adminForms.reduce<Record<string, AdminForm[]>>((acc, form) => {
      const key = normalizeTargetKey(form);
      if (!acc[key]) acc[key] = [];
      acc[key].push(form);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([key, forms]) => ({
        key,
        label: toTargetLabel(key),
        forms: forms.sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        }),
      }))
      .sort((a, b) => b.forms.length - a.forms.length || a.label.localeCompare(b.label));
  }, [adminForms]);

  const formsMetrics = useMemo(() => {
    const total = adminForms.length;
    const published = adminForms.filter((f) => f.isPublished || f.status === 'published').length;
    const drafts = Math.max(0, total - published);
    const targets = formGroups.length;
    return { total, published, drafts, targets };
  }, [adminForms, formGroups.length]);

  const leadershipResponsesByMonth = useMemo(() => {
    const bucket = new Map<string, { month: string; count: number }>();
    leaders.forEach((item) => {
      const parsed = new Date(item.createdAt);
      if (Number.isNaN(parsed.getTime())) return;
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      const month = parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      const current = bucket.get(key) || { month, count: 0 };
      current.count += 1;
      bucket.set(key, current);
    });
    return Array.from(bucket.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([, value]) => value);
  }, [leaders]);

  const leadershipThisMonth = useMemo(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return leaders.reduce((acc, item) => {
      const parsed = new Date(item.createdAt);
      if (Number.isNaN(parsed.getTime())) return acc;
      const monthKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      if (monthKey === key) return acc + 1;
      return acc;
    }, 0);
  }, [leaders]);

  const pendingLeadershipApplications = useMemo(
    () => leaders.filter((row) => row.status === 'pending').length,
    [leaders]
  );

  const pendingLeadership = useMemo(
    () => leaders.filter((row) => row.status === 'pending').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [leaders]
  );
  const publishedLeadership = useMemo(
    () => leaders.filter((row) => row.status === 'approved').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [leaders]
  );
  const inactiveMembers = useMemo(
    () => members.filter((row) => !row.isActive).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [members]
  );

  const activateMember = useCallback(async (member: Member) => {
    try {
      setMemberActivatingId(member.id);
      await apiClient.updateMember(member.id, { isActive: true });
      toast.success('Member approved and activated');
      await loadAll();
    } catch (error) {
      console.error('Failed to activate member:', error);
      toast.error('Unable to approve member');
    } finally {
      setMemberActivatingId(null);
    }
  }, [loadAll]);

  const addMember = useCallback(async () => {
    if (!memberForm.firstName.trim() || !memberForm.lastName.trim() || !memberForm.email.trim()) {
      toast.error('First name, last name, and email are required.');
      return;
    }

    setSavingMember(true);
    try {
      await apiClient.createMember({
        firstName: memberForm.firstName.trim(),
        lastName: memberForm.lastName.trim(),
        email: memberForm.email.trim(),
        phone: memberForm.phone?.trim() || undefined,
        isActive: memberForm.isActive ?? true,
      });
      toast.success('Member added');
      setMemberModalOpen(false);
      setMemberForm({ firstName: '', lastName: '', email: '', phone: '', isActive: true });
      await loadAll();
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error('Unable to add member');
    } finally {
      setSavingMember(false);
    }
  }, [memberForm, loadAll]);

  const addLeader = useCallback(async () => {
    if (!leaderForm.firstName?.trim() || !leaderForm.lastName?.trim() || !leaderForm.role) {
      toast.error('First name, last name, and role are required.');
      return;
    }
    if (leaderForm.birthday && !ddmmyyyy.test(leaderForm.birthday)) {
      toast.error('Birthday must use DD/MM/YYYY');
      return;
    }
    if (leaderForm.anniversary && !ddmmyyyy.test(leaderForm.anniversary)) {
      toast.error('Wedding anniversary must use DD/MM/YYYY');
      return;
    }
    if (leaderImageFile && leaderImageFile.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or less');
      return;
    }

    setSavingLeader(true);
    try {
      let imageUrl = leaderForm.imageUrl || '';
      if (leaderImageFile) {
        const upload = await apiClient.uploadImage(leaderImageFile, 'leadership/profiles');
        imageUrl = upload.url;
      }

      await apiClient.createLeadership({
        firstName: leaderForm.firstName.trim(),
        lastName: leaderForm.lastName.trim(),
        email: leaderForm.email?.trim() || undefined,
        phone: leaderForm.phone?.trim() || undefined,
        role: leaderForm.role,
        status: 'approved',
        bio: leaderForm.bio?.trim() || undefined,
        birthday: leaderForm.birthday?.trim() || undefined,
        anniversary: leaderForm.anniversary?.trim() || undefined,
        imageUrl: imageUrl || undefined,
      });

      toast.success('Leadership profile created');
      setLeaderModalOpen(false);
      setLeaderImageFile(null);
      setLeaderForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'associate_pastor',
        status: 'approved',
        bio: '',
        birthday: '',
        anniversary: '',
        imageUrl: '',
      });
      await loadAll();
    } catch (error) {
      console.error('Failed to add leader:', error);
      toast.error('Unable to create leadership profile');
    } finally {
      setSavingLeader(false);
    }
  }, [leaderForm, leaderImageFile, loadAll]);

  const tabButton = (key: TabKey, label: string, icon: ReactNode) => (
    <button
      key={key}
      onClick={() => setActiveTab(key)}
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

  const copyPublicFormLink = async (form: AdminForm) => {
    const url = buildPublicFormUrl(form.slug, form.publicUrl);
    if (!url) {
      toast.error('Form link not available yet. Publish the form first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Form link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  const deleteForm = async (form: AdminForm) => {
    const confirmed = window.confirm(`Delete "${form.title}"? This will disable its public submissions.`);
    if (!confirmed) return;
    try {
      await apiClient.deleteAdminForm(form.id);
      toast.success('Form deleted');
      await loadAll();
    } catch (error) {
      console.error('Failed to delete form:', error);
      toast.error('Failed to delete form');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        subtitle="Manage workforce, leadership, and member records with structured forms."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setMemberModalOpen(true)}>
              Add Member
            </Button>
            <Button variant="ghost" icon={<Sparkles className="h-4 w-4" />} onClick={() => setLeaderModalOpen(true)}>
              Add Leadership
            </Button>
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap gap-3">
          {tabButton('workforce', 'Workforce', <Shield className="h-4 w-4" />)}
          {tabButton('members', 'Members', <Users className="h-4 w-4" />)}
          {tabButton('leadership', 'Leadership', <Sparkles className="h-4 w-4" />)}
          {tabButton('forms', 'Forms', <LayoutGrid className="h-4 w-4" />)}
        </div>
      </Card>

      <Card title="Administration Form Metrics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Total forms</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{formsMetrics.total}</p>
          </div>
          <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Published</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{formsMetrics.published}</p>
          </div>
          <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Drafts</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{formsMetrics.drafts}</p>
          </div>
          <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Form sections</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{formsMetrics.targets}</p>
          </div>
        </div>
      </Card>

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

          <Card>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Frontend Registrations by Section</p>
            {workforceSections.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-tertiary)]">
                {loading ? 'Loading section metrics...' : 'No section data yet.'}
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {workforceSections.map(([section, count]) => (
                  <div
                    key={section}
                    className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3"
                  >
                    <p className="truncate text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">{section}</p>
                    <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{count}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

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
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-3">
          <Card title="Pending Member Reviews">
            {inactiveMembers.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {loading ? 'Loading member review queue...' : 'No pending member reviews.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[var(--color-text-tertiary)]">
                    <tr>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Submitted</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveMembers.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--color-border-secondary)]">
                        <td className="py-2 pr-4 text-[var(--color-text-primary)]">{row.firstName} {row.lastName}</td>
                        <td className="py-2 pr-4">{row.email}</td>
                        <td className="py-2 pr-4">{new Date(row.createdAt).toLocaleDateString()}</td>
                        <td className="py-2 text-right">
                          <Button size="sm" variant="outline" icon={<Eye className="h-4 w-4" />} onClick={() => setMemberReviewTarget(row)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Member Form Links">
            {formsLoading ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">Loading forms...</p>
            ) : memberForms.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-tertiary)]">No member intake form created yet.</p>
                <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => router.push('/dashboard/forms/new?preset=member')}>
                  Create member form
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {memberForms.map((form) => {
                  const url = buildPublicFormUrl(form.slug, form.publicUrl);
                  return (
                    <div
                      key={form.id}
                      className="flex flex-col gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-text-primary)]">{form.title}</p>
                        <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                          {url || 'Publish this form to generate public link'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" icon={<Link2 className="h-4 w-4" />} disabled={!url} onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}>
                          Open
                        </Button>
                        <Button size="sm" variant="outline" icon={<Copy className="h-4 w-4" />} disabled={!url} onClick={() => copyPublicFormLink(form)}>
                          Copy Link
                        </Button>
                        <Button size="sm" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => deleteForm(form)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

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
        </div>
      )}

      {activeTab === 'leadership' && (
        <div className="space-y-3">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Leadership applications</p>
              <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{leaders.length}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">This month applications</p>
              <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{leadershipThisMonth}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Pending leadership approvals</p>
              <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{pendingLeadershipApplications}</p>
            </Card>
          </div>

      <Card title="Leadership Form Response Activity (Monthly)">
            {leadershipResponsesByMonth.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {loading ? 'Loading monthly activity...' : 'No leadership applications yet.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[var(--color-text-tertiary)]">
                    <tr>
                      <th className="py-2 pr-4">Month</th>
                      <th className="py-2 pr-4">Responses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadershipResponsesByMonth.map((row) => (
                      <tr key={row.month} className="border-t border-[var(--color-border-secondary)]">
                        <td className="py-2 pr-4 text-[var(--color-text-primary)]">{row.month}</td>
                        <td className="py-2 pr-4">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Pending Leadership Review Queue">
            {pendingLeadership.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {loading ? 'Loading leadership queue...' : 'No pending leadership applications.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[var(--color-text-tertiary)]">
                    <tr>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Submitted</th>
                      <th className="py-2 text-right">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLeadership.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--color-border-secondary)]">
                        <td className="py-2 pr-4 text-[var(--color-text-primary)]">{row.firstName} {row.lastName}</td>
                        <td className="py-2 pr-4">{row.email || 'No email'}</td>
                        <td className="py-2 pr-4">{roleLabel(row.role)}</td>
                        <td className="py-2 pr-4">{new Date(row.createdAt).toLocaleDateString()}</td>
                        <td className="py-2 text-right">
                          <Button size="sm" variant="outline" icon={<Eye className="h-4 w-4" />} onClick={() => setLeadershipReviewTarget(row)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Approved Leadership Profiles">
            {publishedLeadership.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No approved leadership profiles yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[var(--color-text-tertiary)]">
                    <tr>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publishedLeadership.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--color-border-secondary)]">
                        <td className="py-2 pr-4 text-[var(--color-text-primary)]">{row.firstName} {row.lastName}</td>
                        <td className="py-2 pr-4">{roleLabel(row.role)}</td>
                        <td className="py-2 pr-4">{row.email || 'No email'}</td>
                        <td className="py-2 pr-4">{new Date(row.updatedAt || row.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Leadership Form Links">
            {formsLoading ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">Loading forms...</p>
            ) : leadershipForms.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-tertiary)]">No leadership application form created yet.</p>
                <Button icon={<Sparkles className="h-4 w-4" />} onClick={() => router.push('/dashboard/forms/new?preset=leadership')}>
                  Create leadership form
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {leadershipForms.map((form) => {
                  const url = buildPublicFormUrl(form.slug, form.publicUrl);
                  return (
                    <div
                      key={form.id}
                      className="flex flex-col gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-text-primary)]">{form.title}</p>
                        <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                          {url || 'Publish this form to generate public link'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" icon={<Link2 className="h-4 w-4" />} disabled={!url} onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}>
                          Open
                        </Button>
                        <Button size="sm" variant="outline" icon={<Copy className="h-4 w-4" />} disabled={!url} onClick={() => copyPublicFormLink(form)}>
                          Copy Link
                        </Button>
                        <Button size="sm" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => deleteForm(form)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
        </div>
      )}

      {activeTab === 'forms' && (
        <div className="space-y-4">
          {formsLoading ? (
            <Card>
              <p className="text-sm text-[var(--color-text-tertiary)]">Loading forms...</p>
            </Card>
          ) : formGroups.length === 0 ? (
            <Card>
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-tertiary)]">No forms created yet.</p>
                <Button onClick={() => router.push('/dashboard/forms/new')}>Create first form</Button>
              </div>
            </Card>
          ) : (
            formGroups.map((group) => (
              <Card key={group.key} title={`${group.label} Forms`}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-[var(--color-text-tertiary)]">{group.forms.length} form(s)</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(buildNewFormRouteForTarget(group.key))}
                  >
                    New {group.label} Form
                  </Button>
                </div>
                <div className="space-y-3">
                  {group.forms.map((form) => {
                    const url = buildPublicFormUrl(form.slug, form.publicUrl);
                    return (
                      <div
                        key={form.id}
                        className="flex flex-col gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--color-text-primary)]">{form.title}</p>
                          <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                            {url || 'Publish this form to generate public link'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" icon={<Link2 className="h-4 w-4" />} disabled={!url} onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}>
                            Open
                          </Button>
                          <Button size="sm" variant="outline" icon={<Copy className="h-4 w-4" />} disabled={!url} onClick={() => copyPublicFormLink(form)}>
                            Copy Link
                          </Button>
                          <Button size="sm" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => deleteForm(form)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {memberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
          <div className="w-full max-w-lg rounded-[var(--radius-card)] bg-[var(--color-background-primary)] p-6 shadow-xl border border-[var(--color-border-secondary)]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Add member</h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">Capture member contact details.</p>
              </div>
              <button onClick={() => setMemberModalOpen(false)} aria-label="Close" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
                ×
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="First name" value={memberForm.firstName} onChange={(e) => setMemberForm((prev) => ({ ...prev, firstName: e.target.value }))} />
                <Input label="Last name" value={memberForm.lastName} onChange={(e) => setMemberForm((prev) => ({ ...prev, lastName: e.target.value }))} />
              </div>
              <Input label="Email address" value={memberForm.email} onChange={(e) => setMemberForm((prev) => ({ ...prev, email: e.target.value }))} />
              <Input label="Contact number" value={memberForm.phone} onChange={(e) => setMemberForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setMemberModalOpen(false)}>Cancel</Button>
              <Button onClick={addMember} loading={savingMember}>Save member</Button>
            </div>
          </div>
        </div>
      )}

      {leaderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
          <div className="w-full max-w-2xl rounded-[var(--radius-card)] bg-[var(--color-background-primary)] p-6 shadow-xl border border-[var(--color-border-secondary)] max-h-[92vh] overflow-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Create leadership profile</h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Profiles created here power the public leadership page.
                </p>
              </div>
              <button onClick={() => setLeaderModalOpen(false)} aria-label="Close" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="First name" value={leaderForm.firstName} onChange={(e) => setLeaderForm((prev) => ({ ...prev, firstName: e.target.value }))} />
                <Input label="Last name" value={leaderForm.lastName} onChange={(e) => setLeaderForm((prev) => ({ ...prev, lastName: e.target.value }))} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Email" value={leaderForm.email} onChange={(e) => setLeaderForm((prev) => ({ ...prev, email: e.target.value }))} />
                <Input label="Phone" value={leaderForm.phone} onChange={(e) => setLeaderForm((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>

              <label className="space-y-2 block">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">Role</span>
                <select
                  className="h-10 w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 text-sm text-[var(--color-text-primary)]"
                  value={leaderForm.role}
                  onChange={(e) => setLeaderForm((prev) => ({ ...prev, role: e.target.value as LeadershipRole }))}
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Birthday (DD/MM/YYYY)"
                  value={leaderForm.birthday}
                  onChange={(e) => setLeaderForm((prev) => ({ ...prev, birthday: e.target.value }))}
                  placeholder="25/12/1990"
                />
                <Input
                  label="Wedding anniversary (DD/MM/YYYY)"
                  value={leaderForm.anniversary}
                  onChange={(e) => setLeaderForm((prev) => ({ ...prev, anniversary: e.target.value }))}
                  placeholder="16/06/2014"
                />
              </div>

              <label className="space-y-2 block">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">Profile image (max 5MB)</span>
                <label className="flex items-center gap-2 h-10 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 text-sm text-[var(--color-text-secondary)]">
                  <UploadCloud className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => setLeaderImageFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <span className="truncate">{leaderImageFile ? leaderImageFile.name : 'Choose image'}</span>
                </label>
              </label>

              <label className="space-y-2 block">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">Bio</span>
                <textarea
                  value={leaderForm.bio}
                  onChange={(e) => setLeaderForm((prev) => ({ ...prev, bio: e.target.value }))}
                  className="min-h-[110px] w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-3 text-sm text-[var(--color-text-primary)]"
                  placeholder="Short leadership summary"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setLeaderModalOpen(false)}>Cancel</Button>
              <Button onClick={addLeader} loading={savingLeader}>Save leadership profile</Button>
            </div>
          </div>
        </div>
      )}

      {leadershipReviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
          <div className="w-full max-w-xl rounded-[var(--radius-card)] bg-[var(--color-background-primary)] p-6 shadow-xl border border-[var(--color-border-secondary)]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Leadership application review</h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Review this record before super-admin approval and publish.
                </p>
              </div>
              <button onClick={() => setLeadershipReviewTarget(null)} aria-label="Close" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
                ×
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Name</p>
                  <p className="font-semibold text-[var(--color-text-primary)]">{leadershipReviewTarget.firstName} {leadershipReviewTarget.lastName}</p>
                </div>
                <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Role</p>
                  <p className="font-semibold text-[var(--color-text-primary)]">{roleLabel(leadershipReviewTarget.role)}</p>
                </div>
              </div>
              <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                <p className="text-xs text-[var(--color-text-tertiary)]">Email</p>
                <p className="font-medium text-[var(--color-text-primary)]">{leadershipReviewTarget.email || 'No email provided'}</p>
              </div>
              {leadershipReviewTarget.bio ? (
                <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Bio</p>
                  <p className="mt-1 text-[var(--color-text-secondary)]">{leadershipReviewTarget.bio}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setLeadershipReviewTarget(null)}>Close</Button>
              <Button onClick={() => router.push('/dashboard/super/requests')}>
                Open Super Admin Approval Queue
              </Button>
            </div>
          </div>
        </div>
      )}

      {memberReviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur p-4">
          <div className="w-full max-w-xl rounded-[var(--radius-card)] bg-[var(--color-background-primary)] p-6 shadow-xl border border-[var(--color-border-secondary)]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Member review</h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Review this submission before approving it for frontend visibility.
                </p>
              </div>
              <button
                onClick={() => setMemberReviewTarget(null)}
                aria-label="Close"
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Name</p>
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {memberReviewTarget.firstName} {memberReviewTarget.lastName}
                  </p>
                </div>
                <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Submitted</p>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {new Date(memberReviewTarget.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                <p className="text-xs text-[var(--color-text-tertiary)]">Email</p>
                <p className="font-medium text-[var(--color-text-primary)]">{memberReviewTarget.email}</p>
              </div>
              <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                <p className="text-xs text-[var(--color-text-tertiary)]">Phone</p>
                <p className="font-medium text-[var(--color-text-primary)]">{memberReviewTarget.phone || 'No phone provided'}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setMemberReviewTarget(null)}>
                Close
              </Button>
              <Button
                onClick={async () => {
                  await activateMember(memberReviewTarget);
                  setMemberReviewTarget(null);
                }}
                loading={memberActivatingId === memberReviewTarget.id}
                disabled={memberActivatingId === memberReviewTarget.id}
                icon={<CheckCircle2 className="h-4 w-4" />}
              >
                Approve member
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
