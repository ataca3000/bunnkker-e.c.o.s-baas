import { api } from '@/lib/axios';
import type {
  WarehousesQuery,
  WarehousesResult,
  Warehouse,
  WarehousePayload,
} from '@/features/warehouses/types/warehouse';
import type { ApiResponse } from '@/types';

/**
 * Warehouses API client. Unwraps the standardized ApiResponse envelope.
 */
export const warehousesService = {
  async list(params: WarehousesQuery): Promise<WarehousesResult> {
    const { data } = await api.get<ApiResponse<WarehousesResult>>('/warehouses', { params });
    return data.data;
  },

  async get(id: string): Promise<Warehouse> {
    const { data } = await api.get<ApiResponse<Warehouse>>(`/warehouses/${id}`);
    return data.data;
  },

  async create(payload: WarehousePayload): Promise<Warehouse> {
    const { data } = await api.post<ApiResponse<Warehouse>>('/warehouses', payload);
    return data.data;
  },

  async update(id: string, payload: WarehousePayload): Promise<Warehouse> {
    const { data } = await api.put<ApiResponse<Warehouse>>(`/warehouses/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/warehouses/${id}`);
  },
};
