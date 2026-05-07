'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, ClipboardCopy, MessageSquareText, RefreshCcw, Search, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import { useAuthContext } from '@/providers/AuthProviders';
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
  approving,
  onApprove,
}: {
  item: Testimonial;
  status: 'pending' | 'approved';
  canApprove: boolean;
  approving: boolean;
  onApprove: (item: Testimonial) => void;
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
              {status === 'approved' ? 'Published' : 'Pending'}
            </Badge>
            {item.isAnonymous && <Badge variant="secondary">Anonymous</Badge>}
          </div>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--color-text-secondary)]">{item.testimony}</p>
          <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">Submitted {formatDate(item.createdAt)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:flex-col md:items-end">
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
        </div>
      </div>
    </div>
  );
}

export default function TestimonialsPage() {
  const auth = useAuthContext();
  const canApprove = normalizeRole(auth.user?.role) === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [formsLoading, setFormsLoading] = useState(true);
  const [pending, setPending] = useState<Testimonial[]>([]);
  const [approved, setApproved] = useState<Testimonial[]>([]);
  const [testimonialForms, setTestimonialForms] = useState<AdminForm[]>([]);
  const [search, setSearch] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<Testimonial | null>(null);

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

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">Pending review</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{pending.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">Published</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{approved.length}</p>
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
                  approving={approvingId === String(item.id)}
                  onApprove={setApproveTarget}
                />
              ))
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-text-primary)]">Published</h3>
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
                  approving={false}
                  onApprove={setApproveTarget}
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
    </div>
  );
}
