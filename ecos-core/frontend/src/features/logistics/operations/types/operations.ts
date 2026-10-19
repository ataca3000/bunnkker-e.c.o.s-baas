/**
 * EPIC-LOG-V2-001 Phase 4 — Logistics Operations.
 *
 * This context owns no business state beyond pool membership, its own
 * reservation envelopes and the exception registry. Every readiness verdict,
 * capacity figure and dispatch number on these types is a SNAPSHOT from the
 * module that owns it — never recomputed client-side.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface EnumOption<T extends string = string> {
  value: T;
  label: string;
}

// ── Pools ────────────────────────────────────────────────────────────────────

export type PoolType = 'vehicle' | 'driver' | 'mixed';

export type PoolStatus = 'draft' | 'active' | 'suspended' | 'archived';

export type PoolMemberType = 'vehicle' | 'driver';

export type PoolMemberStatus = 'active' | 'suspended' | 'withdrawn';

/** Which module decides whether a member can work — never Operations. */
export type ReadinessAuthority = 'fleet' | 'drivers';

export interface PoolOptions {
  pool_types: EnumOption<PoolType>[];
  pool_statuses: (EnumOption<PoolStatus> & { tone: Tone })[];
  member_types: (EnumOption<PoolMemberType> & { readiness_authority: ReadinessAuthority })[];
  member_statuses: (EnumOption<PoolMemberStatus> & { tone: Tone })[];
}

export interface ResourcePool {
  id: string;
  uuid: string;
  company_id: string | null;
  code: string;
  name: string;
  description: string | null;
  pool_type: PoolType;
  pool_type_label: string;
  status: PoolStatus;
  status_label: string;
  status_tone: Tone;
  status_reason: string | null;
  is_usable: boolean;
  allowed_transitions: EnumOption<PoolStatus>[];
  dispatch_region?: { id: string; code: string; name: string } | null;
  service_area?: { id: string; code: string; name: string } | null;
  min_assignable: number;
  /** Membership counts only. Readiness is fetched separately. */
  member_count?: number;
  active_member_count?: number;
  created_at: string | null;
}

export interface PoolMember {
  id: string;
  member_type: PoolMemberType;
  member_id: number;
  status: PoolMemberStatus;
  status_label: string;
  status_tone: Tone;
  status_reason: string | null;
  membership_reason: string | null;
  readiness_authority: ReadinessAuthority;
  joined_at: string | null;
  left_at: string | null;
}

export interface FitnessVerdict {
  blockers: string[];
  warnings: string[];
  is_assignable: boolean;
  [key: string]: unknown;
}

/** A membership row joined to the owning module's current verdict. */
export interface UnifiedMember {
  membership_id: string;
  member_type: PoolMemberType;
  member_id: number;
  membership_status: PoolMemberStatus;
  membership_status_label: string;
  membership_reason: string | null;
  readiness_authority: ReadinessAuthority;
  label: string | null;
  driver_code?: string | null;
  capacity_orders: number | null;
  /** Fleet's verdict, quoted. Null for drivers — LOG-002 answers for them. */
  fitness: FitnessVerdict | null;
  v1_dispatchable: boolean | null;
  is_available: boolean;
  /** The resource is gone from V1 but the membership survives. Named, not hidden. */
  is_orphaned: boolean;
}

export interface PoolCounts {
  members: number;
  vehicles: number;
  drivers: number;
  available: number;
  available_vehicles: number;
  available_drivers: number;
  suspended: number;
  orphaned: number;
}

export interface UnifiedPoolView {
  pool_id: string;
  pool_type: PoolType;
  status: PoolStatus;
  members: UnifiedMember[];
  counts: PoolCounts;
}

export interface PoolHealth {
  pool_id: string;
  pool_name: string;
  status: PoolStatus;
  counts: PoolCounts;
  min_assignable: number;
  /** Ordered, human-readable reasons — the retryBlockers() contract. */
  issues: string[];
  is_healthy: boolean;
  /** Vehicles and drivers paired: whichever runs out first limits the day. */
  fieldable_units: number;
}

export interface PoolHealthOverview {
  pools: PoolHealth[];
  pool_count: number;
  unhealthy_count: number;
  total_available_vehicles: number;
  total_available_drivers: number;
}

export interface UnassignedResources {
  vehicles: Array<Record<string, unknown>>;
  drivers: Array<Record<string, unknown>>;
  /** Assignable, in no pool — capacity nobody is planning with. */
  idle_assignable_vehicles: number;
  idle_available_drivers: number;
}

