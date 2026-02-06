// src/app/dashboard/testimonials/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageSquareText, UserPlus, CheckCircle2, Clock } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
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
};

function TestimonialTable({
  title,
  items,
  status,
  loading,
  canApprove,
  onApprove,
  approvingId,
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
                      <span className="text-xs text-[var(--color-text-tertiary)]">Published</span>
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
        />
      </GridLayout>
    </div>
  );
}
