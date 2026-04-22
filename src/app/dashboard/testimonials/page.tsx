// src/app/dashboard/testimonials/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { MessageSquareText, UserPlus, CheckCircle2, Clock, Pencil, Trash2, Copy, Link2 } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/input';
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import { GridLayout, PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import { useAuthContext } from '@/providers/AuthProviders';
import type { AdminForm, Testimonial } from '@/lib/types';

const formatName = (t: Testimonial) => {
  if (t.fullName) return t.fullName;
  const first = t.firstName || '';
  const last = t.lastName || '';
  const name = `${first} ${last}`.trim();
  return name || 'Anonymous';
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const isSuperAdminRole = (role?: string) => {
  if (!role) return false;
  const normalized = role.toLowerCase().replace(/[-\s]/g, '_');
  return normalized === 'super_admin';
};

const isTestimonialForm = (form: AdminForm): boolean => {
  const target = (form.settings?.submissionTarget || '').trim().toLowerCase();
  if (target === 'testimonial') return true;

  const formType = (form.settings?.formType || '').trim().toLowerCase();
  if (formType === 'testimonial') return true;

  const slug = (form.slug || '').trim().toLowerCase();
  const title = (form.title || '').trim().toLowerCase();
  return (
    slug.includes('testimony') ||
    slug.includes('testimonial') ||
    title.includes('testimony') ||
    title.includes('testimonial')
  );
};

type TestimonialTableProps = {
  title: string;
  items: Testimonial[];
  status: 'pending' | 'approved';
  loading?: boolean;
  canApprove: boolean;
  onApprove?: (id: string) => void;
  approvingId?: string | null;
  onEdit?: (item: Testimonial) => void;
  onDelete?: (item: Testimonial) => void;
};

function TestimonialTable({
  title,
  items,
  status,
  loading,
  canApprove,
  onApprove,
  approvingId,
  onEdit,
  onDelete,
}: TestimonialTableProps) {
  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-[var(--color-text-tertiary)]">
            <tr>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Testimony</th>
              <th className="py-2 pr-4">Submitted</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[var(--color-text-tertiary)]">
                  Loading testimonials...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[var(--color-text-tertiary)]">
                  No testimonials found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={String(item.id)} className="border-t border-[var(--color-border-secondary)]">
                  <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                    {formatName(item)}
                  </td>
                  <td className="py-3 pr-4 text-[var(--color-text-secondary)] line-clamp-2">
                    {item.testimony}
                  </td>
                  <td className="py-3 pr-4 text-[var(--color-text-tertiary)]">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={status === 'approved' ? 'success' : 'warning'}>
                      {status === 'approved' ? 'Published' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    {status === 'pending' ? (
                      canApprove ? (
                        <Button
                          size="sm"
                          onClick={() => onApprove?.(String(item.id))}
                          variant="primary"
                          loading={approvingId === String(item.id)}
                          disabled={approvingId === String(item.id)}
                        >
                          Approve
                        </Button>
                      ) : (
                        <span className="text-xs text-[var(--color-text-tertiary)]">Awaiting approval</span>
                      )
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEdit?.(item)}
                          icon={<Pencil className="h-4 w-4" />}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => onDelete?.(item)}
                          icon={<Trash2 className="h-4 w-4" />}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function TestimonialsPage() {
  const router = useRouter();
  const auth = useAuthContext();
  const canApprove = useMemo(() => isSuperAdminRole(auth.user?.role), [auth.user?.role]);

  const [pending, setPending] = useState<Testimonial[]>([]);
  const [approved, setApproved] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveLoading, setApproveLoading] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Testimonial | null>(null);
  const [editDraft, setEditDraft] = useState({
    firstName: '',
    lastName: '',
    testimony: '',
    imageUrl: '',
    isAnonymous: false,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Testimonial | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [testimonialForms, setTestimonialForms] = useState<AdminForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [deleteFormTarget, setDeleteFormTarget] = useState<AdminForm | null>(null);
  const [deleteFormLoading, setDeleteFormLoading] = useState(false);

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

  useEffect(() => {
    loadTestimonials();
  }, [loadTestimonials]);

  const loadTestimonialForms = useCallback(async () => {
    try {
      setFormsLoading(true);
      const res = await apiClient.getAdminForms({ page: 1, limit: 250 });
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
    loadTestimonialForms();
  }, [loadTestimonialForms]);

  const monthlySummary = useMemo(() => {
    const bucket = new Map<string, { month: string; total: number; approved: number; pending: number }>();
    const all = [...approved, ...pending];
    all.forEach((item) => {
      const dt = item.createdAt ? new Date(item.createdAt) : null;
      if (!dt || Number.isNaN(dt.getTime())) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const month = dt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      const existing = bucket.get(key) || { month, total: 0, approved: 0, pending: 0 };
      existing.total += 1;
      if (item.isApproved) existing.approved += 1;
      else existing.pending += 1;
      bucket.set(key, existing);
    });

    return Array.from(bucket.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([, value]) => value);
  }, [approved, pending]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const currentMonthTotals = useMemo(() => {
    const all = [...approved, ...pending];
    return all.reduce(
      (acc, item) => {
        const dt = item.createdAt ? new Date(item.createdAt) : null;
        if (!dt || Number.isNaN(dt.getTime())) return acc;
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        if (key !== currentMonthKey) return acc;
        acc.total += 1;
        if (item.isApproved) acc.approved += 1;
        else acc.pending += 1;
        return acc;
      },
      { total: 0, approved: 0, pending: 0 }
    );
  }, [approved, currentMonthKey, pending]);

  const copyPublicFormLink = async (form: AdminForm) => {
    const url = buildPublicFormUrl(form.slug, form.publicUrl);
    if (!url) {
      toast.error('Form link not available yet. Publish the form first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Testimonial form link copied');
    } catch {
      toast.error('Unable to copy form link');
    }
  };

  const handleApprove = async (id: string) => {
    if (!canApprove) return;
    try {
      setApproveLoading(id);
      await apiClient.approveTestimonial(id);
      toast.success('Testimonial approved');
      await loadTestimonials();
    } catch (error) {
      console.error('Failed to approve testimonial:', error);
      toast.error('Failed to approve testimonial');
    } finally {
      setApproveLoading(null);
    }
  };

  const openEdit = (item: Testimonial) => {
    setEditTarget(item);
    setEditDraft({
      firstName: item.firstName || '',
      lastName: item.lastName || '',
      testimony: item.testimony || '',
      imageUrl: item.imageUrl || '',
      isAnonymous: Boolean(item.isAnonymous),
    });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    try {
      setEditSaving(true);
      await apiClient.updateTestimonial(editTarget.id, {
        firstName: editDraft.firstName.trim() || undefined,
        lastName: editDraft.lastName.trim() || undefined,
        testimony: editDraft.testimony.trim() || undefined,
        imageUrl: editDraft.imageUrl.trim() || undefined,
        isAnonymous: editDraft.isAnonymous,
      });
      toast.success('Testimonial updated');
      setEditTarget(null);
      await loadTestimonials();
    } catch (error) {
      console.error('Failed to update testimonial:', error);
      toast.error('Failed to update testimonial');
    } finally {
      setEditSaving(false);
    }
  };

  const requestDelete = (item: Testimonial) => {
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await apiClient.deleteTestimonial(deleteTarget.id);
      toast.success('Testimonial deleted');
      setDeleteTarget(null);
      await loadTestimonials();
    } catch (error) {
      console.error('Failed to delete testimonial:', error);
      toast.error('Failed to delete testimonial');
    } finally {
      setDeleteLoading(false);
    }
  };

  const requestDeleteForm = (form: AdminForm) => {
    setDeleteFormTarget(form);
  };

  const confirmDeleteForm = async () => {
    if (!deleteFormTarget) return;
    try {
      setDeleteFormLoading(true);
      await apiClient.deleteAdminForm(deleteFormTarget.id);
      toast.success('Testimonial form deleted');
      setDeleteFormTarget(null);
      await loadTestimonialForms();
    } catch (error) {
      console.error('Failed to delete testimonial form:', error);
      toast.error('Failed to delete testimonial form');
    } finally {
      setDeleteFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Testimonials"
        subtitle="Review submissions, approve highlights, and publish them to the website."
        actions={
          <div className="flex items-center gap-2">
            <Button
              icon={<UserPlus className="h-4 w-4" />}
              onClick={() => router.push('/dashboard/forms/new?preset=testimonial')}
            >
              Create Testimony Form
            </Button>
          </div>
        }
      />

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-tertiary)]">
            <div className="h-10 w-10 rounded-[var(--radius-button)] bg-[var(--color-background-tertiary)] flex items-center justify-center">
              <MessageSquareText className="h-5 w-5 text-[var(--color-text-secondary)]" />
            </div>
            <div>
              <p className="text-[var(--color-text-secondary)] font-semibold">Stories from the community</p>
              <p className="text-xs">Pending items require super-admin approval.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {approved.length} Published
            </Badge>
            <Badge variant="warning" className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {pending.length} Pending
            </Badge>
          </div>
        </div>
      </Card>

      <GridLayout columns="grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">This month</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{currentMonthTotals.total}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Total testimonies received</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">This month approved</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{currentMonthTotals.approved}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Published testimonies</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">This month pending</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{currentMonthTotals.pending}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Awaiting super-admin approval</p>
        </Card>
      </GridLayout>

      <Card title="Testimonial Form Links">
        {formsLoading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading forms...</p>
        ) : testimonialForms.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-tertiary)]">
              No testimonial form has been created yet.
            </p>
            <Button
              icon={<UserPlus className="h-4 w-4" />}
              onClick={() => router.push('/dashboard/forms/new?preset=testimonial')}
            >
              Create testimonial form
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {testimonialForms.map((form) => {
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
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Pencil className="h-4 w-4" />}
                      onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Link2 className="h-4 w-4" />}
                      disabled={!url}
                      onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Copy className="h-4 w-4" />}
                      disabled={!url}
                      onClick={() => copyPublicFormLink(form)}
                    >
                      Copy Link
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => requestDeleteForm(form)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Monthly Intake">
        {monthlySummary.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">No monthly data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[var(--color-text-tertiary)]">
                <tr>
                  <th className="py-2 pr-4">Month</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Approved</th>
                  <th className="py-2 pr-4">Pending</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((row) => (
                  <tr key={row.month} className="border-t border-[var(--color-border-secondary)]">
                    <td className="py-2 pr-4 text-[var(--color-text-primary)]">{row.month}</td>
                    <td className="py-2 pr-4">{row.total}</td>
                    <td className="py-2 pr-4">{row.approved}</td>
                    <td className="py-2 pr-4">{row.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <GridLayout columns="grid-cols-1 gap-6">
        <TestimonialTable
          title="Pending approvals"
          items={pending}
          status="pending"
          loading={loading}
          canApprove={canApprove}
          onApprove={handleApprove}
          approvingId={approveLoading}
        />
        <TestimonialTable
          title="Published testimonials"
          items={approved}
          status="approved"
          loading={loading}
          canApprove={false}
          onEdit={openEdit}
          onDelete={requestDelete}
        />
      </GridLayout>

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
          <div className="w-full max-w-xl rounded-[var(--radius-card)] bg-[var(--color-background-primary)] p-6 shadow-xl border border-[var(--color-border-secondary)]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Edit testimonial</h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">Update and republish instantly.</p>
              </div>
              <button
                onClick={() => setEditTarget(null)}
                aria-label="Close"
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="First name"
                  value={editDraft.firstName}
                  onChange={(e) => setEditDraft({ ...editDraft, firstName: e.target.value })}
                />
                <Input
                  label="Last name"
                  value={editDraft.lastName}
                  onChange={(e) => setEditDraft({ ...editDraft, lastName: e.target.value })}
                />
              </div>
              <Input
                label="Image URL (optional)"
                value={editDraft.imageUrl}
                onChange={(e) => setEditDraft({ ...editDraft, imageUrl: e.target.value })}
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Testimony</label>
                <textarea
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                  rows={4}
                  value={editDraft.testimony}
                  onChange={(e) => setEditDraft({ ...editDraft, testimony: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={editDraft.isAnonymous}
                  onChange={(e) => setEditDraft({ ...editDraft, isAnonymous: e.target.checked })}
                />
                Anonymous testimonial
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button onClick={saveEdit} loading={editSaving}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}

      <VerifyActionModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Testimonial"
        description="This action permanently removes the testimonial from the site."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleteLoading}
        verifyText={deleteTarget ? `DELETE ${formatName(deleteTarget)}` : 'DELETE'}
      />

      <VerifyActionModal
        isOpen={!!deleteFormTarget}
        onClose={() => setDeleteFormTarget(null)}
        onConfirm={confirmDeleteForm}
        title="Delete Testimonial Form"
        description="This removes the testimonial form link and public access for submissions."
        confirmText="Delete Form"
        cancelText="Cancel"
        variant="danger"
        loading={deleteFormLoading}
        verifyText={deleteFormTarget ? `DELETE ${deleteFormTarget.title}` : 'DELETE'}
      />
    </div>
  );
}
