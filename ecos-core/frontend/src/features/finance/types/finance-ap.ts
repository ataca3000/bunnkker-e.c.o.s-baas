/**
 * Accounts Payable types (EPIC-FINANCE-UI-001 Phase 5). Mirror the certified AP API shapes
 * exactly. Read-only. Money values are numbers (EGP default) — never recalculated in the
 * browser. NOTE: AP payloads expose only `supplier_id` (uuid); the API carries no supplier
 * name (a documented backend gap — the Finance ↔ vendor boundary).
 */

export type DocumentStatus = 'draft' | 'posted' | 'void';
/** AP payments have a maker/checker lifecycle (distinct from AR receipts). */
export type PaymentStatus = 'draft' | 'approved' | 'posted' | 'void';
export type SupplierDocumentType = 'bill' | 'credit_note' | 'debit_note';
export type SupplierLedgerEntryType = 'bill' | 'credit_note' | 'debit_note' | 'payment';

export const AP_AGING_BUCKETS = ['current', '1_30', '31_60', '61_90', '90_plus'] as const;
export type ApAgingBucket = (typeof AP_AGING_BUCKETS)[number];

export type ApAgingTotals = Record<ApAgingBucket, number> & { total: number };
export type ApAgingSupplierRow = { supplier_id: string } & ApAgingTotals;

export type ApAging = {
  as_of: string;
  buckets: ApAgingBucket[];
  suppliers: ApAgingSupplierRow[];
  totals: ApAgingTotals;
};

export type ApBill = {
  id: string; // uuid
  supplier_id: string;
  document_type: SupplierDocumentType;
  number: string;
  bill_date: string | null;
  due_date: string | null;
  currency: string;
  subtotal: number;
  tax_total: number;
  total: number;
  status: DocumentStatus;
  outstanding: number | null; // null unless posted
  journal_entry_id: number | null;
  posted_at: string | null;
  lines: ApBillLine[] | null;
};

export type ApBillLine = {
  expense_account_id: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  net_amount: number;
  tax_code_id: number | null;
  tax_amount: number;
  cost_center_id: number | null;
  branch_id: string | null;
};

export type ApPayment = {
  id: string; // uuid
  supplier_id: string;
  number: string;
  payment_date: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  unallocated: number | null; // null unless posted
  journal_entry_id: number | null;
  approved_by: number | null; // user id — not a name
  approved_at: string | null;
  posted_at: string | null;
};

export type SupplierLedgerLine = {
  id: number;
  uuid: string;
  entry_date: string;
  entry_type: SupplierLedgerEntryType;
  description: string | null;
  debit: number;
  credit: number;
  amount: number;
  running_balance: number;
  journal_entry_id: number | null;
};

export type SupplierLedger = {
  supplier_id: string;
  opening_balance: number;
  closing_balance: number;
  lines: SupplierLedgerLine[];
};

export type ApControlReconciliation = {
  subledger: string;
  control_account: { id: number; code: string; name: string };
  gl_balance: number;
  subledger_balance: number;
  difference: number;
  is_reconciled: boolean;
};

export type ApBillParams = { supplier_id?: string; status?: DocumentStatus };
export type ApPaymentParams = { supplier_id?: string };
