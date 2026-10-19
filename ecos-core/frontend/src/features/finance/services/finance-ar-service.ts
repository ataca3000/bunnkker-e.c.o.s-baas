import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

import type {
  ArAging,
  ArControlReconciliation,
  ArInvoice,
  ArInvoiceParams,
  ArReceipt,
  ArReceiptParams,
  CustomerLedger,
} from '../types/finance-ar';

/**
 * Accounts Receivable API client (EPIC-FINANCE-UI-001 Phase 4). Read-only against the
 * certified AR endpoints; unwraps the `{ data }` envelope. No backend changes.
 */
export const financeArService = {
  async aging(params: { as_of?: string; customer_id?: string } = {}): Promise<ArAging> {
    const { data } = await api.get<ApiResponse<ArAging>>('/finance/ar/aging', { params });
    return data.data;
  },

  async invoices(params: ArInvoiceParams = {}): Promise<ArInvoice[]> {
    const { data } = await api.get<ApiResponse<ArInvoice[]>>('/finance/ar/invoices', { params });
    return data.data;
  },

  async receipts(params: ArReceiptParams = {}): Promise<ArReceipt[]> {
    const { data } = await api.get<ApiResponse<ArReceipt[]>>('/finance/ar/receipts', { params });
    return data.data;
  },

  async customerLedger(customerId: string, params: { from?: string; to?: string } = {}): Promise<CustomerLedger> {
    const { data } = await api.get<ApiResponse<CustomerLedger>>(
      `/finance/ar/customers/${customerId}/ledger`,
      { params },
    );
    return data.data;
  },

  async controlReconciliation(): Promise<ArControlReconciliation> {
    const { data } = await api.get<ApiResponse<ArControlReconciliation>>(
      '/finance/control-reconciliation/receivable',
    );
    return data.data;
  },
};
