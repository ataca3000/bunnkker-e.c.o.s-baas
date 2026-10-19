import { useQuery } from '@tanstack/react-query';

import { useOrganizationContext } from '@/features/organization/context/organization-context';

import { financeArService } from '../services/finance-ar-service';
import type { ArInvoiceParams, ArReceiptParams } from '../types/finance-ar';

/**
 * React-query hooks for the Accounts Receivable workspace (Phase 4). Company-scoped keys,
 * all read-only. The customer-ledger query is lazy (enabled only when a drawer opens).
 */
function useCompanyId() {
  const { activeCompanyId } = useOrganizationContext();
  return activeCompanyId ?? 'global';
}

export function useArAging() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'ar', 'aging'],
    queryFn: () => financeArService.aging(),
  });
}

export function useArInvoices(params: ArInvoiceParams = {}) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'ar', 'invoices', params],
    queryFn: () => financeArService.invoices(params),
  });
}

export function useArReceipts(params: ArReceiptParams = {}) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'ar', 'receipts', params],
    queryFn: () => financeArService.receipts(params),
  });
}

export function useCustomerLedger(customerId: string | null) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'ar', 'ledger', customerId],
    queryFn: () => financeArService.customerLedger(customerId as string),
    enabled: Boolean(customerId),
  });
}

export function useArControlReconciliation() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'ar', 'reconciliation'],
    queryFn: () => financeArService.controlReconciliation(),
  });
}
