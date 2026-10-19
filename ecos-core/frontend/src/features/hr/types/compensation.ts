/** HR & Workforce OS — EPIC H3 + H4. Compensation and performance types. */

export type PayrollPeriodStatus = 'draft' | 'open' | 'calculated' | 'approved' | 'closed';
export type PayrollRunStatus = 'draft' | 'calculated' | 'approved' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type CommissionMethod = 'percentage_of_value' | 'amount_per_unit' | 'tiered';
export type CommissionScope = 'employee' | 'position' | 'department' | 'job_grade' | 'all';
export type PerformanceStatusKey = 'exceeded' | 'achieved' | 'on_track' | 'at_risk' | 'missed';
export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export type EmployeeRef = { id: string; name: string; employee_number: string } | null;

export type PayrollPeriod = {
  id: string;
  code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  payment_date: string | null;
  status: PayrollPeriodStatus;
  status_label: string;
  currency: string;
  is_final: boolean;
  accepts_adjustments: boolean;
  calculated_at: string | null;
  approved_at: string | null;
};

export type PayrollRun = {
  id: string;
  reference: string;
  payroll_period_id: string;
  period: { id: string; code: string; name: string } | null;
  status: PayrollRunStatus;
  employees_count: number;
  total_basic: number;
  total_bonus: number;
  total_commission: number;
  total_advances: number;
  total_deductions: number;
  total_gross: number;
  total_net: number;
  currency: string;
  calculated_at: string | null;
  approved_at: string | null;
};

export type Payslip = {
  id: string;
  payslip_number: string;
  employee: EmployeeRef;
  period: string | null;
  basic_salary: number;
  bonus_total: number;
  commission_total: number;
  advance_total: number;
  deduction_total: number;
  gross_salary: number;
  net_salary: number;
  currency: string;
  status: string;
};

export type PayslipLine = {
  category: 'basic' | 'bonus' | 'commission' | 'advance' | 'deduction';
  code: string | null;
  label: string;
  amount: number;
  sign: number;
  signed_amount: number;
  source_type: string | null;
  source_id: string | null;
  explanation: Record<string, unknown> | null;
};

export type PayslipDetail = Payslip & {
  explanation: Record<string, unknown> | null;
  lines: PayslipLine[];
  recomputed_net: number;
};

export type Bonus = {
  id: string;
  employee: EmployeeRef;
  type: string;
  type_label: string;
  amount: number;
  currency: string;
  reason: string;
  status: ApprovalStatus;
  source: string;
  awarded_on: string | null;
};

export type Deduction = {
  id: string;
  employee: EmployeeRef;
  type: string;
  type_label: string;
  amount: number;
  currency: string;
  reason: string;
  decision: string | null;
  status: ApprovalStatus;
  approver_id: number | null;
  decided_at: string | null;
  deduction_date: string | null;
  source_module: string | null;
  source_reference: string | null;
  notes: string | null;
};

export type AdvanceInstallment = {
  id: string;
  sequence: number;
  amount: number;
  due_date: string | null;
  status: 'scheduled' | 'recovered' | 'waived' | 'cancelled';
};

export type Advance = {
  id: string;
  reference: string;
  employee: EmployeeRef;
  type: 'one_time' | 'installment';
  type_label: string;
  amount: number;
  currency: string;
  installments_count: number;
  installment_amount: number;
  remaining_balance: number;
  recovered_amount: number;
  status: string;
  requested_on: string | null;
  schedule: AdvanceInstallment[];
};

export type KpiMetricDef = {
  key: string;
  label: string;
  module: string;
  unit: 'currency' | 'percent' | 'count';
  aggregation: string;
  higher_is_better: boolean;
};

export type CommissionTier = {
  sequence: number;
  from_value: number;
  to_value: number | null;
  rate: number;
};

export type CommissionRule = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  metric_key: string;
  method: CommissionMethod;
  method_label: string;
  reads: 'value' | 'quantity';
  rate: number;
  applies_to: CommissionScope;
  applies_to_label: string;
  target_id: string | null;
  dimension_key: string | null;
  dimension_value: string | null;
  min_amount: number | null;
  max_amount: number | null;
  threshold_value: number | null;
  effective_from: string | null;
  effective_to: string | null;
  priority: number;
  is_active: boolean;
  tiers: CommissionTier[];
};

