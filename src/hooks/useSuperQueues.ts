import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { Testimonial, WorkforceMember } from '@/lib/types';

export type ApprovalItemType = 'testimonial' | 'workforce';
export type ApprovalItemStatus = 'pending' | 'new' | 'flagged';

export interface ApprovalItem {
  id: string;
  type: ApprovalItemType;
  name: string;
  summary: string;
  submittedAt: string;
  status: ApprovalItemStatus;
  email?: string;
  department?: string;
  source: 'api' | 'mock';
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const fallbackApprovals: ApprovalItem[] = [
  {
    id: 'mock-t-01',
    type: 'testimonial',
    name: 'Diana Peters',
    summary: 'Shared a testimony on the youth outreach that drew 60 first-timers.',
    submittedAt: new Date().toISOString(),
    status: 'pending',
    email: 'diana.peters@example.com',
    source: 'mock',
  },
  {
    id: 'mock-w-01',
    type: 'workforce',
    name: 'Chukwuemeka Obasi',
    summary: 'Greeters department applicant looking to serve Sundays.',
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: 'new',
    department: 'Greeters',
    email: 'chukwu.obasi@example.com',
    source: 'mock',
  },
  {
    id: 'mock-w-02',
    type: 'workforce',
    name: 'Sarah Bello',
    summary: 'Media team volunteer with livestream experience.',
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    status: 'new',
    department: 'Media',
    email: 'sarah.bello@example.com',
    source: 'mock',
  },
  {
    id: 'mock-t-02',
    type: 'testimonial',
    name: 'Anonymous Member',
    summary: 'Testimony about healing during the midweek service.',
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    status: 'pending',
    source: 'mock',
  },
];

function mapTestimonialToApproval(testimonial: Partial<Testimonial>): ApprovalItem {
  const raw = testimonial as {
    created_at?: unknown;
    created?: unknown;
    full_name?: unknown;
    first_name?: unknown;
    last_name?: unknown;
  };
  const submittedAt =
    (typeof raw.created_at === 'string' && raw.created_at) ||
    testimonial.createdAt ||
    (typeof raw.created === 'string' && raw.created) ||
    new Date().toISOString();

  const fullName =
    (typeof raw.full_name === 'string' && raw.full_name) || testimonial.fullName;
  const firstName =
    (typeof raw.first_name === 'string' && raw.first_name) || testimonial.firstName || '';
  const lastName =
    (typeof raw.last_name === 'string' && raw.last_name) || testimonial.lastName || '';

  const name =
    fullName ||
    `${firstName} ${lastName}`.trim() ||
    'Anonymous';

  return {
    id: testimonial.id ?? generateId(),
    type: 'testimonial',
    name: name.trim() || 'Anonymous',
    summary: testimonial.testimony || 'Pending review',
    submittedAt,
    status: 'pending',
    source: 'api',
  };
}

function mapWorkforceToApproval(member: Partial<WorkforceMember>): ApprovalItem {
  const raw = member as { created_at?: unknown };
  const submittedAt =
    member.createdAt ||
    (typeof raw.created_at === 'string' && raw.created_at) ||
    member.updatedAt ||
    new Date().toISOString();

  const name = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || 'New workforce';

  return {
    id: member.id ?? generateId(),
    type: 'workforce',
    name,
    summary: member.department || 'New department request',
    submittedAt,
    status: (member.status as ApprovalItemStatus) || 'new',
    email: member.email,
    department: member.department,
    source: 'api',
  };
}

export function useSuperQueues() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const getDataArray = useCallback(<T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === 'object' && 'data' in value) {
      const data = (value as { data?: unknown }).data;
      if (Array.isArray(data)) return data as T[];
    }
    return [];
  }, []);

  const loadQueues = useCallback(async () => {
    try {
      setLoading(true);
      const [testimonialsRes, workforceRes] = await Promise.all([
        apiClient.getAllTestimonials({ approved: false }),
        apiClient.listWorkforce({ status: 'new', limit: 25 }),
      ]);

      const testimonials = getDataArray<Testimonial>(testimonialsRes);
      const workforce = getDataArray<WorkforceMember>(workforceRes);

      const approvals = [
        ...testimonials.map(mapTestimonialToApproval),
        ...workforce.map(mapWorkforceToApproval),
      ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

      setItems(approvals.length > 0 ? approvals : fallbackApprovals);
    } catch (error) {
      console.error('Failed to load approval queues:', error);
      setItems(fallbackApprovals);
    } finally {
      setLoading(false);
    }
  }, [getDataArray]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  const approveItem = useCallback(
    async (item: ApprovalItem) => {
      try {
        if (item.source === 'api') {
          if (item.type === 'testimonial') {
            await apiClient.approveTestimonial(item.id);
          } else {
            await apiClient.updateWorkforce(item.id, { status: 'serving' });
          }
        }

        setItems((prev) => prev.filter((approval) => approval.id !== item.id));
        toast.success(`${item.name} approved`);
      } catch (error) {
        console.error('Approval failed:', error);
        const message = error instanceof Error ? error.message : 'Unable to approve item';
        toast.error(message);
      }
    },
    []
  );

  const stats = useMemo(
    () => ({
      total: items.length,
      testimonials: items.filter((item) => item.type === 'testimonial').length,
      workforce: items.filter((item) => item.type === 'workforce').length,
    }),
    [items]
  );

  return {
    items,
    loading,
    refresh: loadQueues,
    approveItem,
    stats,
  };
}
