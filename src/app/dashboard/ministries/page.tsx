'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HeartHandshake,
  Plus,
  RefreshCw,
  Search,
  Tag,
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
import type { MinistryAdmin, MinistryMemberAdmin, Member } from '@/lib/types';

function MinistriesPage() {
  const [ministries, setMinistries] = useState<MinistryAdmin[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<MinistryAdmin | null>(null);
  const [ministryMembers, setMinistryMembers] = useState<MinistryMemberAdmin[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MinistryAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ministriesRes, membersRes] = await Promise.all([
        apiClient.listMinistries({ page: 1, limit: 100 }),
        apiClient.listMembers({ page: 1, limit: 300 }),
      ]);
      setMinistries(Array.isArray(ministriesRes.data) ? ministriesRes.data : []);
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
    } catch (error) {
      console.error('Failed to load ministries:', error);
      toast.error('Unable to load ministries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const memberName = useCallback((id: string) => {
    const m = members.find((mm) => mm.id === id);
    return m ? `${m.firstName} ${m.lastName}` : id;
  }, [members]);

  const loadDetail = useCallback(async (ministry: MinistryAdmin) => {
    setDetailLoading(true);
    try {
      const list = await apiClient.listMinistryMembers(ministry.id);
      setMinistryMembers(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to load ministry members:', error);
      toast.error('Unable to load ministry members');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openMinistry = (ministry: MinistryAdmin) => {
    setSelected(ministry);
    setMemberQuery('');
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
      await apiClient.addMinistryMember(selected.id, memberId);
      toast.success('Member added');
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
      await apiClient.removeMinistryMember(selected.id, memberId);
      toast.success('Member removed');
      await loadDetail(selected);
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to remove member');
    } finally {
      setBusyMemberId(null);
    }
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
    const existingIds = new Set(ministryMembers.map((m) => m.member_id));
    return members
      .filter((m) => !existingIds.has(m.id) && `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [memberQuery, members, ministryMembers]);

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

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active ministries" value={ministries.filter((m) => m.is_active).length} icon={<HeartHandshake className="h-5 w-5" />} />
        <StatCard label="Total ministries" value={ministries.length} icon={<Tag className="h-5 w-5" />} tone="info" />
        <StatCard label="Members tracked" value={members.length} icon={<UserPlus className="h-5 w-5" />} tone="success" />
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
                  <h3 className="truncate text-sm font-black text-[var(--color-text-primary)]">{m.name}</h3>
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
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Ministry</p>
                <h2 className="mt-1 text-lg font-black text-[var(--color-text-primary)]">{selected.name}</h2>
              </div>
              <button type="button" className="rounded-2xl border border-[var(--color-border-secondary)] p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]" onClick={() => setSelected(null)} aria-label="Close ministry">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Members ({ministryMembers.length})</p>
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
                ) : ministryMembers.length === 0 ? (
                  <EmptyState icon={<Users className="h-6 w-6" />} title="No members yet" />
                ) : (
                  <div className="space-y-2">
                    {ministryMembers.map((mm) => (
                      <div key={mm.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
                        <div>
                          <p className="text-sm font-black text-[var(--color-text-primary)]">{memberName(mm.member_id)}</p>
                          <Badge variant="outline">{mm.role}</Badge>
                        </div>
                        <button
                          type="button"
                          disabled={busyMemberId === mm.member_id}
                          onClick={() => void removeMember(mm.member_id)}
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
