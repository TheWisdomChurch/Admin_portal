'use client';

import { withAuth } from '@/providers/withAuth';
import { NotificationInbox } from '@/components/NotificationInbox';

function SuperNotificationsPage() {
  return (
    <NotificationInbox
      title="Super Admin Notifications"
      subtitle="Review priority alerts and action items across the platform."
    />
  );
}

export default withAuth(SuperNotificationsPage, { requiredRole: 'super_admin' });

