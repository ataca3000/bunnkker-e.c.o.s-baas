import { api } from '@/lib/axios';
import type { CoverageArea, CoverageAreaPayload } from '@/features/branches/types/branch';
import type { ApiResponse } from '@/types';

export const branchCoverageService = {
  async list(branchId: string): Promise<CoverageArea[]> {
    const { data } = await api.get<ApiResponse<CoverageArea[]>>(
      `/branches/${branchId}/coverage`,
    );
    return data.data;
  },

  async create(branchId: string, payload: CoverageAreaPayload): Promise<CoverageArea> {
    const { data } = await api.post<ApiResponse<CoverageArea>>(
      `/branches/${branchId}/coverage`,
      payload,
    );
    return data.data;
  },

  async update(
    branchId: string,
    areaId: string,
    payload: CoverageAreaPayload,
  ): Promise<CoverageArea> {
    const { data } = await api.put<ApiResponse<CoverageArea>>(
      `/branches/${branchId}/coverage/${areaId}`,
      payload,
    );
    return data.data;
  },

  async remove(branchId: string, areaId: string): Promise<void> {
    await api.delete(`/branches/${branchId}/coverage/${areaId}`);
  },
};
