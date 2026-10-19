export type WorkflowStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'paused'
  | 'archived'
  | 'failed';

export type WorkflowTriggerType =
  | 'business_event'
  | 'schedule'
  | 'date_based'
  | 'webhook'
  | 'api'
  | 'manual';

export type WorkflowNodeType =
  | 'trigger'
  | 'condition'
  | 'action'
  | 'wait'
  | 'delay'
  | 'branch'
  | 'loop';

export type WorkflowExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'
  | 'waiting';

export type ActionType =
  | 'send_whatsapp'
  | 'send_messenger'
  | 'send_instagram_dm'
  | 'send_email'
  | 'create_task'
  | 'assign_lead'
  | 'assign_sales_rep'
  | 'assign_team'
  | 'create_opportunity'
  | 'create_quote'
  | 'create_order'
  | 'reserve_inventory'
  | 'notify_manager'
  | 'create_internal_note'
  | 'apply_tag'
  | 'update_customer'
  | 'move_pipeline'
  | 'call_api'
  | 'publish_event'
  | 'start_workflow'
  | 'stop_workflow';

export type ConditionType =
  | 'customer_segment'
  | 'ltv'
  | 'company'
  | 'brand'
  | 'channel'
  | 'product'
  | 'category'
  | 'campaign'
  | 'initiative'
  | 'conversation_intent'
  | 'lead_score'
  | 'order_count'
  | 'purchase_value'
  | 'last_activity'
  | 'business_dna'
  | 'custom_rule';

export type SegmentType =
  | 'demographic'
  | 'geographic'
  | 'behavioral'
  | 'transactional'
  | 'marketing'
  | 'business'
  | 'operational'
  | 'custom';

export type WorkflowTemplateCategory =
  | 'welcome_series'
  | 'abandoned_cart'
  | 'lead_nurturing'
  | 'no_reply_reminder'
  | 'payment_reminder'
  | 'shipment_notification'
  | 'order_delivered'
  | 'review_request'
  | 'birthday_campaign'
  | 'vip_upgrade'
  | 'win_back_customer'
  | 'seasonal_campaign'
  | 'ramadan_journey'
  | 'black_friday_journey'
  | 'product_launch'
  | 'custom';

// ── Graph types ────────────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  node_type?: WorkflowNodeType;
  label: string;
  action_type?: ActionType;
  condition_type?: ConditionType;
  config: Record<string, unknown>;
  next?: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition: 'default' | 'completed' | 'failed' | 'matched' | 'not_matched';
}

export interface NodesGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// ── Core entities ──────────────────────────────────────────────────────────────

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string | null;
  company_id: string | null;
  brand_id: string | null;
  status: WorkflowStatus;
  trigger_type: WorkflowTriggerType;
  nodes_graph: NodesGraph;
  version_number: number;
  current_version_id: string | null;
  governance_policy_id: string | null;
  tags: string[] | null;
  execution_count: number;
  last_executed_at: string | null;
  activated_at: string | null;
  paused_at: string | null;
  archived_at: string | null;
  approval_status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  is_editable: boolean;
  can_activate: boolean;
  can_pause: boolean;
  can_archive: boolean;
  active_executions?: number;
  versions?: WorkflowVersion[];
  executions?: WorkflowExecution[];
  event_subscriptions?: WorkflowEventSubscription[];
}

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version_number: number;
  trigger_type: string;
  nodes_graph: NodesGraph;
  change_note: string | null;
  changed_by: string;
  created_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_version_id: string | null;
  entity_type: string;
  entity_id: string;
  status: WorkflowExecutionStatus;
  trigger_type: string;
  trigger_payload: Record<string, unknown>;
  current_node_id: string | null;
  step_count: number;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  can_retry: boolean;
  steps?: WorkflowExecutionStep[];
}

export interface WorkflowExecutionStep {
  id: string;
  execution_id: string;
  node_id: string;
  node_type: WorkflowNodeType;
  action_type: ActionType | null;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  duration_ms: number;
  executed_at: string;
}

export interface WorkflowEventSubscription {
  id: string;
  event_type: string;
  entity_type: string | null;
  is_active: boolean;
}

export interface AutomationWorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: WorkflowTemplateCategory;
  trigger_type: WorkflowTriggerType;
  nodes_graph: NodesGraph;
  company_id: string | null;
  is_global: boolean;
  is_active: boolean;
  usage_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AudienceSegment {
  id: string;
  name: string;
  description: string | null;
  company_id: string | null;
  segment_type: SegmentType;
  rules: Record<string, unknown>;
  entity_type: string;
  member_count: number;
  is_dynamic: boolean;
  is_active: boolean;
  last_calculated_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationGovernancePolicy {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  max_executions_per_customer_per_day: number | null;
  max_executions_per_customer_per_workflow: number | null;
  max_total_executions_per_day: number | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string | null;
  blacklisted_channels: string[] | null;
  opt_out_rules: Record<string, unknown> | null;
  allowed_action_types: ActionType[] | null;
  requires_approval: boolean;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── API shapes ─────────────────────────────────────────────────────────────────

export interface WorkflowKpis {
  draft: number;
  active: number;
  paused: number;
  archived: number;
  pending_approval: number;
  failed: number;
  total_executions: number;
}

export interface AutomationDashboard {
  kpis: WorkflowKpis;
  trending_workflows: Array<{ id: string; name: string; execution_count: number; last_executed_at: string | null }>;
  recent_executions: Array<{ id: string; workflow_name: string; entity_type: string; entity_id: string; status: WorkflowExecutionStatus; created_at: string }>;
  health: {
    total_7d: number;
    completed_7d: number;
    failed_7d: number;
    success_rate: number | null;
  };
}

export interface SimulationResult {
  workflow_id: string;
  workflow_name: string;
  total_nodes: number;
  action_nodes: number;
  expected_actions: Array<{ action_type: ActionType; node_id: string; label: string; config_preview: Record<string, unknown> }>;
  estimated_volume: number;
  estimated_cost: null;
  warnings: string[];
  can_activate: boolean;
}

export interface VersionCompare {
  version_a: number;
  version_b: number;
  added_nodes: string[];
  removed_nodes: string[];
  common_nodes: string[];
  a_edge_count: number;
  b_edge_count: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  links: { first: string; last: string; prev: string | null; next: string | null };
}

export interface WorkflowFilters {
  company_id?: string;
  status?: WorkflowStatus;
  trigger_type?: WorkflowTriggerType;
  search?: string;
  per_page?: number;
}
