/**
 * Finance frontend types (EPIC-FINANCE-UI-001). Mirror the certified Finance API
 * response shapes exactly — no backend changes. All amounts are numbers (EGP default);
 * format via useFormatter().money.
 */

// ── Executive Workspace (GET /finance/intelligence/executive-workspace) ───────
export type HealthComponent = {
  key: string;
  value: number;
  score: number;
  explanation: string;
};

export type FinancialHealth = {
  score: number;
  rating: 'strong' | 'healthy' | 'watch' | 'at_risk' | string;
  components: HealthComponent[];
};

export type ExecutiveAlert = {
  key: string;
  severity: 'critical' | 'warning' | string;
  message: string;
};

export type FinancialKpis = {
  gross_margin_pct: number;
  operating_margin_pct: number;
  net_margin_pct: number;
  current_ratio: number | null;
  receivables: number;
  payables: number;
};

export type ClosingStatus = { open: number; closed: number; locked: number; future: number };

export type ExecutiveWorkspace = {
  period: { from: string; to: string };
  financial_health: FinancialHealth;
  cash_position: number;
  revenue: number;
  expenses: number;
  profit: number;
  working_capital: number;
  financial_kpis: FinancialKpis;
  closing_status: ClosingStatus;
  alerts: ExecutiveAlert[];
};

// ── Executive Summary Report (POST /finance/intelligence/reports/generate) ────
export type ProfitAndLoss = {
  revenue: number;
  other_revenue: number;
  total_revenue: number;
  cost_of_sales: number;
  gross_profit: number;
  operating_expense: number;
  operating_profit: number;
  other_expense: number;
  net_profit: number;
  gross_margin_pct: number;
  operating_margin_pct: number;
  net_margin_pct: number;
};

export type BalanceSheet = {
  current_assets: number;
  non_current_assets: number;
  total_assets: number;
  current_liabilities: number;
  non_current_liabilities: number;
  total_liabilities: number;
  equity: number;
  working_capital: number;
  current_ratio: number | null;
};

export type ExecutiveSummaryReport = {
  report: string;
  period: { from: string; to: string };
  headline: Record<string, number | string>;
  profit_and_loss: ProfitAndLoss;
  balance_sheet: BalanceSheet;
};

// ── CFO Workspace (GET /finance/intelligence/cfo-workspace) ───────────────────
export type ExecutiveRecommendation = {
  category: string;
  priority: 'high' | 'medium' | 'low' | string;
  recommendation: string;
};

export type AgingTotals = {
  current: number;
  '1_30': number;
  '31_60': number;
  '61_90': number;
  '90_plus': number;
  total: number;
};

export type CfoWorkspace = {
  daily_summary: {
    as_of: string;
    cash_position: number;
    month_to_date_revenue: number;
    month_to_date_expense: number;
    month_to_date_profit: number;
  };
  outstanding_receivables: AgingTotals;
  outstanding_payables: AgingTotals;
  executive_recommendations: ExecutiveRecommendation[];
};

// ── Recent journal activity (GET /finance/journals) ───────────────────────────
export type JournalSummary = {
  id: string;
  number?: string | null;
  reference?: string | null;
  description?: string | null;
  status?: string | null;
  journal_date?: string | null;
  date?: string | null;
  posted_at?: string | null;
  total_debit?: number | null;
  total_credit?: number | null;
  amount?: number | null;
};
