import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

import type {
  BankAccount,
  BankReconciliation,
  CashAccount,
  CashSession,
  CashSessionClose,
  CashTransactionPayload,
  CashTransactionResult,
  CashTransferPayload,
  CashTransferResult,
  CloseSessionPayload,
  CreateBankAccountPayload,
  CreateCashAccountPayload,
  OpenSessionPayload,
  OutstandingItems,
} from '../types/finance-treasury';

/**
 * Cash & Banking API client — EPIC-FINANCE-UI-001 Phase 6.
 *
 * Consumes the certified /finance/cash and /finance/bank endpoints and unwraps
 * the `{ data }` envelope. No backend changes.
 *
 * Note what the API does NOT offer, so the UI does not imply it: there is no
 * cash-transaction LIST endpoint and no bank-transaction list. Transactions are
 * write-only from here — each returns its own result, including the journal
 * entry id once posted. A transaction history would need a backend read that
 * does not exist.
 */
export const financeTreasuryService = {
  // ── Cash ───────────────────────────────────────────────────────────────────

  async cashAccounts(): Promise<CashAccount[]> {
    const { data } = await api.get<ApiResponse<CashAccount[]>>('/finance/cash/accounts');
    return data.data;
  },

  async createCashAccount(payload: CreateCashAccountPayload): Promise<{ id: string; code: string }> {
    const { data } = await api.post<ApiResponse<{ id: string; code: string }>>(
      '/finance/cash/accounts',
      payload,
    );
    return data.data;
  },

  async openSession(accountId: string, payload: OpenSessionPayload): Promise<CashSession> {
    const { data } = await api.post<ApiResponse<CashSession>>(
      `/finance/cash/accounts/${accountId}/sessions/open`,
      payload,
    );
    return data.data;
  },

  /** Returns the backend's expected balance and variance against the count. */
  async closeSession(sessionId: string, payload: CloseSessionPayload): Promise<CashSessionClose> {
    const { data } = await api.patch<ApiResponse<CashSessionClose>>(
      `/finance/cash/sessions/${sessionId}/close`,
      payload,
    );
    return data.data;
  },

  async recordCashTransaction(
    accountId: string,
    payload: CashTransactionPayload,
  ): Promise<CashTransactionResult> {
    const { data } = await api.post<ApiResponse<CashTransactionResult>>(
      `/finance/cash/accounts/${accountId}/transactions`,
      payload,
    );
    return data.data;
  },

  async transfer(payload: CashTransferPayload): Promise<CashTransferResult> {
    const { data } = await api.post<ApiResponse<CashTransferResult>>(
      '/finance/cash/transfers',
      payload,
    );
    return data.data;
  },

  // ── Banking ────────────────────────────────────────────────────────────────

  async bankAccounts(): Promise<BankAccount[]> {
    const { data } = await api.get<ApiResponse<BankAccount[]>>('/finance/bank/accounts');
    return data.data;
  },

  async createBankAccount(payload: CreateBankAccountPayload): Promise<{ id: string }> {
    const { data } = await api.post<ApiResponse<{ id: string }>>('/finance/bank/accounts', payload);
    return data.data;
  },

  // ── Reconciliation ─────────────────────────────────────────────────────────

  async startReconciliation(statementId: string): Promise<BankReconciliation> {
    const { data } = await api.post<ApiResponse<BankReconciliation>>(
      `/finance/bank/statements/${statementId}/reconcile`,
    );
    return data.data;
  },

  async autoMatch(reconciliationId: string): Promise<BankReconciliation> {
    const { data } = await api.post<ApiResponse<BankReconciliation>>(
      `/finance/bank/reconciliations/${reconciliationId}/auto-match`,
    );
    return data.data;
  },

  async outstanding(reconciliationId: string): Promise<OutstandingItems> {
    const { data } = await api.get<ApiResponse<OutstandingItems>>(
      `/finance/bank/reconciliations/${reconciliationId}/outstanding`,
    );
    return data.data;
  },

  async completeReconciliation(reconciliationId: string): Promise<BankReconciliation> {
    const { data } = await api.patch<ApiResponse<BankReconciliation>>(
      `/finance/bank/reconciliations/${reconciliationId}/complete`,
    );
    return data.data;
  },
};
