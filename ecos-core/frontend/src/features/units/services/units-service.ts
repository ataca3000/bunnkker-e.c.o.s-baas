import { api } from '@/lib/axios';
import type { UnitsQuery, UnitsResult, Unit, UnitPayload } from '@/features/units/types/unit';
import type { ApiResponse } from '@/types';

/**
 * Units API client. Unwraps the standardized ApiResponse envelope.
 */
export const unitsService = {
  async list(params: UnitsQuery): Promise<UnitsResult> {
    const { data } = await api.get<ApiResponse<UnitsResult>>('/units', { params });
    return data.data;
  },

  async get(id: string): Promise<Unit> {
    const { data } = await api.get<ApiResponse<Unit>>(`/units/${id}`);
    return data.data;
  },

  async create(payload: UnitPayload): Promise<Unit> {
    const { data } = await api.post<ApiResponse<Unit>>('/units', payload);
    return data.data;
  },

  async update(id: string, payload: UnitPayload): Promise<Unit> {
    const { data } = await api.put<ApiResponse<Unit>>(`/units/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/units/${id}`);
  },
};
