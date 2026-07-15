'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { StatCard } from '@/ui/StatCard';
import { EmptyState } from '@/ui/EmptyState';
import { Table, type TableColumn } from '@/ui/Table';
import { apiClient } from '@/lib/api';
import { withAuth } from '@/providers/withAuth';
import type { AttendanceSessionAdmin, AttendanceRecordAdmin, ServiceTypeAdmin, Member } from '@/lib/types';

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function AttendancePage() {
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeAdmin[]>([]);
  const [sessions, setSessions] = useState<AttendanceSessionAdmin[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [newServiceTypeName, setNewServiceTypeName] = useState('');
  const [creatingServiceType, setCreatingServiceType] = useState(false);

  const [newSessionType, setNewSessionType] = useState('');
  const [newSessionDate, setNewSessionDate] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  const [selected, setSelected] = useState<AttendanceSessionAdmin | null>(null);
  const [records, setRecords] = useState<AttendanceRecordAdmin[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [guestName, setGuestName] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [typesRes, sessionsRes, membersRes] = await Promise.all([
        apiClient.listServiceTypes(),
        apiClient.listAttendanceSessions({ page: 1, limit: 100 }),
        apiClient.listMembers({ page: 1, limit: 300 }),
      ]);
      setServiceTypes(Array.isArray(typesRes) ? typesRes : []);
      setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
    } catch (error) {
      console.error('Failed to load attendance data:', error);
      toast.error('Unable to load attendance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const loadRecords = useCallback(async (session: AttendanceSessionAdmin) => {
    setRecordsLoading(true);
    try {
      const res = await apiClient.listAttendanceRecords(session.id);
      setRecords(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error('Failed to load attendance records:', error);
      toast.error('Unable to load check-ins for this session');
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  const openSession = (session: AttendanceSessionAdmin) => {
    setSelected(session);
    setMemberQuery('');
    setGuestName('');
    void loadRecords(session);
  };

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonthCheckIns = sessions
      .filter((s) => {
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, s) => sum + (s.head_count || 0), 0);
    return {
      totalSessions: sessions.length,
      activeTypes: serviceTypes.filter((t) => t.is_active).length,
      thisMonthCheckIns,
    };
  }, [sessions, serviceTypes]);

  const matchingMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) => `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [memberQuery, members]);

  const createServiceType = async () => {
    if (!newServiceTypeName.trim()) return;
    setCreatingServiceType(true);
    try {
      await apiClient.createServiceType({ name: newServiceTypeName.trim() });
      setNewServiceTypeName('');
      toast.success('Service type added');
      await loadData();
    } catch (error) {
      console.error('Failed to create service type:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to add service type');
    } finally {
      setCreatingServiceType(false);
    }
  };

  const createSession = async () => {
    if (!newSessionType || !newSessionDate) {
      toast.error('Choose a service type and date');
      return;
    }
    setCreatingSession(true);
    try {
      await apiClient.createAttendanceSession({
        service_type_id: newSessionType,
        date: new Date(newSessionDate).toISOString(),
      });
      setNewSessionDate('');
      toast.success('Session created');
      await loadData();
    } catch (error) {
      console.error('Failed to create session:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to create session');
    } finally {
      setCreatingSession(false);
    }
  };

  const checkInMember = async (memberId: string, name: string) => {
    if (!selected) return;
    setCheckingIn(true);
    try {
      await apiClient.checkInAttendance({ session_id: selected.id, member_id: memberId, checked_in_via: 'manual' });
      toast.success(`Checked in ${name}`);
      setMemberQuery('');
      await loadRecords(selected);
      await loadData();
    } catch (error) {
      console.error('Failed to check in member:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to check in');
    } finally {
      setCheckingIn(false);
    }
  };

  const checkInGuest = async () => {
    if (!selected || !guestName.trim()) return;
    setCheckingIn(true);
    try {
      await apiClient.checkInAttendance({ session_id: selected.id, guest_name: guestName.trim(), checked_in_via: 'manual' });
      toast.success(`Checked in ${guestName.trim()}`);
      setGuestName('');
      await loadRecords(selected);
      await loadData();
    } catch (error) {
      console.error('Failed to check in guest:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to check in');
    } finally {
      setCheckingIn(false);
    }
  };

  const memberName = (id?: string) => {
    if (!id) return null;
    const m = members.find((mm) => mm.id === id);
    return m ? `${m.firstName} ${m.lastName}` : id;
  };

  const columns: TableColumn<AttendanceSessionAdmin>[] = [
    { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
    { key: 'service', header: 'Service', render: (row) => row.service_type?.name || serviceTypes.find((t) => t.id === row.service_type_id)?.name || '—' },
    { key: 'headcount', header: 'Head count', render: (row) => <span className="font-black tabular-nums">{row.head_count}</span> },
    { key: 'notes', header: 'Notes', render: (row) => <span className="text-[var(--color-text-tertiary)]">{row.notes || '—'}</span> },
  ];

  return (
    <main className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle="Track service sessions and check-ins across campuses."
        actions={
          <Button variant="outline" icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />} onClick={() => void loadData()} loading={loading}>
            Refresh
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total sessions" value={stats.totalSessions} icon={<CalendarCheck className="h-5 w-5" />} />
        <StatCard label="Check-ins this month" value={stats.thisMonthCheckIns} icon={<UserCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Active service types" value={stats.activeTypes} icon={<ClipboardList className="h-5 w-5" />} tone="info" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <SectionCard title="Sessions" subtitle="Every recorded service, most recent first." icon={<CalendarCheck className="h-5 w-5" />}>
          <div className="mb-4 grid gap-2 rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 sm:grid-cols-[1fr_180px_auto]">
            <select
              value={newSessionType}
              onChange={(e) => setNewSessionType(e.target.value)}
              className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-bold text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="">Select service type…</option>
              {serviceTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input
              type="date"
              value={newSessionDate}
              onChange={(e) => setNewSessionDate(e.target.value)}
              className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-bold text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-border-focus)]"
            />
            <Button size="sm" icon={<Plus className="h-4 w-4" />} loading={creatingSession} onClick={() => void createSession()}>New session</Button>
          </div>

          <Table
            columns={columns}
            data={sessions}
            rowKey={(row) => row.id}
            loading={loading}
            emptyTitle="No attendance sessions yet"
            emptyDescription="Create your first session above to start recording check-ins."
            onRowClick={openSession}
          />
        </SectionCard>

        <SectionCard title="Service types" subtitle="The recurring services you take attendance for." icon={<ClipboardList className="h-5 w-5" />}>
          <div className="mb-4 flex gap-2">
            <Input value={newServiceTypeName} onChange={(e) => setNewServiceTypeName(e.target.value)} placeholder="e.g. Sunday First Service" className="flex-1" />
            <Button size="sm" icon={<Plus className="h-4 w-4" />} loading={creatingServiceType} onClick={() => void createServiceType()}>Add</Button>
          </div>
          {serviceTypes.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No service types yet" description="Add one to start creating sessions." />
          ) : (
            <div className="space-y-2">
              {serviceTypes.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
                  <span className="text-sm font-black text-[var(--color-text-primary)]">{t.name}</span>
                  <Badge variant={t.is_active ? 'success' : 'secondary'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[var(--color-text-primary)]/50 backdrop-blur-sm">
          <button type="button" aria-label="Close session" className="absolute inset-0 cursor-default" onClick={() => setSelected(null)} />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">{formatDate(selected.date)}</p>
                <h2 className="mt-1 text-lg font-black text-[var(--color-text-primary)]">{selected.service_type?.name || 'Session'}</h2>
              </div>
              <button type="button" className="rounded-2xl border border-[var(--color-border-secondary)] p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]" onClick={() => setSelected(null)} aria-label="Close session">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--color-text-tertiary)]">Head count</p>
                  <p className="mt-2 text-2xl font-black tabular-nums text-[var(--color-text-primary)]">{selected.head_count}</p>
                </div>
                <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--color-text-tertiary)]">Checked in</p>
                  <p className="mt-2 text-2xl font-black tabular-nums text-[var(--color-text-primary)]">{records.length}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Check in a member</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <Input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Search members by name or email…" className="pl-10" />
                </div>
                {matchingMembers.length > 0 ? (
                  <div className="mt-2 space-y-1 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-2">
                    {matchingMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        disabled={checkingIn}
                        onClick={() => void checkInMember(m.id, `${m.firstName} ${m.lastName}`)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold text-[var(--color-text-primary)] transition hover:bg-[var(--color-background-primary)] disabled:opacity-50"
                      >
                        {m.firstName} {m.lastName}
                        <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">{m.email}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Or check in a guest</p>
                <div className="flex gap-2">
                  <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest name" className="flex-1" />
                  <Button size="sm" loading={checkingIn} onClick={() => void checkInGuest()}>Check in</Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Check-ins</p>
                {recordsLoading ? (
                  <p className="py-6 text-center text-sm font-bold text-[var(--color-text-tertiary)]">Loading…</p>
                ) : records.length === 0 ? (
                  <EmptyState icon={<Users className="h-6 w-6" />} title="No check-ins yet" />
                ) : (
                  <div className="space-y-2">
                    {records.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm font-black text-[var(--color-text-primary)]">{r.guest_name || memberName(r.member_id) || 'Member'}</span>
                        </div>
                        <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">{formatDateTime(r.checked_in_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

export default withAuth(AttendancePage, { requiredRole: 'admin' });
