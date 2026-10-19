import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { LinkedEntity, LinkedEntityType } from '../types/conversation';

export function useLinkedEntities(conversationId: string) {
  return useQuery<LinkedEntity[]>({
    queryKey: ['conversation-entities', conversationId],
    queryFn: () =>
      axios.get(`/api/omnichannel/conversations/${conversationId}/entities`).then((r) => r.data?.data ?? r.data),
    enabled: !!conversationId,
  });
}

export function useAutoRoute(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      axios.post(`/api/omnichannel/conversations/${conversationId}/auto-route`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversation', conversationId] }),
  });
}

export function usePrepareOrder(conversationId: string) {
  return useMutation({
    mutationFn: (orderData?: Record<string, unknown>) =>
      axios
        .post(`/api/omnichannel/conversations/${conversationId}/prepare-order`, { order_data: orderData ?? {} })
        .then((r) => r.data),
  });
}

export function useLinkEntity(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { entity_type: LinkedEntityType; entity_id: string; entity_code: string }) =>
      axios.post(`/api/omnichannel/conversations/${conversationId}/link-entity`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation-entities', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
    },
  });
}
