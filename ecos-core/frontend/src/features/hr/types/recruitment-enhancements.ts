/**
 * HR V1 enhancement types — tags, timeline, offers, bulk actions, analytics,
 * exit, and the compensation explainability surface.
 */

// ── Tags ─────────────────────────────────────────────────────────────────────

export interface ApplicantTag {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  color: string;
  is_active: boolean;
  sequence: number;
  applicant_count: number;
}

export interface AssignedTag {
  id: string;
  key: string;
  name: string;
  color: string;
  note?: string | null;
  assigned_by?: number | null;
  assigned_at?: string | null;
}

export interface TaggedApplicant {
  id: string;
  applicant_number: string;
  full_name: string;
  mobile?: string | null;
  email?: string | null;
  status: string;
  in_talent_pool: boolean;
  tags: AssignedTag[];
}

// ── Timeline ─────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  event_type: string;
  event_label: string;
  category: string;
  is_milestone: boolean;
  title: string;
  summary?: string | null;
  description: string;
  application_id?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
  context: Record<string, unknown>;
  actor_id?: number | null;
  actor_name?: string | null;
  is_system: boolean;
  occurred_at?: string | null;
}

export interface TimelineFilters {
  categories: Array<{ key: string; count: number }>;
  event_types: Array<{ key: string; label: string; count: number }>;
  total: number;
}

export interface TimelineResult {
  events: TimelineEvent[];
  filters?: TimelineFilters;
}

// ── Offers ───────────────────────────────────────────────────────────────────

export interface OfferTerms {
  candidate_name: string;
  position?: string | null;
  department?: string | null;
  branch?: string | null;
  employment_type?: string | null;
  start_date?: string | null;
  basic_salary: number;
  currency: string;
  notes?: string | null;
}

export interface OfferVersionEntry {
  id: string;
  version: number;
  is_current: boolean;
  terms: OfferTerms;
  revision_reason?: string | null;
  changes: Record<string, { from: unknown; to: unknown }>;
  created_by?: number | null;
  created_at?: string | null;
}

export interface OfferDetail {
  id: string;
  offer_number: string;
  status: string;
  status_label: string;
  application_id: string;
  applicant_id: string;
  current_version: number;
  terms?: OfferTerms | null;
  expires_on?: string | null;
  has_lapsed: boolean;
  days_until_expiry?: number | null;
  sent_at?: string | null;
  responded_at?: string | null;
  response_note?: string | null;
  withdrawn_at?: string | null;
  permits_hiring: boolean;
  version_history: OfferVersionEntry[];
}

export interface OfferListItem {
  id: string;
  offer_number: string;
  candidate_name?: string | null;
  application_id: string;
  status: string;
  status_label: string;
  current_version: number;
  basic_salary: number;
  currency: string;
  start_date?: string | null;
  expires_on?: string | null;
  has_lapsed: boolean;
  sent_at?: string | null;
  responded_at?: string | null;
}

export interface OfferDocument {
  offer_number: string;
  version: number;
  status: string;
  issued_on?: string | null;
  expires_on?: string | null;
  terms: OfferTerms;
  salary_line: string;
  notes?: string | null;
}

// ── Bulk ─────────────────────────────────────────────────────────────────────

export interface BulkActionDefinition {
  key: string;
  label: string;
  requires: string[];
  permission: string;
}

export interface BulkPreview {
  action: string;
  label: string;
  permission: string;
  requires: string[];
  selected: number;
  not_found: number;
  candidates: Array<{ id: string; application_number: string; name?: string | null; status: string }>;
  is_reversible: boolean;
}

export interface BulkResult {
  action: string;
  label: string;
  requested: number;
  succeeded: number;
  failed: number;
  results: Array<{ id: string; application_number?: string }>;
  failures: Array<{ id: string; application_number?: string; reason: string }>;
  columns?: string[];
  rows?: Array<Record<string, unknown>>;
}

// ── Analytics ────────────────────────────────────────────────────────────────

/** A rate that carries its own sample, so a dash is never mistaken for zero. */
export interface MeasuredRate {
  percent: number | null;
  numerator: number;
  denominator: number;
  meaning: string;
  is_measurable: boolean;
}

