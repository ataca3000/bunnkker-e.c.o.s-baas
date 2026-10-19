/**
 * General Ledger types (TASK-FIN-UI-002). Mirror the certified Finance API shapes exactly.
 * No backend changes. Money values are numbers (EGP default) — never recalculated client-side.
 */

// ── Chart of Accounts ─────────────────────────────────────────────────────────
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';
export type FinancialStatement = 'balance_sheet' | 'income_statement';

export type Account = {
  id: string; // account UUID
  code: string;
  name: string;
  name_ar: string | null;
  account_type: AccountType;
  account_category: string | null;
  normal_balance: NormalBalance;
  statement: FinancialStatement;
  is_postable: boolean;
  is_control: boolean;
  control_subledger: string | null;
  currency: string;
  is_active: boolean;
};

export type AccountOption = {
  value: string;
  label: string;
  normal_balance?: string;
  statement?: string;
  type?: string;
};

export type AccountOptions = {
  account_types: AccountOption[];
  account_categories: AccountOption[];
};

export type AccountCreateInput = {
  code: string;
  name: string;
  name_ar?: string | null;
  account_type: AccountType;
  account_category?: string | null;
  parent_id?: number | null;
  is_postable?: boolean;
  is_control?: boolean;
  control_subledger?: string | null;
  currency?: string;
};

export type AccountListParams = {
  type?: AccountType;
  postable_only?: boolean;
};

// ── Journal Entries ───────────────────────────────────────────────────────────
export type JournalStatus = 'draft' | 'approved' | 'posted' | 'locked' | 'cancelled' | 'reversed';

/** Line shape as RETURNED by the API (account_id is the numeric id, not the UUID). */
export type JournalLine = {
  account_id: number;
  debit: number;
  credit: number;
  cost_center_id: number | null;
  description: string | null;
};

export type Journal = {
  id: string; // journal UUID
  reference: string | null;
  description: string | null;
  entry_date: string; // YYYY-MM-DD
  status: JournalStatus;
  source: string;
  total_debit: number | null;
  total_credit: number | null;
  reverses_journal_id: number | null;
  reversed_by_journal_id: number | null;
  created_by: number | null;
  approved_by: number | null;
  posted_by: number | null;
  posted_at: string | null;
  lines?: JournalLine[];
};

/** Line shape as ACCEPTED on create (account_id is the UUID; side + amount). */
export type JournalCreateLine = {
  account_id: string; // account UUID
  side: 'debit' | 'credit';
  amount: number;
  description?: string | null;
  cost_center_id?: number | null;
};

export type JournalCreateInput = {
  entry_date: string;
  reference?: string | null;
  description?: string | null;
  lines: JournalCreateLine[];
};

export type JournalListParams = {
  status?: JournalStatus;
};

// ── Trial Balance (GET /finance/trial-balance) ────────────────────────────────
export type TrialBalanceLine = {
  account_id: string; // account UUID
  account_code: string;
  account_name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  debit: number;
  credit: number;
  balance: number; // signed onto the account's normal side
};

export type TrialBalance = {
  company_id: string;
  fiscal_period_id: number | null;
  lines: TrialBalanceLine[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
};
