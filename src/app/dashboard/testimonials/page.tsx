// src/app/dashboard/testimonials/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageSquareText, UserPlus, CheckCircle2, Clock, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/input';
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import { GridLayout, PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { useAuthContext } from '@/providers/AuthProviders';
import type { Testimonial } from '@/lib/types';

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Testimonials"
        subtitle="Review submissions, approve highlights, and publish them to the website."
        actions={<Button icon={<UserPlus className="h-4 w-4" />}>Invite Testimony</Button>}
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
    </div>
  );
}
