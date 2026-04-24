import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { ApprovalRequest, ApprovalRequestStatus, ApprovalRequestType } from '@/lib/types';

export type ApprovalItemType = ApprovalRequestType;
export type ApprovalItemStatus = ApprovalRequestStatus;

export interface ApprovalItem {
  id: string;
  type: ApprovalItemType;
  entityId?: string;
  ticketCode?: string;
  name: string;
  summary: string;
  submittedAt: string;
  status: ApprovalItemStatus;
  approvedAt?: string;
  email?: string;
  department?: string;
  source: 'api';
}

function mapRequestToApproval(req: ApprovalRequest): ApprovalItem {
  const requestedBy = req.requestedByName || req.requestedByEmail || 'System';
  return {
    id: req.id,
    type: req.type,
    entityId: req.entityId,
    ticketCode: req.ticketCode,
    name: requestedBy,
    summary: req.entityLabel || req.ticketCode,
    submittedAt: req.createdAt,
    status: req.status,
    approvedAt: req.approvedAt,
    email: req.requestedByEmail,
    source: 'api',
  };
}

export function useSuperQueues() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadQueues = useCallback(async () => {
    try {
      setLoading(true);
      const requests = await apiClient.listApprovalRequests({ limit: 100 });
      const approvals = (Array.isArray(requests) ? requests : [])
        .map(mapRequestToApproval)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

      setItems(approvals);
    } catch (error) {
      console.error('Failed to load approval queues:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  const approveItem = useCallback(
    async (item: ApprovalItem) => {
      try {
        if (item.source !== 'api') {
          return;
        }
        if (!item.entityId) {
          throw new Error('Request has no entity id');
        }
        if (item.status !== 'pending') {
          throw new Error('Only pending requests can be approved');
        }
        if (item.type === 'testimonial') {
          await apiClient.approveTestimonial(item.entityId);
        } else if (item.type === 'event') {
          await apiClient.approveEvent(item.entityId);
        } else if (item.type === 'admin_user') {
          await apiClient.approveAdminUser(item.entityId);
        } else {
          throw new Error('Unsupported approval type');
        }
        await loadQueues();
        toast.success(`${item.name} approved`);
      } catch (error) {
        console.error('Approval failed:', error);
        const message = error instanceof Error ? error.message : 'Unable to approve item';
        toast.error(message);
      }
    },
    [loadQueues]
  );

  const declineItem = useCallback(
    async (item: ApprovalItem) => {
      try {
        if (item.source !== 'api') {
          return;
        }
        if (!item.entityId) {
          throw new Error('Request has no entity id');
        }
        if (item.status !== 'pending') {
          throw new Error('Only pending requests can be declined');
        }
        if (item.type === 'testimonial') {
          await apiClient.deleteTestimonial(item.entityId);
        } else {
          throw new Error('Decline is only enabled for testimonial requests');
        }
        await loadQueues();
        toast.success(`${item.name} declined`);
      } catch (error) {
        console.error('Decline failed:', error);
        const message = error instanceof Error ? error.message : 'Unable to decline item';
        toast.error(message);
      }
    },
    [loadQueues]
  );

  const stats = useMemo(
    () => ({
      total: items.filter((item) => item.status === 'pending').length,
      testimonials: items.filter((item) => item.type === 'testimonial' && item.status === 'pending').length,
      events: items.filter((item) => item.type === 'event' && item.status === 'pending').length,
      adminUsers: items.filter((item) => item.type === 'admin_user' && item.status === 'pending').length,
    }),
    [items]
  );

  return {
    items,
    loading,
    refresh: loadQueues,
    approveItem,
    declineItem,
    stats,
  };
}
