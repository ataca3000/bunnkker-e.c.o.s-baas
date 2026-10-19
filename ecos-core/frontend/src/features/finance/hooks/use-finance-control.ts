import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganizationContext } from '@/features/organization/context/organization-context';

import { financeControlService } from '../services/finance-control-service';
import type {
  AddBudgetLinePayload,
  BudgetContext,
  BudgetControlRulePayload,
  CreateBudgetPayload,
  CreateFiscalYearPayload,
  CreateTaxCategoryPayload,
  CreateVatPeriodPayload,
  YearEndClosePayload,
} from '../types/finance-control';

/**
 * Financial Control hooks (Phase 7). Company-scoped keys, matching the AR/AP and
 * treasury workspaces.
 *
 * Every write invalidates the whole `finance` prefix rather than one key.
 * Closing a period changes what the journals, statements and closing workspace
 * may show; settling VAT posts a journal; approving a budget changes every
 * availability verdict drawn from it. A narrower invalidation would leave one
 * view asserting something another has already contradicted.
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

// ── Fiscal calendar ──────────────────────────────────────────────────────────

export function useFiscalYears() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'fiscal', 'years'],
    queryFn: () => financeControlService.fiscalYears(),
  });
}

export function useFiscalOptions() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'fiscal', 'options'],
    queryFn: () => financeControlService.fiscalOptions(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useCreateFiscalYear() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (payload: CreateFiscalYearPayload) =>
      financeControlService.createFiscalYear(payload),
    onSuccess: invalidate,
  });
}

/**
 * The four fiscal-calendar transitions share a shape, so they share a hook
 * keyed by action. `lock` is permanent — the API offers no way back.
 */
export function usePeriodTransition() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ periodId, action }: { periodId: string; action: 'open' | 'close' | 'lock' }) => {
      if (action === 'open') return financeControlService.openPeriod(periodId);
      if (action === 'close') return financeControlService.closePeriod(periodId);
      return financeControlService.lockPeriod(periodId);
    },
    onSuccess: invalidate,
  });
}

// ── Period closing ───────────────────────────────────────────────────────────

export function usePeriodClose() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({
      periodId,
      hard,
      reason,
    }: {
      periodId: string;
      hard: boolean;
      reason?: string;
    }) =>
      hard
        ? financeControlService.hardClosePeriod(periodId, reason)
        : financeControlService.softClosePeriod(periodId, reason),
    onSuccess: invalidate,
  });
}

export function useReopenPeriod() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ periodId, reason }: { periodId: string; reason: string }) =>
      financeControlService.reopenPeriod(periodId, reason),
    onSuccess: invalidate,
  });
}

/** Lazy: only fetched once a period is selected. */
export function useClosureHistory(periodId: string | null) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'periods', periodId, 'closure-history'],
    queryFn: () => financeControlService.closureHistory(periodId as string),
    enabled: periodId !== null,
  });
}

// ── Closing runs & workspace ─────────────────────────────────────────────────

export function useClosingWorkspace(periodId: string | null) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'closing', 'workspace', periodId],
    queryFn: () => financeControlService.closingWorkspace(periodId as string),
    enabled: periodId !== null,
  });
}

export function useStartClosingRun() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (periodId: string) => financeControlService.startClosingRun(periodId),
    onSuccess: invalidate,
  });
}

export function useValidateClosingRun() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (runId: string) => financeControlService.validateClosingRun(runId),
    onSuccess: invalidate,
  });
}

export function useCloseClosingRun() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ runId, reason }: { runId: string; reason?: string }) =>
      financeControlService.closeClosingRun(runId, reason),
    onSuccess: invalidate,
  });
}

// ── Year-end ─────────────────────────────────────────────────────────────────

export function useYearEnd(yearId: string | null) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'year-end', yearId],
    queryFn: () => financeControlService.yearEnd(yearId as string),
    enabled: yearId !== null,
  });
}

export function useCloseYear() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ yearId, payload }: { yearId: string; payload: YearEndClosePayload }) =>
      financeControlService.closeYear(yearId, payload),
    onSuccess: invalidate,
  });
}

