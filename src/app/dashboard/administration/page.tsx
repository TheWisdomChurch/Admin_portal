'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Calendar,
  Heart,
  Mail,
  Phone,
  Shield,
  Sparkles,
  UploadCloud,
  UserPlus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { Badge } from '@/ui/Badge';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import type {
  CreateLeadershipRequest,
  CreateMemberRequest,
  LeadershipMember,
  LeadershipRole,
  Member,
  WorkforceMember,
} from '@/lib/types';

type TabKey = 'workforce' | 'members' | 'leadership';

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
  const [activeTab, setActiveTab] = useState<TabKey>('workforce');

  const [workforce, setWorkforce] = useState<WorkforceMember[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [leaders, setLeaders] = useState<LeadershipMember[]>([]);
  const [loading, setLoading] = useState(false);

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [leaderModalOpen, setLeaderModalOpen] = useState(false);
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
    try {
      const [workforceRes, membersRes, leadershipRes] = await Promise.all([
        apiClient.listWorkforce({ page: 1, limit: 200 }),
        apiClient.listMembers({ page: 1, limit: 200 }),
        apiClient.listLeadership({ page: 1, limit: 200 }),
      ]);

      setWorkforce(toArray<WorkforceMember>(workforceRes));
      setMembers(toArray<Member>(membersRes));
      setLeaders(toArray<LeadershipMember>(leadershipRes));
    } catch (error) {
      console.error('Failed to load administration data:', error);
      toast.error('Unable to load administration records');
      setWorkforce([]);
      setMembers([]);
      setLeaders([]);
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
    </div>
  );
}

