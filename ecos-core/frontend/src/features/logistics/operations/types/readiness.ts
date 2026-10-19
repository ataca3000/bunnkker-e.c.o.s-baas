/**
 * EPIC-LOG-V2-001 Phase 6 — Enterprise Readiness & Operational Completion.
 *
 * The final read-model. Every field is a projection or a digest over Phases 1-5;
 * a readiness verdict interprets figures the owning modules produced, and never
 * recomputes Fleet readiness or Network capacity.
 */

export type ModuleStatus = 'ready' | 'degraded' | 'not_ready';

export type CheckSeverity = 'blocking' | 'advisory';

export interface ValidationCheck {
  name: string;
  passed: boolean;
  severity: CheckSeverity;
  detail: string;
}

export interface ModuleValidation {
  module: string;
  label: string;
  status: ModuleStatus;
  checks: ValidationCheck[];
  reasons: string[];
  passed_checks: number;
  total_checks: number;
}

export interface ValidationReport {
  generated_at: string;
  overall_status: ModuleStatus;
  modules: ModuleValidation[];
  ready_count: number;
  degraded_count: number;
  not_ready_count: number;
}

export interface ModuleSummaryRow {
  module: string;
  label: string;
  status: ModuleStatus;
  passed_checks: number;
  total_checks: number;
  headline: string | null;
  weight: number;
}

export interface ChecklistItem {
  id: string;
  module: string;
  module_label: string;
  label: string;
  passed: boolean;
  severity: CheckSeverity;
  detail: string;
}

export interface ReadinessDashboard {
  generated_at: string;
  /** Weighted roll-up of module statuses, 0-100. */
  health_score: number;
  overall_status: ModuleStatus;
  ready_count: number;
  degraded_count: number;
  not_ready_count: number;
  modules: ModuleSummaryRow[];
  checklist: ChecklistItem[];
}

export interface HealthScore {
  generated_at: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  overall_status: ModuleStatus;
  weights: Record<string, number>;
}

export interface Checklist {
  generated_at: string;
  overall_status: ModuleStatus;
  items: ChecklistItem[];
  passed: number;
  total: number;
  blocking_failures: ChecklistItem[];
}

// ── Diagnostics ──────────────────────────────────────────────────────────────

export interface DependencyRow {
  name: string;
  label: string;
  status: ModuleStatus;
  reason: string | null;
}

export interface DiagnosticsCenter {
  generated_at: string;
  system: {
    status: ModuleStatus;
    is_quiet: boolean;
    headline: Record<string, number>;
    modules_ready: number;
    modules_degraded: number;
    modules_not_ready: number;
  };
  dependencies: { status: ModuleStatus; dependencies: DependencyRow[] };
  queue: { status: ModuleStatus; metrics: Record<string, unknown> };
  capacity: { status: ModuleStatus; metrics: Record<string, unknown> };
  dispatch: { status: ModuleStatus; metrics: Record<string, unknown> };
  exceptions: {
    status: ModuleStatus;
    exceptions: Record<string, unknown>;
    alerts: Record<string, unknown>;
  };
}

// ── Summaries ────────────────────────────────────────────────────────────────

export interface ExecutiveSummary {
  generated_at: string;
  health_score: number;
  grade: string;
  overall_status: ModuleStatus;
  is_quiet: boolean;
  headline: {
    critical_alerts: number;
    open_exceptions: number;
    unhealthy_pools: number;
    exhausted_capacity_slots: number;
    fieldable_units: number;
    overdue_escalations: number;
  };
}

export interface TodaySummary {
  date: string;
  sessions_active: number;
  allocations_confirmed: number;
  allocations_attempted: number;
  confirmation_rate: number | null;
  queue_depth: number;
  queue_needs_action: number;
}

export interface FleetSummary {
  vehicles: {
    total: number;
    assignable: number;
    unfit: number;
    in_use_now: number;
    idle_assignable: number;
    utilisation_now: number | null;
  };
  drivers: {
    total: number;
    available: number;
    in_use_now: number;
    idle_available: number;
    utilisation_now: number | null;
  };
  fieldable_units: number;
}

/**
 * Per-module readiness, one row per module with its check tally.
 *
 * This shares the same validation report the diagnostics centre uses. It is a
 * separate read because it is the only endpoint that returns the per-module
 * breakdown; the centre returns the counts only.
 */
export type ReadinessModuleRow = {
  module: string;
  label: string;
  status: string;
  passed_checks: number;
  total_checks: number;
  headline: string;
  weight: number;
};

export type ReadinessModuleSummary = {
  generated_at: string;
  overall_status: string;
  modules: ReadinessModuleRow[];
};

export type CapacitySummary = {
  date: string;
  slots: number;
  avg_utilisation: number;
  near_capacity: number;
  exhausted: number;
  currently_holding: number;
  refused: number;
  refusal_rate: number;
};

export type DispatchSummary = {
  sessions_active: number;
  sessions_abandoned: number;
  allocations_confirmed: number;
  allocations_failed: number;
  confirmation_rate: number;
  automatic_share: number;
  avg_session_minutes: number;
};

export type ExceptionsSummary = {
  outstanding: number;
  needs_attention: number;
  critical: number;
  escalated: number;
  recurring: number;
  overdue_for_escalation: number;
  by_source: Record<string, number>;
  by_category: Record<string, number>;
};
