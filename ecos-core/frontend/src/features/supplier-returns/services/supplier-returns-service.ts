import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  CreateSupplierReturnPayload,
  SupplierReturn,
  SupplierReturnsQuery,
  SupplierReturnsResult,
} from '@/features/supplier-returns/types/supplier-return';

type ReturnStats = {
  total: number;
  draft: number;
  waiting: number;
  approved: number;
  credit_pending: number;
  completed: number;
  total_value: number;
};

export const supplierReturnsService = {
  async list(params: SupplierReturnsQuery): Promise<SupplierReturnsResult> {
    const { data } = await api.get<ApiResponse<SupplierReturnsResult>>('/supplier-returns', { params });
    return data.data;
  },

  async get(id: string): Promise<SupplierReturn> {
    const { data } = await api.get<ApiResponse<SupplierReturn>>(`/supplier-returns/${id}`);
    return data.data;
  },

  async create(payload: CreateSupplierReturnPayload): Promise<SupplierReturn> {
    const { data } = await api.post<ApiResponse<SupplierReturn>>('/supplier-returns', payload);
    return data.data;
  },

  async update(id: string, payload: CreateSupplierReturnPayload): Promise<SupplierReturn> {
    const { data } = await api.put<ApiResponse<SupplierReturn>>(`/supplier-returns/${id}`, payload);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/supplier-returns/${id}`);
  },

  async submit(id: string): Promise<SupplierReturn> {
    const { data } = await api.post<ApiResponse<SupplierReturn>>(`/supplier-returns/${id}/submit`);
    return data.data;
  },

  async approve(id: string): Promise<SupplierReturn> {
    const { data } = await api.post<ApiResponse<SupplierReturn>>(`/supplier-returns/${id}/approve`);
    return data.data;
  },

  async reject(id: string, reason: string): Promise<SupplierReturn> {
    const { data } = await api.post<ApiResponse<SupplierReturn>>(`/supplier-returns/${id}/reject`, { reason });
    return data.data;
  },

  async markSent(id: string): Promise<SupplierReturn> {
    const { data } = await api.post<ApiResponse<SupplierReturn>>(`/supplier-returns/${id}/mark-sent`);
    return data.data;
  },

  async creditPending(id: string): Promise<SupplierReturn> {
    const { data } = await api.post<ApiResponse<SupplierReturn>>(`/supplier-returns/${id}/credit-pending`);
    return data.data;
  },

  async complete(
    id: string,
    payload: { credit_amount?: number; debit_note_number?: string; credit_received_date?: string },
  ): Promise<SupplierReturn> {
    const { data } = await api.post<ApiResponse<SupplierReturn>>(`/supplier-returns/${id}/complete`, payload);
    return data.data;
  },

  async cancel(id: string): Promise<SupplierReturn> {
    const { data } = await api.post<ApiResponse<SupplierReturn>>(`/supplier-returns/${id}/cancel`);
    return data.data;
  },

  async stats(): Promise<ReturnStats> {
    const { data } = await api.get<ApiResponse<ReturnStats>>('/supplier-returns/stats');
    return data.data;
  },
};
