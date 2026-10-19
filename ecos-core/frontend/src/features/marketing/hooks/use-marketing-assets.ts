import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type {
  AssetRelationship,
  MarketingAsset,
  PaginatedResponse,
  RelationshipGraph,
} from '../types/marketing';

const BASE = '/marketing';

export function useMarketingAssets(params?: {
  company_id?: string;
  connector_type?: string;
  asset_type?: string;
  health_status?: string;
  status?: string;
  search?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ['marketing-assets', params],
    queryFn: async () => {
      const { data } = await axios.get<PaginatedResponse<MarketingAsset>>(
        `${BASE}/assets`,
        { params },
      );
      return data;
    },
  });
}

export function useMarketingAsset(id: string | undefined) {
  return useQuery({
    queryKey: ['marketing-assets', id],
    queryFn: async () => {
      const { data } = await axios.get<{ data: MarketingAsset }>(`${BASE}/assets/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCheckAssetHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) =>
      axios.post<{ health_status: string; health_checked_at: string }>(
        `${BASE}/assets/${assetId}/check-health`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-assets'] });
    },
  });
}

export function useAssetRelationships(assetId: string | undefined) {
  return useQuery({
    queryKey: ['asset-relationships', assetId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: AssetRelationship[] }>(
        `${BASE}/assets/${assetId}/relationships`,
      );
      return data.data;
    },
    enabled: !!assetId,
  });
}

export function useMapAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      assetId,
      related_type,
      related_id,
      confidence,
    }: {
      assetId: string;
      related_type: string;
      related_id: string;
      confidence?: number;
    }) =>
      axios.post<{ data: AssetRelationship }>(`${BASE}/assets/${assetId}/relationships`, {
        related_type,
        related_id,
        confidence,
      }),
    onSuccess: (_d, { assetId }) => {
      qc.invalidateQueries({ queryKey: ['asset-relationships', assetId] });
      qc.invalidateQueries({ queryKey: ['marketing-assets'] });
    },
  });
}

export function useAcceptSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (relationshipId: string) =>
      axios.post(`${BASE}/relationships/${relationshipId}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-relationships'] });
      qc.invalidateQueries({ queryKey: ['marketing-suggestions'] });
      qc.invalidateQueries({ queryKey: ['marketing-dashboard'] });
    },
  });
}

export function useRejectSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (relationshipId: string) =>
      axios.post(`${BASE}/relationships/${relationshipId}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-suggestions'] });
      qc.invalidateQueries({ queryKey: ['marketing-dashboard'] });
    },
  });
}

export function useMappingSuggestions(companyId: string | undefined) {
  return useQuery({
    queryKey: ['marketing-suggestions', companyId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: AssetRelationship[] }>(
        `${BASE}/suggestions`,
        { params: { company_id: companyId } },
      );
      return data.data;
    },
    enabled: !!companyId,
  });
}

export function useAssetRelationshipGraph(assetId: string | undefined) {
  return useQuery({
    queryKey: ['asset-graph', assetId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: RelationshipGraph }>(
        `${BASE}/assets/${assetId}/graph`,
      );
      return data.data;
    },
    enabled: !!assetId,
  });
}
