import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { ConversationMessage, SendMessagePayload } from '../types/conversation';

export function useConversationMessages(conversationId: string) {
  return useQuery<ConversationMessage[]>({
    queryKey: ['conversation-messages', conversationId],
    queryFn: () =>
      axios.get(`/api/cep/conversations/${conversationId}/messages`).then((r) => r.data?.data ?? r.data),
    enabled: !!conversationId,
    refetchInterval: 8000,
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendMessagePayload) =>
      axios.post(`/api/omnichannel/conversations/${conversationId}/send`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
    },
  });
}

export function useMarkRead(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      axios.post(`/api/cep/conversations/${conversationId}/messages/read`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
