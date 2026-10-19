import { api as apiClient } from '@/lib/axios';
import type {
  DistributionPlanningStats,
  PlanningFilters,
  ZoneDetailTab,
  ZonePlanCard,
  UnassignedOrder,
} from '../types/distribution-planning';

const BASE = '/logistics/distribution/planning';

export const distributionPlanningService = {
  async getStats(filters: PlanningFilters = {}): Promise<DistributionPlanningStats> {
    const { data } = await apiClient.get<DistributionPlanningStats>(`${BASE}/stats`, {
      params: filters,
    });
    return data;
  },

  async getZones(filters: PlanningFilters = {}): Promise<ZonePlanCard[]> {
    const { data } = await apiClient.get<{ data: ZonePlanCard[] }>(`${BASE}/zones`, {
      params: filters,
    });
    return data.data;
  },

  async getUnassigned(filters: PlanningFilters = {}): Promise<UnassignedOrder[]> {
    const { data } = await apiClient.get<{ data: UnassignedOrder[] }>(
      `${BASE}/unassigned`,
      { params: filters },
    );
    return data.data;
  },

  async getZoneDetail(
    zoneId: number,
    tab: ZoneDetailTab,
    filters: PlanningFilters = {},
  ) {
    const { data } = await apiClient.get(`${BASE}/zones/${zoneId}/detail`, {
      params: { ...filters, tab },
    });
    return data;
  },

  async startPlanning(zoneId: number, date?: string): Promise<void> {
    await apiClient.patch(`${BASE}/zones/${zoneId}/start`, { date });
  },

  async markPlanned(zoneId: number, date?: string): Promise<void> {
    await apiClient.patch(`${BASE}/zones/${zoneId}/planned`, { date });
  },
};
