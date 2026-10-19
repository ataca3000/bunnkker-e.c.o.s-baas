import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganizationContext } from '@/features/organization/context/organization-context';

import { financeTreasuryService } from '../services/finance-treasury-service';
import type {
  CashTransactionPayload,
  CashTransferPayload,
  CloseSessionPayload,
  CreateBankAccountPayload,
  CreateCashAccountPayload,
  OpenSessionPayload,
} from '../types/finance-treasury';

/**
 * Cash & Banking hooks (Phase 6). Company-scoped keys, matching the AR/AP
 * workspaces.
 *
 * Every write invalidates the whole `finance` prefix rather than one key: a cash
 * transaction posts a journal entry, a transfer moves balances between two
 * accounts, and completing a reconciliation changes the book balance. A narrower
 * invalidation would leave the statements and ledger views contradicting the
 * treasury views.
 */
function useCompanyId() {
  const { activeCompanyId } = useOrganizationContext();
  return activeCompanyId ?? 'global';
}

function useFinanceInvalidation() {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  return () => queryClient.invalidateQueries({ queryKey: ['company', companyId, 'finance'] });
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useCashAccounts() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'cash', 'accounts'],
    queryFn: () => financeTreasuryService.cashAccounts(),
  });
}

export function useBankAccounts() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'bank', 'accounts'],
    queryFn: () => financeTreasuryService.bankAccounts(),
  });
}

/** Lazy: only fetched once a reconciliation is selected. */
export function useOutstandingItems(reconciliationId: string | null) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'bank', 'outstanding', reconciliationId],
    queryFn: () => financeTreasuryService.outstanding(reconciliationId as string),
    enabled: reconciliationId !== null,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateCashAccount() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (payload: CreateCashAccountPayload) =>
      financeTreasuryService.createCashAccount(payload),
    onSuccess: invalidate,
  });
}

export function useCreateBankAccount() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (payload: CreateBankAccountPayload) =>
      financeTreasuryService.createBankAccount(payload),
    onSuccess: invalidate,
  });
}

export function useOpenCashSession() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: OpenSessionPayload }) =>
      financeTreasuryService.openSession(accountId, payload),
    onSuccess: invalidate,
  });
}

export function useCloseCashSession() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: string; payload: CloseSessionPayload }) =>
      financeTreasuryService.closeSession(sessionId, payload),
    onSuccess: invalidate,
  });
}

export function useRecordCashTransaction() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: CashTransactionPayload }) =>
      financeTreasuryService.recordCashTransaction(accountId, payload),
    onSuccess: invalidate,
  });
}

export function useCashTransfer() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (payload: CashTransferPayload) => financeTreasuryService.transfer(payload),
    onSuccess: invalidate,
  });
}

export function useAutoMatchReconciliation() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (reconciliationId: string) => financeTreasuryService.autoMatch(reconciliationId),
    onSuccess: invalidate,
  });
}

export function useCompleteReconciliation() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (reconciliationId: string) =>
      financeTreasuryService.completeReconciliation(reconciliationId),
    onSuccess: invalidate,
  });
}
