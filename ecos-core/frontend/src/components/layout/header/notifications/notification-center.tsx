import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Boxes,
  CircleAlert,
  CircleCheck,
  Info,
  Megaphone,
  Monitor,
  Settings,
  Truck,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useFormatter } from '@/hooks/use-formatter';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications/hooks/use-notifications';
import {
  toUiNotification,
  type NotificationSeverity,
  type NotificationSource,
  type UiNotification,
} from '@/features/notifications/types/notification';

/**
 * The notification centre in the top bar.
 *
 * Reads GET /api/notifications — the authenticated user's own feed, scoped
 * server-side by ownership. It shows what producers actually wrote and nothing
 * else: the message text is the producer's, the timestamp is the record's, and
 * a feed with no rows says so rather than filling the drawer.
 *
 * Filter tabs are derived from the sources present in the feed, not from a
 * fixed taxonomy. A notification from a module nobody has categorised still
 * appears, under `other`, instead of being dropped because no tab claimed it.
 */

const SOURCE_ICONS: Record<NotificationSource, LucideIcon> = {
  operations: Boxes,
  logistics: Truck,
  marketing: Megaphone,
  pos: Monitor,
  system: Settings,
  other: Bell,
};

const SEVERITY_ICONS: Record<NotificationSeverity, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
};

const SEVERITY_TONE: Record<NotificationSeverity, string> = {
  info: 'text-muted-foreground',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  error: 'text-red-600',
};

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: UiNotification;
  onMarkRead: (id: string) => void;
}) {
  const { t } = useTranslation('common');
  const fmt = useFormatter();

  const SourceIcon = SOURCE_ICONS[notification.source];
  const SeverityIcon = SEVERITY_ICONS[notification.severity];

  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40',
        !notification.read && 'bg-primary/3',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
          notification.read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
        )}
        aria-hidden
      >
        <SourceIcon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'flex items-center gap-1.5 text-sm leading-tight',
              notification.read ? 'font-medium' : 'font-semibold',
            )}
          >
            <SeverityIcon
              className={cn('size-3.5 shrink-0', SEVERITY_TONE[notification.severity])}
              aria-hidden
            />
            {t(($) => $.notifications.source[notification.source])}
          </p>

          {!notification.read && (
            <span
              className="mt-1 size-2 shrink-0 rounded-full bg-primary"
              aria-label={t(($) => $.notifications.unread)}
            />
          )}
        </div>

        <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">
          {notification.message === '' ? t(($) => $.notifications.noMessage) : notification.message}
        </p>

        <div className="mt-1.5 flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground/70">
            {notification.createdAt ? fmt.dateTime(notification.createdAt) : ''}
          </span>
          {!notification.read && (
            <button
              type="button"
              onClick={() => onMarkRead(notification.id)}
              className="text-[10px] font-medium text-primary opacity-0 transition-opacity hover:text-primary/80 group-hover:opacity-100 focus-visible:opacity-100"
            >
              {t(($) => $.notifications.markRead)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<NotificationSource | 'all'>('all');

  const feed = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = useMemo(() => (feed.data?.data ?? []).map(toUiNotification), [feed.data]);

  const unreadCount = feed.data?.unread_count ?? 0;

  // Only sources actually present get a tab — an empty tab would advertise a
  // category the platform never produces.
  const sources = useMemo(() => {
    const seen = new Set<NotificationSource>();
    notifications.forEach((n) => seen.add(n.source));
    return [...seen];
  }, [notifications]);

  const visible =
    activeSource === 'all' ? notifications : notifications.filter((n) => n.source === activeSource);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={
          unreadCount > 0
            ? t(($) => $.notifications.bellWithUnread, { count: unreadCount })
            : t(($) => $.notifications.bell)
        }
        className="relative"
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 flex min-w-[1rem] items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold leading-4 text-primary-foreground end-[-0.125rem]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 pe-12">
            <div>
              <SheetTitle className="text-base font-semibold">
                {t(($) => $.notifications.title)}
              </SheetTitle>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0
                  ? t(($) => $.notifications.unreadCount, { count: unreadCount })
                  : t(($) => $.notifications.allCaughtUp)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={unreadCount === 0 || markAllRead.isPending}
              className="h-7 text-xs"
            >
              {t(($) => $.notifications.markAllRead)}
            </Button>
          </div>

          {sources.length > 1 && (
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2">
              {(['all', ...sources] as const).map((source) => {
                const count =
                  source === 'all'
                    ? notifications.filter((n) => !n.read).length
                    : notifications.filter((n) => n.source === source && !n.read).length;

                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setActiveSource(source)}
                    aria-pressed={activeSource === source}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      activeSource === source
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {source === 'all'
                      ? t(($) => $.notifications.all)
                      : t(($) => $.notifications.source[source])}
                    {count > 0 && (
                      <span
                        className={cn(
                          'rounded-full px-1 py-0.5 text-[9px] font-bold leading-none',
                          activeSource === source
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {feed.isLoading ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {t(($) => $.loading)}
              </p>
            ) : feed.isError ? (
              <p className="py-16 text-center text-sm text-destructive">
                {t(($) => $.notifications.loadFailed)}
              </p>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Bell className="size-10 text-muted-foreground/20" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t(($) => $.notifications.empty)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/60">
                    {t(($) => $.notifications.emptyHint)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {visible.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onMarkRead={(id) => markRead.mutate(id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* The feed endpoint paginates; the drawer shows the most recent page.
              There is no standalone notifications page, so nothing is linked to
              rather than linking to a route that does not exist. */}
          {(feed.data?.meta.total ?? 0) > notifications.length && (
            <div className="shrink-0 border-t px-4 py-3 text-center text-xs text-muted-foreground">
              {t(($) => $.notifications.showingRecent, {
                shown: notifications.length,
                total: feed.data?.meta.total ?? 0,
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
