'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, MessageSquare, Users } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { apiClient } from '@/lib/api';
import { withAuth } from '@/providers/withAuth';
import { Testimonial, WorkforceMember } from '@/lib/types';
import toast from 'react-hot-toast';

function RequestsPage() {
  const [pendingTestimonials, setPendingTestimonials] = useState<Testimonial[]>([]);
  const [pendingWorkforce, setPendingWorkforce] = useState<WorkforceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [testRes, workforceRes] = await Promise.all([
        apiClient.getAllTestimonials({ approved: false }),
        apiClient.listWorkforce({ status: 'new', limit: 10 }).catch(() => null),
      ]);

      const tList = Array.isArray(testRes) ? testRes : (testRes as any)?.data || [];
      setPendingTestimonials(tList);

      if (workforceRes && Array.isArray((workforceRes as any)?.data)) {
        setPendingWorkforce((workforceRes as any).data as WorkforceMember[]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const approveTestimonial = async (id: string) => {
    try {
      setApprovingId(id);
      await apiClient.approveTestimonial(id);
      toast.success('Testimonial approved');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Approval failed');
    } finally {
      setApprovingId(null);
    }
  };

  const approveWorkforce = async (id: string) => {
    try {
      setApprovingId(id);
      await apiClient.updateWorkforce(id, { status: 'serving' });
      toast.success('Workforce request approved');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Approval failed');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Requests</h1>
        <p className="text-sm text-[var(--color-text-tertiary)]">Approve testimonials and workforce join requests.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Testimonials awaiting approval">
          {loading ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
          ) : pendingTestimonials.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No pending testimonials.</p>
          ) : (
            <div className="space-y-3">
              {pendingTestimonials.map((t) => (
                <div
                  key={t.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {t.full_name || `${t.first_name} ${t.last_name}` || 'Anonymous'}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                        {new Date(t.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="warning" size="sm" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Pending
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-[var(--color-text-secondary)] line-clamp-3">{t.testimony}</p>
                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => approveTestimonial(t.id)}
                      loading={approvingId === t.id}
                      disabled={approvingId !== null}
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

        <Card title="Workforce join requests">
          {loading ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
          ) : pendingWorkforce.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No pending workforce requests.</p>
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
                      <Users className="h-3 w-3" />
                      New
                    </Badge>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => approveWorkforce(person.id)}
                      loading={approvingId === person.id}
                      disabled={approvingId !== null}
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
      </div>
    </div>
  );
}

export default withAuth(RequestsPage, { requiredRole: 'super_admin' });
