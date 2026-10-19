import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

import type { NotificationPage } from '../types/notification';

/**
 * The caller's own notification feed.
 *
 * Scoped server-side to the authenticated notifiable — there is no user or
 * company parameter to pass, and none should be added: ownership is the gate.
 */
export const notificationsService = {
  async list(params: { page?: number; perPage?: number; unread?: boolean } = {}) {
    const { data } = await api.get<ApiResponse<NotificationPage>>('/notifications', {
      params: {
        page: params.page,
        per_page: params.perPage,
        unread: params.unread ? 1 : undefined,
      },
    });
    return data.data;
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<number> {
    const { data } = await api.post<ApiResponse<{ updated: number }>>(
      '/notifications/mark-all-read',
    );
    return data.data.updated;
  },
};
