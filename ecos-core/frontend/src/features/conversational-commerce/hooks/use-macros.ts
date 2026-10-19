import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { ConversationMacro, CreateMacroPayload, PaginatedResponse } from '../types/conversation';

const BASE = '/api/omnichannel/macros';

export function useMacros(params?: Record<string, string>) {
  return useQuery<PaginatedResponse<ConversationMacro>>({
    queryKey: ['macros', params],
    queryFn: () => axios.get(BASE, { params }).then((r) => r.data),
  });
}

export function useCreateMacro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMacroPayload) => axios.post(BASE, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['macros'] }),
  });
}

export function useUpdateMacro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateMacroPayload> }) =>
      axios.patch(`${BASE}/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['macros'] }),
  });
}

export function useDeleteMacro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axios.delete(`${BASE}/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['macros'] }),
  });
}

export function useApplyMacro(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ macroId, context }: { macroId: string; context?: Record<string, string> }) =>
      axios
        .post(`/api/omnichannel/conversations/${conversationId}/macros/${macroId}`, { context })
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['conversation-messages', conversationId] }),
  });
}
