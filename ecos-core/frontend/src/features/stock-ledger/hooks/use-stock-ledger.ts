import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { stockLedgerService } from '@/features/stock-ledger/services/stock-ledger-service';
import type { StockMovementsQuery } from '@/features/stock-ledger/types/stock-movement';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export const STOCK_LEDGER_KEY = 'stock-movements';

export function useStockMovementsQuery(params: StockMovementsQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, STOCK_LEDGER_KEY, params],
    queryFn: () => stockLedgerService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useStockMovementQuery(id: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, STOCK_LEDGER_KEY, id],
    queryFn: () => stockLedgerService.get(id),
    enabled: Boolean(id),
  });
}
