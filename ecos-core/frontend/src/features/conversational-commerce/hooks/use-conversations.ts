import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Conversation, PaginatedResponse } from '../types/conversation';

const BASE = '/api/cep/conversations';

export function useConversations(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Conversation>>({
    queryKey: ['conversations', params],
    queryFn: () => axios.get(BASE, { params }).then((r) => r.data),
  });
}

export function useConversation(id: string) {
  return useQuery<Conversation>({
    queryKey: ['conversation', id],
    queryFn: () => axios.get(`${BASE}/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Conversation> }) =>
      axios.patch(`${BASE}/${id}`, data).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['conversation', id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useCloseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axios.post(`${BASE}/${id}/close`).then((r) => r.data),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['conversation', id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useResolveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axios.post(`${BASE}/${id}/resolve`).then((r) => r.data),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['conversation', id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
