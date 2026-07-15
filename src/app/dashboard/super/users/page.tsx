'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import { apiClient } from '@/lib/api';
import { useAuthContext } from '@/providers/AuthProviders';
import { withAuth } from '@/providers/withAuth';
import type { AdminUserAdmin, AdminUserRole } from '@/lib/types';

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
}

const emptyForm = { firstName: '', lastName: '', email: '', password: '', role: 'admin' as AdminUserRole };

function AdminUsersPage() {
  const { user: currentUser } = useAuthContext();
  const [users, setUsers] = useState<AdminUserAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.listAdminUsers();
      setUsers(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error('Failed to load admin users:', error);
      toast.error('Unable to load admin users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const stats = useMemo(() => ({
    total: users.length,
    pendingApproval: users.filter((u) => u.role === 'admin' && !u.admin_approved).length,
    superAdmins: users.filter((u) => u.role === 'super_admin').length,
  }), [users]);

  const createUser = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || form.password.length < 8) {
      toast.error('Fill in all fields — password needs at least 8 characters');
      return;
    }
    setCreating(true);
    try {
      const { message } = await apiClient.createAdminUser({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      toast.success(message);
      setForm(emptyForm);
      setShowCreate(false);
      await loadUsers();
    } catch (error) {
      console.error('Failed to create admin user:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to create user');
    } finally {
      setCreating(false);
    }
  };

  const approveUser = async (id: string) => {
    setBusyId(id);
    try {
      await apiClient.approveAdminUser(id);
      toast.success('User approved');
      await loadUsers();
    } catch (error) {
      console.error('Failed to approve user:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to approve user');
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (target: AdminUserAdmin) => {
    if (target.id === currentUser?.id) {
      toast.error('You cannot deactivate your own account');
      return;
    }
    setBusyId(target.id);
    try {
      await apiClient.updateAdminUser(target.id, { is_active: !target.is_active });
      toast.success(target.is_active ? 'User deactivated' : 'User reactivated');
      await loadUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to update user');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.deleteAdminUser(deleteTarget.id);
      toast.success('User deleted');
      setDeleteTarget(null);
      await loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<AdminUserAdmin>[] = [
    { key: 'name', header: 'Name', render: (row) => <span className="font-black text-[var(--color-text-primary)]">{row.first_name} {row.last_name}</span> },
    { key: 'email', header: 'Email', render: (row) => <span className="text-[var(--color-text-secondary)]">{row.email}</span> },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Badge variant={row.role === 'super_admin' ? 'info' : 'outline'}>
          {row.role === 'super_admin' ? 'Super Admin' : 'Admin'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        if (row.role === 'admin' && !row.admin_approved) {
          return <Badge variant="warning">Pending approval</Badge>;
        }
        return <Badge variant={row.is_active ? 'success' : 'secondary'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>;
      },
    },
    { key: 'lastLogin', header: 'Last login', render: (row) => <span className="text-xs text-[var(--color-text-tertiary)]">{formatDate(row.last_login_at)}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.role === 'admin' && !row.admin_approved ? (
            <Button size="sm" variant="outline" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={busyId === row.id} onClick={(e) => { e.stopPropagation(); void approveUser(row.id); }}>
              Approve
            </Button>
          ) : (
            <Button size="sm" variant="outline" loading={busyId === row.id} onClick={(e) => { e.stopPropagation(); void toggleActive(row); }} disabled={row.id === currentUser?.id}>
              {row.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
          )}
          <button
            type="button"
            disabled={row.id === currentUser?.id}
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
            className="rounded-xl p-2 text-[var(--color-text-tertiary)] transition hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Delete user"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <main className="space-y-6">
      <PageHeader
        title="Admin Users"
        subtitle="Who has access to this portal, and at what level."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />} onClick={() => void loadUsers()} loading={loading}>
              Refresh
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate((v) => !v)}>New admin</Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total admin accounts" value={stats.total} icon={<UserCog className="h-5 w-5" />} />
        <StatCard label="Pending approval" value={stats.pendingApproval} icon={<ShieldAlert className="h-5 w-5" />} tone={stats.pendingApproval > 0 ? 'warning' : 'default'} />
        <StatCard label="Super admins" value={stats.superAdmins} icon={<Shield className="h-5 w-5" />} tone="info" />
      </section>

      {showCreate ? (
        <SectionCard title="Create admin account" icon={<Plus className="h-5 w-5" />} actions={<button type="button" onClick={() => setShowCreate(false)} aria-label="Close" className="rounded-xl p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-secondary)]"><X className="h-4 w-4" /></button>}>
          <p className="mb-4 text-xs font-semibold text-[var(--color-text-tertiary)]">
            Admin-role accounts require a super-admin to approve before they can sign in. Super-admin accounts activate immediately.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="First name" />
            <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last name" />
            <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" />
            <Input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Temporary password (min 8 characters)" type="password" />
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AdminUserRole }))}
              className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-bold text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-border-focus)] sm:col-span-2"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div className="mt-4 flex justify-end">
            <Button loading={creating} onClick={() => void createUser()}>Create account</Button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="All admin accounts" icon={<UserCog className="h-5 w-5" />}>
        <Table
          columns={columns}
          data={users}
          rowKey={(row) => row.id}
          loading={loading}
          emptyTitle="No admin accounts found"
        />
      </SectionCard>

      <VerifyActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete admin account"
        description={`This permanently removes ${deleteTarget ? `${deleteTarget.first_name} ${deleteTarget.last_name}` : 'this account'}'s access. This cannot be undone.`}
        verifyText="DELETE"
        confirmText="Delete account"
        variant="danger"
        loading={deleting}
      />
    </main>
  );
}

export default withAuth(AdminUsersPage, { requiredRole: 'super_admin' });
