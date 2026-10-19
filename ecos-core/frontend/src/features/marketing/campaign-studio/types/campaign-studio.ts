export type CampaignInternalStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'paused'
  | 'archived'
  | 'failed'
  | 'rejected';

export type PublishingOperation = 'publish' | 'pause' | 'resume' | 'archive' | 'duplicate' | 'update' | 'soft_delete';
export type PublishingJobStatus  = 'queued' | 'processing' | 'completed' | 'failed' | 'retrying' | 'cancelled';
export type ValidationSeverity   = 'blocking' | 'warning' | 'recommendation';
export type ApprovalStatus       = 'pending' | 'approved' | 'rejected' | 'skipped' | 'cancelled';
export type BulkOperationType    = 'publish' | 'pause' | 'resume' | 'archive' | 'duplicate' | 'assign_initiative' | 'assign_owner' | 'assign_tags' | 'validate' | 'schedule';
export type TemplateCategory     = 'sales' | 'lead_generation' | 'catalog_sales' | 'awareness' | 'retargeting' | 'seasonal' | 'whatsapp' | 'messenger' | 'product_launch' | 'custom';
export type BudgetType           = 'daily' | 'lifetime';
export type PlacementMode        = 'auto' | 'manual';
export type VersionChangeType    = 'initial' | 'budget_change' | 'audience_change' | 'creative_change' | 'placement_change' | 'schedule_change' | 'business_context_change' | 'approval_decision' | 'published' | 'paused' | 'resumed' | 'settings_change';

export interface CampaignDraft {
  id: string;
  name: string;
  internal_status: CampaignInternalStatus;
  initiative_id: string | null;
  company_id: string | null;
  brand_id: string | null;
  channel_id: string | null;
  campaign_owner_id: string | null;
  budget_owner: string | null;
  marketing_team: string | null;
  cost_center: string | null;
  season: string | null;
  custom_season: string | null;
  business_goal: string | null;
  tags: string[] | null;
  internal_notes: string | null;
  objective: string | null;
  buying_type: string | null;
  budget_type: BudgetType | null;
  daily_budget: string | null;
  lifetime_budget: string | null;
  bid_strategy: string | null;
  optimization_goal: string | null;
  timezone: string | null;
  start_date: string | null;
  end_date: string | null;
  connector_type: string | null;
  connection_id: string | null;
  ad_account_id: string | null;
  business_manager_id: string | null;
  page_id: string | null;
  instagram_account_id: string | null;
  pixel_id: string | null;
  catalog_id: string | null;
  domain: string | null;
  external_campaign_id: string | null;
  linked_campaign_id: string | null;
  current_version_number: number | null;
  current_version_id: string | null;
  approval_workflow_id: string | null;
  template_id: string | null;
  governance_policy_id: string | null;
  published_at: string | null;
  scheduled_publish_at: string | null;
  last_published_at: string | null;
  submitted_for_approval_at: string | null;
  is_editable: boolean;
  audience: CampaignAudience | null;
  creatives: CampaignCreative[];
  placement: CampaignPlacement | null;
  versions: CampaignVersion[];
  current_approval: CampaignApproval | null;
  publishing_jobs: PublishingJob[];
  products: CampaignProduct[];
  validation_results: ValidationResult[];
  created_at: string;
  updated_at: string;
}

export interface CampaignAudience {
  id: string;
  campaign_draft_id: string;
  countries: string[] | null;
  governorates: string[] | null;
  cities: string[] | null;
  radius_km: number | null;
  age_min: number | null;
  age_max: number | null;
  genders: string[] | null;
  languages: string[] | null;
  interests: object[] | null;
  behaviors: object[] | null;
  lookalike_audiences: string[] | null;
  custom_audiences: string[] | null;
  saved_audiences: string[] | null;
  exclusions: object[] | null;
}

export interface CampaignCreative {
  id: string;
  campaign_draft_id: string;
  creative_type: 'image' | 'video' | 'carousel' | 'collection' | 'story' | 'reel' | 'other';
  name: string | null;
  headline: string | null;
  primary_text: string | null;
  description: string | null;
  call_to_action: string | null;
  destination_url: string | null;
  utm_params: Record<string, string> | null;
  media_items: object[] | null;
  asset_ids: string[] | null;
  status: string;
  sort_order: number;
}

export interface CampaignPlacement {
  id: string;
  campaign_draft_id: string;
  placement_mode: PlacementMode;
  facebook_feed: boolean;
  instagram_feed: boolean;
  facebook_stories: boolean;
  instagram_stories: boolean;
  facebook_reels: boolean;
  instagram_reels: boolean;
  messenger_inbox: boolean;
  audience_network: boolean;
  excluded_placements: string[] | null;
}

