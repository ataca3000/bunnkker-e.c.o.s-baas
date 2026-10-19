import { api } from '@/lib/axios';
import type {
  AreasParams,
  AreasResult,
  DistributionZone,
  DistributionZonePayload,
  DistributionZoneStats,
  DistributionZonesQuery,
  DistributionZonesResult,
} from '../types/distribution-zone';

const BASE = '/logistics/distribution';

export const distributionZoneService = {
  async stats(): Promise<DistributionZoneStats> {
    const { data } = await api.get<DistributionZoneStats>(`${BASE}/stats`);
    return data;
  },

  async nextCode(): Promise<string> {
    const { data } = await api.get<{ code: string }>(`${BASE}/next-code`);
    return data.code;
  },

  async list(params?: DistributionZonesQuery): Promise<DistributionZonesResult> {
    const { data } = await api.get<DistributionZonesResult>(`${BASE}/zones`, { params });
    return data;
  },

  async get(id: number): Promise<DistributionZone> {
    const { data } = await api.get<{ data: DistributionZone }>(`${BASE}/zones/${id}`);
    return data.data;
  },

  async create(payload: DistributionZonePayload): Promise<DistributionZone> {
    const { data } = await api.post<{ data: DistributionZone }>(`${BASE}/zones`, payload);
    return data.data;
  },

  async update(id: number, payload: DistributionZonePayload): Promise<DistributionZone> {
    const { data } = await api.put<{ data: DistributionZone }>(`${BASE}/zones/${id}`, payload);
    return data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`${BASE}/zones/${id}`);
  },

  async toggleStatus(id: number): Promise<DistributionZone> {
    const { data } = await api.patch<{ data: DistributionZone }>(`${BASE}/zones/${id}/status`);
    return data.data;
  },

  async areas(params?: AreasParams): Promise<AreasResult> {
    const { data } = await api.get<AreasResult>(`${BASE}/areas`, { params });
    return data;
  },
};
