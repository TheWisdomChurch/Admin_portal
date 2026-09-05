'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, ClipboardCopy, MessageSquareText, Pencil, RefreshCcw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Checkbox } from '@/ui/Checkbox';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import { useAuthContext } from '@/providers/AuthProviders';
import { withAuth } from '@/providers/withAuth';
import type { AdminForm, Testimonial } from '@/lib/types';

function normalizeRole(role?: string | null): string {
  return (role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
}

function formatName(item: Testimonial): string {
  const name = item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim();
  return name || 'Anonymous testimony';
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function isTestimonialForm(form: AdminForm): boolean {
  const settings = form.settings || {};
  const target = String(settings.submissionTarget || '').trim().toLowerCase();
  const formType = String(settings.formType || '').trim().toLowerCase();
  const slug = String(form.slug || '').trim().toLowerCase();
  const title = String(form.title || '').trim().toLowerCase();

  return (
    target === 'testimonial' ||
    formType === 'testimonial' ||
    slug.includes('testimonial') ||
    slug.includes('testimony') ||
    title.includes('testimonial') ||
    title.includes('testimony')
  );
}

function TestimonialCard({
  item,
  status,
  canApprove,
  isSuperAdmin,
  approving,
  onApprove,
  onEdit,
  onDelete,
}: {
  item: Testimonial;
  status: 'pending' | 'approved';
  canApprove: boolean;
  isSuperAdmin: boolean;
  approving: boolean;
  onApprove: (item: Testimonial) => void;
  onEdit: (item: Testimonial) => void;
  onDelete: (item: Testimonial) => void;
}) {
  return (
    <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[var(--color-background-tertiary)]">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={formatName(item)} fill sizes="96px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MessageSquareText className="h-8 w-8 text-[var(--color-text-tertiary)]" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-[var(--color-text-primary)]">{formatName(item)}</h3>
            <Badge variant={status === 'approved' ? 'success' : 'warning'}>
              {status === 'approved' ? 'Live' : 'Pending'}
            </Badge>
            {item.isAnonymous && <Badge variant="secondary">Anonymous</Badge>}
          </div>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--color-text-secondary)]">{item.testimony}</p>
          <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">Submitted {formatDate(item.createdAt)}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-end">
          {status === 'pending' && canApprove ? (
            <Button type="button" size="sm" onClick={() => onApprove(item)} loading={approving} disabled={approving}>
              <CheckCircle2 className="h-4 w-4" />
              <span className="ml-2">Approve</span>
            </Button>
          ) : status === 'pending' ? (
            <Badge variant="warning">Awaiting super admin</Badge>
          ) : (
            <Badge variant="success">Live</Badge>
          )}

          <Button type="button" size="sm" variant="outline" onClick={() => onEdit(item)}>
            <Pencil className="h-4 w-4" />
            <span className="ml-2">Edit</span>
          </Button>

          <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(item)}>
            <Trash2 className="h-4 w-4" />
            <span className="ml-2">{isSuperAdmin ? 'Delete' : 'Request removal'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function TestimonialsPage() {
  const auth = useAuthContext();
  const isSuperAdmin = normalizeRole(auth.user?.role) === 'super_admin';
  const canApprove = isSuperAdmin;

  const [loading, setLoading] = useState(true);
  const [formsLoading, setFormsLoading] = useState(true);
  const [pending, setPending] = useState<Testimonial[]>([]);
  const [approved, setApproved] = useState<Testimonial[]>([]);
  const [testimonialForms, setTestimonialForms] = useState<AdminForm[]>([]);
  const [search, setSearch] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<Testimonial | null>(null);

  const [editTarget, setEditTarget] = useState<Testimonial | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', testimony: '', isAnonymous: false });
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Testimonial | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadTestimonials = useCallback(async () => {
    try {
      setLoading(true);
      const [pendingRes, approvedRes] = await Promise.all([
        apiClient.getAllTestimonials({ approved: false }),
        apiClient.getAllTestimonials({ approved: true }),
      ]);
      setPending(Array.isArray(pendingRes) ? pendingRes : []);
      setApproved(Array.isArray(approvedRes) ? approvedRes : []);
    } catch (error) {
      console.error('Failed to load testimonials:', error);
      toast.error('Failed to load testimonials');
      setPending([]);
      setApproved([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadForms = useCallback(async () => {
    try {
      setFormsLoading(true);
      const res = await apiClient.getAdminForms({ page: 1, limit: 100 });
      const forms = Array.isArray(res.data) ? res.data : [];
      setTestimonialForms(forms.filter(isTestimonialForm));
    } catch (error) {
      console.error('Failed to load testimonial forms:', error);
      setTestimonialForms([]);
    } finally {
      setFormsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTestimonials();
    void loadForms();
  }, [loadForms, loadTestimonials]);

  const query = search.trim().toLowerCase();
  const filteredPending = useMemo(
    () => pending.filter((item) => `${formatName(item)} ${item.testimony}`.toLowerCase().includes(query)),
    [pending, query]
  );
  const filteredApproved = useMemo(
    () => approved.filter((item) => `${formatName(item)} ${item.testimony}`.toLowerCase().includes(query)),
    [approved, query]
  );

  const currentMonthTotals = useMemo(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return [...pending, ...approved].reduce(
      (acc, item) => {
        const created = item.createdAt ? new Date(item.createdAt) : null;
        if (!created || Number.isNaN(created.getTime())) return acc;
        const createdKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        if (createdKey !== key) return acc;
        acc.total += 1;
        if (item.isApproved) acc.approved += 1;
        else acc.pending += 1;
        return acc;
      },
      { total: 0, approved: 0, pending: 0 }
    );
  }, [approved, pending]);

  const copyPublicFormLink = async (form: AdminForm) => {
    const url = buildPublicFormUrl(form.slug, form.publicUrl);
    if (!url) {
      toast.error('Publish this form before copying its public link.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Testimonial form link copied');
    } catch {
      toast.error('Unable to copy form link');
    }
  };

  const approveSelected = async () => {
    if (!approveTarget || !canApprove) return;
    const id = String(approveTarget.id);
    try {
      setApprovingId(id);
      await apiClient.approveTestimonial(id);
      toast.success('Testimonial approved');
      setApproveTarget(null);
      await loadTestimonials();
    } catch (error) {
      console.error('Failed to approve testimonial:', error);
      toast.error('Failed to approve testimonial');
    } finally {
      setApprovingId(null);
    }
  };

  const openEdit = (item: Testimonial) => {
    setEditTarget(item);
    setEditForm({
      firstName: item.firstName || '',
      lastName: item.lastName || '',
      testimony: item.testimony || '',
      isAnonymous: Boolean(item.isAnonymous),
    });
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.testimony.trim()) {
      toast.error('First name, last name and testimony are required.');
      return;
    }
    try {
      setSavingEdit(true);
      await apiClient.updateTestimonial(String(editTarget.id), {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        testimony: editForm.testimony.trim(),
        isAnonymous: editForm.isAnonymous,
      });
      toast.success('Testimonial updated');
      setEditTarget(null);
      await loadTestimonials();
    } catch (error) {
      console.error('Failed to update testimonial:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update testimonial');
    } finally {
      setSavingEdit(false);
    }
  };

  const openDelete = (item: Testimonial) => {
    setDeleteTarget(item);
    setDeleteReason('');
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    if (!isSuperAdmin && !deleteReason.trim()) {
      toast.error('A reason is required so the super admin can review this removal.');
      return;
    }
    try {
      setDeleting(true);
      const result = await apiClient.deleteTestimonial(String(deleteTarget.id), deleteReason.trim());
      if (result && typeof result === 'object' && 'deleted' in result) {
        toast.success('Testimonial removed');
      } else {
        toast.success('Removal request sent for super admin approval');
      }
      setDeleteTarget(null);
      await loadTestimonials();
    } catch (error) {
      console.error('Failed to remove testimonial:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove testimonial');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Testimonials"
        subtitle="Review, approve and publish testimonies from public forms and direct submissions."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void loadTestimonials()} loading={loading}>
            <RefreshCcw className="h-4 w-4" />
            <span className="ml-2">Refresh</span>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">Pending review</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-warning-text)]">{pending.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">Live</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-success-text)]">{approved.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">This month</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{currentMonthTotals.total}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">Authority</p>
          <div className="mt-3">
            <Badge variant={canApprove ? 'success' : 'warning'} className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              {canApprove ? 'Can approve' : 'Read only'}
            </Badge>
          </div>
        </Card>
      </div>

      <Card title="Testimonial collection forms">
        {formsLoading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading testimonial forms...</p>
        ) : testimonialForms.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">No testimonial forms found yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {testimonialForms.map((form) => (
              <div key={form.id} className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
                <p className="font-semibold text-[var(--color-text-primary)]">{form.title}</p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">/{form.slug || 'unpublished'}</p>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void copyPublicFormLink(form)}>
                  <ClipboardCopy className="h-4 w-4" />
                  <span className="ml-2">Copy link</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Review queue</h2>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Super admin approval publishes testimonials to the public website.</p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" placeholder="Search testimonials..." />
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-text-primary)]">Pending</h3>
              <Badge variant="warning">{filteredPending.length}</Badge>
            </div>
            {loading ? (
              <p className="rounded-2xl border border-dashed border-[var(--color-border-secondary)] p-6 text-center text-sm text-[var(--color-text-tertiary)]">Loading pending testimonials...</p>
            ) : filteredPending.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--color-border-secondary)] p-6 text-center text-sm text-[var(--color-text-tertiary)]">No pending testimonials.</p>
            ) : (
              filteredPending.map((item) => (
                <TestimonialCard
                  key={item.id}
                  item={item}
                  status="pending"
                  canApprove={canApprove}
                  isSuperAdmin={isSuperAdmin}
                  approving={approvingId === String(item.id)}
                  onApprove={setApproveTarget}
                  onEdit={openEdit}
                  onDelete={openDelete}
                />
              ))
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-text-primary)]">Live</h3>
              <Badge variant="success">{filteredApproved.length}</Badge>
            </div>
            {loading ? (
              <p className="rounded-2xl border border-dashed border-[var(--color-border-secondary)] p-6 text-center text-sm text-[var(--color-text-tertiary)]">Loading published testimonials...</p>
            ) : filteredApproved.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--color-border-secondary)] p-6 text-center text-sm text-[var(--color-text-tertiary)]">No published testimonials.</p>
            ) : (
              filteredApproved.map((item) => (
                <TestimonialCard
                  key={item.id}
                  item={item}
                  status="approved"
                  canApprove={canApprove}
                  isSuperAdmin={isSuperAdmin}
                  approving={false}
                  onApprove={setApproveTarget}
                  onEdit={openEdit}
                  onDelete={openDelete}
                />
              ))
            )}
          </div>
        </div>
      </Card>

      <VerifyActionModal
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => void approveSelected()}
        title="Approve testimonial"
        description={`This will publish ${approveTarget ? formatName(approveTarget) : 'this testimonial'} to the public testimonials area.`}
        verifyText={approveTarget ? formatName(approveTarget) : ''}
        confirmText="Approve testimonial"
        variant="primary"
        loading={Boolean(approvingId)}
      />

      <Modal open={Boolean(editTarget)} onClose={() => setEditTarget(null)} size="lg">
        <div className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Edit testimonial</h2>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
              {editTarget?.isApproved
                ? 'This testimonial is live — changes publish to the public site immediately.'
                : 'Update the details before this testimonial is approved.'}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              value={editForm.firstName}
              onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <Input
              label="Last name"
              value={editForm.lastName}
              onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Testimony</label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-4 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={6}
              value={editForm.testimony}
              onChange={(e) => setEditForm((f) => ({ ...f, testimony: e.target.value }))}
            />
          </div>
          <Checkbox
            label="Publish anonymously"
            checked={editForm.isAnonymous}
            onChange={(e) => setEditForm((f) => ({ ...f, isAnonymous: e.target.checked }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitEdit()} loading={savingEdit}>
              Save changes
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} size="md">
        <div className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {isSuperAdmin ? 'Delete testimonial' : 'Request testimonial removal'}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
              {isSuperAdmin
                ? `${deleteTarget ? formatName(deleteTarget) : 'This testimonial'} will be permanently removed${deleteTarget?.isApproved ? ' from the public site' : ''}.`
                : 'A super admin must approve this removal before the testimonial is taken down.'}
            </p>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Reason {isSuperAdmin ? '(optional)' : '(required)'}
            </label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-4 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={3}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Why should this testimonial be removed?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void submitDelete()}
              loading={deleting}
              disabled={!isSuperAdmin && !deleteReason.trim()}
            >
              {isSuperAdmin ? 'Delete testimonial' : 'Send removal request'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default withAuth(TestimonialsPage, { requiredRole: 'admin' });
