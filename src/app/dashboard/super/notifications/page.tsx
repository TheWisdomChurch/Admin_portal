'use client';

import { withAuth } from '@/providers/withAuth';
import { NotificationInbox } from '@/components/NotificationInbox';

function SuperNotificationsPage() {
  return (
    <NotificationInbox
      title="Super Admin Notifications"
      subtitle="Priority alerts, approval signals, and platform events requiring executive attention."
    />
  );
}

export default withAuth(SuperNotificationsPage, { requiredRole: 'super_admin' });
