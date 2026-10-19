import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  BusinessAccount,
  BusinessAccountPayload,
  BusinessAccountsQuery,
  BusinessAccountsResult,
} from '@/features/business-accounts/types/business-account';

export const businessAccountsService = {
  async list(params: BusinessAccountsQuery): Promise<BusinessAccountsResult> {
    const { data } = await api.get<ApiResponse<BusinessAccountsResult>>('/business-accounts', { params });
    return data.data;
  },

  async get(id: string): Promise<BusinessAccount> {
    const { data } = await api.get<ApiResponse<BusinessAccount>>(`/business-accounts/${id}`);
    return data.data;
  },

  async create(payload: BusinessAccountPayload): Promise<BusinessAccount> {
    const { data } = await api.post<ApiResponse<BusinessAccount>>('/business-accounts', payload);
    return data.data;
  },

  async update(id: string, payload: Omit<BusinessAccountPayload, 'company_id'>): Promise<BusinessAccount> {
    const { data } = await api.put<ApiResponse<BusinessAccount>>(`/business-accounts/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/business-accounts/${id}`);
  },
};
