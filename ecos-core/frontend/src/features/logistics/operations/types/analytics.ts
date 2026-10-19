/**
 * EPIC-LOG-V2-001 Phase 5 — operational dashboards and activity.
 *
 * Every shape here is READ-ONLY and assembled server-side from Phases 1-4.
 * Nothing on these types is a projection: utilisation figures are snapshots
 * (in use ÷ available right now), and the activity feed is a live union over the
 * append-only tables the owning modules already keep.
 */

import type { CapacitySlotStats, ReservationStats, Tone } from './operations';

// ── Dashboards ───────────────────────────────────────────────────────────────

export interface IdleVehicle {
  vehicle_id: number;
  plate_number: string | null;
  capacity_orders: number | null;
  is_assignable: boolean;
  [key: string]: unknown;
}

export interface FleetUtilisation {
  total_vehicles: number;
  assignable: number;
  unfit: number;
  in_use_now: number;
  idle_assignable: number;
  /** Snapshot, never a forecast. Null when nothing is assignable. */
  utilisation_now: number | null;
  /** Idle vehicles named, not just counted (BO-1). */
  idle_vehicles: IdleVehicle[];
}

export interface IdleDriver {
  driver_id: number;
  driver_code: string | null;
  full_name: string | null;
  can_start_deliveries: boolean;
  [key: string]: unknown;
}

export interface DriverUtilisation {
  total_drivers: number;
  available: number;
  unavailable: number;
  in_use_now: number;
  idle_available: number;
  utilisation_now: number | null;
  idle_drivers: IdleDriver[];
}

export interface CapacityDashboard {
  slots: CapacitySlotStats;
  reservations: ReservationStats;
}

/** Phase 3's own figures, reported not recomputed. Loose by design. */
export interface DispatchPerformance {
  kpis: {
    sessions_active: number;
    allocations_confirmed: number;
    allocations_attempted: number;
    confirmation_rate: number | null;
    automatic_share: number | null;
    avg_session_minutes: number | null;
    [key: string]: unknown;
  };
  queue: {
    depth: number;
    needs_action: number;
    stuck: number;
    avg_wait_minutes: number | null;
    [key: string]: unknown;
  };
  assignment: Record<string, unknown>;
}

export interface OperationalKpi {
  generated_at: string;
  headline: {
    critical_alerts: number;
    open_exceptions: number;
    unhealthy_pools: number;
    exhausted_capacity_slots: number;
    fieldable_units: number;
    overdue_escalations: number;
  };
  is_quiet: boolean;
  pools: {
    total: number;
    unhealthy: number;
    available_vehicles: number;
    available_drivers: number;
    fieldable: number;
  };
  dispatch: {
    sessions_active: number;
    allocations_confirmed: number;
    confirmation_rate: number | null;
    automatic_share: number | null;
  };
}

// ── Activity ─────────────────────────────────────────────────────────────────

export type ActivitySource =
  | 'dispatch_timeline'
  | 'dispatch_audit'
  | 'capacity_audit'
  | 'escalation'
  | 'note';

export type ActivitySeverity = 'critical' | 'warning' | 'info';

export interface ActivityItem {
  id: string;
  source: ActivitySource;
  category: string;
  action: string;
  title: string;
  description: string | null;
  severity: ActivitySeverity;
  occurred_at: string | null;
  actor_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
}

export interface ActivityFeed {
  from: string;
  to: string;
  items: ActivityItem[];
  returned: number;
  available: number;
  /** Which sources hit their per-source cap — truncation is never silent. */
  truncated_sources: ActivitySource[];
  window_truncated: boolean;
}

export interface AuditFeed {
  items: ActivityItem[];
  available: number;
  truncated_sources: ActivitySource[];
}

export interface ActivityOptions {
  sources: { value: ActivitySource; label: string }[];
  severities: { value: ActivitySeverity; label: string }[];
}

// ── History ──────────────────────────────────────────────────────────────────

export interface AssignmentHistoryRow {
  id: string;
  status: string;
  status_label: string;
  status_tone: Tone;
  mode: string;
  trip_id: number | null;
  vehicle_id: number | null;
  driver_id: number | null;
  /** Fleet's verdict at allocation time, quoted. */
  fleet_verdict: string | null;
  driver_ready: boolean | null;
  allocated_at: string | null;
  confirmed_at: string | null;
  released_at: string | null;
  release_reason: string | null;
  session_id: string | null;
}

export interface SessionHistoryRow {
  id: string;
  status: string;
  status_label: string;
  status_tone: Tone;
  mode: string;
  operator_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  assigned_count: number;
  released_count: number;
  conflict_count: number;
}

export interface CapacityHistoryRow {
  id: string;
  status: string;
  status_label: string;
  status_tone: Tone;
  requested_orders: number;
  purpose: string | null;
  pool: string | null;
  failure_reason: string | null;
  release_reason: string | null;
  requested_at: string | null;
  confirmed_at: string | null;
  released_at: string | null;
  was_rebalanced: boolean;
}
