import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { RoutingRule, CreateRoutingRulePayload, PaginatedResponse } from '../types/conversation';

const BASE = '/api/omnichannel/routing-rules';

export function useRoutingRules(params?: Record<string, string>) {
  return useQuery<PaginatedResponse<RoutingRule>>({
    queryKey: ['routing-rules', params],
    queryFn: () => axios.get(BASE, { params }).then((r) => r.data),
  });
}

export function useCreateRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoutingRulePayload) => axios.post(BASE, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing-rules'] }),
  });
}

export function useUpdateRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRoutingRulePayload> }) =>
      axios.patch(`${BASE}/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing-rules'] }),
  });
}

export function useDeleteRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axios.delete(`${BASE}/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing-rules'] }),
  });
}
