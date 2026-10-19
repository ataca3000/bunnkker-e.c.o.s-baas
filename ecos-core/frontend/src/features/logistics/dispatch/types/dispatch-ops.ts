/**
 * EPIC-LOG-V2-001 Phase 3 — Dispatch Operations.
 *
 * Everything here RECORDS decisions. Fleet remains the readiness authority,
 * Network owns capacity, Distribution owns execution — the verdicts that arrive
 * on these types are snapshots from those modules, never recomputed client-side.
 */

export type SessionStatus = 'open' | 'paused' | 'closing' | 'closed' | 'abandoned';

export type SessionMode = 'manual' | 'automatic' | 'hybrid';

export type QueueItemStatus =
  | 'waiting'
  | 'claimed'
  | 'assigned'
  | 'blocked'
  | 'deferred'
  | 'completed'
  | 'cancelled';

export type QueuePriority = 'critical' | 'high' | 'normal' | 'low';

export type AllocationStatus = 'proposed' | 'reserved' | 'confirmed' | 'released' | 'failed';

export type ConflictStatus = 'open' | 'acknowledged' | 'resolved' | 'overridden' | 'expired';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export type LockStatus = 'held' | 'released' | 'expired' | 'broken';

/** Which module owns the fact behind a conflict — where it must be fixed. */
export type ConflictAuthority = 'fleet' | 'drivers' | 'network' | 'distribution' | 'dispatch';

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface EnumOption<T extends string = string> {
  value: T;
  label: string;
}

export interface ConflictTypeOption extends EnumOption {
  severity: 'blocking' | 'advisory';
  authority: ConflictAuthority;
}

export interface DispatchOpsOptions {
  session_statuses: EnumOption<SessionStatus>[];
  session_modes: EnumOption<SessionMode>[];
  queue_statuses: EnumOption<QueueItemStatus>[];
  queue_priorities: EnumOption<QueuePriority>[];
  allocation_statuses: EnumOption<AllocationStatus>[];
  conflict_types: ConflictTypeOption[];
  conflict_statuses: EnumOption<ConflictStatus>[];
  review_statuses: EnumOption<ReviewStatus>[];
  lock_statuses: EnumOption<LockStatus>[];
}

export interface DispatchSession {
  id: string;
  uuid: string;
  company_id: string | null;
  dispatch_board_id: number;
  status: SessionStatus;
  status_label: string;
  status_tone: Tone;
  is_active: boolean;
  allowed_transitions: EnumOption<SessionStatus>[];
  mode: SessionMode;
  is_automatic: boolean;
  operator_id: number | null;
  operator_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  /** Null until a session has run long enough for the figure to mean anything. */
  throughput_per_hour: number | null;
  is_idle: boolean;
  assigned_count: number;
  released_count: number;
  conflict_count: number;
  held_lock_count?: number;
  board?: { id: string; board_date: string | null; status: string } | null;
  notes: string | null;
  close_reason: string | null;
  created_at: string | null;
}

export interface QueueItem {
  id: string;
  uuid: string;
  dispatch_board_id: number;
  status: QueueItemStatus;
  status_label: string;
  status_tone: Tone;
  needs_action: boolean;
  allowed_transitions: EnumOption<QueueItemStatus>[];
  priority: QueuePriority;
  priority_label: string;
  priority_tone: Tone;
  /** Ordering must be explainable, or dispatchers work around it. */
  priority_reason: string | null;
  rank: number;
  trip_id: string | null;
  trip_number: string | null;
  trip_capacity: number | null;
  queued_at: string | null;
  waiting_minutes: number;
  claimed_at: string | null;
  claimed_by_session_id: string | null;
  claimed_by: string | null;
  attempt_count: number;
  /** Repeated failure needs a human, not another retry. */
  is_stuck: boolean;
  last_failure_reason: string | null;
  created_at: string | null;
}

