import { api } from '@/lib/axios';
import type {
  StockMovement,
  StockMovementsQuery,
  StockMovementsResult,
} from '@/features/stock-ledger/types/stock-movement';
import type { ApiResponse } from '@/types';

export const stockLedgerService = {
  async list(params: StockMovementsQuery): Promise<StockMovementsResult> {
    const { data } = await api.get<ApiResponse<StockMovementsResult>>('/stock-movements', { params });
    return data.data;
  },

  async get(id: string): Promise<StockMovement> {
    const { data } = await api.get<ApiResponse<StockMovement>>(`/stock-movements/${id}`);
    return data.data;
  },
};
