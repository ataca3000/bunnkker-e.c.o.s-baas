import { Bell, BellOff, CheckCheck, RefreshCw } from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { cn }       from '@/lib/utils';
import { useToast } from '@/components/ds/use-toast';
import {
  useEngineeringNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '../hooks/use-engineering';
import type { EngineeringPipelineNotification, NotificationSeverity } from '../types/engineering';

const SEVERITY_STYLE: Record<NotificationSeverity, string> = {
  info:    'border-l-4 border-blue-400',
  warning: 'border-l-4 border-amber-400',
  error:   'border-l-4 border-red-400',
  success: 'border-l-4 border-green-400',
};

const SEVERITY_BADGE: Record<NotificationSeverity, string> = {
  info:    'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  error:   'bg-red-100 text-red-700',
  success: 'bg-green-100 text-green-700',
};

function NotificationCard({ notification }: { notification: EngineeringPipelineNotification }) {
  const markRead = useMarkNotificationRead();

  return (
    <div className={cn(
      'rounded-lg bg-card px-4 py-3',
      SEVERITY_STYLE[notification.severity],
      notification.is_read ? 'opacity-60' : '',
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{notification.title}</span>
            <Badge className={cn('text-xs border-0 shrink-0', SEVERITY_BADGE[notification.severity])}>
              {notification.severity}
            </Badge>
            {!notification.is_read && (
              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{notification.message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(notification.created_at).toLocaleString()}
          </p>
        </div>
        {!notification.is_read && (
          <button
            onClick={() => markRead.mutate(notification.id)}
            disabled={markRead.isPending}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title="Mark as read"
          >
            <CheckCheck className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function EngineeringNotificationsPage() {
  const { toast } = useToast();
  const { data, isLoading, refetch, isRefetching } = useEngineeringNotifications();
  const markAll = useMarkAllNotificationsRead();

  const notifications  = data?.data ?? [];
  const unreadCount    = data?.unread_count ?? 0;

  function handleMarkAll() {
    markAll.mutate(undefined, {
      onSuccess: ({ updated }) => {
        toast({ title: `${updated} notification${updated !== 1 ? 's' : ''} marked as read` });
      },
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5 pb-4 border-b border-border/60 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                {unreadCount} unread
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pipeline events, failures, and deployment alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline" size="sm"
              onClick={handleMarkAll}
              disabled={markAll.isPending}
              className="gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <BellOff className="h-10 w-10 opacity-20" />
            <p className="text-sm">No notifications yet. Run a pipeline to start receiving events.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <NotificationCard key={n.id} notification={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
