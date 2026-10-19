import { api } from '@/lib/axios';
import type {
  PurchaseOrder,
  PurchaseOrderPayload,
  PurchaseOrdersQuery,
  PurchaseOrdersResult,
} from '@/features/purchase-orders/types/purchase-order';
import type { ApiResponse } from '@/types';

export const purchaseOrdersService = {
  async list(params: PurchaseOrdersQuery): Promise<PurchaseOrdersResult> {
    const { data } = await api.get<ApiResponse<PurchaseOrdersResult>>('/purchase-orders', { params });
    return data.data;
  },

  async get(id: string): Promise<PurchaseOrder> {
    const { data } = await api.get<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`);
    return data.data;
  },

  async create(payload: PurchaseOrderPayload): Promise<PurchaseOrder> {
    const { data } = await api.post<ApiResponse<PurchaseOrder>>('/purchase-orders', payload);
    return data.data;
  },

  async update(id: string, payload: PurchaseOrderPayload): Promise<PurchaseOrder> {
    const { data } = await api.put<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/purchase-orders/${id}`);
  },

  async approve(id: string): Promise<PurchaseOrder> {
    const { data } = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/approve`);
    return data.data;
  },

  async cancel(id: string): Promise<PurchaseOrder> {
    const { data } = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/cancel`);
    return data.data;
  },

  async submit(id: string): Promise<PurchaseOrder> {
    const { data } = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/submit`);
    return data.data;
  },
};
