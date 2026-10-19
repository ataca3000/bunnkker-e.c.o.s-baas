import { api } from '@/lib/axios';
import type {
  GoodsReceipt,
  GoodsReceiptPayload,
  GoodsReceiptsQuery,
  GoodsReceiptsResult,
} from '@/features/goods-receipts/types/goods-receipt';
import type { ApiResponse } from '@/types';

export const goodsReceiptsService = {
  async list(params: GoodsReceiptsQuery): Promise<GoodsReceiptsResult> {
    const { data } = await api.get<ApiResponse<GoodsReceiptsResult>>('/goods-receipts', { params });
    return data.data;
  },

  async get(id: string): Promise<GoodsReceipt> {
    const { data } = await api.get<ApiResponse<GoodsReceipt>>(`/goods-receipts/${id}`);
    return data.data;
  },

  async create(payload: FormData | GoodsReceiptPayload): Promise<GoodsReceipt> {
    const { data } = await api.post<ApiResponse<GoodsReceipt>>('/goods-receipts', payload, {
      headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return data.data;
  },

  async update(id: string, payload: FormData | GoodsReceiptPayload): Promise<GoodsReceipt> {
    const { data } = await api.post<ApiResponse<GoodsReceipt>>(
      `/goods-receipts/${id}?_method=PUT`,
      payload,
      {
        headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
      },
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/goods-receipts/${id}`);
  },

  async post(id: string): Promise<GoodsReceipt> {
    const { data } = await api.post<ApiResponse<GoodsReceipt>>(`/goods-receipts/${id}/post`);
    return data.data;
  },
};
