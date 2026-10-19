import { useQuery } from '@tanstack/react-query';

import { useOrganizationContext } from '@/features/organization/context/organization-context';

import { financeApService } from '../services/finance-ap-service';
import type { ApBillParams, ApPaymentParams } from '../types/finance-ap';

/**
 * React-query hooks for the Accounts Payable workspace (Phase 5). Company-scoped keys, all
 * read-only. The supplier-ledger query is lazy (enabled only when a drawer opens).
 */
function useCompanyId() {
  const { activeCompanyId } = useOrganizationContext();
  return activeCompanyId ?? 'global';
}

export function useApAging() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'ap', 'aging'],
    queryFn: () => financeApService.aging(),
  });
}

export function useApBills(params: ApBillParams = {}) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'ap', 'bills', params],
    queryFn: () => financeApService.bills(params),
  });
}

export function useApPayments(params: ApPaymentParams = {}) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'ap', 'payments', params],
    queryFn: () => financeApService.payments(params),
  });
}

export function useSupplierLedger(supplierId: string | null) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'ap', 'ledger', supplierId],
    queryFn: () => financeApService.supplierLedger(supplierId as string),
    enabled: Boolean(supplierId),
  });
}

export function useApControlReconciliation() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'ap', 'reconciliation'],
    queryFn: () => financeApService.controlReconciliation(),
  });
}
