import { api } from '@/lib/axios';
import type {
  Fulfillment,
  FulfillmentPayload,
  FulfillmentsQuery,
  FulfillmentsResult,
} from '@/features/fulfillments/types/fulfillment';
import type { ApiResponse } from '@/types';

export const fulfillmentsService = {
  async list(params: FulfillmentsQuery): Promise<FulfillmentsResult> {
    const { data } = await api.get<ApiResponse<FulfillmentsResult>>('/fulfillments', { params });
    return data.data;
  },

  async get(id: string): Promise<Fulfillment> {
    const { data } = await api.get<ApiResponse<Fulfillment>>(`/fulfillments/${id}`);
    return data.data;
  },

  async create(payload: FulfillmentPayload): Promise<Fulfillment> {
    const { data } = await api.post<ApiResponse<Fulfillment>>('/fulfillments', payload);
    return data.data;
  },

  async update(id: string, payload: FulfillmentPayload): Promise<Fulfillment> {
    const { data } = await api.put<ApiResponse<Fulfillment>>(`/fulfillments/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/fulfillments/${id}`);
  },

  async fulfill(id: string): Promise<Fulfillment> {
    const { data } = await api.post<ApiResponse<Fulfillment>>(`/fulfillments/${id}/fulfill`);
    return data.data;
  },

  async cancel(id: string): Promise<Fulfillment> {
    const { data } = await api.post<ApiResponse<Fulfillment>>(`/fulfillments/${id}/cancel`);
    return data.data;
  },
};