export interface MatrixCell {
  date: string;
  slot_count: number;
  committed: number;
  available: number;
  /** Null when no plan exists for that day — not the same as nothing booked. */
  utilisation: number | null;
  exhausted_slots: number;
  fieldable_units: number;
  has_capacity_plan: boolean;
}

export interface MatrixRow {
  pool_id: string;
  pool_name: string;
  pool_type: PoolType;
  service_area: string | null;
  available_vehicles: number;
  available_drivers: number;
  /** Supply is a today figure; a fitness verdict a week out would be a guess. */
  supply_is_current_only: boolean;
  cells: MatrixCell[];
}

export interface AvailabilityMatrix {
  from: string;
  dates: string[];
  rows: MatrixRow[];
}

// ── Capacity ─────────────────────────────────────────────────────────────────

export type ReservationStatus = 'pending' | 'held' | 'confirmed' | 'released' | 'failed';

export interface CapacityOptions {
  reservation_statuses: (EnumOption<ReservationStatus> & { tone: Tone })[];
  capacity_units: EnumOption[];
}

export interface CapacityReservation {
  id: string;
  company_id: string | null;
  status: ReservationStatus;
  status_label: string;
  status_tone: Tone;
  holds_capacity: boolean;
  allowed_transitions: EnumOption<ReservationStatus>[];
  /** The immutable record of the ask, not a copy of the ledger's balance. */
  requested: { orders: number; stops: number; weight_kg: number; volume_m3: number };
  slot?: {
    id: string;
    window_start: string | null;
    window_end: string | null;
    utilisation: number | null;
    is_exhausted: boolean;
  } | null;
  /** Network's verdict, read live rather than cached. */
  ledger_status: string | null;
  commitment_id?: string | null;
  pool?: { id: string; name: string } | null;
  reference_type: string | null;
  reference_id: string | null;
  purpose: string | null;
  requested_at: string | null;
  confirmed_at: string | null;
  released_at: string | null;
  release_reason: string | null;
  /** Network's own words when it refused. Never paraphrased. */
  failure_reason: string | null;
  was_rebalanced: boolean;
}

export interface RebalanceCandidate {
  slot_id: string;
  window_start: string | null;
  window_end: string | null;
  utilisation: number | null;
  remaining: Record<string, number>;
  binding_unit: string | null;
}

export interface CapacitySlotStats {
  date: string;
  slot_count: number;
  avg_utilisation: number | null;
  at_warn_threshold: number;
  exhausted: number;
  by_area: Record<string, { slots: number; exhausted: number; at_warn: number }>;
}

export interface ReservationStats {
  from: string;
  to: string;
  requested: number;
  held: number;
  confirmed: number;
  released: number;
  refused: number;
  /** Null, not zero, when nothing was asked. */
  refusal_rate: number | null;
  confirmation_rate: number | null;
  rebalanced: number;
  currently_holding: number;
}

export interface CapacityMonitoring {
  slots: CapacitySlotStats;
  reservations: ReservationStats;
  /** One refusal is an incident; forty of the same is a plan that needs changing. */
  refusal_reasons: Array<{ reason: string; count: number }>;
}

export interface ReservationAuditEntry {
  id: string;
  action: string;
  outcome: string | null;
  reason: string | null;
  context: Record<string, unknown>;
  performed_at: string | null;
  actor_name: string | null;
}

// ── Exceptions ───────────────────────────────────────────────────────────────

export type ExceptionSource =
  | 'fleet'
  | 'drivers'
  | 'network'
  | 'dispatch'
  | 'routing'
  | 'carriers'
  | 'distribution'
  | 'delivery'
  | 'operations';

export type ExceptionCategory =
  | 'resource'
  | 'capacity'
  | 'dispatch'
  | 'routing'
  | 'execution'
  | 'carrier'
  | 'integration'
  | 'policy';

export type ExceptionSeverity = 'critical' | 'warning' | 'info';

export type ExceptionStatus =
  | 'open'
  | 'acknowledged'
  | 'escalated'
  | 'resolved'
  | 'suppressed'
  | 'auto_resolved';

export type ExceptionResolution =
  | 'fixed'
  | 'handled_elsewhere'
  | 'not_a_problem'
  | 'accepted';

export type NoteType = 'note' | 'action_taken' | 'handover';

