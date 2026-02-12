'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Users,
  Shield,
  Sparkles,
  UserPlus,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  Award,
  Calendar,
  Heart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { Badge } from '@/ui/Badge';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import type { WorkforceMember, Member } from '@/lib/types';

type LeaderRow = {
  id: string;
  name: string;
  title: string;
  dob: string;
  anniversary?: string;
  email: string;
};

type BirthdayMember = WorkforceMember & Record<string, unknown>;

const monthLabels = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const pickNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getStatNumber = (stats: Record<string, unknown> | null, keys: string[]): number | null => {
  if (!stats) return null;
  for (const key of keys) {
    if (key in stats) {
      const value = pickNumber(stats[key]);
      if (value !== null) return value;
    }
  }
  return null;
};

const getBirthdayLabel = (member: BirthdayMember): string => {
  const raw = member as Record<string, unknown>;
  const candidate =
    raw.birthday ??
    raw.birthDate ??
    raw.birth_date ??
    raw.date_of_birth ??
    raw.dob ??
    raw.dateOfBirth;

  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    const timestampMs = candidate > 1e12 ? candidate : candidate * 1000;
    const date = new Date(timestampMs);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  return '—';
};

const getMemberName = (member: BirthdayMember): string => {
  const raw = member as Record<string, unknown>;
  const firstName =
    member.firstName ||
    (typeof raw.first_name === 'string' ? raw.first_name : '');
  const lastName =
    member.lastName ||
    (typeof raw.last_name === 'string' ? raw.last_name : '');
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) return fullName;
  if (typeof raw.name === 'string' && raw.name.trim()) return raw.name.trim();
  return 'Workforce Member';
};

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
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
      <button
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--color-text-primary)] truncate">{title}</p>
          {subtitle && <p className="text-xs text-[var(--color-text-tertiary)] truncate">{subtitle}</p>}
        </div>
        {badge}
        {open ? <ChevronUp className="h-4 w-4 text-[var(--color-text-tertiary)]" /> : <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)]" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function AdministrationPage() {
  const [activeTab, setActiveTab] = useState<'workforce' | 'members' | 'leadership'>('workforce');
  const [workforce, setWorkforce] = useState<WorkforceMember[]>([]);
  const [workforceLoading, setWorkforceLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [leaderModalOpen, setLeaderModalOpen] = useState(false);
  const [birthdayStats, setBirthdayStats] = useState<Record<string, unknown> | null>(null);
  const [birthdaysToday, setBirthdaysToday] = useState<WorkforceMember[]>([]);
  const [birthdaysByMonth, setBirthdaysByMonth] = useState<WorkforceMember[]>([]);
  const [birthdayMonth, setBirthdayMonth] = useState(() => new Date().getMonth() + 1);
  const [birthdayLoading, setBirthdayLoading] = useState(false);
  const [birthdayMonthLoading, setBirthdayMonthLoading] = useState(false);
  const [birthdaySending, setBirthdaySending] = useState(false);

  const [memberForm, setMemberForm] = useState<Member>({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  });

  const [leaderForm, setLeaderForm] = useState<LeaderRow>({
    id: '',
    name: '',
    title: '',
    dob: '',
    anniversary: '',
    email: '',
  });

  const workforceCounts = useMemo(() => {
    return workforce.reduce(
      (acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [workforce]);

  const loadWorkforce = useCallback(async () => {
    setWorkforceLoading(true);
    try {
      const res = await apiClient.listWorkforce({ page: 1, limit: 200 });
      const data = Array.isArray(res) ? res : (res as { data?: WorkforceMember[] }).data;
      setWorkforce(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load workforce:', error);
      toast.error('Unable to load workforce');
      setWorkforce([]);
    } finally {
      setWorkforceLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await apiClient.listMembers({ page: 1, limit: 200 });
      const data = Array.isArray(res) ? res : (res as { data?: Member[] }).data;
      setMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load members:', error);
      toast.error('Unable to load members');
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const loadBirthdayOverview = useCallback(async () => {
    setBirthdayLoading(true);
    try {
      const [statsResult, todayResult] = await Promise.allSettled([
        apiClient.getWorkforceBirthdayStats(),
        apiClient.getWorkforceBirthdaysToday(),
      ]);

      if (statsResult.status === 'fulfilled') {
        setBirthdayStats(statsResult.value);
      } else {
        setBirthdayStats(null);
      }

      if (todayResult.status === 'fulfilled') {
        setBirthdaysToday(todayResult.value);
      } else {
        setBirthdaysToday([]);
      }
    } catch (error) {
      console.error('Failed to load birthday overview:', error);
      toast.error('Birthday overview unavailable');
      setBirthdayStats(null);
      setBirthdaysToday([]);
    } finally {
      setBirthdayLoading(false);
    }
  }, []);

  const loadBirthdaysByMonth = useCallback(async (month: number) => {
    setBirthdayMonthLoading(true);
    try {
      const results = await apiClient.getWorkforceBirthdaysByMonth(month);
      setBirthdaysByMonth(results);
    } catch (error) {
      console.error('Failed to load birthday month list:', error);
      toast.error('Birthday list unavailable');
      setBirthdaysByMonth([]);
    } finally {
      setBirthdayMonthLoading(false);
    }
  }, []);

  const handleSendBirthdaysToday = useCallback(async () => {
    if (!confirm('Send birthday greetings for today?')) return;
    setBirthdaySending(true);
    try {
      const result = await apiClient.sendWorkforceBirthdaysToday();
      const targeted = getStatNumber(result, ['targeted', 'Targeted', 'total']);
      const sent = getStatNumber(result, ['sent', 'Sent']);
      const skipped = getStatNumber(result, ['skipped', 'Skipped']);

      if (targeted !== null || sent !== null || skipped !== null) {
        toast.success(
          `Birthday greetings queued: targeted ${targeted ?? 0}, sent ${sent ?? 0}, skipped ${skipped ?? 0}`
        );
      } else {
        toast.success('Birthday greetings queued');
      }

      loadBirthdayOverview();
    } catch (error) {
      console.error('Failed to send birthday greetings:', error);
      toast.error('Unable to send birthday greetings');
    } finally {
      setBirthdaySending(false);
    }
  }, [loadBirthdayOverview]);

  useEffect(() => {
    loadBirthdayOverview();
  }, [loadBirthdayOverview]);

  useEffect(() => {
    loadBirthdaysByMonth(birthdayMonth);
  }, [birthdayMonth, loadBirthdaysByMonth]);

  useEffect(() => {
    loadWorkforce();
    loadMembers();
  }, [loadWorkforce, loadMembers]);

  const handleAddMember = async () => {
    if (!memberForm.firstName || !memberForm.lastName || !memberForm.email) {
      toast.error('First name, last name, and email are required.');
      return;
    }
    try {
      await apiClient.createMember({
        firstName: memberForm.firstName,
        lastName: memberForm.lastName,
        email: memberForm.email,
        phone: memberForm.phone || undefined,
        isActive: memberForm.isActive ?? true,
      });
      toast.success('Member added');
      setMemberForm({ id: '', firstName: '', lastName: '', email: '', phone: '', isActive: true, createdAt: '', updatedAt: '' });
      setMemberModalOpen(false);
      loadMembers();
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error('Failed to add member');
    }
  };

  const handleAddLeader = () => {
    if (!leaderForm.name || !leaderForm.title || !leaderForm.dob) return;
    setLeaders((prev) => [
      {
        ...leaderForm,
        id: `l-${Date.now()}`,
      },
      ...prev,
    ]);
    setLeaderForm({ id: '', name: '', title: '', dob: '', anniversary: '', email: '' });
    setLeaderModalOpen(false);
  };

  const tabButton = (key: typeof activeTab, label: string, icon: React.ReactNode) => (
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
        subtitle="Manage workforce, leadership, and member records with clear roles."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setMemberModalOpen(true)}>
              Add Member
            </Button>
            <Button variant="ghost" icon={<Award className="h-4 w-4" />} onClick={() => setLeaderModalOpen(true)}>
              Add Leader
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
              <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{workforceCounts['serving'] || 0}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">New / Onboard</p>
              <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">
                {(workforceCounts['new'] || 0) + (workforceCounts['pending'] || 0)}
              </p>
            </Card>
          </div>

          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Birthday scheduler</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Track birthdays for the workforce and send today&apos;s greetings.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={loadBirthdayOverview} disabled={birthdayLoading}>
                    Refresh
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSendBirthdaysToday}
                    loading={birthdaySending}
                    disabled={birthdaySending || birthdayLoading}
                  >
                    Send today&apos;s greetings
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Today</p>
                  <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">
                    {birthdayLoading ? '—' : (getStatNumber(birthdayStats, ['today', 'todayCount', 'birthdaysToday']) ?? birthdaysToday.length)}
                  </p>
                </div>
                <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">This month</p>
                  <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">
                    {birthdayMonthLoading ? '—' : (getStatNumber(birthdayStats, ['month', 'monthCount', 'birthdaysThisMonth']) ?? birthdaysByMonth.length)}
                  </p>
                </div>
                <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Total tracked</p>
                  <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">
                    {getStatNumber(birthdayStats, ['total', 'totalMembers', 'totalWorkforce', 'count']) ?? '—'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
                  Month
                  <select
                    className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                    value={birthdayMonth}
                    onChange={(e) => setBirthdayMonth(Number(e.target.value))}
                  >
                    {monthLabels.map((label, index) => (
                      <option key={label} value={index + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">Today&apos;s birthdays</p>
                    {birthdaysToday.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-tertiary)]">No birthdays today.</p>
                    ) : (
                      <ul className="space-y-2">
                        {birthdaysToday.map((member) => {
                          const record = member as BirthdayMember;
                          const name = getMemberName(record);
                          const department = member.department || (record.department as string | undefined);
                          const email = member.email || (record.email as string | undefined);
                          return (
                            <li
                              key={member.id}
                              className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-3"
                            >
                              <div>
                                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{name}</p>
                                <p className="text-xs text-[var(--color-text-tertiary)]">
                                  {[department, email].filter(Boolean).join(' • ') || 'Workforce member'}
                                </p>
                              </div>
                              <Badge variant="secondary" size="sm">{getBirthdayLabel(record)}</Badge>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {monthLabels[birthdayMonth - 1]} birthdays
                    </p>
                    {birthdaysByMonth.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {birthdayMonthLoading ? 'Loading birthdays...' : 'No birthdays recorded for this month.'}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {birthdaysByMonth.map((member) => {
                          const record = member as BirthdayMember;
                          const name = getMemberName(record);
                          const department = member.department || (record.department as string | undefined);
                          const email = member.email || (record.email as string | undefined);
                          return (
                            <li
                              key={member.id}
                              className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-3"
                            >
                              <div>
                                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{name}</p>
                                <p className="text-xs text-[var(--color-text-tertiary)]">
                                  {[department, email].filter(Boolean).join(' • ') || 'Workforce member'}
                                </p>
                              </div>
                              <Badge variant="secondary" size="sm">{getBirthdayLabel(record)}</Badge>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {workforceLoading ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">Loading workforce...</p>
            ) : workforce.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No workforce records yet.</p>
            ) : (
              workforce.map((row) => {
                const name = `${row.firstName} ${row.lastName}`.trim() || 'Workforce member';
                const dob = row.birthdayMonth && row.birthdayDay ? `${row.birthdayMonth}/${row.birthdayDay}` : '—';
                const statusLabel =
                  row.status === 'serving'
                    ? 'Serving'
                    : row.status === 'not_serving'
                      ? 'Not serving'
                      : 'Pending';
                const badgeVariant = row.status === 'serving' ? 'success' : row.status === 'not_serving' ? 'warning' : 'primary';
                return (
                  <AccordionRow
                    key={row.id}
                    title={name}
                    subtitle={`${row.department} • DOB ${dob}`}
                    badge={
                      <Badge variant={badgeVariant} size="sm">
                        {statusLabel}
                      </Badge>
                    }
                  >
                    <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                        {row.email || '—'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                        {row.phone || '—'}
                      </div>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                        Birthdays auto-email: enabled (connect backend notifications).
                      </p>
                    </div>
                  </AccordionRow>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-3">
          {membersLoading ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading members...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No members found.</p>
          ) : (
            members.map((row) => (
              <AccordionRow
                key={row.id}
                title={`${row.firstName} ${row.lastName}`}
                subtitle={row.email}
                badge={<Badge variant={row.isActive ? 'secondary' : 'warning'} size="sm">{row.isActive ? 'Active' : 'Inactive'}</Badge>}
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
            <p className="text-sm text-[var(--color-text-tertiary)]">No leadership records yet.</p>
          ) : (
            leaders.map((row) => {
              const anniversaryRow = row.anniversary ? (
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                  Anniversary: {row.anniversary}
                </div>
              ) : null;

              return (
                <AccordionRow
                  key={row.id}
                  title={row.name}
                  subtitle={row.title}
                  badge={<Badge variant="primary" size="sm">{row.title}</Badge>}
                >
                  <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                      Birthday: {row.dob}
                    </div>
                    {anniversaryRow}
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                      {row.email || 'No email'}
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                      Automated greetings: configure email templates in notifications.
                    </p>
                  </div>
                </AccordionRow>
              );
            })
          )}
        </div>
      )}

      {/* Member modal */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
          <div className="w-full max-w-lg rounded-[var(--radius-card)] bg-[var(--color-background-primary)] p-6 shadow-xl border border-[var(--color-border-secondary)]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Add member</h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">Quickly capture basic contact details.</p>
              </div>
              <button onClick={() => setMemberModalOpen(false)} aria-label="Close" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
                ×
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="First name" value={memberForm.firstName} onChange={(e) => setMemberForm({ ...memberForm, firstName: e.target.value })} />
                <Input label="Last name" value={memberForm.lastName} onChange={(e) => setMemberForm({ ...memberForm, lastName: e.target.value })} />
              </div>
              <Input label="Email address" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} />
              <Input label="Contact number" value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setMemberModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAddMember}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Leader modal */}
      {leaderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
          <div className="w-full max-w-lg rounded-[var(--radius-card)] bg-[var(--color-background-primary)] p-6 shadow-xl border border-[var(--color-border-secondary)]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Add leader</h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">Track pastoral birthdays and anniversaries.</p>
              </div>
              <button onClick={() => setLeaderModalOpen(false)} aria-label="Close" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
                ×
              </button>
            </div>
            <div className="space-y-3">
              <Input label="Full name" value={leaderForm.name} onChange={(e) => setLeaderForm({ ...leaderForm, name: e.target.value })} />
              <Input label="Title (Senior Pastor, Resident Pastor, Deacon...)" value={leaderForm.title} onChange={(e) => setLeaderForm({ ...leaderForm, title: e.target.value })} />
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Birthday (MM/DD)" value={leaderForm.dob} onChange={(e) => setLeaderForm({ ...leaderForm, dob: e.target.value })} />
                <Input label="Anniversary (MM/DD)" value={leaderForm.anniversary || ''} onChange={(e) => setLeaderForm({ ...leaderForm, anniversary: e.target.value })} />
              </div>
              <Input label="Email" value={leaderForm.email} onChange={(e) => setLeaderForm({ ...leaderForm, email: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setLeaderModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAddLeader}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
