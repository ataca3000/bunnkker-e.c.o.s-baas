/**
 * Routing types — mirror RoutingController and RoutePlanResource.
 *
 * Routing is deterministic. The controller says so explicitly: the strategy
 * catalogue is published so a future optimiser is a registration rather than a
 * redesign. Nothing here schedules or scores anything client-side.
 */

export const ROUTE_PLAN_STATUSES = [
  'draft',
  'optimizing',
  'failed',
  'planned',
  'active',
  'superseded',
  'completed',
  'cancelled',
] as const;

export type RoutePlanStatus = (typeof ROUTE_PLAN_STATUSES)[number];

export type RoutingStrategy = {
  key?: string;
  value?: string;
  label?: string;
  name?: string;
  description?: string;
  version?: string;
};

export type RoutePlanStop = {
  stop_id: number;
  sequence: number;
  is_frozen: boolean;
  eta: string | null;
  eta_level: number | null;
  eta_level_label: string | null;
  breach_predicted: boolean;
  minutes_late: number | null;
};

export type RoutePlanLeg = {
  sequence: number;
  from_stop_ref_id: number | null;
  to_stop_ref_id: number | null;
  is_departure_leg: boolean;
  distance_km: number | null;
  duration_minutes: number | null;
};

export type RoutePlan = {
  id: number;
  uuid: string;
  trip_id: number;
  status: RoutePlanStatus;
  status_label: string;
  is_current: boolean;
  is_superseded: boolean;
  superseded_by_plan_id: number | null;
  supersede_reason: string | null;
  strategy: string | null;
  strategy_version: string | null;
  total_distance_km: number | null;
  total_duration_minutes: number | null;
  stop_count: number;
  average_km_per_stop: number | null;
  confidence: number | null;
  planned_at: string | null;
  activated_at: string | null;
  completed_at: string | null;
  stops?: RoutePlanStop[];
  legs?: RoutePlanLeg[];
  created_at: string | null;
};

/**
 * ETA projection result. `predicted_breaches` is whatever the engine reports;
 * it is displayed as a count and per-stop flags rather than re-interpreted.
 */
export type EtaProjection = {
  plan_id: string;
  predicted_breaches: unknown[];
  stops: RoutePlanStop[];
};

export type PlanTripPayload = {
  strategy?: string | null;
};
