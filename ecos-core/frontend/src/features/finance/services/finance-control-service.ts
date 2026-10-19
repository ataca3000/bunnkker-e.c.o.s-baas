import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

import type {
  AddBudgetLinePayload,
  Budget,
  BudgetAvailability,
  BudgetContext,
  BudgetControlRulePayload,
  BudgetVerdict,
  BudgetVsActual,
  BudgetVsActualLine,
  ClosingRun,
  ClosingWorkspace,
  CreateBudgetPayload,
  CreateFiscalYearPayload,
  CreateTaxCategoryPayload,
  CreateVatPeriodPayload,
  FiscalOptions,
  FiscalYear,
  PeriodClosureEntry,
  PeriodTransitionResult,
  TaxCategory,
  TaxCode,
  VatPeriod,
  VatReport,
  VatReturn,
  YearEndClosePayload,
  YearEndClosing,
} from '../types/finance-control';

/**
 * Financial Control API client — EPIC-FINANCE-UI-001 Phase 7.
 *
 * Fiscal calendar, period and year-end closing, budgets, budget control, tax
 * and VAT. Consumes the certified endpoints and unwraps the `{ data }`
 * envelope. No backend changes.
 *
 * `fiscal/options` is the one endpoint that answers without an envelope — it
 * returns `{ period_statuses: [...] }` directly, so it is read as such rather
 * than forced through the same unwrap.
 *
 * Contract gaps recorded here so the UI does not imply capability it lacks:
 *   • POST /finance/tax/codes requires the NUMERIC tax_category_id and account
 *     ids, while every read endpoint exposes UUIDs only. Tax codes are
 *     therefore read-only from this workspace.
 *   • There is no list endpoint for closing runs, budget commitments or budget
 *     control rules — each is addressed by id or created blind.
 *   • GET /finance/year-end/{yearUuid} returns `null` (not 404) when a year has
 *     never been closed.
 */
