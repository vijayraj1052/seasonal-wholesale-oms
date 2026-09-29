import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import type { Notification } from '@/types/database';

export function CustomerNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setNotifications((data ?? []) as Notification[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in(
        'id',
        unread.map((n) => n.id)
      );

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-slate-500">Loading notifications…</p>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<Bell className="h-7 w-7" />}
        title="Couldn't load notifications"
        description={error}
      />
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-7 w-7" />}
          title="No notifications"
          description="You'll see order updates, payment reminders, and other alerts here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={notif.is_read ? 'opacity-60' : 'border-blue-200'}
            >
              <CardBody className="flex items-start gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                    notif.is_read
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  <Bell className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {notif.title}
                  </h3>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {notif.message}
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {new Date(notif.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {!notif.is_read && (
                  <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-2" />
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
