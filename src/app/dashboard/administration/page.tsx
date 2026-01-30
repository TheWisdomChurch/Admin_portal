'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  Users,
  Shield,
  Sparkles,
  UserPlus,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  ChevronUp,
  Award,
  Calendar,
  Heart,
} from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { Badge } from '@/ui/Badge';
import { PageHeader } from '@/layouts';

type WorkforceRow = {
  id: string;
  name: string;
  department: string;
  status: 'serving' | 'not_serving' | 'new';
  email: string;
  phone: string;
  dob: string;
  address?: string;
};

type MemberRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
};

type LeaderRow = {
  id: string;
  name: string;
  title: string;
  dob: string;
  anniversary?: string;
  email: string;
};

const defaultWorkforce: WorkforceRow[] = [
  { id: 'wf-1', name: 'Ruth Aligbeh', department: 'Media Team', status: 'serving', email: 'ruth@wisdomchurch.org', phone: '+234 801 222 3333', dob: '04/12', address: 'Lagos' },
  { id: 'wf-2', name: 'Cherish Aigbeh', department: 'Media Team', status: 'new', email: 'cherish@wisdomchurch.org', phone: '+234 809 555 1212', dob: '08/22', address: 'Abuja' },
  { id: 'wf-3', name: 'Favour ', department: 'Media', status: 'not_serving', email: 'naomi@wisdomchurch.org', phone: '+233 55 991 2299', dob: '01/08', address: 'Accra' },
];

const defaultMembers: MemberRow[] = [
  { id: 'm-1', firstName: 'Paul', lastName: 'Samuel', email: 'ethan@wisdomchurch.org', phone: '+234 801 777 8822', address: 'Nairobi, KE' },
  { id: 'm-2', firstName: 'Chisom', lastName: 'Adebayo', email: 'chisom@wisdomchurch.org', phone: '+234 809 111 2277', address: 'Lagos, NG' },
];

const defaultLeaders: LeaderRow[] = [
  { id: 'l-1', name: 'Bishop Gabriel Ayilara', title: 'Senior Pastor', dob: '03/28', anniversary: '10/12', email: 'david@wisdomchurch.org' },
  { id: 'l-2', name: 'Rev. Victor Jimba', title: 'Associate Pastor', dob: '07/04', anniversary: '12/20', email: 'sarah@wisdomchurch.org' },
];

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
  const workforce = defaultWorkforce;
  const [members, setMembers] = useState<MemberRow[]>(defaultMembers);
  const [leaders, setLeaders] = useState<LeaderRow[]>(defaultLeaders);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [leaderModalOpen, setLeaderModalOpen] = useState(false);

  const [memberForm, setMemberForm] = useState<MemberRow>({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
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

  const handleAddMember = () => {
    if (!memberForm.firstName || !memberForm.lastName || !memberForm.email || !memberForm.phone) return;
    setMembers((prev) => [
      {
        ...memberForm,
        id: `m-${Date.now()}`,
      },
      ...prev,
    ]);
    setMemberForm({ id: '', firstName: '', lastName: '', email: '', phone: '', address: '' });
    setMemberModalOpen(false);
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
              <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{workforceCounts['new'] || 0}</p>
            </Card>
          </div>

          <div className="space-y-3">
            {workforce.map((row) => (
              <AccordionRow
                key={row.id}
                title={row.name}
                subtitle={`${row.department} • DOB ${row.dob}`}
                badge={
                  <Badge variant={row.status === 'serving' ? 'success' : row.status === 'new' ? 'primary' : 'warning'} size="sm">
                    {row.status === 'serving' ? 'Serving' : row.status === 'new' ? 'Pending' : 'Not serving'}
                  </Badge>
                }
              >
                <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    {row.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    {row.phone}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    {row.address || '—'}
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                    Birthdays auto-email: enabled (connect backend notifications).
                  </p>
                </div>
              </AccordionRow>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-3">
          {members.map((row) => (
            <AccordionRow
              key={row.id}
              title={`${row.firstName} ${row.lastName}`}
              subtitle={row.email}
              badge={<Badge variant="secondary" size="sm">Member</Badge>}
            >
              <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                  {row.phone}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                  {row.address}
                </div>
              </div>
            </AccordionRow>
          ))}
        </div>
      )}

      {activeTab === 'leadership' && (
        <div className="space-y-3">
          {leaders.map((row) => (
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
                {row.anniversary && (
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    Anniversary: {row.anniversary}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                  {row.email || 'No email'}
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                  Automated greetings: configure email templates in notifications.
                </p>
              </div>
            </AccordionRow>
          ))}
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
              <Input label="Contact address" value={memberForm.address} onChange={(e) => setMemberForm({ ...memberForm, address: e.target.value })} />
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