export const financeControlService = {
  // ── Fiscal calendar ────────────────────────────────────────────────────────

  async fiscalOptions(): Promise<FiscalOptions> {
    const { data } = await api.get<FiscalOptions>('/finance/fiscal/options');
    return data;
  },

  async fiscalYears(): Promise<FiscalYear[]> {
    const { data } = await api.get<ApiResponse<FiscalYear[]>>('/finance/fiscal/years');
    return data.data;
  },

  async createFiscalYear(payload: CreateFiscalYearPayload): Promise<{ id: string; name: string }> {
    const { data } = await api.post<ApiResponse<{ id: string; name: string }>>(
      '/finance/fiscal/years',
      payload,
    );
    return data.data;
  },

  async openPeriod(periodId: string): Promise<PeriodTransitionResult> {
    const { data } = await api.patch<ApiResponse<PeriodTransitionResult>>(
      `/finance/fiscal/periods/${periodId}/open`,
    );
    return data.data;
  },

  async closePeriod(periodId: string): Promise<PeriodTransitionResult> {
    const { data } = await api.patch<ApiResponse<PeriodTransitionResult>>(
      `/finance/fiscal/periods/${periodId}/close`,
    );
    return data.data;
  },

  /** Permanent. A locked period has no transition out. */
  async lockPeriod(periodId: string): Promise<PeriodTransitionResult> {
    const { data } = await api.patch<ApiResponse<PeriodTransitionResult>>(
      `/finance/fiscal/periods/${periodId}/lock`,
    );
    return data.data;
  },

  // ── Period closing ─────────────────────────────────────────────────────────

  async softClosePeriod(periodId: string, reason?: string): Promise<PeriodTransitionResult> {
    const { data } = await api.post<ApiResponse<PeriodTransitionResult>>(
      `/finance/periods/${periodId}/soft-close`,
      { reason },
    );
    return data.data;
  },

  async hardClosePeriod(periodId: string, reason?: string): Promise<PeriodTransitionResult> {
    const { data } = await api.post<ApiResponse<PeriodTransitionResult>>(
      `/finance/periods/${periodId}/hard-close`,
      { reason },
    );
    return data.data;
  },

  /** The API requires a reason: a reopen is an audited exception, not a toggle. */
  async reopenPeriod(periodId: string, reason: string): Promise<PeriodTransitionResult> {
    const { data } = await api.post<ApiResponse<PeriodTransitionResult>>(
      `/finance/periods/${periodId}/reopen`,
      { reason },
    );
    return data.data;
  },

  async closureHistory(periodId: string): Promise<PeriodClosureEntry[]> {
    const { data } = await api.get<ApiResponse<PeriodClosureEntry[]>>(
      `/finance/periods/${periodId}/closure-history`,
    );
    return data.data;
  },

  // ── Closing runs ───────────────────────────────────────────────────────────

  async startClosingRun(periodId: string): Promise<ClosingRun> {
    const { data } = await api.post<ApiResponse<ClosingRun>>(
      `/finance/closing/runs/period/${periodId}`,
    );
    return data.data;
  },

  async validateClosingRun(runId: string): Promise<ClosingRun> {
    const { data } = await api.post<ApiResponse<ClosingRun>>(
      `/finance/closing/runs/${runId}/validate`,
    );
    return data.data;
  },

  async closingRun(runId: string): Promise<ClosingRun> {
    const { data } = await api.get<ApiResponse<ClosingRun>>(`/finance/closing/runs/${runId}`);
    return data.data;
  },

  /** Maker/checker: the approver may not be the initiator. */
  async closeClosingRun(runId: string, reason?: string): Promise<ClosingRun> {
    const { data } = await api.post<ApiResponse<ClosingRun>>(
      `/finance/closing/runs/${runId}/close`,
      { reason },
    );
    return data.data;
  },

  async closingWorkspace(periodId: string): Promise<ClosingWorkspace> {
    const { data } = await api.get<ApiResponse<ClosingWorkspace>>(
      `/finance/closing/workspace/period/${periodId}`,
    );
    return data.data;
  },

  // ── Year-end ───────────────────────────────────────────────────────────────

  /** Returns null when the year has never been closed. */
  async yearEnd(yearId: string): Promise<YearEndClosing | null> {
    const { data } = await api.get<ApiResponse<YearEndClosing | null>>(
      `/finance/year-end/${yearId}`,
    );
    return data.data;
  },

  /** Repeatable: sweeps P&L to retained earnings and carries balances forward. */
  async closeYear(yearId: string, payload: YearEndClosePayload): Promise<YearEndClosing> {
    const { data } = await api.post<ApiResponse<YearEndClosing>>(
      `/finance/year-end/${yearId}/close`,
      payload,
    );
    return data.data;
  },

  /** Immutable. Freezes the closing. */
  async finalizeYearEnd(closingId: string): Promise<YearEndClosing> {
    const { data } = await api.post<ApiResponse<YearEndClosing>>(
      `/finance/year-end/${closingId}/finalize`,
    );
    return data.data;
  },

  // ── Budgets ────────────────────────────────────────────────────────────────

  async budgets(status?: string): Promise<Budget[]> {
    const { data } = await api.get<ApiResponse<Budget[]>>('/finance/budgets', {
      params: status ? { status } : undefined,
    });
    return data.data;
  },

  async createBudget(payload: CreateBudgetPayload): Promise<Budget> {
    const { data } = await api.post<ApiResponse<Budget>>('/finance/budgets', payload);
    return data.data;
  },

  async addBudgetLine(
    budgetId: string,
    payload: AddBudgetLinePayload,
  ): Promise<{ id: string; amount: number }> {
    const { data } = await api.post<ApiResponse<{ id: string; amount: number }>>(
      `/finance/budgets/${budgetId}/lines`,
      payload,
    );
    return data.data;
  },

  async newBudgetVersion(budgetId: string, version: string): Promise<Budget> {
    const { data } = await api.post<ApiResponse<Budget>>(`/finance/budgets/${budgetId}/versions`, {
      version,
    });
    return data.data;
  },

  async approveBudget(budgetId: string): Promise<Budget> {
    const { data } = await api.post<ApiResponse<Budget>>(`/finance/budgets/${budgetId}/approve`);
    return data.data;
  },

  async budgetVsActual(budgetId: string): Promise<BudgetVsActual> {
    const { data } = await api.get<ApiResponse<BudgetVsActual>>(
      `/finance/budgets/${budgetId}/vs-actual`,
    );
    return data.data;
  },

  /** The subset of vs-actual lines breaching their warn/block threshold. */
  async budgetAlerts(budgetId: string): Promise<BudgetVsActualLine[]> {
    const { data } = await api.get<ApiResponse<BudgetVsActualLine[]>>(
      `/finance/budgets/${budgetId}/alerts`,
    );
    return data.data;
  },

  // ── Budget control ─────────────────────────────────────────────────────────

  async budgetAvailability(context: BudgetContext): Promise<BudgetAvailability> {
    const { data } = await api.get<ApiResponse<BudgetAvailability>>(
      '/finance/budget-control/availability',
      { params: context },
    );
    return data.data;
  },

  async evaluateSpend(context: BudgetContext & { amount: number }): Promise<BudgetVerdict> {
    const { data } = await api.post<ApiResponse<BudgetVerdict>>(
      '/finance/budget-control/evaluate',
      context,
    );
    return data.data;
  },

  async commit(
    context: BudgetContext & { amount: number; reference?: string },
  ): Promise<{ id: string; amount: number }> {
    const { data } = await api.post<ApiResponse<{ id: string; amount: number }>>(
      '/finance/budget-control/commitments',
      context,
    );
    return data.data;
  },

  async releaseCommitment(commitmentId: string): Promise<{ id: string; status: string }> {
    const { data } = await api.patch<ApiResponse<{ id: string; status: string }>>(
      `/finance/budget-control/commitments/${commitmentId}/release`,
    );
    return data.data;
  },

  async createControlRule(
    payload: BudgetControlRulePayload,
  ): Promise<{ id: string; scope: string; action: string }> {
    const { data } = await api.post<ApiResponse<{ id: string; scope: string; action: string }>>(
      '/finance/budget-control/rules',
      payload,
    );
    return data.data;
  },

  // ── Tax ────────────────────────────────────────────────────────────────────

  async taxCategories(): Promise<TaxCategory[]> {
    const { data } = await api.get<ApiResponse<TaxCategory[]>>('/finance/tax/categories');
    return data.data;
  },

  async createTaxCategory(
    payload: CreateTaxCategoryPayload,
  ): Promise<{ id: string; code: string }> {
    const { data } = await api.post<ApiResponse<{ id: string; code: string }>>(
      '/finance/tax/categories',
      payload,
    );
    return data.data;
  },

  async taxCodes(): Promise<TaxCode[]> {
    const { data } = await api.get<ApiResponse<TaxCode[]>>('/finance/tax/codes');
    return data.data;
  },

  // ── VAT ────────────────────────────────────────────────────────────────────

  async vatPeriods(): Promise<VatPeriod[]> {
    const { data } = await api.get<ApiResponse<VatPeriod[]>>('/finance/vat/periods');
    return data.data;
  },

  async vatReport(periodId: string): Promise<VatReport> {
    const { data } = await api.get<ApiResponse<VatReport>>(
      `/finance/vat/periods/${periodId}/report`,
    );
    return data.data;
  },

  async createVatPeriod(payload: CreateVatPeriodPayload): Promise<VatPeriod> {
    const { data } = await api.post<ApiResponse<VatPeriod>>('/finance/vat/periods', payload);
    return data.data;
  },

  async generateVatReturn(periodId: string): Promise<VatReturn> {
    const { data } = await api.post<ApiResponse<VatReturn>>(
      `/finance/vat/periods/${periodId}/return`,
    );
    return data.data;
  },

  /** Posts through the Posting Engine. Irreversible for the period. */
  async settleVatPeriod(periodId: string): Promise<VatPeriod> {
    const { data } = await api.post<ApiResponse<VatPeriod>>(
      `/finance/vat/periods/${periodId}/settle`,
    );
    return data.data;
  },
};
