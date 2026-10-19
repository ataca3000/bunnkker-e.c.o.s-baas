/** HR & Workforce OS — EPIC H5 + H6. Recruitment and executive intelligence types. */

export type JobStatus = 'draft' | 'published' | 'on_hold' | 'closed' | 'filled';

export type ApplicationStatusKey =
  | 'in_pipeline'
  | 'hold'
  | 'accepted'
  | 'offer_sent'
  | 'offer_accepted'
  | 'offer_declined'
  | 'rejected'
  | 'talent_pool'
  | 'withdrawn';

export type EvaluationRatingKey = 'excellent' | 'very_good' | 'good' | 'average' | 'weak';

/** What the PUBLIC careers portal returns — deliberately narrow. */
export type PublicJob = {
  slug: string;
  title: string;
  department: string | null;
  employment_type: string | null;
  work_location: string | null;
  work_mode: 'onsite' | 'hybrid' | 'remote';
  openings: number;
  published_at: string | null;
  closes_on: string | null;
  salary: { min: number | null; max: number | null; currency: string } | null;
};

export type PublicJobDetail = PublicJob & {
  description: string | null;
  requirements: string | null;
  responsibilities: string | null;
  accepting_applications: boolean;
};

export type ApplicationReceipt = {
  reference: string;
  job_title: string;
  submitted_at: string | null;
  message: string;
};

// ── Admin ATS ───────────────────────────────────────────────────────────────

export type JobOpening = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  department: { id: string; name: string } | null;
  employment_type: { id: string; name: string } | null;
  work_location: string | null;
  work_mode: string;
  status: JobStatus;
  status_label: string;
  is_publicly_visible: boolean;
  openings_count: number;
  filled_count: number;
  remaining_positions: number;
  salary_min: number | null;
  salary_max: number | null;
  show_salary: boolean;
  currency: string;
  applications_count: number;
  published_at: string | null;
  closes_on: string | null;
};

export type RecruitmentStage = {
  id: string;
  code: string;
  name: string;
  sequence: number;
  type: string;
  is_initial: boolean;
  is_terminal: boolean;
  is_active: boolean;
  color: string | null;
};

export type BoardColumn = {
  stage_id: string;
  code: string;
  name: string;
  type: string;
  sequence: number;
  is_terminal: boolean;
  applications: number;
};

export type Application = {
  id: string;
  application_number: string;
  applicant_id: string;
  applicant_name: string | null;
  applicant_mobile: string | null;
  applicant_email: string | null;
  job_opening_id: string;
  job_title: string | null;
  stage: { id: string; name: string; sequence: number } | null;
  status: ApplicationStatusKey;
  status_label: string;
  can_be_hired: boolean;
  years_experience: number | null;
  current_employer: string | null;
  expected_salary: number | null;
  available_from: string | null;
  source: string;
  match_score: number | null;
  applied_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
};

export type ApplicationsResult = {
  items: Application[];
  meta: { current_page: number; per_page: number; total: number; last_page: number };
};

export type Applicant = {
  id: string;
  applicant_number: string;
  full_name: string;
  mobile: string;
  email: string | null;
  birth_date: string | null;
  city: string | null;
  source: string;
  status: string;
  in_talent_pool: boolean;
  talent_pool_note: string | null;
  talent_pool_tags: string[] | null;
  is_hired: boolean;
  hired_employee_id: string | null;
  applications_count: number;
  attachments:
    | Array<{ id: string; type: string; title: string; file_name: string | null; mime_type: string | null; file_size: number | null }>
    | null;
};

export type ApplicationDetail = Application & {
  applicant: Applicant | null;
  match_explanation: Record<string, unknown> | null;
  average_score: number | null;
  evaluations: Array<{
    id: string;
    rating: EvaluationRatingKey;
    rating_label: string;
    score: number;
    comments: string | null;
    reviewer: string | null;
    evaluated_at: string | null;
  }>;
  interviews: Array<{
    id: string;
    title: string | null;
    scheduled_at: string | null;
    duration_minutes: number;
    mode: string;
    location: string | null;
    status: string;
    decision: string | null;
    notes: string | null;
    interviewer: string | null;
  }>;
  history: Array<{
    action: string;
    from_stage: string | null;
    to_stage: string | null;
    from_status: string | null;
    to_status: string | null;
    note: string | null;
    occurred_at: string | null;
  }>;
};