export interface CampaignVersion {
  id: string;
  campaign_draft_id: string;
  version_number: number;
  change_type: VersionChangeType;
  snapshot: Record<string, unknown> | null;
  changed_fields: string[] | null;
  change_note: string | null;
  changed_by_user_id: string | null;
  approval_decision: string | null;
  approved_by_user_id: string | null;
  approval_decided_at: string | null;
  created_at: string;
}

export interface ApprovalWorkflowStep {
  id: string;
  workflow_template_id: string;
  step_name: string;
  step_order: number;
  role_required: string | null;
  user_id_required: string | null;
  is_optional: boolean;
  timeout_hours: number | null;
  on_timeout_action: 'escalate' | 'auto_approve' | 'reject';
}

export interface ApprovalWorkflowTemplate {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  steps: ApprovalWorkflowStep[];
  created_at: string;
}

export interface CampaignApprovalDecision {
  id: string;
  approval_id: string;
  step_order: number;
  step_name: string;
  decided_by_user_id: string;
  decision: 'approved' | 'rejected' | 'skipped';
  notes: string | null;
  created_at: string;
}

export interface CampaignApproval {
  id: string;
  campaign_draft_id: string;
  workflow_template_id: string | null;
  status: ApprovalStatus;
  current_step_order: number;
  total_steps: number;
  submitted_by_user_id: string;
  submitted_at: string;
  completed_at: string | null;
  workflow_template: ApprovalWorkflowTemplate | null;
  decisions: CampaignApprovalDecision[];
}

export interface PublishingJob {
  id: string;
  campaign_draft_id: string;
  operation: PublishingOperation;
  status: PublishingJobStatus;
  connector_type: string;
  connection_id: string | null;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  scheduled_at: string | null;
  scheduled_timezone: string | null;
  queued_by: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface CampaignTemplate {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  category: TemplateCategory;
  category_label: string;
  is_global: boolean;
  is_active: boolean;
  usage_count: number;
  default_objective: string | null;
  default_budget_type: BudgetType | null;
  default_daily_budget: string | null;
  created_at: string;
}

export interface GovernancePolicy {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  naming_pattern: string | null;
  naming_example: string | null;
  min_daily_budget: string | null;
  max_daily_budget: string | null;
  min_lifetime_budget: string | null;
  max_lifetime_budget: string | null;
  required_utm_params: string[] | null;
  required_assets: string[] | null;
  pixel_required: boolean;
  approval_required: boolean;
  publishing_windows: object[] | null;
  blocked_publishing_days: string[] | null;
  allowed_objectives: string[] | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ValidationResult {
  id: string;
  campaign_draft_id: string;
  rule_key: string;
  severity: ValidationSeverity;
  message: string;
  context: Record<string, unknown> | null;
  is_resolved: boolean;
  blocks_publishing: boolean;
  created_at: string;
}

export interface ValidationSummary {
  can_publish: boolean;
  total_issues: number;
  blocking_errors: number;
  warnings: number;
  results: ValidationResult[];
}

export interface CampaignProduct {
  id: string;
  campaign_draft_id: string;
  product_type: 'finished_good' | 'raw_material' | 'category' | 'brand' | 'collection';
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  warn_if_unavailable: boolean;
  is_available: boolean | null;
  availability_checked_at: string | null;
  has_availability_issue: boolean;
}

export interface CampaignBulkJob {
  id: string;
  operation_type: BulkOperationType;
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
  total_count: number;
  processed_count: number;
  success_count: number;
  failure_count: number;
  results: Record<string, unknown> | null;
  queued_by: string;
  company_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface StudioKpis {
  drafts: number;
  pending_review: number;
  approved: number;
  scheduled: number;
  active: number;
  paused: number;
  archived: number;
  failed: number;
  published_today: number;
}

export interface StudioDashboard {
  campaigns: StudioKpis;
  approvals: { pending: number };
  publishing_queue: {
    queued: number;
    processing: number;
    retrying: number;
    failed_today: number;
  };
  health: {
    blocking_validation_issues: number;
    recent_failures_7d: number;
    version_changes_24h: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export type DraftFilters = Partial<{
  status: CampaignInternalStatus;
  company_id: string;
  brand_id: string;
  initiative_id: string;
  campaign_owner_id: string;
  connector_type: string;
  search: string;
  per_page: number;
  page: number;
}>;