export interface DispatchConflict {
  id: string;
  conflict_type: string;
  conflict_label: string;
  severity: 'blocking' | 'advisory';
  is_blocking: boolean;
  blocks_release: boolean;
  /** Dispatch may not overrule another authority's fact. */
  authority: ConflictAuthority;
  status: ConflictStatus;
  status_label: string;
  description: string;
  resource_type: string | null;
  resource_id: number | null;
  detected_at: string | null;
  age_minutes: number;
  resolution: string | null;
  resolution_reason: string | null;
}

export interface ResourceAllocation {
  id: string;
  status: AllocationStatus;
  status_label: string;
  status_tone: Tone;
  holds_resource: boolean;
  allocation_mode: 'manual' | 'automatic';
  trip_id: string | null;
  vehicle_id: number | null;
  driver_id: number | null;
  /** Snapshot of Fleet's verdict at allocation time. Not recomputed. */
  fleet_verdict: string | null;
  driver_ready: boolean | null;
  has_capacity_hold: boolean;
  allocated_at: string | null;
  confirmed_at: string | null;
  released_at: string | null;
  conflicts: DispatchConflict[];
}

export interface AssignmentReview {
  id: string;
  assignment_id: string | null;
  status: ReviewStatus;
  status_label: string;
  status_tone: Tone;
  trigger: string;
  trigger_reason: string | null;
  requested_at: string | null;
  requested_by: number | null;
  decided_at: string | null;
  decided_by_name: string | null;
  decision_reason: string | null;
  waiting_minutes: number;
}

export interface HeldLock {
  id: string;
  resource: string;
  resource_type: string;
  resource_id: number;
  held_by: string | null;
  session_id: string | null;
  acquired_at: string | null;
  expires_at: string | null;
  remaining_seconds: number;
  is_effective: boolean;
}

export interface TimelineEvent {
  id: number;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string | null;
  is_problem: boolean;
  occurred_at: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditEntry {
  id: string;
  action: string;
  is_override: boolean;
  entity_type: string | null;
  entity_id: string | null;
  changes: Record<string, unknown>;
  reason: string | null;
  performed_at: string | null;
  actor_name: string | null;
}

// ── Monitoring (operational metrics only — no prediction) ────────────────────

export interface DispatchKpis {
  from: string;
  to: string;
  sessions_opened: number;
  sessions_active: number;
  sessions_abandoned: number;
  allocations_attempted: number;
  allocations_confirmed: number;
  allocations_failed: number;
  /** Null, not zero, when nothing was attempted. */
  confirmation_rate: number | null;
  automatic_share: number | null;
  total_assigned: number;
  total_released: number;
  avg_session_minutes: number | null;
}

export interface QueueStatistics {
  depth: number;
  by_status: Record<QueueItemStatus, number>;
  needs_action: number;
  stuck: number;
  avg_wait_minutes: number | null;
  oldest_wait_minutes: number | null;
  by_priority: Record<QueuePriority, number>;
}

export interface AssignmentHealth {
  open_conflicts: number;
  blocking_conflicts: number;
  conflicts_by_type: Record<string, number>;
  /** Which module owns the outstanding problems. */
  conflicts_by_authority: Partial<Record<ConflictAuthority, number>>;
  oldest_conflict_minutes: number | null;
  pending_reviews: number;
  oldest_review_minutes: number | null;
  held_locks: number;
}

export interface CapacityUtilisation {
  date: string;
  slot_count: number;
  avg_utilisation: number | null;
  at_warn_threshold: number;
  exhausted: number;
  by_area: Record<string, { slots: number; exhausted: number; binding_units: string[] }>;
}

export interface DispatchExceptions {
  blocking_conflicts: number;
  pending_reviews: number;
  blocked_queue_items: number;
  stuck_queue_items: number;
  abandoned_sessions: number;
  conflicts_by_authority: Partial<Record<ConflictAuthority, number>>;
  oldest_conflict_minutes: number | null;
  oldest_review_minutes: number | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/**
 * A Phase 2 board, read only so a dispatcher can pick the board to work.
 * Boards are created and advanced by the Phase 2 surface — never here.
 */
export interface DispatchBoardSummary {
  id: string;
  board_date: string | null;
  status: string;
  status_label: string;
  status_tone: Tone;
  is_open: boolean;
  dispatch_region?: { id: string; code: string; name: string } | null;
}
