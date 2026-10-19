import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationsService } from '../services/notifications-service';

/**
 * The notification feed.
 *
 * Deliberately NOT company-scoped, unlike every other query key in the app: a
 * notification is addressed to a person, not to a company, and re-keying it per
 * active company would empty the bell every time the user switched context.
 */
const KEY = ['notifications'] as const;

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'list'],
    queryFn: () => notificationsService.list({ perPage: 50 }),
    // The bell is always mounted; a background refresh keeps the unread count
    // honest without the user reopening the drawer.
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