export interface MeasuredRatio {
  value: number | null;
  numerator: number;
  denominator: number;
  meaning: string;
  is_measurable: boolean;
}

export interface RecruitmentAnalytics {
  period: { from: string; to: string; days: number };
  kpis: {
    open_jobs: number;
    applications: number;
    applicants_per_job: MeasuredRatio;
    interview_rate: MeasuredRate;
    offer_rate: MeasuredRate;
    acceptance_rate: MeasuredRate;
    hiring_rate: MeasuredRate;
    average_time_to_hire: {
      days: number | null;
      fastest_days: number | null;
      slowest_days: number | null;
      hires_measured: number;
    };
  };
  funnel: Array<{
    key: string;
    label: string;
    count: number;
    share_of_total: number;
    conversion_from_previous: number | null;
    dropped_from_previous: number | null;
  }>;
  monthly_hiring: Array<{ month: string; label: string; applications: number; hires: number }>;
  trend: Array<{ month: string; label: string; applications: number; hires: number }>;
  hiring_by_department: Array<{
    department_id: string | null;
    department_name: string;
    applications: number;
    hires: number;
    hire_rate: number;
  }>;
  source_effectiveness: Array<{
    source: string;
    applications: number;
    hires: number;
    rejected: number;
    hire_rate: number;
  }>;
  recruiter_performance: Array<{
    employee_id: string;
    employee_number: string;
    name: string;
    assigned: number;
    hires: number;
    rejected: number;
    still_open: number;
    hire_rate: number;
  }>;
  time_in_stage: Array<{
    stage_id: string;
    stage_name: string;
    sequence: number;
    average_days: number | null;
    candidacies_measured: number;
  }>;
}

// ── Exit ─────────────────────────────────────────────────────────────────────

export interface ExitChecklistItem {
  id: string;
  key: string;
  label: string;
  category: string;
  is_mandatory: boolean;
  status: string;
  status_label: string;
  is_blocking: boolean;
  is_overdue: boolean;
  responsible_employee_id?: string | null;
  responsible_name?: string | null;
  due_date?: string | null;
  completed_on?: string | null;
  notes?: string | null;
  has_evidence: boolean;
  file_name?: string | null;
  waiver_reason?: string | null;
}

export interface ExitDetail {
  id: string;
  reference: string;
  employee_id: string;
  employee?: { employee_number: string; name: string; status: string } | null;
  type: string;
  type_label: string;
  is_voluntary: boolean;
  status: string;
  status_label: string;
  notice_date?: string | null;
  last_working_day?: string | null;
  completed_on?: string | null;
  reason?: string | null;
  notes?: string | null;
  is_rehire_eligible?: boolean | null;
  rehire_note?: string | null;
  progress_percent: number;
  can_complete: boolean;
  blocking_items: Array<{
    id: string;
    label: string;
    responsible?: string | null;
    due_date?: string | null;
    is_overdue: boolean;
  }>;
  checklist: ExitChecklistItem[];
}

export interface ExitListItem {
  id: string;
  reference: string;
  employee_name?: string | null;
  employee_number?: string | null;
  type: string;
  type_label: string;
  status: string;
  last_working_day?: string | null;
  days_remaining?: number | null;
  progress_percent: number;
  outstanding_mandatory: number;
  can_complete: boolean;
}

// ── Compensation explainability ──────────────────────────────────────────────

export interface CommissionPreviewLine {
  metric: {
    key: string;
    label: string;
    source_module?: string | null;
    unit?: string | null;
    measured_value: number;
    measured_quantity: number;
    facts_counted: number;
  };
  rule: {
    id: string;
    code: string;
    name: string;
    method: string;
    rate: number;
    threshold: number | null;
    min_amount: number | null;
    max_amount: number | null;
    version: number | null;
    effective_from?: string | null;
    effective_to?: string | null;
  };
  calculation: {
    formula: string;
    base: number;
    rate: number;
    worked: string;
    note?: string | null;
  };
  commission: number;
}

