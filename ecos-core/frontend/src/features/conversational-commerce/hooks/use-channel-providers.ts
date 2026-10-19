import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { ChannelProvider, CreateChannelProviderPayload, PaginatedResponse } from '../types/conversation';

const BASE = '/api/omnichannel/providers';

export function useChannelProviders(params?: Record<string, string>) {
  return useQuery<PaginatedResponse<ChannelProvider>>({
    queryKey: ['channel-providers', params],
    queryFn: () => axios.get(BASE, { params }).then((r) => r.data),
  });
}

export function useCreateChannelProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChannelProviderPayload) => axios.post(BASE, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channel-providers'] }),
  });
}

export function useActivateChannelProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axios.post(`${BASE}/${id}/activate`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channel-providers'] }),
  });
}

export function useDeleteChannelProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axios.delete(`${BASE}/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channel-providers'] }),
  });
}
