import { api } from '@/lib/axios';
import type {
  CompaniesQuery,
  CompaniesResult,
  Company,
  CompanyPayload,
} from '@/features/companies/types/company';
import type { ApiResponse } from '@/types';

/**
 * Companies API client. Unwraps the standardized ApiResponse envelope.
 */
export const companiesService = {
  async list(params: CompaniesQuery): Promise<CompaniesResult> {
    const { data } = await api.get<ApiResponse<CompaniesResult>>('/companies', { params });
    return data.data;
  },

  async get(id: string): Promise<Company> {
    const { data } = await api.get<ApiResponse<Company>>(`/companies/${id}`);
    return data.data;
  },

  async create(payload: CompanyPayload): Promise<Company> {
    const { data } = await api.post<ApiResponse<Company>>('/companies', payload);
    return data.data;
  },

  async update(id: string, payload: CompanyPayload): Promise<Company> {
    const { data } = await api.put<ApiResponse<Company>>(`/companies/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/companies/${id}`);
  },
};
