'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
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
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import { apiClient } from '@/lib/api';
import { withAuth } from '@/providers/withAuth';
import type { CellGroupAdmin, CellGroupMemberAdmin, CellGroupMeetingAdmin, Member } from '@/lib/types';

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
}

function CellGroupsPage() {
  const [groups, setGroups] = useState<CellGroupAdmin[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [newZone, setNewZone] = useState('');
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<CellGroupAdmin | null>(null);
  const [groupMembers, setGroupMembers] = useState<CellGroupMemberAdmin[]>([]);
  const [meetings, setMeetings] = useState<CellGroupMeetingAdmin[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingCount, setMeetingCount] = useState('');
  const [loggingMeeting, setLoggingMeeting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CellGroupAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, membersRes] = await Promise.all([
        apiClient.listCellGroups({ page: 1, limit: 100 }),
        apiClient.listMembers({ page: 1, limit: 300 }),
      ]);
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
    } catch (error) {
      console.error('Failed to load cell groups:', error);
      toast.error('Unable to load cell groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const memberName = useCallback((id: string) => {
    const m = members.find((mm) => mm.id === id);
    return m ? `${m.firstName} ${m.lastName}` : id;
  }, [members]);

  const loadDetail = useCallback(async (group: CellGroupAdmin) => {
    setDetailLoading(true);
    try {
      const [membersList, meetingsList] = await Promise.all([
        apiClient.listCellGroupMembers(group.id),
        apiClient.listCellGroupMeetings(group.id),
      ]);
      setGroupMembers(Array.isArray(membersList) ? membersList : []);
      setMeetings(Array.isArray(meetingsList) ? meetingsList : []);
    } catch (error) {
      console.error('Failed to load cell group detail:', error);
      toast.error('Unable to load group detail');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openGroup = (group: CellGroupAdmin) => {
    setSelected(group);
    setMemberQuery('');
    void loadDetail(group);
  };

  const createGroup = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiClient.createCellGroup({ name: newName.trim(), zone: newZone.trim() || undefined });
      setNewName('');
      setNewZone('');
      toast.success('Cell group created');
      await loadData();
    } catch (error) {
      console.error('Failed to create cell group:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to create cell group');
    } finally {
      setCreating(false);
    }
  };

  const addMember = async (memberId: string) => {
    if (!selected) return;
    setBusyMemberId(memberId);
    try {
      await apiClient.addCellGroupMember(selected.id, memberId);
      toast.success('Member added');
      setMemberQuery('');
      await loadDetail(selected);
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to add member (already in group?)');
    } finally {
      setBusyMemberId(null);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selected) return;
    setBusyMemberId(memberId);
    try {
      await apiClient.removeCellGroupMember(selected.id, memberId);
      toast.success('Member removed');
      await loadDetail(selected);
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to remove member');
    } finally {
      setBusyMemberId(null);
    }
  };

  const logMeeting = async () => {
    if (!selected || !meetingDate) {
      toast.error('Pick a meeting date');
      return;
    }
    setLoggingMeeting(true);
    try {
      await apiClient.logCellGroupMeeting(selected.id, {
        date: new Date(meetingDate).toISOString(),
        attendee_count: meetingCount ? Number(meetingCount) : undefined,
      });
      setMeetingDate('');
      setMeetingCount('');
      toast.success('Meeting logged');
      await loadDetail(selected);
    } catch (error) {
      console.error('Failed to log meeting:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to log meeting');
    } finally {
      setLoggingMeeting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.deleteCellGroup(deleteTarget.id);
      toast.success('Cell group deleted');
      setDeleteTarget(null);
      setSelected(null);
      await loadData();
    } catch (error) {
      console.error('Failed to delete cell group:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to delete cell group');
    } finally {
      setDeleting(false);
    }
  };

  const matchingMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return [];
    const existingIds = new Set(groupMembers.map((m) => m.member_id));
    return members
      .filter((m) => !existingIds.has(m.id) && `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [memberQuery, members, groupMembers]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Cell Groups"
        subtitle="Small groups, membership, and meeting attendance."
        actions={
          <Button variant="outline" icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />} onClick={() => void loadData()} loading={loading}>
            Refresh
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active groups" value={groups.filter((g) => g.is_active).length} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Total groups" value={groups.length} icon={<MapPin className="h-5 w-5" />} tone="info" />
        <StatCard label="Members tracked" value={members.length} icon={<UserPlus className="h-5 w-5" />} tone="success" />
      </section>

      <SectionCard
        title="Groups"
        subtitle="Click a group to manage members and log meetings."
        icon={<Users className="h-5 w-5" />}
        actions={
          <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Group name" />
            <Input value={newZone} onChange={(e) => setNewZone(e.target.value)} placeholder="Zone (optional)" />
            <Button size="sm" icon={<Plus className="h-4 w-4" />} loading={creating} onClick={() => void createGroup()}>Add group</Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center text-sm font-bold text-[var(--color-text-tertiary)]">Loading cell groups...</div>
        ) : groups.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No cell groups yet" description="Add your first group above." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => openGroup(g)}
                className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 text-left transition hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-black text-[var(--color-text-primary)]">{g.name}</h3>
                  <Badge variant={g.is_active ? 'success' : 'secondary'}>{g.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                {g.zone ? <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-tertiary)]"><MapPin className="h-3.5 w-3.5" />{g.zone}</p> : null}
                {g.max_capacity ? <p className="mt-1 text-xs font-semibold text-[var(--color-text-tertiary)]">Capacity: {g.max_capacity}</p> : null}
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[var(--color-text-primary)]/50 backdrop-blur-sm">
          <button type="button" aria-label="Close group" className="absolute inset-0 cursor-default" onClick={() => setSelected(null)} />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Cell group</p>
                <h2 className="mt-1 text-lg font-black text-[var(--color-text-primary)]">{selected.name}</h2>
              </div>
              <button type="button" className="rounded-2xl border border-[var(--color-border-secondary)] p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]" onClick={() => setSelected(null)} aria-label="Close group">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Members ({groupMembers.length})</p>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <Input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Search members to add…" className="pl-10" />
                </div>
                {matchingMembers.length > 0 ? (
                  <div className="mb-3 space-y-1 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-2">
                    {matchingMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        disabled={busyMemberId === m.id}
                        onClick={() => void addMember(m.id)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold text-[var(--color-text-primary)] transition hover:bg-[var(--color-background-primary)] disabled:opacity-50"
                      >
                        {m.firstName} {m.lastName}
                        <UserPlus className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                      </button>
                    ))}
                  </div>
                ) : null}

                {detailLoading ? (
                  <p className="py-4 text-center text-sm font-bold text-[var(--color-text-tertiary)]">Loading…</p>
                ) : groupMembers.length === 0 ? (
                  <EmptyState icon={<Users className="h-6 w-6" />} title="No members yet" />
                ) : (
                  <div className="space-y-2">
                    {groupMembers.map((gm) => (
                      <div key={gm.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
                        <div>
                          <p className="text-sm font-black text-[var(--color-text-primary)]">{memberName(gm.member_id)}</p>
                          <Badge variant="outline">{gm.role}</Badge>
                        </div>
                        <button
                          type="button"
                          disabled={busyMemberId === gm.member_id}
                          onClick={() => void removeMember(gm.member_id)}
                          className="rounded-xl p-2 text-[var(--color-text-tertiary)] transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                          aria-label="Remove member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-[var(--color-border-secondary)] pt-5">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Log a meeting</p>
                <div className="grid grid-cols-[1fr_100px_auto] gap-2">
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-bold text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-border-focus)]"
                  />
                  <Input value={meetingCount} onChange={(e) => setMeetingCount(e.target.value)} placeholder="Count" type="number" />
                  <Button size="sm" icon={<CalendarPlus className="h-4 w-4" />} loading={loggingMeeting} onClick={() => void logMeeting()}>Log</Button>
                </div>

                <div className="mt-3 space-y-2">
                  {meetings.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
                      <span className="text-sm font-black text-[var(--color-text-primary)]">{formatDate(m.date)}</span>
                      <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">{m.attendee_count} attended</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end border-t border-[var(--color-border-secondary)] pt-5">
                <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteTarget(selected)}>
                  Delete group
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <VerifyActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete cell group"
        description={`This permanently deletes ${deleteTarget?.name || 'this group'}. This cannot be undone.`}
        verifyText="DELETE"
        confirmText="Delete group"
        variant="danger"
        loading={deleting}
      />
    </main>
  );
}

export default withAuth(CellGroupsPage, { requiredRole: 'admin' });
