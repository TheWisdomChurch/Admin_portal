'use client';

import { withAuth } from '@/providers/withAuth';
import { NotificationInbox } from '@/components/NotificationInbox';

function NotificationsPage() {
  return (
    <NotificationInbox
      title="Notifications"
      subtitle="Track requests, approvals, and operational updates."
    />
  );
}

export default withAuth(NotificationsPage, { requiredRole: 'admin' });

