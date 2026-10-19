// Financial Control types — EPIC-FINANCE-UI-001 Phase 7.
// Fiscal calendar, period & year-end closing, budgets, budget control, tax and VAT.
// Mirror the certified /finance endpoints exactly. Every amount, percentage and
// readiness score below is computed by the backend and displayed unmodified.

// ── Fiscal calendar ──────────────────────────────────────────────────────────

/** future → open → closed → locked. Only `open` accepts postings. */
export const PERIOD_STATUSES = ['future', 'open', 'closed', 'locked'] as const;

export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export type FiscalPeriod = {
  id: string;
  period_number: number;
  name: string;
  status: PeriodStatus;
  start_date: string | null;
  end_date: string | null;
};

export type FiscalYear = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  periods: FiscalPeriod[];
};

export type FiscalOptions = {
  period_statuses: PeriodStatus[];
};

export type CreateFiscalYearPayload = {
  name: string;
  start_date: string;
  end_date: string;
  period_count?: number;
};

/** The trimmed payload returned by the period transition endpoints. */
export type PeriodTransitionResult = {
  id: string;
  name: string;
  status: PeriodStatus;
  /** Present on open/close/lock, absent on soft/hard close and reopen. */
  accepts_postings?: boolean;
};

export type PeriodClosureEntry = {
  action: string;
  close_type: string | null;
  from: string | null;
  to: string | null;
  reason: string | null;
  actor_id: number | null;
  at: string | null;
};

// ── Closing runs ─────────────────────────────────────────────────────────────

export type ClosingCheckStatus = 'passed' | 'failed' | 'pending' | 'skipped';

export type ClosingRunItem = {
  key: string;
  label: string;
  category: string | null;
  status: ClosingCheckStatus;
  is_blocking: boolean;
  detail: string | null;
};

export type ClosingRun = {
  id: string;
  scope: string;
  status: string;
  /** 0–100, computed by the backend's readiness scorer. */
  readiness_score: number | null;
  validated_at: string | null;
  closed_at: string | null;
  /** Only populated by show and validate; null on start and close. */
  items: ClosingRunItem[] | null;
};

// ── Closing workspace (read-only dashboard) ──────────────────────────────────

export type ClosingWorkspace = {
  period: { id: string; name: string; status: PeriodStatus };
  closing_progress: { total: number; passed: number; failed: number; pct: number };
  open_tasks: { key: string; label: string; detail: string | null }[];
  reconciliation_status: Record<
    string,
    { reconciled: boolean | null; difference?: number; note?: string }
  >;
  pending_journals: number;
  vat_status: { open_periods: number };
  control_exceptions: { open_total: number; critical: number };
  close_readiness_score: number;
};

// ── Year-end ─────────────────────────────────────────────────────────────────

export type YearEndClosing = {
  id: string;
  status: string;
  net_income: number;
  run_count: number;
  pnl_closing_journal_id: number | null;
  opening_journal_id: number | null;
  closed_at: string | null;
  finalized_at: string | null;
};

export type YearEndClosePayload = {
  /** Account UUID, resolved server-side. */
  retained_earnings_account_id: string;
  next_fiscal_year_id?: string | null;
};

// ── Budgets ──────────────────────────────────────────────────────────────────

export type Budget = {
  id: string;
  name: string;
  version: string;
  scenario: string;
  status: string;
  currency: string;
  total: number;
  approved_at: string | null;
};

/** The analytic dimension a budget line and its actuals are measured on. */
export const BUDGET_DIMENSIONS = [
  'company',
  'department',
  'branch',
  'cost_center',
  'project',
] as const;

export type BudgetDimension = (typeof BUDGET_DIMENSIONS)[number];

export type BudgetVsActualLine = {
  line_id: string;
  account_id: string | null;
  account_code: string | null;
  dimension_type: BudgetDimension;
  dimension_id: string | null;
  period_number: number | null;
  budget: number;
  actual: number;
  committed: number;
  available: number;
  consumption_pct: number;
  /** ok | warn | over — the backend's threshold verdict, not a UI rule. */
  status: 'ok' | 'warn' | 'over';
};

export type BudgetVsActual = {
  budget_id: string;
  lines: BudgetVsActualLine[];
  totals: {
    budget: number;
    actual: number;
    committed: number;
    available: number;
    consumption_pct: number;
  };
};

export type CreateBudgetPayload = {
  /** Fiscal year UUID. */
  fiscal_year_id: string;
  name: string;
  version?: string;
  scenario?: string;
  currency?: string;
  description?: string | null;
};

export type AddBudgetLinePayload = {
  /** Account UUID. */
  account_id: string;
  amount: number;
  dimension_type?: BudgetDimension;
  dimension_id?: string | null;
  period_number?: number | null;
  notes?: string | null;
};

// ── Budget control ───────────────────────────────────────────────────────────

export type BudgetContext = {
  fiscal_year_id: string;
  account_id: string;
  dimension_type?: BudgetDimension;
  dimension_id?: string | null;
  period_number?: number | null;
};

export type BudgetAvailability = {
  budget: number;
  actual: number;
  committed: number;
  available: number;
  consumption_pct: number;
};

/** The pre-commit verdict an operational flow would receive. */
export type BudgetVerdict = {
  verdict: 'ok' | 'warn' | 'blocked';
  allowed: boolean;
  projected_consumption_pct: number;
  available: number;
  budget: number;
  warn_threshold_pct: number;
  block_threshold_pct: number;
};

export type BudgetControlRulePayload = {
  scope?: 'global' | 'account' | 'dimension';
  account_id?: string | null;
  dimension_type?: string | null;
  dimension_id?: string | null;
  warn_threshold_pct?: number;
  block_threshold_pct?: number;
  action?: 'warn' | 'block' | 'none';
};

// ── Tax ──────────────────────────────────────────────────────────────────────

export type TaxCategory = {
  id: string;
  code: string;
  name: string;
  is_recoverable: boolean;
  is_active: boolean;
};

export type TaxCode = {
  id: string;
  code: string;
  name: string;
  tax_type: string | null;
  rate: number;
  is_recoverable: boolean;
  is_active: boolean;
};

export type CreateTaxCategoryPayload = {
  code: string;
  name: string;
  name_ar?: string | null;
  is_recoverable?: boolean;
};

// ── VAT ──────────────────────────────────────────────────────────────────────

export type VatPeriod = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  settlement_journal_id: number | null;
};

/**
 * The live, derived figures for a VAT period. Computed from the ledger's VAT
 * accounts over the period window — never stored, never recalculated here.
 */
export type VatReport = {
  period: string;
  status: string;
  window: [string | null, string | null];
  output_vat: number;
  input_vat_recoverable: number;
  input_vat_non_recoverable: number;
  net_payable: number;
};

/** The filed snapshot produced by generating a return. */
export type VatReturn = {
  id: string;
  output_vat: number;
  input_vat_recoverable: number;
  input_vat_non_recoverable: number;
  net_payable: number;
  status: string;
};

export type CreateVatPeriodPayload = {
  name: string;
  start_date: string;
  end_date: string;
};
