import { api } from '@/lib/axios';
import type {
  Channel,
  ChannelPayload,
  ChannelsQuery,
  ChannelsResult,
  ImportResult,
  OrderImportResult,
} from '@/features/channels/types/channel';
import type { ApiResponse } from '@/types';

export const channelsService = {
  async list(params: ChannelsQuery): Promise<ChannelsResult> {
    const { data } = await api.get<ApiResponse<ChannelsResult>>('/channels', { params });
    return data.data;
  },

  async get(id: string): Promise<Channel> {
    const { data } = await api.get<ApiResponse<Channel>>(`/channels/${id}`);
    return data.data;
  },

  async create(payload: ChannelPayload): Promise<Channel> {
    const { data } = await api.post<ApiResponse<Channel>>('/channels', payload);
    return data.data;
  },

  async update(id: string, payload: ChannelPayload): Promise<Channel> {
    const { data } = await api.put<ApiResponse<Channel>>(`/channels/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/channels/${id}`);
  },

  async testConnection(id: string): Promise<Channel> {
    const { data } = await api.post<ApiResponse<Channel>>(`/channels/${id}/test-connection`);
    return data.data;
  },

  async importProducts(id: string): Promise<ImportResult> {
    const { data } = await api.post<ApiResponse<ImportResult>>(`/channels/${id}/import-products`);
    return data.data;
  },

  async importOrders(id: string): Promise<OrderImportResult> {
    const { data } = await api.post<ApiResponse<OrderImportResult>>(`/channels/${id}/import-orders`);
    return data.data;
  },
};
