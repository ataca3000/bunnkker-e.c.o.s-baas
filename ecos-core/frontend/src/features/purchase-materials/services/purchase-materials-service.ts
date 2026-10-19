import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  PurchaseMaterial,
  PurchaseMaterialsQuery,
  PurchaseMaterialsResult,
  CreatePurchaseMaterialPayload,
  UpdatePurchaseMaterialPayload,
  PurchaseMaterialStats,
  ProductProcurementPanel,
  DemandAnalysisData,
} from '../types/purchase-material';

type ListEnvelope = { items: PurchaseMaterial[]; meta: PurchaseMaterialsResult['meta'] };

export const purchaseMaterialsService = {
  async list(params: PurchaseMaterialsQuery = {}): Promise<PurchaseMaterialsResult> {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'),
    );
    const { data } = await api.get<ApiResponse<ListEnvelope>>('/purchase-materials', { params: filtered });
    return { items: data.data.items, meta: data.data.meta };
  },

  async get(id: string): Promise<PurchaseMaterial> {
    const { data } = await api.get<ApiResponse<PurchaseMaterial>>(`/purchase-materials/${id}`);
    return data.data;
  },

  async create(payload: CreatePurchaseMaterialPayload): Promise<PurchaseMaterial> {
    const { data } = await api.post<ApiResponse<PurchaseMaterial>>('/purchase-materials', payload);
    return data.data;
  },

  async update(id: string, payload: UpdatePurchaseMaterialPayload): Promise<PurchaseMaterial> {
    const { data } = await api.put<ApiResponse<PurchaseMaterial>>(`/purchase-materials/${id}`, payload);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/purchase-materials/${id}`);
  },

  async submit(id: string): Promise<PurchaseMaterial> {
    const { data } = await api.post<ApiResponse<PurchaseMaterial>>(`/purchase-materials/${id}/submit`);
    return data.data;
  },

  async approve(id: string): Promise<PurchaseMaterial> {
    const { data } = await api.post<ApiResponse<PurchaseMaterial>>(`/purchase-materials/${id}/approve`);
    return data.data;
  },

  async reject(id: string, reason?: string): Promise<PurchaseMaterial> {
    const { data } = await api.post<ApiResponse<PurchaseMaterial>>(`/purchase-materials/${id}/reject`, { reason });
    return data.data;
  },

  async hold(id: string): Promise<PurchaseMaterial> {
    const { data } = await api.post<ApiResponse<PurchaseMaterial>>(`/purchase-materials/${id}/hold`);
    return data.data;
  },

  async cancel(id: string): Promise<PurchaseMaterial> {
    const { data } = await api.post<ApiResponse<PurchaseMaterial>>(`/purchase-materials/${id}/cancel`);
    return data.data;
  },

  async assignBuyer(id: string, buyerName: string): Promise<PurchaseMaterial> {
    const { data } = await api.post<ApiResponse<PurchaseMaterial>>(`/purchase-materials/${id}/assign-buyer`, {
      buyer_name: buyerName,
    });
    return data.data;
  },

  async selectLineSupplier(
    materialId: string,
    lineId: string,
    payload: { supplier_id: string; agreed_price?: number | null; agreed_qty?: number | null; lead_time_days?: number | null },
  ): Promise<unknown> {
    const { data } = await api.post<ApiResponse<unknown>>(
      `/purchase-materials/${materialId}/lines/${lineId}/select-supplier`,
      payload,
    );
    return data.data;
  },

  async getStats(params: { company_id?: string; warehouse_id?: string } = {}): Promise<PurchaseMaterialStats> {
    const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    const { data } = await api.get<ApiResponse<PurchaseMaterialStats>>('/purchase-materials/stats', { params: filtered });
    return data.data;
  },

  async getProcurementPanel(
    productId: string,
    params: { warehouse_id?: string; requested_qty?: number; required_date?: string } = {},
  ): Promise<ProductProcurementPanel> {
    const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    const { data } = await api.get<ApiResponse<ProductProcurementPanel>>(
      `/purchase-materials/procurement-panel/${productId}`,
      { params: filtered },
    );
    return data.data;
  },

  async getDemandAnalysis(
    productId: string,
    params: { warehouse_id?: string } = {},
  ): Promise<DemandAnalysisData> {
    const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    const { data } = await api.get<ApiResponse<DemandAnalysisData>>(
      `/demand-analysis/${productId}`,
      { params: filtered },
    );
    return data.data;
  },
};
