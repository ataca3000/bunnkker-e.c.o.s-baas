/**
 * EPIC-LOG-V2-001 Phase 2 — Network.
 *
 * A ServiceArea COMPOSES geography that already exists — distribution zones and
 * cities from V1. Member names arrive resolved from the server and are never
 * stored client-side either (Directive 8).
 *
 * Capacity is ADVISORY: the API answers with what remains and what is short.
 * Orders decides. Nothing here rejects.
 */

export type ServiceAreaStatus = 'draft' | 'active' | 'paused' | 'closed';

export type CoverageMemberType = 'zone' | 'city' | 'governorate';

export type CapacityUnit = 'orders' | 'stops' | 'weight_kg' | 'volume_m3';

export type CommitmentStatus = 'reserved' | 'committed' | 'consumed' | 'released' | 'expired';

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface EnumOption<T extends string = string> {
  value: T;
  label: string;
}

export interface CapacityUnitOption extends EnumOption<CapacityUnit> {
  unit: string;
}

export interface NetworkOptions {
  service_area_statuses: EnumOption<ServiceAreaStatus>[];
  member_types: EnumOption<CoverageMemberType>[];
  capacity_units: CapacityUnitOption[];
  commitment_statuses: EnumOption<CommitmentStatus>[];
}

export interface ServiceAreaMember {
  id: number;
  member_type: CoverageMemberType;
  member_type_label: string;
  member_id: string;
  /** Resolved live from V1 geography — never a stored copy. */
  name: string | null;
  is_excluded: boolean;
}

export interface CoverageRuleRow {
  id: string;
  service_level: string | null;
  service_level_code: string | null;
  cutoff_time: string | null;
  lead_time_hours: number;
  surcharge: number | null;
  currency: string | null;
  is_active: boolean;
}

export interface ServiceArea {
  id: string;
  uuid: string;
  company_id: string | null;
  code: string;
  name: string;
  description: string | null;
  status: ServiceAreaStatus;
  status_label: string;
  status_tone: Tone;
  status_reason: string | null;
  accepts_commitments: boolean;
  is_serving: boolean;
  allowed_transitions: EnumOption<ServiceAreaStatus>[];
  default_lead_time_hours: number;
  priority: number;
  color: string | null;
  dispatch_region?: { id: string; code: string; name: string } | null;
  member_count?: number;
  has_coverage?: boolean;
  members?: ServiceAreaMember[];
  coverage_rules?: CoverageRuleRow[];
  created_at: string | null;
  updated_at: string | null;
}

export interface DispatchRegionRow {
  id: string;
  code: string;
  name: string;
  warehouse_id: string | null;
  has_origin: boolean;
  is_active: boolean;
  service_area_count: number;
}

export interface ServiceLevelRow {
  id: string;
  code: string;
  name: string;
  target_hours: number;
  is_same_day: boolean;
}

export interface CoverageAnswer {
  covered: boolean;
  service_area: {
    id: string;
    code: string;
    name: string;
    status: ServiceAreaStatus;
    accepts_commitments: boolean;
    dispatch_region_id: string | null;
  } | null;
  service_levels: {
    service_level_id: string | null;
    code: string | null;
    name: string | null;
    cutoff_time: string | null;
    lead_time_hours: number;
    past_cutoff: boolean;
    surcharge: number | null;
    currency: string | null;
    /** Null means the level serves no day inside the horizon — a misconfiguration. */
    earliest_service_date: string | null;
  }[];
  reason: string | null;
}

export interface CapacityAvailability {
  slot_id: string;
  available: Record<CapacityUnit, number>;
  committed: Record<CapacityUnit, number>;
  remaining: Record<CapacityUnit, number>;
  utilisation: number | null;
  /** The tightest dimension — the one that will actually stop us taking more. */
  binding_unit: CapacityUnit | null;
  can_accommodate: boolean;
  shortfall: Partial<Record<CapacityUnit, number>> | null;
  at_warn_threshold: boolean;
  is_exhausted: boolean;
}

export interface CapacitySlotRow {
  id: string;
  window_start: string | null;
  window_end: string | null;
  remaining: Record<CapacityUnit, number>;
  utilisation: number | null;
  binding_unit: CapacityUnit | null;
  at_warn_threshold: boolean;
  is_exhausted: boolean;
}

export interface CapacityPlanRow {
  id: string;
  plan_date: string | null;
  is_published: boolean;
  total_remaining: Partial<Record<CapacityUnit, number>>;
  slots: CapacitySlotRow[];
}

export interface ServiceAreasQuery {
  status?: ServiceAreaStatus;
  dispatch_region_id?: number;
  page?: number;
  per_page?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export type ServiceAreasResult = Paginated<ServiceArea>;

export interface ServiceAreaPayload {
  code: string;
  name: string;
  description?: string | null;
  dispatch_region_id?: number | null;
  default_lead_time_hours?: number;
  priority?: number;
  color?: string | null;
}

/**
 * A network capacity commitment: a hold on a slot, later committed or released.
 *
 * This is the primitive layer. The operator-facing workflow is Operations'
 * capacity reservation, which owns one of these — ops_capacity_reservations
 * has a commitment relation to network_capacity_commitments. These endpoints
 * exist for callers working at the network level directly.
 *
 * `holds_capacity` is the backend's answer to whether the row still consumes
 * headroom; holds expire, and only the domain knows when.
 */
export type CapacityCommitment = {
  id: string;
  status: string;
  status_label: string;
  holds_capacity: boolean;
  quantities: Record<string, number>;
  reference_type: string | null;
  reference_id: string | null;
  expires_at: string | null;
  committed_at: string | null;
  released_at: string | null;
  release_reason: string | null;
};

export type ReserveCapacityPayload = {
  slot_id: string;
  orders?: number;
  stops?: number;
  weight_kg?: number;
  reference_type?: string | null;
  reference_id?: string | null;
  /** Minutes until the hold lapses. Omitted, the backend applies its default. */
  ttl_minutes?: number | null;
};
