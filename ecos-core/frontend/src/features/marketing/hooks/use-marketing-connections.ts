import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { ConnectorHealthData, MarketingConnection, PaginatedResponse } from '../types/marketing';

const BASE = '/marketing';

export function useMarketingConnections(params?: {
  company_id?: string;
  connector_type?: string;
  status?: string;
  per_page?: number;
}) {
  return useQuery({
    queryKey: ['marketing-connections', params],
    queryFn: async () => {
      const { data } = await axios.get<PaginatedResponse<MarketingConnection>>(
        `${BASE}/connections`,
        { params },
      );
      return data;
    },
  });
}

export function useMarketingConnection(id: string | undefined) {
  return useQuery({
    queryKey: ['marketing-connections', id],
    queryFn: async () => {
      const { data } = await axios.get<{ data: MarketingConnection }>(
        `${BASE}/connections/${id}`,
      );
      return data.data;
    },
    enabled: !!id,
  });
}

export function useDisconnectConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      axios.post(`${BASE}/connections/${connectionId}/disconnect`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-connections'] });
      qc.invalidateQueries({ queryKey: ['marketing-dashboard'] });
    },
  });
}

export function useValidateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      axios.post<{ valid: boolean; granted: string[]; missing: string[] }>(
        `${BASE}/connections/${connectionId}/validate`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-connections'] });
    },
  });
}

export function useRegisteredConnectors() {
  return useQuery({
    queryKey: ['marketing-connectors'],
    queryFn: async () => {
      const { data } = await axios.get<{ data: string[] }>(`${BASE}/connectors`);
      return data.data;
    },
  });
}

export function useConnectorHealth(connectionId: string | undefined) {
  return useQuery({
    queryKey: ['connector-health', connectionId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: ConnectorHealthData }>(
        `${BASE}/connections/${connectionId}/health`,
      );
      return data.data;
    },
    enabled: !!connectionId,
    staleTime: 30_000,
  });
}