export type DuplicateMatch = {
  id: string;
  applicant_number: string;
  full_name: string;
  mobile: string;
  email: string | null;
  matched_on: string[];
  confidence: 'high' | 'possible';
  applications: number;
  is_hired: boolean;
};

export type HirePrefill = {
  applicant: { full_name: string | null; mobile: string | null; email: string | null; birth_date: string | null };
  department_id: string | null;
  position_id: string | null;
  job_grade_id: string | null;
  employment_type_id: string | null;
  branch_id: string | null;
  reporting_manager_employee_id: string | null;
  expected_salary: number | null;
  salary_range: { min: number | null; max: number | null };
  available_from: string | null;
  can_hire: boolean;
};

export type LifecycleEvent = {
  id: string;
  event_type: string;
  label: string;
  effective_date: string | null;
  reason: string | null;
  notes: string | null;
  from_values: Record<string, unknown> | null;
  to_values: Record<string, unknown> | null;
  source_module: string | null;
  source_reference: string | null;
};

export type UpcomingInterview = {
  id: string;
  application_id: string;
  applicant_name: string | null;
  job_title: string | null;
  title: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  mode: string;
  location: string | null;
  status: string;
  decision: string | null;
  interviewer: string | null;
};

// ── H6 Executive ────────────────────────────────────────────────────────────

export type NamedCount = { id: string | null; name: string; employees: number };

export type HrExecutiveDashboard = {
  date: string;
  period_month: string;
  workforce: {
    total_employees: number;
    by_status: Record<string, number>;
    by_company: NamedCount[];
    by_branch: NamedCount[];
    by_department: NamedCount[];
    by_position: NamedCount[];
  };
  attendance: {
    headcount: number;
    present: number;
    absent: number;
    on_leave: number;
    holiday: number;
    rest_day: number;
    unregistered: number;
    attendance_rate_percent: number;
  };
  compensation: {
    period_month: string;
    has_run: boolean;
    run_status: string | null;
    total_payroll: number;
    total_gross: number;
    total_basic: number;
    total_bonuses: number;
    total_commissions: number;
    total_deductions: number;
    total_advances_recovered: number;
    outstanding_advances: number;
    employees_paid: number;
    pending_approvals: { bonuses: number; deductions: number; advances: number };
  };
  performance: {
    period_month: string;
    goals_measured: number;
    goals_met: number;
    goal_achievement_percent: number;
    average_achievement_percent: number;
    top_employees: Array<{
      employee_id: string;
      employee_number: string;
      name: string;
      achievement_percent: number;
      goals: number;
    }>;
    department_performance: Array<{
      department_id: string | null;
      name: string;
      achievement_percent: number;
      goals: number;
    }>;
  };
  recruitment: {
    period_month: string;
    open_jobs: number;
    applications_this_month: number;
    total_applications: number;
    hires_this_month: number;
    hiring_rate_percent: number;
    talent_pool: number;
    interviews_upcoming: number;
    funnel: Array<{ stage: string; sequence: number; applications: number }>;
  };
  operations: {
    date: string;
    groups: Array<{
      group: string;
      headcount: number;
      available: number;
      absent: number;
      on_leave: number;
      unregistered: number;
    }>;
  };
};

export type HrTrends = {
  months: string[];
  hiring: Array<{ month: string; hires: number }>;
  turnover: Array<{
    month: string;
    joiners: number;
    leavers: number;
    net_change: number;
    headcount: number;
    turnover_rate_percent: number;
  }>;
  attendance: Array<{
    month: string;
    present: number;
    absent: number;
    on_leave: number;
    attendance_rate_percent: number;
  }>;
  payroll: Array<{
    month: string;
    total_net: number;
    total_gross: number;
    total_bonus: number;
    total_commission: number;
    total_deductions: number;
    employees_paid: number;
  }>;
  performance: Array<{
    month: string;
    goals: number;
    goals_met: number;
    achievement_percent: number;
    goal_achievement_percent: number;
  }>;
  recruitment: Array<{ month: string; applications: number; hires: number; conversion_percent: number }>;
  department_growth: Array<{
    department_id: string | null;
    name: string;
    headcount: number;
    joiners: number;
    leavers: number;
    net_change: number;
  }>;
};
