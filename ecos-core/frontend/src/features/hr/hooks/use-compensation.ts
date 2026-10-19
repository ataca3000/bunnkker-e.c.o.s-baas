import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { compensationService } from '@/features/hr/services/compensation-service';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

/**
 * Compensation and performance query hooks.
 *
 * ADR-024 cache keys: every key is prefixed with the active company, and any
 * mutation invalidates the whole HR prefix — approving a payroll run changes
 * payslips, advances and periods at once, so nothing narrower would be honest.
 */
const HR_KEY = 'hr';

function useCompanyKey() {
  const { activeCompanyId } = useOrganizationContext();
  return activeCompanyId ?? 'global';
}

function useInvalidateHr() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['company', companyId, HR_KEY] });
}

// ── Payroll ─────────────────────────────────────────────────────────────────

export function usePayrollPeriodsQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'payroll-periods'],
    queryFn: () => compensationService.periods(),
  });
}

export function usePayrollRunsQuery(params: { period_id?: string } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'payroll-runs', params],
    queryFn: () => compensationService.runs(params),
    placeholderData: keepPreviousData,
  });
}

export function usePayslipsQuery(params: { run_id?: string; period_id?: string; employee_id?: string } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'payslips', params],
    queryFn: () => compensationService.payslips(params),
    placeholderData: keepPreviousData,
  });
}

export function usePayslipQuery(id: string | null) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'payslip', id],
    queryFn: () => compensationService.payslip(id as string),
    enabled: !!id,
  });
}

export function useCreatePeriod() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (payload: { start_date: string; end_date?: string }) => compensationService.createPeriod(payload),
    onSuccess: invalidate,
  });
}

export function useOpenPeriod() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (id: string) => compensationService.openPeriod(id),
    onSuccess: invalidate,
  });
}

export function useCalculatePayroll() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (id: string) => compensationService.calculate(id),
    onSuccess: invalidate,
  });
}

export function useApproveRun() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (runId: string) => compensationService.approveRun(runId),
    onSuccess: invalidate,
  });
}

// ── Ledgers ─────────────────────────────────────────────────────────────────

export function useCompensation360Query(employeeId: string) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'compensation-360', employeeId],
    queryFn: () => compensationService.overview(employeeId),
    enabled: !!employeeId,
  });
}

export function useBonusesQuery(params: { status?: string } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'bonuses', params],
    queryFn: () => compensationService.bonuses(params),
    placeholderData: keepPreviousData,
  });
}

export function useDeductionsQuery(params: { status?: string; type?: string } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'deductions', params],
    queryFn: () => compensationService.deductions(params),
    placeholderData: keepPreviousData,
  });
}

export function useAdvancesQuery(params: { status?: string } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'advances', params],
    queryFn: () => compensationService.advances(params),
    placeholderData: keepPreviousData,
  });
}

export function useDecideBonus() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      compensationService.decideBonus(id, decision),
    onSuccess: invalidate,
  });
}

export function useDecideDeduction() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'approve' | 'reject'; note?: string }) =>
      compensationService.decideDeduction(id, decision, note),
    onSuccess: invalidate,
  });
}

export function useDecideAdvance() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'cancel' }) =>
      compensationService.decideAdvance(id, decision),
    onSuccess: invalidate,
  });
}

export function useAssignSalary() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ employeeId, ...payload }: { employeeId: string; basic_salary: number; effective_from?: string }) =>
      compensationService.assignSalary(employeeId, payload),
    onSuccess: invalidate,
  });
}

// ── Commission rules ────────────────────────────────────────────────────────

export function useCommissionRulesQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'commission-rules'],
    queryFn: () => compensationService.commissionRules(),
  });
}

export function useKpiMetricsQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    // The metric registry is static — cached for the session.
    queryKey: ['company', companyId, HR_KEY, 'kpi-metrics'],
    queryFn: () => compensationService.commissionMetrics(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useCreateCommissionRule() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (payload: Parameters<typeof compensationService.createCommissionRule>[0]) =>
      compensationService.createCommissionRule(payload),
    onSuccess: invalidate,
  });
}

// ── Performance ─────────────────────────────────────────────────────────────

export function useGoalsQuery(params: { period_month?: string; subject_type?: string }) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'goals', params],
    queryFn: () => compensationService.goals(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateGoal() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (payload: Parameters<typeof compensationService.createGoal>[0]) =>
      compensationService.createGoal(payload),
    onSuccess: invalidate,
  });
}

export function useEvaluatePerformance() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (periodMonth: string) => compensationService.evaluate(periodMonth),
    onSuccess: invalidate,
  });
}

export function useEmployeePerformanceQuery(employeeId: string, periodMonth: string) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'performance-employee', employeeId, periodMonth],
    queryFn: () => compensationService.employeePerformance(employeeId, periodMonth),
    enabled: !!employeeId,
  });
}

export function useDepartmentPerformanceQuery(departmentId: string, periodMonth: string) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'performance-department', departmentId, periodMonth],
    queryFn: () => compensationService.departmentPerformance(departmentId, periodMonth),
    enabled: !!departmentId,
  });
}

export function useRecommendationsQuery(periodMonth: string) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'recommendations', periodMonth],
    queryFn: () => compensationService.recommendations(periodMonth),
    placeholderData: keepPreviousData,
  });
}

export function useGenerateRecommendations() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (periodMonth: string) => compensationService.generateRecommendations(periodMonth),
    onSuccess: invalidate,
  });
}

export function useDecideRecommendation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      decision: 'approve' | 'reject' | 'modify';
      amount?: number;
      note?: string;
    }) => compensationService.decideRecommendation(id, payload),
    onSuccess: invalidate,
  });
}

export function useIncidentsQuery(params: { employee_id?: string; category?: string } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'incidents', params],
    queryFn: () => compensationService.incidents(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateIncident() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (payload: Parameters<typeof compensationService.createIncident>[0]) =>
      compensationService.createIncident(payload),
    onSuccess: invalidate,
  });
}
