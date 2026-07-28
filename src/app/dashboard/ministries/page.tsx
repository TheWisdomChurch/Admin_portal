'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HeartHandshake,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Mail,
  Phone,
  Crown,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { SectionCard } from '@/ui/SectionCard';
import { StatCard } from '@/ui/StatCard';
import { EmptyState } from '@/ui/EmptyState';
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import { apiClient } from '@/lib/api';
import { withAuth } from '@/providers/withAuth';
import type { MinistryAdmin, MinistryStructure, MinistryWorkforceAssignment, MinistryWorkforceRole, WorkforceMember } from '@/lib/types';

function roleLabel(role: MinistryWorkforceRole): string {
  return role === 'head' ? 'Department Head' : role === 'deputy_head' ? 'Deputy Head' : role === 'coordinator' ? 'Coordinator' : 'Team Member';
}

function WorkforceIdentityCard({ assignment, busy, onRemove, onRoleChange }: { assignment: MinistryWorkforceAssignment; busy: boolean; onRemove: () => void; onRoleChange: (role: MinistryWorkforceRole) => void }) {
  const person = assignment.workforceMember;
  const initials = `${person.firstName?.[0] || ''}${person.lastName?.[0] || ''}`.toUpperCase() || 'WH';
  const leadership = assignment.role !== 'member';
  return (
    <article className="group relative overflow-hidden rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <div className={`h-20 ${leadership ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600' : 'bg-gradient-to-br from-slate-800 via-indigo-900 to-blue-700'}`} />
      <div className="relative px-4 pb-4">
        <div className="-mt-9 flex items-end justify-between gap-3">
          <div className="flex h-18 w-18 items-center justify-center rounded-3xl border-4 border-[var(--color-background-primary)] bg-[var(--color-background-secondary)] text-xl font-bold text-[var(--color-text-primary)] shadow-lg">{initials}</div>
          <button type="button" disabled={busy} onClick={onRemove} className="mb-1 rounded-xl bg-[var(--color-background-secondary)] p-2 text-[var(--color-text-tertiary)] shadow transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50" aria-label={`Remove ${person.firstName} ${person.lastName}`}><Trash2 className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0"><h3 className="truncate text-base font-bold text-[var(--color-text-primary)]">{person.firstName} {person.lastName}</h3><p className="truncate text-xs font-semibold text-[var(--color-text-tertiary)]">{assignment.title || roleLabel(assignment.role)}</p></div>
          {leadership ? <Crown className="h-4 w-4 shrink-0 text-amber-500" /> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5"><Badge variant={person.status === 'serving' ? 'success' : person.status === 'pending' ? 'warning' : 'secondary'}>{person.status.replace('_', ' ')}</Badge><Badge variant="outline">{roleLabel(assignment.role)}</Badge></div>
        <Select aria-label={`Role for ${person.firstName} ${person.lastName}`} value={assignment.role} disabled={busy} onChange={(event) => onRoleChange(event.target.value as MinistryWorkforceRole)} className="mt-3"><option value="head">Department Head</option><option value="deputy_head">Deputy Head</option><option value="coordinator">Coordinator</option><option value="member">Team Member</option></Select>
        <div className="mt-4 space-y-2 border-t border-[var(--color-border-secondary)] pt-3 text-xs text-[var(--color-text-secondary)]">
          {person.email ? <p className="flex min-w-0 items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{person.email}</span></p> : null}
          {person.phone ? <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /><span>{person.phone}</span></p> : null}
        </div>
      </div>
    </article>
  );
}

function MinistriesPage() {
  const [ministries, setMinistries] = useState<MinistryAdmin[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<MinistryAdmin | null>(null);
  const [structure, setStructure] = useState<MinistryStructure | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [assignmentRole, setAssignmentRole] = useState<MinistryWorkforceRole>('member');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MinistryAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [ministriesRes, workforceRes] = await Promise.all([
        apiClient.listMinistries({ page: 1, limit: 100 }),
        apiClient.listWorkforce({ page: 1, limit: 300 }),
      ]);
      setMinistries(Array.isArray(ministriesRes.data) ? ministriesRes.data : []);
      setWorkforce(Array.isArray(workforceRes.data) ? workforceRes.data : []);
    } catch (error) {
      console.error('Failed to load ministries:', error);
      toast.error('Unable to load ministries');
      setMinistries([]);
      setWorkforce([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const loadDetail = useCallback(async (ministry: MinistryAdmin) => {
    setDetailLoading(true);
    try {
      const result = await apiClient.getMinistryStructure(ministry.id);
      setStructure(result);
    } catch (error) {
      console.error('Failed to load ministry members:', error);
      toast.error('Unable to load ministry members');
      setStructure(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openMinistry = (ministry: MinistryAdmin) => {
    setSelected(ministry);
    setStructure(null);
    setMemberQuery('');
    setAssignmentRole('member');
    setAssignmentTitle('');
    void loadDetail(ministry);
  };

  const createMinistry = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiClient.createMinistry({ name: newName.trim(), category: newCategory.trim() || undefined });
      setNewName('');
      setNewCategory('');
      toast.success('Ministry created');
      await loadData();
    } catch (error) {
      console.error('Failed to create ministry:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to create ministry');
    } finally {
      setCreating(false);
    }
  };

  const addMember = async (memberId: string) => {
    if (!selected) return;
    setBusyMemberId(memberId);
    try {
      await apiClient.assignMinistryWorkforceMember(selected.id, { workforceMemberId: memberId, role: assignmentRole, title: assignmentTitle.trim() || undefined });
      toast.success('Workforce member assigned');
      setMemberQuery('');
      await loadDetail(selected);
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to add member (already in ministry?)');
    } finally {
      setBusyMemberId(null);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selected) return;
    setBusyMemberId(memberId);
    try {
      await apiClient.removeMinistryWorkforceMember(selected.id, memberId);
      toast.success('Workforce member removed');
      await loadDetail(selected);
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to remove member');
    } finally {
      setBusyMemberId(null);
    }
  };

  const updateAssignmentRole = async (assignment: MinistryWorkforceAssignment, role: MinistryWorkforceRole) => {
    if (!selected || role === assignment.role) return;
    setBusyMemberId(assignment.workforceMemberId);
    try {
      await apiClient.updateMinistryWorkforceAssignment(selected.id, assignment.workforceMemberId, { role, title: assignment.title });
      toast.success('Ministry role updated');
      await loadDetail(selected);
    } catch (error) {
      console.error('Failed to update ministry role:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to update ministry role');
    } finally { setBusyMemberId(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.deleteMinistry(deleteTarget.id);
      toast.success('Ministry deleted');
      setDeleteTarget(null);
      setSelected(null);
      await loadData();
    } catch (error) {
      console.error('Failed to delete ministry:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to delete ministry');
    } finally {
      setDeleting(false);
    }
  };

  const matchingMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return [];
    const assignments = structure ? [...structure.heads, ...structure.deputyHeads, ...structure.coordinators, ...structure.members] : [];
    const existingIds = new Set(assignments.map((m) => m.workforceMemberId));
    return workforce
      .filter((m) => !existingIds.has(m.id) && `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [memberQuery, workforce, structure]);

  const assignments = useMemo(() => structure ? [...structure.heads, ...structure.deputyHeads, ...structure.coordinators, ...structure.members] : [], [structure]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Ministries"
        subtitle="Ministry teams, leaders, and membership."
        actions={
          <Button variant="outline" icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />} onClick={() => void loadData()} loading={loading}>
            Refresh
          </Button>
        }
      />

      {loadError ? <SectionCard title="Authoritative data unavailable" subtitle="Ministry and workforce records could not be loaded."><p className="text-sm font-semibold text-[var(--color-danger-text)]">No placeholder counts or inferred assignments are being displayed.</p></SectionCard> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active ministries" value={loadError ? 'Unavailable' : ministries.filter((m) => m.is_active).length} icon={<HeartHandshake className="h-5 w-5" />} />
        <StatCard label="Total ministries" value={loadError ? 'Unavailable' : ministries.length} icon={<Tag className="h-5 w-5" />} tone="info" />
        <StatCard label="Workforce profiles" value={loadError ? 'Unavailable' : workforce.length} icon={<UserPlus className="h-5 w-5" />} tone="success" />
      </section>

      <SectionCard
        title="Ministries"
        subtitle="Click a ministry to manage its members."
        icon={<HeartHandshake className="h-5 w-5" />}
        actions={
          <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ministry name" />
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category (optional)" />
            <Button size="sm" icon={<Plus className="h-4 w-4" />} loading={creating} onClick={() => void createMinistry()}>Add ministry</Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center text-sm font-bold text-[var(--color-text-tertiary)]">Loading ministries...</div>
        ) : ministries.length === 0 ? (
          <EmptyState icon={<HeartHandshake className="h-6 w-6" />} title="No ministries yet" description="Add your first ministry above." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ministries.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => openMinistry(m)}
                className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 text-left transition hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-bold text-[var(--color-text-primary)]">{m.name}</h3>
                  <Badge variant={m.is_active ? 'success' : 'secondary'}>{m.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                {m.category ? <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-tertiary)]"><Tag className="h-3.5 w-3.5" />{m.category}</p> : null}
                {m.description ? <p className="mt-2 line-clamp-2 text-xs text-[var(--color-text-tertiary)]">{m.description}</p> : null}
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[var(--color-text-primary)]/50 backdrop-blur-sm">
          <button type="button" aria-label="Close ministry" className="absolute inset-0 cursor-default" onClick={() => setSelected(null)} />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Ministry</p>
                <h2 className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">{selected.name}</h2>
              </div>
              <button type="button" className="rounded-2xl border border-[var(--color-border-secondary)] p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]" onClick={() => setSelected(null)} aria-label="Close ministry">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Ministry workforce ({structure?.total ?? 0})</p>
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <Select aria-label="Ministry role" value={assignmentRole} onChange={(event) => setAssignmentRole(event.target.value as MinistryWorkforceRole)}><option value="head">Department head</option><option value="deputy_head">Deputy head</option><option value="coordinator">Coordinator</option><option value="member">Team member</option></Select>
                  <Input value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} placeholder="Ministry title (optional)" />
                </div>
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
                ) : assignments.length === 0 ? (
                  <EmptyState icon={<Users className="h-6 w-6" />} title="No workforce assigned" description="Search the authoritative workforce directory above and assign the ministry structure." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {assignments.map((assignment) => <WorkforceIdentityCard key={assignment.id} assignment={assignment} busy={busyMemberId === assignment.workforceMemberId} onRemove={() => void removeMember(assignment.workforceMemberId)} onRoleChange={(role) => void updateAssignmentRole(assignment, role)} />)}
                  </div>
                )}
              </div>

              <div className="flex justify-end border-t border-[var(--color-border-secondary)] pt-5">
                <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteTarget(selected)}>
                  Delete ministry
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
        title="Delete ministry"
        description={`This permanently deletes ${deleteTarget?.name || 'this ministry'}. This cannot be undone.`}
        verifyText="DELETE"
        confirmText="Delete ministry"
        variant="danger"
        loading={deleting}
      />
    </main>
  );
}

export default withAuth(MinistriesPage, { requiredRole: 'admin' });
