import { Bell, CheckCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export function AdminNotifications() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-500 mt-1">
          Send and manage customer notifications.
        </p>
      </div>

      <EmptyState
        icon={<Bell className="h-7 w-7" />}
        title="Notification management — Phase 2"
        description="This section will allow you to view notification history, send manual alerts to customers, and configure automated notification triggers for order status changes."
      />
    </div>
  );
}
