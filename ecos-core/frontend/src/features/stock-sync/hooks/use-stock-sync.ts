import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { stockSyncService } from '@/features/stock-sync/services/stock-sync-service';
import type { StockSyncLogsQuery, SyncStockResult } from '@/features/stock-sync/types/stock-sync';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export const STOCK_SYNC_LOGS_KEY = 'stock-sync-logs';

export function useStockSyncLogsQuery(params: StockSyncLogsQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, STOCK_SYNC_LOGS_KEY, params],
    queryFn: () => stockSyncService.listLogs(params),
    placeholderData: keepPreviousData,
  });
}

export function useSyncStock() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation<SyncStockResult, Error, string>({
    mutationFn: (channelId: string) => stockSyncService.syncStock(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, STOCK_SYNC_LOGS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'channels'] });
    },
  });
}
