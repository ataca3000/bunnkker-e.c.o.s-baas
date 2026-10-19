import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  Advance,
  Bonus,
  BonusRecommendation,
  CommissionMethod,
  CommissionRule,
  CommissionScope,
  Compensation360,
  Deduction,
  DepartmentPerformance,
  EmployeeIncident,
  EmployeePerformance,
  Goal,
  KpiMetricDef,
  PayrollPeriod,
  PayrollRun,
  Payslip,
  PayslipDetail,
  RecommendationBand,
} from '@/features/hr/types/compensation';

/** HR & Workforce OS — EPIC H3 + H4 REST client. */
export const compensationService = {
  // ── Payroll (H3) ──────────────────────────────────────────────────────────
  async periods(): Promise<PayrollPeriod[]> {
    const { data } = await api.get<ApiResponse<PayrollPeriod[]>>('/hr/compensation/periods');
    return data.data;
  },

  async createPeriod(payload: {
    start_date: string;
    end_date?: string;
    code?: string;
    name?: string;
  }): Promise<PayrollPeriod> {
    const { data } = await api.post<ApiResponse<PayrollPeriod>>('/hr/compensation/periods', payload);
    return data.data;
  },

  async openPeriod(id: string): Promise<PayrollPeriod> {
    const { data } = await api.patch<ApiResponse<PayrollPeriod>>(`/hr/compensation/periods/${id}/open`);
    return data.data;
  },

  async calculate(id: string): Promise<PayrollRun> {
    const { data } = await api.post<ApiResponse<PayrollRun>>(`/hr/compensation/periods/${id}/calculate`);
    return data.data;
  },

  async approveRun(runId: string): Promise<PayrollRun> {
    const { data } = await api.patch<ApiResponse<PayrollRun>>(`/hr/compensation/runs/${runId}/approve`);
    return data.data;
  },

  async runs(params: { period_id?: string } = {}): Promise<PayrollRun[]> {
    const { data } = await api.get<ApiResponse<PayrollRun[]>>('/hr/compensation/runs', { params });
    return data.data;
  },

  async payslips(params: { run_id?: string; period_id?: string; employee_id?: string } = {}): Promise<Payslip[]> {
    const { data } = await api.get<ApiResponse<Payslip[]>>('/hr/compensation/payslips', { params });
    return data.data;
  },

  async payslip(id: string): Promise<PayslipDetail> {
    const { data } = await api.get<ApiResponse<PayslipDetail>>(`/hr/compensation/payslips/${id}`);
    return data.data;
  },

  // ── Compensation 360 & ledgers ────────────────────────────────────────────
  async overview(employeeId: string): Promise<Compensation360> {
    const { data } = await api.get<ApiResponse<Compensation360>>(
      `/hr/compensation/employees/${employeeId}/overview`,
    );
    return data.data;
  },

  async assignSalary(
    employeeId: string,
    payload: { basic_salary: number; effective_from?: string; currency?: string },
  ): Promise<unknown> {
    const { data } = await api.post<ApiResponse<unknown>>(
      `/hr/compensation/employees/${employeeId}/salary`,
      payload,
    );
    return data.data;
  },

  async bonuses(params: { status?: string; employee_id?: string } = {}): Promise<Bonus[]> {
    const { data } = await api.get<ApiResponse<Bonus[]>>('/hr/compensation/bonuses', { params });
    return data.data;
  },

  async createBonus(payload: {
    employee_id: string;
    amount: number;
    reason: string;
    type?: string;
    awarded_on?: string;
  }): Promise<Bonus> {
    const { data } = await api.post<ApiResponse<Bonus>>('/hr/compensation/bonuses', payload);
    return data.data;
  },

  async decideBonus(id: string, decision: 'approve' | 'reject'): Promise<Bonus> {
    const { data } = await api.patch<ApiResponse<Bonus>>(`/hr/compensation/bonuses/${id}/decide`, { decision });
    return data.data;
  },

  async deductions(params: { status?: string; type?: string; employee_id?: string } = {}): Promise<Deduction[]> {
    const { data } = await api.get<ApiResponse<Deduction[]>>('/hr/compensation/deductions', { params });
    return data.data;
  },

  async createDeduction(payload: {
    employee_id: string;
    type: string;
    amount: number;
    reason: string;
    deduction_date?: string;
    source_module?: string;
    source_reference?: string;
  }): Promise<Deduction> {
    const { data } = await api.post<ApiResponse<Deduction>>('/hr/compensation/deductions', payload);
    return data.data;
  },

  async decideDeduction(id: string, decision: 'approve' | 'reject', note?: string): Promise<Deduction> {
    const { data } = await api.patch<ApiResponse<Deduction>>(`/hr/compensation/deductions/${id}/decide`, {
      decision,
      note,
    });
    return data.data;
  },

  async advances(params: { status?: string; employee_id?: string } = {}): Promise<Advance[]> {
    const { data } = await api.get<ApiResponse<Advance[]>>('/hr/compensation/advances', { params });
    return data.data;
  },

  async createAdvance(payload: {
    employee_id: string;
    type: 'one_time' | 'installment';
    amount: number;
    installments_count?: number;
    first_recovery_date?: string;
    reason?: string;
  }): Promise<Advance> {
    const { data } = await api.post<ApiResponse<Advance>>('/hr/compensation/advances', payload);
    return data.data;
  },

  async decideAdvance(id: string, decision: 'approve' | 'cancel'): Promise<Advance> {
    const { data } = await api.patch<ApiResponse<Advance>>(`/hr/compensation/advances/${id}/decide`, { decision });
    return data.data;
  },

  // ── Commission rules engine (H3) ──────────────────────────────────────────
  async commissionRules(): Promise<CommissionRule[]> {
    const { data } = await api.get<ApiResponse<CommissionRule[]>>('/hr/commission/rules');
    return data.data;
  },

  async commissionMetrics(): Promise<KpiMetricDef[]> {
    const { data } = await api.get<ApiResponse<KpiMetricDef[]>>('/hr/commission/metrics');
    return data.data;
  },

  async createCommissionRule(payload: {
    code: string;
    name: string;
    metric_key: string;
    method: CommissionMethod;
    rate?: number;
    applies_to?: CommissionScope;
    target_id?: string;
    threshold_value?: number;
    max_amount?: number;
  }): Promise<CommissionRule> {
    const { data } = await api.post<ApiResponse<CommissionRule>>('/hr/commission/rules', payload);
    return data.data;
  },

  async previewCommission(
    employeeId: string,
    params: { from: string; to: string },
  ): Promise<{ total: number; rules: Array<{ rule_name: string; amount: number; explanation: Record<string, unknown> }> }> {
    const { data } = await api.get<
      ApiResponse<{ total: number; rules: Array<{ rule_name: string; amount: number; explanation: Record<string, unknown> }> }>
    >(`/hr/commission/employees/${employeeId}/preview`, { params });
    return data.data;
  },

  // ── Performance (H4) ──────────────────────────────────────────────────────
  async goals(params: { period_month?: string; subject_type?: string } = {}): Promise<Goal[]> {
    const { data } = await api.get<ApiResponse<Goal[]>>('/hr/performance/goals', { params });
    return data.data;
  },

  async createGoal(payload: {
    subject_type: 'employee' | 'department';
    subject_id: string;
    metric_key: string;
    target_value: number;
    period_month: string;
    weight?: number;
  }): Promise<Goal> {
    const { data } = await api.post<ApiResponse<Goal>>('/hr/performance/goals', payload);
    return data.data;
  },

  async evaluate(periodMonth: string): Promise<{ period_month: string; goals_evaluated: number }> {
    const { data } = await api.post<ApiResponse<{ period_month: string; goals_evaluated: number }>>(
      '/hr/performance/evaluate',
      {},
      { params: { period_month: periodMonth } },
    );
    return data.data;
  },

  async employeePerformance(employeeId: string, periodMonth: string): Promise<EmployeePerformance> {
    const { data } = await api.get<ApiResponse<EmployeePerformance>>(
      `/hr/performance/employees/${employeeId}/dashboard`,
      { params: { period_month: periodMonth } },
    );
    return data.data;
  },

  async departmentPerformance(departmentId: string, periodMonth: string): Promise<DepartmentPerformance> {
    const { data } = await api.get<ApiResponse<DepartmentPerformance>>(
      `/hr/performance/departments/${departmentId}/dashboard`,
      { params: { period_month: periodMonth } },
    );
    return data.data;
  },

  async recommendations(
    periodMonth: string,
  ): Promise<{ bands: RecommendationBand[]; items: BonusRecommendation[] }> {
    const { data } = await api.get<ApiResponse<{ bands: RecommendationBand[]; items: BonusRecommendation[] }>>(
      '/hr/performance/recommendations',
      { params: { period_month: periodMonth } },
    );
    return data.data;
  },

  async generateRecommendations(periodMonth: string): Promise<{ recommended: number; skipped: number }> {
    const { data } = await api.post<ApiResponse<{ recommended: number; skipped: number }>>(
      '/hr/performance/recommendations/generate',
      {},
      { params: { period_month: periodMonth } },
    );
    return data.data;
  },

  async decideRecommendation(
    id: string,
    payload: { decision: 'approve' | 'reject' | 'modify'; amount?: number; note?: string },
  ): Promise<BonusRecommendation> {
    const { data } = await api.patch<ApiResponse<BonusRecommendation>>(
      `/hr/performance/recommendations/${id}/decide`,
      payload,
    );
    return data.data;
  },

  async saveReview(
    employeeId: string,
    payload: {
      period_month: string;
      overall_rating: number;
      strengths?: string;
      improvement_notes?: string;
      manager_comments?: string;
      status?: 'draft' | 'submitted';
    },
  ): Promise<unknown> {
    const { data } = await api.post<ApiResponse<unknown>>(
      `/hr/performance/employees/${employeeId}/review`,
      payload,
    );
    return data.data;
  },

  async incidents(params: { employee_id?: string; category?: string } = {}): Promise<EmployeeIncident[]> {
    const { data } = await api.get<ApiResponse<EmployeeIncident[]>>('/hr/performance/incidents', { params });
    return data.data;
  },

  async createIncident(payload: {
    employee_id: string;
    category: string;
    description: string;
    occurred_on?: string;
    severity?: string;
    related_module?: string;
    related_reference?: string;
    amount?: number;
  }): Promise<EmployeeIncident> {
    const { data } = await api.post<ApiResponse<EmployeeIncident>>('/hr/performance/incidents', payload);
    return data.data;
  },

  async raiseIncidentDeduction(id: string, payload: { amount?: number; reason?: string }): Promise<EmployeeIncident> {
    const { data } = await api.post<ApiResponse<EmployeeIncident>>(
      `/hr/performance/incidents/${id}/deduction`,
      payload,
    );
    return data.data;
  },
};
