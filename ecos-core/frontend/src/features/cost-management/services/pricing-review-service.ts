import axios from 'axios';
import { api } from '@/lib/axios';
import type {
  ApprovePayload,
  AssignPayload,
  BulkApprovePayload,
  BulkPolicyPayload,
  CostDashboardStats,
  InlineUpdatePayload,
  MaterialCostHistoryQuery,
  MaterialCostHistoryResult,
  PricingReview,
  ProductCostDetail,
  PricingReviewsQuery,
  PricingReviewsResult,
  SnoozePayload,
} from '@/features/cost-management/types/pricing-review';

const BASE     = '/cost-management/pricing-reviews';
const DASH_URL = '/cost-management/dashboard';
const HIST_URL = '/cost-management/cost-history';
const MAT_URL  = '/cost-management/materials';

async function safeFetch<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 405)) {
      return fallback;
    }
    throw err;
  }
}

const emptyResult: PricingReviewsResult = {
  data: [],
  pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
  summary: { pending: 0, approved: 0, kept: 0, custom_price: 0, snoozed: 0, rejected: 0 },
};

const emptyHistory: MaterialCostHistoryResult = {
  data: [],
  pagination: { current_page: 1, per_page: 30, total: 0, last_page: 1 },
};

const emptyDashboard: CostDashboardStats = {
  pending_reviews: 0,
  below_target_margin: 0,
  cost_increased_today: 0,
  cost_decreased_today: 0,
  expected_profit_impact: 0,
  average_margin: null,
  awaiting_approval: 0,
};

export const pricingReviewService = {
  async list(params: PricingReviewsQuery): Promise<PricingReviewsResult> {
    return safeFetch(async () => {
      const { data } = await api.get<PricingReviewsResult>(BASE, { params });
      return data;
    }, emptyResult);
  },

  async getDetail(id: string): Promise<ProductCostDetail | null> {
    return safeFetch(async () => {
      const { data } = await api.get<{ data: ProductCostDetail }>(`${BASE}/${id}/detail`);
      return data.data;
    }, null);
  },

  async approve(id: string, payload: ApprovePayload): Promise<void> {
    await api.post(`${BASE}/${id}/approve`, payload);
  },

  async snooze(id: string, payload: SnoozePayload): Promise<void> {
    await api.post(`${BASE}/${id}/snooze`, payload);
  },

  async assign(id: string, payload: AssignPayload): Promise<void> {
    await api.post(`${BASE}/${id}/assign`, payload);
  },

  async bulkApprove(payload: BulkApprovePayload): Promise<void> {
    await api.post(`${BASE}/bulk-approve`, payload);
  },

  async inlineUpdate(id: string, payload: InlineUpdatePayload): Promise<{ review: PricingReview }> {
    const { data } = await api.patch<{ review: PricingReview }>(`${BASE}/${id}/inline`, payload);
    return data;
  },

  async bulkPolicy(payload: BulkPolicyPayload): Promise<void> {
    await api.post(`${BASE}/bulk-policy`, payload);
  },

  async publish(id: string): Promise<void> {
    await api.post(`${BASE}/${id}/publish`);
  },

  async getBadge(companyId?: string): Promise<{ pending: number }> {
    return safeFetch(async () => {
      const { data } = await api.get<{ pending: number }>(`${BASE}/badge`, { params: companyId ? { company_id: companyId } : undefined });
      return data;
    }, { pending: 0 });
  },
};

export const costDashboardService = {
  async getStats(): Promise<CostDashboardStats> {
    return safeFetch(async () => {
      const { data } = await api.get<{ data: CostDashboardStats }>(DASH_URL);
      return data.data;
    }, emptyDashboard);
  },
};

export const materialCostService = {
  async getGlobalHistory(params: MaterialCostHistoryQuery): Promise<MaterialCostHistoryResult> {
    return safeFetch(async () => {
      const { data } = await api.get<MaterialCostHistoryResult>(HIST_URL, { params });
      return data;
    }, emptyHistory);
  },

  async getMaterialHistory(productId: string, params: { page?: number; per_page?: number }): Promise<MaterialCostHistoryResult> {
    return safeFetch(async () => {
      const { data } = await api.get<MaterialCostHistoryResult>(`${MAT_URL}/${productId}/cost-history`, { params });
      return data;
    }, emptyHistory);
  },

  async updateMaterialCost(productId: string, materialCost: number, reason?: string): Promise<void> {
    await api.patch(`${MAT_URL}/${productId}/cost`, { material_cost: materialCost, reason });
  },
};
