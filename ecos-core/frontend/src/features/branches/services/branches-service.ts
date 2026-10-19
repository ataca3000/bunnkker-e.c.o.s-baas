import { api } from '@/lib/axios';
import type {
  BranchesQuery,
  BranchesResult,
  Branch,
  BranchPayload,
} from '@/features/branches/types/branch';
import type { ApiResponse } from '@/types';

/**
 * Branches API client. Unwraps the standardized ApiResponse envelope.
 */
export const branchesService = {
  async list(params: BranchesQuery): Promise<BranchesResult> {
    const { data } = await api.get<ApiResponse<BranchesResult>>('/branches', { params });
    return data.data;
  },

  async get(id: string): Promise<Branch> {
    const { data } = await api.get<ApiResponse<Branch>>(`/branches/${id}`);
    return data.data;
  },

  async create(payload: BranchPayload): Promise<Branch> {
    const { data } = await api.post<ApiResponse<Branch>>('/branches', payload);
    return data.data;
  },

  async update(id: string, payload: BranchPayload): Promise<Branch> {
    const { data } = await api.put<ApiResponse<Branch>>(`/branches/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/branches/${id}`);
  },
};
