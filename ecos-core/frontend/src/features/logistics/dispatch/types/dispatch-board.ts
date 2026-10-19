/**
 * Dispatch board and proposal types — mirror DispatchController.
 *
 * The board is a day's dispatch for a region. A proposal is one generated
 * assignment set for that board; accepting it and releasing it are separate
 * decisions with separate permissions, because releasing commits vehicles and
 * drivers to trips.
 */

export const BOARD_STATUSES = [
  'open',
  'planning',
  'proposed',
  'releasing',
  'partially_released',
  'released',
  'closed',
  'cancelled',
] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const PROPOSAL_STATUSES = ['generated', 'accepted', 'rejected', 'superseded'] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type DispatchOption = { value: string; label: string };

export type DispatchBoardOptions = {
  board_statuses: DispatchOption[];
  proposal_statuses: DispatchOption[];
  assignment_statuses: DispatchOption[];
};

/**
 * One proposed vehicle+driver+trip assignment.
 *
 * `score` and `score_breakdown` are the engine's ranking; `blockers` are the
 * reasons it cannot be released. Both are displayed as given — a client-side
 * re-score would disagree with the engine that produced the proposal.
 */
export type DispatchAssignment = {
  id: string;
  status: string;
  status_label: string;
  status_tone: string | null;
  is_releasable: boolean;
  trip_id: string | null;
  trip_number: string | null;
  vehicle_id: number | null;
  vehicle_plate: string | null;
  driver_id: number | null;
  driver_name: string | null;
  score: number | null;
  score_breakdown: Record<string, unknown> | null;
  fitness_level: string | null;
  blockers: string[];
};

export type DispatchProposal = {
  id: string;
  uuid: string;
  dispatch_board_id: string;
  status: ProposalStatus;
  status_label: string;
  is_decided: boolean;
  assignment_count: number;
  blocked_count: number;
  decided_at: string | null;
  decided_by: string | null;
  decision_reason: string | null;
  assignments?: DispatchAssignment[];
  created_at: string | null;
};

export type DispatchRegionRef = {
  id: number;
  code: string;
  name: string;
  warehouse_id: number | null;
};

export type DispatchBoard = {
  id: string;
  uuid: string;
  company_id: string | null;
  board_date: string;
  status: BoardStatus;
  status_label: string;
  status_tone: string | null;
  status_reason: string | null;
  is_open: boolean;
  allowed_transitions: { value: BoardStatus; label: string }[];
  dispatch_region: DispatchRegionRef | null;
  warehouse_id: number | null;
  planned_at: string | null;
  released_at: string | null;
  closed_at: string | null;
  proposals?: DispatchProposal[];
  created_at: string | null;
};

export type PoolVehicle = {
  vehicle_id: number;
  uuid: string;
  plate_number: string;
  capacity_orders: number | null;
  fitness: string | null;
  is_assignable: boolean;
};

export type PoolDriver = {
  driver_id: number;
  driver_code: string;
  full_name: string;
  can_start_deliveries: boolean;
};

/**
 * What is actually available to dispatch right now. The two counts are the
 * backend's, and they are the numbers that decide whether a proposal can be
 * generated at all.
 */
export type ResourcePool = {
  vehicles: PoolVehicle[];
  drivers: PoolDriver[];
  assignable_vehicle_count: number;
  available_driver_count: number;
};

// ── Write payloads ───────────────────────────────────────────────────────────

export type SetBoardStatusPayload = {
  status: BoardStatus;
  reason?: string | null;
};

export type ProposePayload = {
  policy_id?: string | null;
};

export type OverrideAssignmentPayload = {
  reason: string;
  vehicle_id?: number | null;
  driver_id?: number | null;
};
