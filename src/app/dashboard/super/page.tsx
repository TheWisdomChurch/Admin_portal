'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Users, BarChart3, MessageSquare } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { apiClient } from '@/lib/api';
import { withAuth } from '@/providers/withAuth';
import { Testimonial, WorkforceStatsResponse, WorkforceMember } from '@/lib/types';
import toast from 'react-hot-toast';

function SuperDashboard() {
  const [pending, setPending] = useState<Testimonial[]>([]);
  const [pendingWorkforce, setPendingWorkforce] = useState<WorkforceMember[]>([]);
  const [workforceStats, setWorkforceStats] = useState<WorkforceStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    try {
      setLoading(true);
      const [testimonialsRes, statsRes, workforceRes] = await Promise.all([
        apiClient.getAllTestimonials({ approved: false }),
        apiClient.getWorkforceStats().catch(() => null),
        apiClient.listWorkforce({ status: 'new', limit: 5 }).catch(() => null),
      ]);

      const pendingTestimonials = Array.isArray(testimonialsRes)
        ? testimonialsRes
        : (testimonialsRes as any)?.data || [];
      setPending(pendingTestimonials);

      if (statsRes) setWorkforceStats(statsRes);
      if (workforceRes && Array.isArray((workforceRes as any)?.data)) {
        setPendingWorkforce((workforceRes as any).data as WorkforceMember[]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load pending testimonials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleApprove = async (id: string) => {
    try {
      setApproving(id);
      await apiClient.approveTestimonial(id);
      toast.success('Testimonial approved');
      await loadPending();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve');
    } finally {
      setApproving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Registered Workforce</p>
              <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {workforceStats?.total ?? '—'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-[var(--color-background-tertiary)] p-2">
              <p className="text-[var(--color-text-tertiary)]">New</p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {workforceStats?.byStatus?.new ?? 0}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--color-background-tertiary)] p-2">
              <p className="text-[var(--color-text-tertiary)]">Serving</p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {workforceStats?.byStatus?.serving ?? 0}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--color-background-tertiary)] p-2">
              <p className="text-[var(--color-text-tertiary)]">Not Serving</p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {workforceStats?.byStatus?.not_serving ?? 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Pending Testimonials</p>
              <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {pending.length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Pending Workforce</p>
              <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {pendingWorkforce.length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      <Card title="Pending Testimonials">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">No testimonials waiting for approval.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((t) => (
              <div key={t.id} className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {t.full_name || `${t.first_name} ${t.last_name}` || 'Anonymous'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{new Date(t.created_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="warning" size="sm" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Pending
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{t.testimony}</p>
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(t.id)}
                    loading={approving === t.id}
                    disabled={approving !== null}
                    icon={<CheckCircle className="h-4 w-4" />}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Pending Workforce Approvals">
        {pendingWorkforce.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">No workforce requests waiting.</p>
        ) : (
          <div className="space-y-3">
            {pendingWorkforce.map((person) => (
              <div
                key={person.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {person.firstName} {person.lastName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {person.department} • {person.email || person.phone || 'No contact'}
                    </p>
                  </div>
                  <Badge variant="warning" size="sm" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    New
                  </Badge>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mr-2"
                    onClick={() => toast('Please contact before approval')}
                  >
                    Review
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        setApproving(person.id);
                        await apiClient.updateWorkforce(person.id, { status: 'serving' });
                        toast.success('Workforce request approved');
                        await loadPending();
                      } catch (err: any) {
                        toast.error(err?.message || 'Failed to approve workforce');
                      } finally {
                        setApproving(null);
                      }
                    }}
                    loading={approving === person.id}
                    disabled={approving !== null}
                    icon={<CheckCircle className="h-4 w-4" />}
                  >
                    Approve & Activate
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default withAuth(SuperDashboard, { requiredRole: 'super_admin' });