/** Compensation 360. */
export type Compensation360 = {
  employee: { id: string; employee_number: string; name: string; status: string };
  salary: {
    basic_salary: number;
    currency: string;
    pay_frequency: string | null;
    effective_from: string | null;
    history: Array<{ id: string; basic_salary: number; effective_from: string | null; effective_to: string | null }>;
  };
  commission: {
    rules: Array<{ code: string; name: string; metric_key: string; method: string; rate: number }>;
    month_to_date: Array<{
      rule_code: string;
      rule_name: string;
      metric_key: string;
      amount: number;
      explanation: Record<string, unknown>;
    }>;
  };
  advances: {
    advances: number;
    total_advanced: number;
    total_recovered: number;
    remaining_balance: number;
    active_advances: number;
    open: Array<{
      id: string;
      reference: string;
      type: string;
      amount: number;
      remaining_balance: number;
      installments_count: number;
      schedule: AdvanceInstallment[];
    }>;
  };
  bonuses: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string;
    status: ApprovalStatus;
    awarded_on: string | null;
    source: string;
  }>;
  deductions: Array<{
    id: string;
    type: string;
    type_label: string;
    amount: number;
    reason: string;
    decision: string | null;
    status: ApprovalStatus;
    deduction_date: string | null;
    source_module: string | null;
    source_reference: string | null;
  }>;
  pending_approvals: { bonuses: number; deductions: number };
  payslips: Array<{
    id: string;
    payslip_number: string;
    period: string | null;
    basic_salary: number;
    bonus_total: number;
    commission_total: number;
    advance_total: number;
    deduction_total: number;
    gross_salary: number;
    net_salary: number;
    status: string;
  }>;
};

// ── H4 Performance ──────────────────────────────────────────────────────────

export type Goal = {
  id: string;
  subject_type: 'employee' | 'department';
  subject_id: string;
  metric_key: string;
  title: string;
  target_value: number;
  comparison: 'gte' | 'lte';
  lower_is_better: boolean;
  weight: number;
  period_month: string;
  status: string;
};

export type GoalResult = {
  metric_key: string;
  label: string;
  unit: string;
  module: string | null;
  target: number;
  actual: number;
  achievement_percent: number;
  status: PerformanceStatusKey;
  status_label: string;
  facts: number;
};

export type OverallAchievement = {
  goals: number;
  achievement_percent: number;
  status: PerformanceStatusKey | string;
  weighted: boolean;
  met_targets?: number;
};

export type HistoryPoint = {
  period_month: string;
  achievement_percent: number;
  goals: number;
  status: PerformanceStatusKey;
};

export type EmployeePerformance = {
  employee: { id: string; employee_number: string; name: string; department_id: string | null };
  period_month: string;
  overall: OverallAchievement;
  goals: GoalResult[];
  measured_metrics: Array<{
    metric_key: string;
    label: string;
    module: string | null;
    unit: string;
    actual: number;
    facts: number;
  }>;
  review: {
    overall_rating: number;
    strengths: string | null;
    improvement_notes: string | null;
    manager_comments: string | null;
    status: string;
  } | null;
  history: HistoryPoint[];
};

export type DepartmentPerformance = {
  department_id: string;
  period_month: string;
  department_goals: GoalResult[];
  department_overall: OverallAchievement;
  team: {
    headcount: number;
    with_goals: number;
    average_achievement_percent: number;
    status: PerformanceStatusKey;
    meeting_target: number;
    needing_attention: number;
  };
  rankings: Array<{
    rank: number;
    employee_id: string;
    employee_number: string;
    name: string;
    goals: number;
    achievement_percent: number;
    status: PerformanceStatusKey | string;
  }>;
  history: HistoryPoint[];
};

export type BonusRecommendation = {
  id: string;
  employee: EmployeeRef;
  period_month: string;
  achievement_percent: number;
  recommended_amount: number;
  decided_amount: number | null;
  effective_amount: number;
  was_overridden: boolean;
  currency: string;
  rule_key: string;
  rationale: string;
  explanation: Record<string, unknown> | null;
  status: RecommendationStatus;
  bonus_id: string | null;
  decided_at: string | null;
};

export type RecommendationBand = {
  key: string;
  min_achievement: number;
  percent_of_basic: number;
};

export type EmployeeIncident = {
  id: string;
  employee: EmployeeRef;
  occurred_on: string | null;
  category: string;
  category_label: string;
  is_positive: boolean;
  severity: string;
  description: string;
  related_module: string | null;
  related_reference: string | null;
  related_document_type: string | null;
  amount: number | null;
  deduction_id: string | null;
  bonus_id: string | null;
  may_justify_deduction: boolean;
};
