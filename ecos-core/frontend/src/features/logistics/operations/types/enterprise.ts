/**
 * EPIC-LOG-V2-002 completion — the Enterprise Workspace dashboards.
 *
 * Two aggregated read payloads (executive + operations), each composed
 * server-side from the readiness, intelligence and automation layers — one
 * request per dashboard instead of eight.
 */

import type { ModuleStatus } from './readiness';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface TopRecommendation {
  type: string;
  category: string;
  severity: Severity;
  title: string;
  detail: string;
  action: string;
  source_module: string;
  rationale: string[];
  priority: number;
}

export interface ExecutiveDashboard {
  generated_at: string;
  health: {
    score: number;
    grade: string;
    overall_status: ModuleStatus;
  };
  is_quiet: boolean;
  headline: {
    critical_alerts: number;
    open_exceptions: number;
    unhealthy_pools: number;
    exhausted_capacity_slots: number;
    fieldable_units: number;
    overdue_escalations: number;
  };
  decisions: {
    total: number;
    by_severity: Record<Severity, number>;
    top_priority: TopRecommendation | null;
  };
  forecasts: {
    capacity: 'exhausted' | 'at_risk' | 'tightening' | 'comfortable' | 'no_data';
    dispatch_pressure: 'low' | 'moderate' | 'high' | 'severe';
    workload: 'low' | 'moderate' | 'high' | 'severe';
  };
}

export interface OperationsModuleRow {
  module: string;
  label: string;
  status: ModuleStatus;
  headline: string | null;
}

export interface Bottleneck {
  module: string;
  reason: string;
  tightness: number;
  action: string;
}

export interface Suggestion {
  title: string;
  suggestion: string;
  severity: Severity;
  priority: number;
  why: string[];
  owning_module: string;
}

export interface OperationsDashboard {
  generated_at: string;
  overall_status: ModuleStatus;
  modules: OperationsModuleRow[];
  bottleneck: Bottleneck | null;
  suggestions: Suggestion[];
  capacity_warnings: Array<{ level: string; message: string }>;
  automation: {
    consumer_count: number;
    policy_count: number;
  };
}
