import { api } from '@/lib/axios';
import type { Bom, BomPayload, BomsQuery, BomsResult } from '@/features/boms/types/bom';
import type { ApiResponse } from '@/types';

export const bomsService = {
  async list(params: BomsQuery): Promise<BomsResult> {
    const { data } = await api.get<ApiResponse<BomsResult>>('/boms', { params });
    return data.data;
  },

  async get(id: string): Promise<Bom> {
    const { data } = await api.get<ApiResponse<Bom>>(`/boms/${id}`);
    return data.data;
  },

  async create(payload: BomPayload): Promise<Bom> {
    const { data } = await api.post<ApiResponse<Bom>>('/boms', payload);
    return data.data;
  },

  async update(id: string, payload: BomPayload): Promise<Bom> {
    const { data } = await api.put<ApiResponse<Bom>>(`/boms/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/boms/${id}`);
  },
};