export function useFinalizeYearEnd() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (closingId: string) => financeControlService.finalizeYearEnd(closingId),
    onSuccess: invalidate,
  });
}

// ── Budgets ──────────────────────────────────────────────────────────────────

export function useBudgets(status?: string) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'budgets', status ?? 'all'],
    queryFn: () => financeControlService.budgets(status),
  });
}

export function useBudgetVsActual(budgetId: string | null) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'budgets', budgetId, 'vs-actual'],
    queryFn: () => financeControlService.budgetVsActual(budgetId as string),
    enabled: budgetId !== null,
  });
}

export function useBudgetAlerts(budgetId: string | null) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'budgets', budgetId, 'alerts'],
    queryFn: () => financeControlService.budgetAlerts(budgetId as string),
    enabled: budgetId !== null,
  });
}

export function useCreateBudget() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (payload: CreateBudgetPayload) => financeControlService.createBudget(payload),
    onSuccess: invalidate,
  });
}

export function useAddBudgetLine() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ budgetId, payload }: { budgetId: string; payload: AddBudgetLinePayload }) =>
      financeControlService.addBudgetLine(budgetId, payload),
    onSuccess: invalidate,
  });
}

export function useNewBudgetVersion() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ budgetId, version }: { budgetId: string; version: string }) =>
      financeControlService.newBudgetVersion(budgetId, version),
    onSuccess: invalidate,
  });
}

export function useApproveBudget() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (budgetId: string) => financeControlService.approveBudget(budgetId),
    onSuccess: invalidate,
  });
}

// ── Budget control ───────────────────────────────────────────────────────────

/**
 * Availability and evaluate are read-only probes, but evaluate is a POST, so it
 * is modelled as a mutation. Neither writes anything: evaluate returns the
 * verdict an operational flow would receive, nothing more.
 */
export function useBudgetAvailability() {
  return useMutation({
    mutationFn: (context: BudgetContext) => financeControlService.budgetAvailability(context),
  });
}

export function useEvaluateSpend() {
  return useMutation({
    mutationFn: (context: BudgetContext & { amount: number }) =>
      financeControlService.evaluateSpend(context),
  });
}

export function useCommitBudget() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (context: BudgetContext & { amount: number; reference?: string }) =>
      financeControlService.commit(context),
    onSuccess: invalidate,
  });
}

export function useReleaseCommitment() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (commitmentId: string) => financeControlService.releaseCommitment(commitmentId),
    onSuccess: invalidate,
  });
}

export function useCreateControlRule() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (payload: BudgetControlRulePayload) =>
      financeControlService.createControlRule(payload),
    onSuccess: invalidate,
  });
}

// ── Tax ──────────────────────────────────────────────────────────────────────

export function useTaxCategories() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'tax', 'categories'],
    queryFn: () => financeControlService.taxCategories(),
  });
}

export function useTaxCodes() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'tax', 'codes'],
    queryFn: () => financeControlService.taxCodes(),
  });
}

export function useCreateTaxCategory() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (payload: CreateTaxCategoryPayload) =>
      financeControlService.createTaxCategory(payload),
    onSuccess: invalidate,
  });
}

// ── VAT ──────────────────────────────────────────────────────────────────────

export function useVatPeriods() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'vat', 'periods'],
    queryFn: () => financeControlService.vatPeriods(),
  });
}

export function useVatReport(periodId: string | null) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'vat', 'periods', periodId, 'report'],
    queryFn: () => financeControlService.vatReport(periodId as string),
    enabled: periodId !== null,
  });
}

export function useCreateVatPeriod() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (payload: CreateVatPeriodPayload) => financeControlService.createVatPeriod(payload),
    onSuccess: invalidate,
  });
}

export function useGenerateVatReturn() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (periodId: string) => financeControlService.generateVatReturn(periodId),
    onSuccess: invalidate,
  });
}

export function useSettleVatPeriod() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (periodId: string) => financeControlService.settleVatPeriod(periodId),
    onSuccess: invalidate,
  });
}
