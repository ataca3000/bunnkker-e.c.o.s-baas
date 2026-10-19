import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

import type {
  ApAging,
  ApBill,
  ApBillParams,
  ApControlReconciliation,
  ApPayment,
  ApPaymentParams,
  SupplierLedger,
} from '../types/finance-ap';

/**
 * Accounts Payable API client (EPIC-FINANCE-UI-001 Phase 5). Read-only against the certified
 * AP endpoints; unwraps the `{ data }` envelope. No backend changes.
 */
export const financeApService = {
  async aging(params: { as_of?: string; supplier_id?: string } = {}): Promise<ApAging> {
    const { data } = await api.get<ApiResponse<ApAging>>('/finance/ap/aging', { params });
    return data.data;
  },

  async bills(params: ApBillParams = {}): Promise<ApBill[]> {
    const { data } = await api.get<ApiResponse<ApBill[]>>('/finance/ap/bills', { params });
    return data.data;
  },

  async payments(params: ApPaymentParams = {}): Promise<ApPayment[]> {
    const { data } = await api.get<ApiResponse<ApPayment[]>>('/finance/ap/payments', { params });
    return data.data;
  },

  async supplierLedger(supplierId: string, params: { from?: string; to?: string } = {}): Promise<SupplierLedger> {
    const { data } = await api.get<ApiResponse<SupplierLedger>>(
      `/finance/ap/suppliers/${supplierId}/ledger`,
      { params },
    );
    return data.data;
  },

  async controlReconciliation(): Promise<ApControlReconciliation> {
    const { data } = await api.get<ApiResponse<ApControlReconciliation>>(
      '/finance/control-reconciliation/payable',
    );
    return data.data;
  },
};