export interface ExceptionOptions {
  sources: (EnumOption<ExceptionSource> & { self_owned: boolean })[];
  categories: EnumOption<ExceptionCategory>[];
  severities: (EnumOption<ExceptionSeverity> & { tone: Tone; rank: number })[];
  statuses: (EnumOption<ExceptionStatus> & { tone: Tone })[];
  resolutions: EnumOption<ExceptionResolution>[];
  note_types: EnumOption<NoteType>[];
  max_escalation_level: number;
}

export interface OperationalException {
  id: string;
  company_id: string | null;
  /** Where it must be fixed. Operations cannot clear another module's fact. */
  source: ExceptionSource;
  source_label: string;
  is_self_owned: boolean;
  category: ExceptionCategory;
  category_label: string;
  exception_type: string;
  severity: ExceptionSeverity;
  severity_label: string;
  severity_tone: Tone;
  status: ExceptionStatus;
  status_label: string;
  status_tone: Tone;
  is_outstanding: boolean;
  needs_attention: boolean;
  allowed_transitions: EnumOption<ExceptionStatus>[];
  title: string;
  description: string | null;
  context: Record<string, unknown>;
  subject_type: string | null;
  subject_id: string | null;
  source_conflict_id?: string | null;
  /** The count is the information; four hundred rows would not be. */
  occurrence_count: number;
  is_recurring: boolean;
  first_seen_at: string | null;
  last_seen_at: string | null;
  age_minutes: number;
  unacknowledged_minutes: number | null;
  is_overdue_for_escalation: boolean;
  acknowledged_at: string | null;
  acknowledged_by_name: string | null;
  escalation_level: number;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolution: string | null;
  resolution_reason: string | null;
  note_count?: number;
}

export interface ExceptionSummary {
  outstanding: number;
  needs_attention: number;
  critical: number;
  escalated: number;
  by_source: Partial<Record<ExceptionSource, number>>;
  by_category: Partial<Record<ExceptionCategory, number>>;
  /** Null when the queue is empty — "0 minutes" reads as "just arrived". */
  oldest_minutes: number | null;
  overdue_for_escalation: number;
  recurring: number;
}

export interface ExceptionNote {
  id: string;
  body: string;
  note_type: NoteType;
  is_pinned: boolean;
  written_at: string | null;
  author_name: string | null;
}

export interface Escalation {
  id: string;
  level: number;
  reason: string;
  trigger: string;
  was_automatic?: boolean;
  escalated_to_role: string | null;
  escalated_at: string | null;
  escalated_by_name: string | null;
  acknowledged_at?: string | null;
}

/** An alert IS an exception a rule matched — there is no second record. */
export interface OperationalAlert {
  exception_id: string;
  rule: string | null;
  source: ExceptionSource;
  category: ExceptionCategory;
  severity: ExceptionSeverity;
  severity_rank: number;
  status: ExceptionStatus;
  title: string;
  occurrence_count: number;
  age_minutes: number;
  unacknowledged_minutes: number | null;
  escalation_level: number;
  is_overdue: boolean;
}

export interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
  overdue: number;
}

export interface AlertRule {
  id: string;
  name: string;
  source: ExceptionSource | null;
  category: ExceptionCategory | null;
  exception_type: string | null;
  min_severity: ExceptionSeverity;
  is_active: boolean;
  escalate_after_minutes: number | null;
  escalate_to_role: string | null;
  suppress: boolean;
  suppress_reason: string | null;
}

// ── Health ───────────────────────────────────────────────────────────────────

export interface HealthOverview {
  generated_at: string;
  headline: {
    critical_alerts: number;
    open_exceptions: number;
    unhealthy_pools: number;
    exhausted_capacity_slots: number;
    fieldable_units: number;
    overdue_escalations: number;
  };
  alerts: AlertSummary;
  exceptions: ExceptionSummary;
  /** A healthy operation shows an operator nothing to do (ADR-006). */
  is_quiet: boolean;
}

export interface UtilisationView {
  date: string;
  pooled_available_vehicles: number;
  pooled_available_drivers: number;
  fieldable_units: number;
  capacity_utilisation: number | null;
  slots_exhausted: number;
  slots_near_capacity: number;
  unhealthy_pools: number;
}

/** Phase 3's own figures, reported here rather than recomputed. */
export interface DispatchHealth {
  kpis: Record<string, unknown>;
  queue: Record<string, unknown>;
  assignment: Record<string, unknown>;
  exceptions: Record<string, unknown>;
}

export interface CapacityHealth {
  slots: CapacitySlotStats;
  reservations: ReservationStats;
  refusal_reasons: Array<{ reason: string; count: number }>;
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}
