/**
 * Logistics intelligence types — mirror the /logistics/intelligence contract.
 *
 * Everything here is deterministic and read-only. The engines rank and explain;
 * they do not act, and there is no write endpoint anywhere in this surface.
 * Every response is wrapped in `data` and company-scoped from the token.
 */

export type RecommendationSeverity = string;

/** Recommendation::toArray() — the shape every decision endpoint returns. */
export type Recommendation = {
  title: string;
  action: string;
  category: string;
  severity: RecommendationSeverity;
  priority: number;
  source_module: string;
};

/** priorities() returns the same fields, deliberately without the body text. */
export type DecisionPriority = {
  priority: number;
  severity: RecommendationSeverity;
  title: string;
  category: string;
  action: string;
  source_module: string;
};

export type DecisionSummary = {
  generated_at: string;
  overall_status: string;
  recommendation_count: number;
  by_severity: Record<string, number>;
  top_priority: Recommendation | null;
  recommendations: Recommendation[];
};

export type SmartSuggestion = {
  title: string;
  suggestion: string;
  severity: RecommendationSeverity;
  priority: number;
  why: string;
  owning_module: string;
};

/**
 * A binding constraint. `tightness` is the engine's own 0-100 score for how
 * close to zero headroom the constraint is; it is displayed, never recomputed.
 */
export type Bottleneck = {
  module: string;
  reason: string;
  tightness: number;
  action: string;
};

export type CapacityWarning = {
  level: string;
  message: string;
};

export type OperationalInsight = {
  topic: string;
  insight: string;
  signal: string;
};

/**
 * Forecasts publish their own `method` and `note`. Both are shown: a projection
 * whose method is hidden invites the reader to assume more rigour than the
 * engine claims for it.
 */
export type CapacityForecast = {
  method: string;
  horizon: string;
  avg_utilisation: number;
  headroom_share: number;
  exhausted_slots: number;
  near_capacity_slots: number;
  currently_holding: number;
  refusal_rate: number;
  projected_status: string;
  note: string;
};

export type DispatchForecast = {
  method: string;
  horizon: string;
  queue_depth: number;
  needs_action: number;
  stuck: number;
  oldest_wait_minutes: number;
  confirmation_rate: number;
  projected_pressure: string;
  note: string;
};

export type WorkloadForecast = {
  method: string;
  horizon: string;
  queue_needs_action: number;
  exceptions_needing_attention: number;
  critical_exceptions: number;
  open_work_items: number;
  projected_level: string;
  note: string;
};

/** The four optimisation kinds the controller exposes. */
export const OPTIMIZATION_KINDS = ['vehicle', 'capacity', 'route', 'assignment'] as const;

export type OptimizationKind = (typeof OPTIMIZATION_KINDS)[number];

/**
 * Optimisation results are engine-shaped and differ per endpoint. They are
 * rendered from their own keys rather than forced into a schema the backend
 * does not promise.
 */
export type OptimizationResult = Record<string, unknown>;
