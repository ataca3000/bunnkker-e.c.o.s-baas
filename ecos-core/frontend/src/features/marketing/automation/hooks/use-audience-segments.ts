import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { AudienceSegment, PaginatedResponse, SegmentType } from '../types/automation';
import { automationKeys } from './use-automation-workflows';

const segmentKeys = {
  all:  () => [...automationKeys.all, 'segments'] as const,
  list: (filters?: Record<string, unknown>) => [...segmentKeys.all(), filters] as const,
  one:  (id: string) => [...segmentKeys.all(), id] as const,
};

export function useAudienceSegments(filters?: { segment_type?: SegmentType; search?: string; company_id?: string }) {
  return useQuery({
    queryKey: segmentKeys.list(filters),
    queryFn:  async () => {
      const { data } = await axios.get<PaginatedResponse<AudienceSegment>>(
        '/marketing/automation/segments',
        { params: filters },
      );
      return data;
    },
  });
}

export function useAudienceSegment(id: string) {
  return useQuery({
    queryKey: segmentKeys.one(id),
    queryFn:  async () => {
      const { data } = await axios.get<{ data: AudienceSegment }>(`/marketing/automation/segments/${id}`);
      return data.data ?? data;
    },
    enabled: !!id,
  });
}

export function useCreateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AudienceSegment> & { name: string; segment_type: SegmentType; rules: Record<string, unknown> }) => {
      const { data } = await axios.post<{ data: AudienceSegment }>('/marketing/automation/segments', payload);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: segmentKeys.all() }),
  });
}

export function useUpdateSegment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AudienceSegment>) => {
      const { data } = await axios.put<{ data: AudienceSegment }>(`/marketing/automation/segments/${id}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: segmentKeys.one(id) });
      qc.invalidateQueries({ queryKey: segmentKeys.all() });
    },
  });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/marketing/automation/segments/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: segmentKeys.all() }),
  });
}

export function useRecalculateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post(`/marketing/automation/segments/${id}/recalculate`);
      return data;
    },
    onSuccess: (_data, id) => qc.invalidateQueries({ queryKey: segmentKeys.one(id) }),
  });
}
