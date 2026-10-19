import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  CreateSupplierInvoicePayload,
  SupplierInvoice,
  SupplierInvoicesQuery,
  SupplierInvoicesResult,
} from '@/features/supplier-invoices/types/supplier-invoice';

type InvoiceStats = {
  total: number;
  draft: number;
  validated: number;
  posted: number;
  failed: number;
  total_value: number;
  pending_value: number;
};

export const supplierInvoicesService = {
  async list(params: SupplierInvoicesQuery): Promise<SupplierInvoicesResult> {
    const { data } = await api.get<ApiResponse<SupplierInvoicesResult>>('/supplier-invoices', { params });
    return data.data;
  },

  async get(id: string): Promise<SupplierInvoice> {
    const { data } = await api.get<ApiResponse<SupplierInvoice>>(`/supplier-invoices/${id}`);
    return data.data;
  },

  async create(payload: CreateSupplierInvoicePayload): Promise<SupplierInvoice> {
    const { data } = await api.post<ApiResponse<SupplierInvoice>>('/supplier-invoices', payload);
    return data.data;
  },

  async update(id: string, payload: CreateSupplierInvoicePayload): Promise<SupplierInvoice> {
    const { data } = await api.put<ApiResponse<SupplierInvoice>>(`/supplier-invoices/${id}`, payload);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/supplier-invoices/${id}`);
  },

  async validate(id: string): Promise<SupplierInvoice> {
    const { data } = await api.post<ApiResponse<SupplierInvoice>>(`/supplier-invoices/${id}/validate`);
    return data.data;
  },

  async post(id: string): Promise<SupplierInvoice> {
    const { data } = await api.post<ApiResponse<SupplierInvoice>>(`/supplier-invoices/${id}/post`);
    return data.data;
  },

  async cancel(id: string): Promise<SupplierInvoice> {
    const { data } = await api.post<ApiResponse<SupplierInvoice>>(`/supplier-invoices/${id}/cancel`);
    return data.data;
  },

  async stats(): Promise<InvoiceStats> {
    const { data } = await api.get<ApiResponse<InvoiceStats>>('/supplier-invoices/stats');
    return data.data;
  },
};
