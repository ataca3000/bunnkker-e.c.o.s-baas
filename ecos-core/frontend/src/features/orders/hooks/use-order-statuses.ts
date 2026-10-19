import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

export type OrderStatusOption = {
  value: string;
  label: string;
};

export type OrderStatusesData = {
  all: OrderStatusOption[];
  entry_options: Record<string, OrderStatusOption[]>;
};

export function useOrderStatuses() {
  return useQuery({
    queryKey: ['order-statuses'],
    queryFn:  async (): Promise<OrderStatusesData> => {
      const { data } = await api.get<ApiResponse<OrderStatusesData>>('/orders/statuses');
      return data.data;
    },
    staleTime: Infinity,
  });
}