export interface CommissionPreviewEmployee {
  employee: { id: string; employee_number: string; name: string; department_id: string | null };
  from: string;
  to: string;
  rules_evaluated: number;
  lines: CommissionPreviewLine[];
  total: number;
}

export interface CommissionPreview {
  period: { id: string; code: string; start_date: string; end_date: string; status: string };
  currency: string;
  employees_with_commission: number;
  total_commission: number;
  employees: CommissionPreviewEmployee[];
  note: string;
}

export interface ExplainedPayslipLine {
  id: string;
  sequence: number;
  category: string;
  code: string;
  label: string;
  amount: number;
  sign: number;
  signed_amount: number;
  direction: string;
  formula: string;
  inputs: Array<{ label: string; value: unknown; unit?: string | null }>;
  source: {
    type?: string | null;
    id?: string | null;
    label: string;
    origin_module?: string | null;
    source_module?: string | null;
    source_reference?: string | null;
    approver?: number | null;
    recommendation_id?: string | null;
  };
  calculation: { worked: string; steps: string[]; result: number };
  raw_explanation: Record<string, unknown>;
}

export interface ExplainedPayslip {
  payslip_id: string;
  payslip_number: string;
  employee_id: string;
  status: string;
  currency: string;
  totals: Record<string, number>;
  net_formula: string;
  net_worked: string;
  lines: ExplainedPayslipLine[];
  payslip_explanation: Record<string, unknown>;
}

export interface KpiTraceability {
  metric_key: string;
  metric_label: string;
  source_module?: string | null;
  from: string;
  to: string;
  facts_total: number;
  facts_shown: number;
  is_truncated: boolean;
  facts: Array<{
    id: string;
    source_module?: string | null;
    source_document_type?: string | null;
    source_document_number?: string | null;
    source_reference?: string | null;
    value: number;
    quantity: number;
    dimension_key?: string | null;
    dimension_value?: string | null;
    event_date?: string | null;
    imported_date?: string | null;
    idempotency_key: string;
  }>;
}

export interface BonusDecisionAudit {
  bonus_id: string;
  recommended_amount: number | null;
  approved_amount: number;
  difference: number | null;
  difference_percent: number | null;
  followed_recommendation: boolean | null;
  approval_reason?: string | null;
  approver?: number | null;
  approval_date?: string | null;
  status: string;
  recommendation_id?: string | null;
  source?: string | null;
}

export interface LockStatus {
  is_locked: boolean;
  period: {
    id: string;
    code: string;
    name: string;
    start_date?: string | null;
    end_date?: string | null;
    approved_at?: string | null;
  } | null;
  reason: string | null;
  remedy: string | null;
}

export interface AdjustmentAudit {
  reference: string;
  component: string;
  corrects: { type?: string | null; id?: string | null; amount?: number | null; period_id?: string | null };
  adjustment_amount: number;
  direction: string;
  reason: string;
  requested_by?: number | null;
  requested_at?: string | null;
  approved_by?: number | null;
  approved_at?: string | null;
  decision_note?: string | null;
  applied_at?: string | null;
  applied_payslip_id?: string | null;
  status: string;
}

export interface PendingAdjustment {
  id: string;
  reference: string;
  employee_id: string;
  employee_number?: string | null;
  employee_name?: string | null;
  component: string;
  component_label: string;
  amount: number;
  currency: string;
  direction: string;
  reason: string;
  requested_by?: number | null;
  requested_at?: string | null;
  carried_in_period_id?: string | null;
}

export interface RuleVersionHistory {
  code: string;
  version_group: string;
  current_version: number;
  versions: Array<{
    id: string;
    version: number;
    metric_key: string;
    method: string;
    rate: number;
    applies_to: string;
    target_id?: string | null;
    threshold_value: number | null;
    min_amount: number | null;
    max_amount: number | null;
    tiers: Array<{ from_value: number; to_value: number | null; rate: number; sequence: number }>;
    effective_from?: string | null;
    effective_to?: string | null;
    is_current: boolean;
    superseded_at?: string | null;
    supersedes_rule_id?: string | null;
  }>;
}
