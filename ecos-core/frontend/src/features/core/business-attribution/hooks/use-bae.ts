import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type {
  BusinessEvent,
  BusinessDna,
  JourneyData,
  AttributionResult,
  BusinessMetric,
  EntityNode,
  ReplayResult,
  PaginatedBaeResponse,
} from '../types/bae';

const BASE = '/api/bae';

// ─── Event Bus ────────────────────────────────────────────────────────────────

export function useBaeTimeline(params?: {
  company_id?: string;
  category?: string;
  producer_module?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ['bae-timeline', params],
    queryFn: async () => {
      const { data } = await axios.get<PaginatedBaeResponse<BusinessEvent>>(
        `${BASE}/events/timeline`,
        { params },
      );
      return data;
    },
    staleTime: 15_000,
  });
}

export function useBaeEventsForDna(dnaId: string | undefined, perPage = 25) {
  return useQuery({
    queryKey: ['bae-events-dna', dnaId, perPage],
    queryFn: async () => {
      const { data } = await axios.get<PaginatedBaeResponse<BusinessEvent>>(
        `${BASE}/events/for-dna/${dnaId}`,
        { params: { per_page: perPage } },
      );
      return data;
    },
    enabled: !!dnaId,
  });
}

export function usePublishEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await axios.post<{ data: BusinessEvent }>(`${BASE}/events`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bae-timeline'] });
    },
  });
}

// ─── Business DNA ─────────────────────────────────────────────────────────────

export function useBusinessDnaList(params?: {
  entity_type?: string;
  company_id?: string;
  campaign_id?: string;
  initiative_id?: string;
  customer_lifetime_stage?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ['bae-dna-list', params],
    queryFn: async () => {
      const { data } = await axios.get<PaginatedBaeResponse<BusinessDna>>(
        `${BASE}/dna`,
        { params },
      );
      return data;
    },
  });
}

export function useBusinessDna(dnaId: string | undefined) {
  return useQuery({
    queryKey: ['bae-dna', dnaId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: BusinessDna }>(`${BASE}/dna/${dnaId}`);
      return data.data;
    },
    enabled: !!dnaId,
  });
}

export function useBusinessDnaForEntity(entityType: string | undefined, entityId: string | undefined) {
  return useQuery({
    queryKey: ['bae-dna-entity', entityType, entityId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: BusinessDna }>(`${BASE}/dna/for-entity`, {
        params: { entity_type: entityType, entity_id: entityId },
      });
      return data.data;
    },
    enabled: !!entityType && !!entityId,
  });
}

export function useAttachDna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await axios.post<{ data: BusinessDna }>(`${BASE}/dna`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bae-dna-list'] }),
  });
}

export function useUpdateDna(dnaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await axios.patch<{ data: BusinessDna }>(`${BASE}/dna/${dnaId}`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bae-dna', dnaId] });
      qc.invalidateQueries({ queryKey: ['bae-dna-list'] });
    },
  });
}

// ─── Journey Explorer ─────────────────────────────────────────────────────────

export function useJourneySearch(params?: {
  entity_type?: string;
  company_id?: string;
  campaign_id?: string;
  initiative_id?: string;
  has_stage?: string;
  customer_lifetime_stage?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ['bae-journey-search', params],
    queryFn: async () => {
      const { data } = await axios.get<PaginatedBaeResponse<BusinessDna>>(
        `${BASE}/journey/search`,
        { params },
      );
      return data;
    },
  });
}

export function useJourney(dnaId: string | undefined) {
  return useQuery({
    queryKey: ['bae-journey', dnaId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: JourneyData }>(`${BASE}/journey/${dnaId}`);
      return data.data;
    },
    enabled: !!dnaId,
  });
}

export function useRecordJourneyStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await axios.post(`${BASE}/journey/step`, payload);
      return data.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['bae-journey-search'] });
      if (variables['entity_id']) {
        qc.invalidateQueries({ queryKey: ['bae-dna-entity', variables['entity_type'], variables['entity_id']] });
      }
    },
  });
}

// ─── Attribution ──────────────────────────────────────────────────────────────

export function useAttributionResult(dnaId: string | undefined, model?: string) {
  return useQuery({
    queryKey: ['bae-attribution', dnaId, model],
    queryFn: async () => {
      const { data } = await axios.get<{ data: AttributionResult }>(
        `${BASE}/attribution/${dnaId}`,
        { params: model ? { model } : undefined },
      );
      return data.data;
    },
    enabled: !!dnaId,
    staleTime: 30_000,
  });
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export function useDnaMetrics(dnaId: string | undefined) {
  return useQuery({
    queryKey: ['bae-metrics', dnaId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: BusinessMetric }>(`${BASE}/metrics/${dnaId}`);
      return data.data;
    },
    enabled: !!dnaId,
  });
}

export function useMetricsAverages(companyId?: string) {
  return useQuery({
    queryKey: ['bae-metrics-avg', companyId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: Record<string, number | null> }>(
        `${BASE}/metrics/averages`,
        { params: companyId ? { company_id: companyId } : undefined },
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ─── Graph ────────────────────────────────────────────────────────────────────

export function useGraphNode(nodeId: string | undefined) {
  return useQuery({
    queryKey: ['bae-graph-node', nodeId],
    queryFn: async () => {
      const { data } = await axios.get(`${BASE}/graph/nodes/${nodeId}`);
      return data.data;
    },
    enabled: !!nodeId,
  });
}

export function useGraphSubgraph(nodeId: string | undefined, hops = 2) {
  return useQuery({
    queryKey: ['bae-graph-subgraph', nodeId, hops],
    queryFn: async () => {
      const { data } = await axios.get(`${BASE}/graph/nodes/${nodeId}/subgraph`, { params: { hops } });
      return data.data;
    },
    enabled: !!nodeId,
    staleTime: 60_000,
  });
}

export function useUpsertNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await axios.post<{ data: EntityNode }>(`${BASE}/graph/nodes`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bae-graph-node'] }),
  });
}

// ─── Event Replay ─────────────────────────────────────────────────────────────

export function useReplayEvents() {
  return useMutation({
    mutationFn: async (payload: {
      type: 'entity' | 'dna' | 'correlation' | 'campaign';
      entity_type?: string;
      entity_id?: string;
      dna_id?: string;
      correlation_id?: string;
      campaign_id?: string;
    }) => {
      const { data } = await axios.post<{ data: ReplayResult }>(`${BASE}/replay`, payload);
      return data.data;
    },
  });
}
