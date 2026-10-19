// Cash & Banking types — EPIC-FINANCE-UI-001 Phase 6.
// Mirror the certified /finance/cash and /finance/bank contracts exactly.
// Every figure is the backend's; nothing here is recalculated in the browser.

export type CashAccount = {
  id: string;
  code: string;
  name: string;
  currency: string;
  is_active: boolean;
};

export type BankAccount = {
  id: string;
  name: string;
  bank_name: string | null;
  iban: string | null;
  currency: string;
  is_active: boolean;
};

/** `receipt` and `payment` move cash; `adjustment` corrects a counted variance. */
export const CASH_TRANSACTION_TYPES = ['receipt', 'payment', 'adjustment'] as const;

export type CashTransactionType = (typeof CASH_TRANSACTION_TYPES)[number];

export type CashTransactionResult = {
  id: string;
  type: string;
  amount: number;
  /** Present once the transaction has posted to the ledger. */
  journal_entry_id: string | null;
};

export type CashSession = {
  id: string;
  status: string;
};

/**
 * The result of closing a session.
 *
 * `expected` and `variance` are computed by the backend from the session's
 * movements against the counted amount. A browser-side subtraction would
 * disagree the moment a transaction landed mid-count.
 */
export type CashSessionClose = {
  id: string;
  status: string;
  expected: number;
  variance: number;
};

export type CashTransferResult = {
  /** Outgoing leg uuid. */
  out: string;
  /** Incoming leg uuid. */
  in: string;
};

export type BankReconciliation = {
  id: string;
  status: string;
  book_balance: number;
  statement_balance: number;
  /** book_balance - statement_balance, as the backend computes it. */
  difference: number;
  completed_at: string | null;
};

export type OutstandingItem = {
  id: string;
  value_date: string | null;
  description: string | null;
  amount: number;
};

export type OutstandingItems = {
  items: OutstandingItem[];
  count: number;
  total: number;
};

// ── Write payloads ───────────────────────────────────────────────────────────

export type CreateCashAccountPayload = {
  code: string;
  name: string;
  gl_account_id: string;
  branch_id?: string | null;
  currency?: string;
};

export type CreateBankAccountPayload = {
  name: string;
  bank_name?: string | null;
  iban?: string | null;
  gl_account_id: string;
  currency?: string;
};

export type OpenSessionPayload = {
  opening_float?: number;
};

export type CloseSessionPayload = {
  counted_amount: number;
};

export type CashTransactionPayload = {
  type: CashTransactionType;
  amount: number;
  counterparty_account_id: string;
  transaction_date?: string | null;
  description?: string | null;
};

export type CashTransferPayload = {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transaction_date?: string | null;
  description?: string | null;
};
