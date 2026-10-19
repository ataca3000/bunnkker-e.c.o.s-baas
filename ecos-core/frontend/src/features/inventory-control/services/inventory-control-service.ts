import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  AbcClassificationsQuery,
  AbcClassificationsResult,
  AbcRecalculateSummary,
  CycleCountPlansQuery,
  CycleCountPlansResult,
  DashboardData,
  VarianceAnalytics,
  VarianceAnalyticsQuery,
  WarehousePerformance,
  WarehousePerformanceQuery,
} from '@/features/inventory-control/types/inventory-control';

export const inventoryControlService = {
  async getDashboard(): Promise<DashboardData> {
    const { data } = await api.get<ApiResponse<DashboardData>>('/inventory/dashboard');
    return data.data;
  },

  async getAbcClassifications(params: AbcClassificationsQuery): Promise<AbcClassificationsResult> {
    const { data } = await api.get<ApiResponse<AbcClassificationsResult>>(
      '/inventory/abc-classifications',
      { params },
    );
    return data.data;
  },

  async recalculateAbc(): Promise<AbcRecalculateSummary> {
    const { data } = await api.post<ApiResponse<AbcRecalculateSummary>>(
      '/inventory/abc-classifications/recalculate',
    );
    return data.data;
  },

  async getVarianceAnalytics(params: VarianceAnalyticsQuery = {}): Promise<VarianceAnalytics> {
    const { data } = await api.get<ApiResponse<VarianceAnalytics>>(
      '/inventory/variance-analytics',
      { params },
    );
    return data.data;
  },

  async getWarehousePerformance(
    params: WarehousePerformanceQuery = {},
  ): Promise<WarehousePerformance[]> {
    const { data } = await api.get<ApiResponse<WarehousePerformance[]>>(
      '/inventory/warehouse-performance',
      { params },
    );
    return data.data;
  },

  async getCycleCountPlans(params: CycleCountPlansQuery): Promise<CycleCountPlansResult> {
    const { data } = await api.get<ApiResponse<CycleCountPlansResult>>(
      '/inventory/cycle-count-plans',
      { params },
    );
    return data.data;
  },
};
