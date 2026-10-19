export type CertStatus = 'PASS' | 'WARN' | 'FAIL' | 'SKIP';
export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface CategoryResult {
  score: number;
  status: CertStatus;
  weight: number;
}

export interface EngineeringMetrics {
  dead_code_files: number;
  arch_critical: number;
  arch_high: number;
  arch_medium: number;
  arch_low: number;
  arch_total: number;
  repo_health_pct: number;
  todo_count: number;
  phpstan_baseline_issues: number;
  missing_translation_keys: number;
  total_php_files: number;
  total_tsx_files: number;
}

export interface EngineeringRun {
  id: string;
  branch: string;
  commit: string | null;
  mode: 'full' | 'fast';
  overall_score: number;
  release_ready: boolean;
  categories: Record<string, CategoryResult>;
  metrics: EngineeringMetrics;
  blockers: string[];
  report_json: Record<string, unknown> | null;
  certified_at: string;
  created_at: string;
  findings?: EngineeringFinding[];
  findings_summary?: FindingsSummary;
}

export interface EngineeringFinding {
  id: string;
  engineering_run_id: string;
  severity: FindingSeverity;
  category: string;
  file: string | null;
  line: number | null;
  title: string;
  description: string | null;
  fix_suggestion: string | null;
  created_at: string;
}

export interface FindingsSummary {
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
}

export interface ScoreTrendPoint {
  date: string;
  score: number;
  release_ready: boolean;
}

export interface EngineeringDashboard {
  has_data: boolean;
  latest_run: EngineeringRun | null;
  score_trend: ScoreTrendPoint[];
  findings_count: FindingsSummary;
  total_runs: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    lastPage: number;
  };
}

// ── Release Manager ─────────────────────────────────────────────────────────

export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StageStatus    = 'pending' | 'running' | 'success' | 'failed' | 'retrying' | 'skipped' | 'cancelled';
export type PipelineStage  =
  | 'development_guardian'
  | 'architecture_guardian'
  | 'build'
  | 'tests'
  | 'commit'
  | 'push'
  | 'github_actions'
  | 'deployment_guardian'
  | 'certification'
  | 'health_check'
  | 'notifications';

export const STAGE_LABELS: Record<PipelineStage, string> = {
  development_guardian:  'Development Guardian',
  architecture_guardian: 'Architecture Guardian',
  build:                 'Build',
  tests:                 'Tests',
  commit:                'Auto Commit',
  push:                  'Auto Push',
  github_actions:        'GitHub Actions',
  deployment_guardian:   'Deployment Guardian',
  certification:         'Certification',
  health_check:          'Health Check',
  notifications:         'Notifications',
};

export const ORDERED_STAGES: PipelineStage[] = [
  'development_guardian',
  'architecture_guardian',
  'build',
  'tests',
  'commit',
  'push',
  'github_actions',
  'deployment_guardian',
  'certification',
  'health_check',
  'notifications',
];

export interface PipelineLog {
  id: string;
  stage: PipelineStage;
  stage_label: string;
  status: StageStatus;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  message: string | null;
  payload: unknown[] | null;
  retry_count: number;
}

export interface EngineeringPipeline {
  id: string;
  task_name: string;
  branch: string;
  commit_sha: string | null;
  status: PipelineStatus;
  current_stage: PipelineStage | null;
  current_stage_label: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  duration_formatted: string;
  initiated_by: string;
  error_message: string | null;
  auto_deploy: boolean;
  logs?: PipelineLog[];
}

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';
export type NotificationType =
  | 'pipeline_started'
  | 'pipeline_completed'
  | 'pipeline_failed'
  | 'certification_failed'
  | 'health_check_failed'
  | 'deployment_pending'
  | 'deployment_failed';

export interface EngineeringPipelineNotification {
  id: string;
  pipeline_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface NotificationListResponse {
  data: EngineeringPipelineNotification[];
  unread_count: number;
  meta: {
    page: number;
    perPage: number;
    total: number;
    lastPage: number;
  };
}

// ── ENG-007: Templates ────────────────────────────────────────────────────────

export interface PipelineTemplateStage {
  handler: string;
  label: string;
  order: number;
  enabled: boolean;
  retry_policy: {
    max_retries: number;
    backoff_strategy: 'fixed' | 'linear' | 'exponential';
    retry_delay_seconds: number;
    timeout_seconds: number;
  };
  actions: string[];
  options: Record<string, unknown>;
}

export interface PipelineTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  version: number;
  is_system: boolean;
  metadata: { color?: string; icon?: string } | null;
  stage_count: number;
  stages?: PipelineTemplateStage[];
}

// ── ENG-007: Analytics ───────────────────────────────────────────────────────

export interface PipelineStageDuration {
  avg_seconds: number;
  max_seconds: number;
  total_runs: number;
}

export interface PipelineAnalytics {
  queue_size: number;
  running_count: number;
  total_in_window: number;
  completed_count: number;
  failed_count: number;
  success_rate: number;
  failure_rate: number;
  avg_duration_seconds: number;
  total_retries: number;
  slowest_stage: { stage: string; avg_seconds: number } | null;
  stage_durations: Record<string, PipelineStageDuration>;
  recent_pipelines: Array<{
    id: string;
    task_name: string;
    status: PipelineStatus;
    branch: string;
    duration_seconds: number | null;
    started_at: string | null;
    finished_at: string | null;
    initiated_by: string;
  }>;
  lookback_days: number;
}

// ── Engineering Inbox (ENG-008B) ─────────────────────────────────────────────

export type TaskStatus = 'draft' | 'queued' | 'assigned' | 'accepted' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'released' | 'archived';

export type TaskPriority = 1 | 3 | 5 | 8 | 10;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: 'Draft', queued: 'Queued', assigned: 'Assigned', accepted: 'Accepted',
  running: 'Running', paused: 'Paused', completed: 'Completed', failed: 'Failed',
  cancelled: 'Cancelled', released: 'Released', archived: 'Archived',
};

export const TASK_PRIORITY_LABELS: Record<number, string> = {
  10: 'Critical', 8: 'High', 5: 'Medium', 3: 'Low', 1: 'Minimal',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  draft: 'slate', queued: 'blue', assigned: 'indigo', accepted: 'violet',
  running: 'amber', paused: 'yellow', completed: 'green', failed: 'red',
  cancelled: 'gray', released: 'emerald', archived: 'stone',
};

export interface EngineeringTask {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  source_type: string | null;
  source_ref: string | null;
  assigned_agent_id: string | null;
  created_by_id: string;
  updated_by_id: string | null;
  deadline: string | null;
  queued_at: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  released_at: string | null;
  archived_at: string | null;
  failure_reason: string | null;
  retry_count: number;
  max_retries: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Relations (when loaded)
  agent?: EngineeringAgent;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  dependencies?: TaskDependency[];
  checklists?: TaskChecklist[];
  labels?: TaskLabel[];
  history?: TaskHistoryEntry[];
  activity?: TaskActivity[];
  watchers?: TaskWatcher[];
  checklist_progress?: { total: number; completed: number; percent: number };
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  is_system: boolean;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  author?: { id: string; name: string; email: string; avatar_url: string | null };
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  filename: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  checksum: string | null;
  created_at: string;
  uploaded_by?: { id: string; name: string };
  download_url?: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: 'blocks' | 'blocked_by' | 'related';
  created_at: string;
  depends_on_task?: Pick<EngineeringTask, 'id' | 'title' | 'status' | 'priority'>;
}

export interface TaskLabel {
  id: string;
  company_id: string;
  name: string;
  color: string;
  description: string | null;
}

export interface TaskHistoryEntry {
  id: string;
  task_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  actor_type: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  actor?: { id: string; name: string };
}

export interface TaskActivity {
  id: string;
  task_id: string;
  activity_type: string;
  causer_id: string | null;
  causer_type: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
  causer?: { id: string; name: string };
}

export interface TaskWatcher {
  task_id: string;
  user_id: string;
  user?: { id: string; name: string; email: string };
}

export interface TaskChecklist {
  id: string;
  task_id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
  progress: { total: number; completed: number; percent: number };
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  content: string;
  is_completed: boolean;
  completed_by_id: string | null;
  completed_at: string | null;
  position: number;
}

export type ReleaseCandidateStatus = 'draft' | 'under_review' | 'approved' | 'rejected' | 'staged' | 'released' | 'rolled_back';

export interface EngineeringReleaseCandidate {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: ReleaseCandidateStatus;
  version_tag: string | null;
  created_by_id: string;
  approved_at: string | null;
  rejected_at: string | null;
  staged_at: string | null;
  released_at: string | null;
  rejection_reason: string | null;
  task_count?: number;
  created_at: string;
  tasks?: Array<Pick<EngineeringTask, 'id' | 'title' | 'status' | 'priority'>>;
}

export interface InboxKPIs {
  open_tasks: number;
  running_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  release_candidates: number;
  avg_completion_hours: number | null;
  overdue_tasks: number;
  my_assigned_tasks: number;
}

// ── Developer Agent (ENG-008C) ───────────────────────────────────────────────

export type AgentStatus = 'unregistered' | 'registering' | 'idle' | 'busy' | 'paused' | 'draining' | 'offline' | 'terminated';

export type ExecutionSessionStatus = 'initializing' | 'running' | 'paused' | 'completing' | 'completed' | 'failed' | 'aborted';

export interface EngineeringAgent {
  id: string;
  company_id: string;
  name: string;
  agent_type: 'standard' | 'specialist' | 'orchestrator';
  status: AgentStatus;
  machine_fingerprint: string | null;
  os_info: string | null;
  ip_address: string | null;
  version: string | null;
  capabilities: AgentCapability[] | null;
  platform_info: AgentPlatformInfo | null;
  last_seen_at: string | null;
  registered_at: string | null;
  deregistered_at: string | null;
  created_at: string;
  latest_heartbeat?: AgentHeartbeat;
  current_session?: ExecutionSession | null;
}

export interface AgentCapability {
  capability_key: string;
  capability_version: string | null;
  proficiency: number;
}

export interface AgentPlatformInfo {
  os: string;
  cpu_cores: number;
  memory_gb: number;
  disk_gb: number;
  git_version: string | null;
  claude_version: string | null;
  node_version: string | null;
  php_version: string | null;
}

export interface AgentHeartbeat {
  id: number;
  agent_id: string;
  status: AgentStatus;
  cpu_percent: number | null;
  memory_mb_used: number | null;
  disk_free_gb: number | null;
  current_task_id: string | null;
  load_average: number | null;
  recorded_at: string;
}

export interface ExecutionSession {
  id: string;
  company_id: string;
  task_id: string;
  agent_id: string;
  status: ExecutionSessionStatus;
  workspace_path: string | null;
  git_branch: string | null;
  git_commit: string | null;
  progress_percent: number;
  progress_message: string | null;
  cpu_seconds_used: number | null;
  memory_mb_peak: number | null;
  failure_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  task?: Pick<EngineeringTask, 'id' | 'title' | 'status'>;
  agent?: Pick<EngineeringAgent, 'id' | 'name' | 'status'>;
  artifacts?: ExecutionArtifact[];
  events?: ExecutionEvent[];
}

export interface ExecutionArtifact {
  id: string;
  session_id: string;
  artifact_type: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  checksum: string | null;
  created_at: string;
  download_url?: string;
}

export interface ExecutionEvent {
  id: number;
  session_id: string;
  event_type: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  context: Record<string, unknown> | null;
  occurred_at: string;
}

export interface AgentDashboard {
  connected_agents: number;
  busy_agents: number;
  offline_agents: number;
  running_tasks: number;
  failed_executions_24h: number;
  avg_runtime_seconds: number | null;
  latest_activity: Array<{
    agent_id: string;
    agent_name: string;
    event: string;
    occurred_at: string;
  }>;
}

// ── Execution Cluster (ENG-008D) ─────────────────────────────────────────────

export type WorkerStatus =
  | 'starting' | 'idle' | 'waiting' | 'reserved' | 'preparing'
  | 'running' | 'paused' | 'completed' | 'failed' | 'recovering'
  | 'updating' | 'stopping' | 'offline' | 'destroyed';

export type WorkerType = 'standard' | 'specialist' | 'heavy';
export type QueueStatus = 'pending' | 'assigned' | 'running' | 'paused' | 'cancelled' | 'completed' | 'expired';
export type SchedulingPolicy = 'fifo' | 'priority' | 'weighted_priority' | 'manual_override' | 'resource_aware' | 'dependency_aware' | 'reserved';
export type ClusterNodeStatus = 'active' | 'draining' | 'offline';
export type WorkerSessionStatus = 'preparing' | 'running' | 'paused' | 'completing' | 'completed' | 'failed' | 'aborted';

export const WORKER_STATUS_LABELS: Record<WorkerStatus, string> = {
  starting: 'Starting', idle: 'Idle', waiting: 'Waiting', reserved: 'Reserved',
  preparing: 'Preparing', running: 'Running', paused: 'Paused', completed: 'Completed',
  failed: 'Failed', recovering: 'Recovering', updating: 'Updating', stopping: 'Stopping',
  offline: 'Offline', destroyed: 'Destroyed',
};

export const WORKER_STATUS_COLORS: Record<WorkerStatus, string> = {
  starting: 'blue', idle: 'green', waiting: 'sky', reserved: 'indigo',
  preparing: 'violet', running: 'amber', paused: 'yellow', completed: 'emerald',
  failed: 'red', recovering: 'orange', updating: 'cyan', stopping: 'slate',
  offline: 'gray', destroyed: 'zinc',
};

export interface EngineeringWorker {
  id: string;
  company_id: string;
  name: string;
  worker_type: WorkerType;
  status: WorkerStatus;
  current_task_id: string | null;
  current_session_id: string | null;
  workspace_base_path: string | null;
  machine_id: string | null;
  max_concurrent_tasks: number;
  cpu_limit_percent: number | null;
  memory_limit_mb: number | null;
  disk_limit_gb: number | null;
  max_execution_minutes: number;
  capabilities: Array<{ capability_key: string; capability_version: string | null; proficiency: number }> | null;
  last_heartbeat_at: string | null;
  started_at: string | null;
  stopped_at: string | null;
  total_tasks_completed: number;
  total_tasks_failed: number;
  created_at: string;
  current_task?: { id: string; title: string; status: string } | null;
  current_session?: WorkerSession | null;
  latest_metrics?: WorkerRuntimeMetric[];
}

export interface WorkerSession {
  id: string;
  company_id: string;
  worker_id: string;
  task_id: string;
  status: WorkerSessionStatus;
  workspace_path: string | null;
  git_branch: string | null;
  git_commit_before: string | null;
  git_commit_after: string | null;
  progress_percent: number;
  progress_message: string | null;
  failure_reason: string | null;
  cpu_seconds_used: number | null;
  memory_mb_peak: number | null;
  disk_gb_peak: number | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  worker?: { id: string; name: string; status: WorkerStatus } | null;
  task?: { id: string; title: string; status: string; priority: number } | null;
}

export interface QueueEntry {
  id: string;
  company_id: string;
  task_id: string;
  priority: number;
  status: QueueStatus;
  scheduling_policy: SchedulingPolicy;
  assigned_worker_id: string | null;
  reserved_worker_id: string | null;
  earliest_start_at: string | null;
  enqueued_at: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  retry_count: number;
  max_retries: number;
  task?: { id: string; title: string; status: string; priority: number } | null;
  assigned_worker?: { id: string; name: string; status: WorkerStatus } | null;
}

export interface ClusterNode {
  id: string;
  company_id: string;
  node_name: string;
  node_type: 'primary' | 'secondary' | 'worker';
  status: ClusterNodeStatus;
  ip_address: string | null;
  port: number | null;
  worker_count: number;
  max_workers: number;
  cpu_usage_percent: number;
  memory_mb_used: number;
  memory_mb_total: number | null;
  disk_gb_free: number | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface WorkspaceLock {
  id: string;
  workspace_path: string;
  worker_id: string;
  task_id: string;
  expires_at: string | null;
  acquired_at: string;
  lock_reason: string | null;
}

export interface BranchLock {
  id: string;
  repository_path: string;
  branch_name: string;
  worker_id: string;
  task_id: string;
  expires_at: string | null;
  acquired_at: string;
}

export interface WorkerRuntimeMetric {
  id: number;
  worker_id: string;
  session_id: string | null;
  metric_key: string;
  metric_value: number;
  metric_unit: string | null;
  recorded_at: string;
}

export interface ResourceUsageSnapshot {
  id: number;
  cpu_percent: number;
  memory_mb_used: number;
  disk_gb_used: number;
  active_workers: number;
  idle_workers: number;
  failed_workers: number;
  queue_length: number;
  running_sessions: number;
  paused_sessions: number;
  cluster_utilization_percent: number;
  recorded_at: string;
}

export interface ClusterDashboard {
  workers: { total: number; active: number; idle: number; running: number; failed: number; offline: number };
  queue: { pending: number; assigned: number; running: number; total_today: number; completed_today: number; failed_today: number; avg_wait_seconds: number | null };
  resources: { cpu_percent: number; memory_mb_used: number; disk_gb_used: number; cluster_utilization_percent: number };
  locks: { workspace_locks: number; branch_locks: number; file_locks: number; conflicts_detected_24h: number };
  recent_events: ClusterEvent[];
  throughput: { tasks_per_hour: number; avg_execution_minutes: number | null; success_rate_percent: number };
}

export interface ClusterEvent {
  id: number;
  event_type: string;
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  message: string;
  context: Record<string, unknown> | null;
  occurred_at: string;
}

export interface ConflictReport {
  has_conflicts: boolean;
  workspace_conflicts: Array<{ workspace_path: string; locked_by_task_id: string; locked_by_worker_id: string }>;
  branch_conflicts: Array<{ branch_name: string; locked_by_task_id: string }>;
  file_conflicts: Array<{ file_path: string; locked_by_task_id: string; lock_type: string }>;
  dependency_blocks: Array<{ blocking_task_id: string; blocking_task_title: string; status: string }>;
}

export interface SchedulerStatus {
  is_paused: boolean;
  active_policy: SchedulingPolicy;
  queue_length: number;
  available_workers: number;
  next_scheduled_task: QueueEntry | null;
  tasks_scheduled_last_hour: number;
}

export interface ClusterHealthReport {
  status: 'healthy' | 'degraded' | 'critical';
  workers: { total: number; healthy: number; stale: number; failed: number };
  resources: { cpu_percent: number; memory_mb_used: number; disk_gb_used: number; cluster_utilization_percent: number };
  alerts: { cpu_high: boolean; memory_high: boolean; stale_workers: number; failed_workers: number };
  queue: { pending: number };
  checked_at: string;
}

// ─── Release Orchestrator Types (ENG-008E) ───────────────────────────────────

export type ReleaseStatus =
  | 'draft' | 'collecting' | 'validating' | 'ready'
  | 'approval_pending' | 'approved' | 'rejected'
  | 'queued' | 'pipeline_running' | 'pipeline_failed'
  | 'released' | 'cancelled' | 'archived';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'skipped';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'minimal';
export type ValidationStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'warning';
export type ApprovalLevel = 'engineering' | 'lead' | 'cto' | 'final';
export type DependencyType = 'task' | 'module' | 'database' | 'api' | 'migration' | 'circular';

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  draft: 'Draft', collecting: 'Collecting', validating: 'Validating', ready: 'Ready',
  approval_pending: 'Approval Pending', approved: 'Approved', rejected: 'Rejected',
  queued: 'Queued', pipeline_running: 'Pipeline Running', pipeline_failed: 'Pipeline Failed',
  released: 'Released', cancelled: 'Cancelled', archived: 'Archived',
};

export const RELEASE_STATUS_COLORS: Record<ReleaseStatus, string> = {
  draft: 'bg-gray-400', collecting: 'bg-blue-500', validating: 'bg-yellow-500', ready: 'bg-emerald-500',
  approval_pending: 'bg-orange-500', approved: 'bg-green-600', rejected: 'bg-red-600',
  queued: 'bg-indigo-500', pipeline_running: 'bg-violet-600', pipeline_failed: 'bg-red-700',
  released: 'bg-green-700', cancelled: 'bg-gray-500', archived: 'bg-gray-600',
};

export interface ReadinessBreakdown {
  architecture: number;
  backend: number;
  frontend: number;
  database: number;
  testing: number;
  documentation: number;
  security: number;
  deployment: number;
}

export interface EngineeringRelease {
  id: string;
  company_id: string;
  name: string;
  version: string | null;
  description: string | null;
  status: ReleaseStatus;
  release_type: string;
  task_ids: string[];
  task_count: number;
  readiness_score: number;
  readiness_breakdown: ReadinessBreakdown | null;
  risk_level: RiskLevel;
  risk_factors: string[] | null;
  is_breaking_change: boolean;
  breaking_changes: string[] | null;
  target_environment: string;
  scheduled_at: string | null;
  collected_at: string | null;
  validated_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  pipeline_started_at: string | null;
  released_at: string | null;
  cancelled_at: string | null;
  archived_at: string | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  pipeline_run_id: string | null;
  pipeline_status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleaseArtifact {
  id: string;
  release_id: string;
  task_id: string | null;
  artifact_type: string;
  name: string;
  file_path: string | null;
  file_size_bytes: number;
  checksum: string | null;
  mime_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ReleaseReport {
  id: string;
  release_id: string;
  report_type: string;
  title: string;
  content: string;
  structured_data: Record<string, unknown> | null;
  format: string;
  generated_by: string;
  generated_at: string | null;
  is_final: boolean;
  version: number;
  created_at: string;
}

export interface ReleaseValidationCheck {
  id: string;
  release_id: string;
  check_type: string;
  check_name: string;
  status: ValidationStatus;
  passed: boolean;
  message: string | null;
  details: Record<string, unknown> | null;
  score_contribution: number;
  severity: string;
  is_blocking: boolean;
  checked_at: string | null;
}

export interface ReleaseApproval {
  id: string;
  release_id: string;
  approval_level: ApprovalLevel;
  approval_role: string;
  approver_id: string | null;
  status: ApprovalStatus;
  comment: string | null;
  decision: string | null;
  sequence: number;
  is_required: boolean;
  requested_at: string | null;
  decided_at: string | null;
  expires_at: string | null;
}

export interface ReleaseDependency {
  id: string;
  release_id: string;
  dependency_type: DependencyType;
  dependency_name: string;
  dependency_version: string | null;
  status: string;
  is_blocking: boolean;
  is_circular: boolean;
  resolution_notes: string | null;
}

export interface ReleaseRisk {
  id: string;
  release_id: string;
  risk_category: string;
  risk_title: string;
  risk_description: string;
  severity: RiskLevel;
  likelihood: string;
  risk_score: number;
  mitigation_plan: string | null;
  is_accepted: boolean;
  accepted_at: string | null;
}

export interface ReleasePipelineRun {
  id: string;
  release_id: string;
  pipeline_run_id: string | null;
  pipeline_type: string;
  status: string;
  trigger_type: string;
  triggered_by: string | null;
  pipeline_config: Record<string, unknown> | null;
  logs: string | null;
  result_payload: Record<string, unknown> | null;
  environment: string;
  exit_code: number | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface ReleasePackage {
  id: string;
  release_id: string;
  package_type: string;
  file_path: string | null;
  file_size_bytes: number;
  checksum: string | null;
  manifest: Record<string, unknown> | null;
  metadata_payload: Record<string, unknown> | null;
  status: string;
  built_at: string | null;
}

export interface ReleaseAuditEntry {
  id: number;
  release_id: string;
  event_type: string;
  actor_id: string | null;
  actor_name: string | null;
  from_status: string | null;
  to_status: string | null;
  description: string;
  occurred_at: string;
}

export interface ReleaseNote {
  id: string;
  release_id: string;
  note_type: string;
  section: string | null;
  content: string;
  is_public: boolean;
  is_pinned: boolean;
  authored_by: string | null;
  created_at: string;
}

export interface ReleaseDashboard {
  summary: {
    total: number;
    draft: number;
    active: number;
    pending_approval: number;
    released_this_month: number;
    failed: number;
  };
  recent_releases: EngineeringRelease[];
  upcoming: EngineeringRelease[];
  pipeline_activity: ReleasePipelineRun[];
  readiness_avg: number;
}

export interface ReleaseReadinessScore {
  overall: number;
  breakdown: ReadinessBreakdown;
  checks: ReleaseValidationCheck[];
  blocking_issues: ReleaseValidationCheck[];
  warnings: ReleaseValidationCheck[];
}

// ============================================================
// TASK-ENG-009: AI Engineering Supervisor Types
// ============================================================

export type ReviewStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ReviewRecommendation = 'approve' | 'approve_with_warnings' | 'needs_review' | 'reject' | 'critical_block';
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type ReviewDimension = 'architecture' | 'backend' | 'frontend' | 'database' | 'security' | 'testing' | 'documentation' | 'performance' | 'maintainability';
export type RecommendationType = 'immediate_fix' | 'suggested_improvement' | 'future_refactoring' | 'technical_debt' | 'architecture_improvement' | 'performance_improvement' | 'security_improvement' | 'documentation_improvement';

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const REVIEW_RECOMMENDATION_LABELS: Record<ReviewRecommendation, string> = {
  approve: 'Approve',
  approve_with_warnings: 'Approve with Warnings',
  needs_review: 'Needs Review',
  reject: 'Reject',
  critical_block: 'Critical Block',
};

export const REVIEW_RECOMMENDATION_COLORS: Record<ReviewRecommendation, string> = {
  approve: 'text-green-600',
  approve_with_warnings: 'text-yellow-600',
  needs_review: 'text-orange-500',
  reject: 'text-red-600',
  critical_block: 'text-red-800',
};

export const RISK_SEVERITY_COLORS: Record<RiskSeverity, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
  informational: 'bg-gray-100 text-gray-700',
};

export const DIMENSION_WEIGHTS: Record<ReviewDimension, number> = {
  architecture: 20, backend: 15, frontend: 15, database: 10,
  security: 10, testing: 10, documentation: 10, performance: 5, maintainability: 5,
};

export interface AIReview {
  id: string;
  company_id: string;
  review_type: string;
  status: ReviewStatus;
  subject_type: string | null;
  subject_id: string | null;
  triggered_by: string | null;
  triggered_at: string;
  started_at: string | null;
  completed_at: string | null;
  overall_score: number | null;
  recommendation: ReviewRecommendation | null;
  justification: string | null;
  summary: string | null;
  dimensions: Record<ReviewDimension, number> | null;
  risk_count_critical: number;
  risk_count_high: number;
  risk_count_medium: number;
  risk_count_low: number;
  is_blocking: boolean;
  notes: string | null;
  // relations
  scores?: AIScore[];
  risks?: AIRisk[];
  recommendations?: AIRecommendation[];
  architecture_checks?: AIArchitectureCheck[];
  security_checks?: AISecurityCheck[];
  created_at: string;
  updated_at: string;
}

export interface AIScore {
  id: number;
  review_id: string;
  dimension: ReviewDimension;
  score: number;
  weight: number;
  weighted_score: number;
  details: Record<string, unknown> | null;
  issues_found: number;
  passed_checks: number;
  failed_checks: number;
}

export interface AIRisk {
  id: string;
  review_id: string;
  company_id: string;
  severity: RiskSeverity;
  category: string;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  priority: number;
  is_blocking: boolean;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  evidence: Record<string, unknown> | null;
  created_at: string;
}

export interface AIRecommendation {
  id: string;
  review_id: string;
  company_id: string;
  type: RecommendationType;
  priority: string;
  category: string;
  title: string;
  description: string;
  effort_estimate: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AIArchitectureCheck {
  id: number;
  review_id: string;
  adr_reference: string;
  check_name: string;
  check_description: string;
  passed: boolean;
  severity: string | null;
  details: string | null;
  evidence: Record<string, unknown> | null;
  created_at: string;
}

export interface AISecurityCheck {
  id: number;
  review_id: string;
  check_name: string;
  category: string;
  passed: boolean;
  severity: string | null;
  details: string | null;
  remediation: string | null;
  created_at: string;
}

export interface AIReleaseReview {
  id: string;
  company_id: string;
  review_id: string;
  release_id: string;
  recommendation: ReviewRecommendation | null;
  justification: string | null;
  blocking_risks_count: number;
  warning_risks_count: number;
  passed_checks: number;
  failed_checks: number;
  is_blocking: boolean;
  score_at_review: number | null;
  reviewed_at: string;
  review?: AIReview;
}

export interface AITrend {
  id: number;
  company_id: string;
  period_type: 'daily' | 'weekly' | 'monthly';
  period_label: string;
  overall_score: number | null;
  dimension_scores: Record<ReviewDimension, number> | null;
  review_count: number;
  risk_count: number;
  recommendation_count: number;
  avg_review_duration_seconds: number | null;
  created_at: string;
}

export interface AIDashboard {
  latest_review: AIReview | null;
  overall_score: number | null;
  recommendation: ReviewRecommendation | null;
  scores_by_dimension: AIScore[];
  critical_risks: AIRisk[];
  open_recommendations: AIRecommendation[];
  recent_reviews: AIReview[];
  trend_30d: AITrend[];
  review_count_total: number;
  review_count_this_month: number;
  architecture_compliance_rate: number;
  security_pass_rate: number;
}

// ===== TASK-ENG-V2-001: AI Repair Platform =====

export type RepairSessionStatus = "pending" | "analyzing" | "generating_prompt" | "awaiting_response" | "applying" | "completed" | "failed" | "cancelled" | "retrying" | "timeout";
export type RepairFailureType = "build_failure" | "test_failure" | "validation_failure" | "security_issue" | "architecture_violation" | "quality_issue" | "documentation_gap" | "performance_issue" | "pipeline_failure";
export type RepairApproach = "direct_fix" | "refactor" | "architectural_change" | "documentation_only" | "configuration_change" | "multi_step";
export type RepairResponseType = "patch" | "explanation" | "clarification_request" | "error" | "timeout";
export type EstimatedEffort = "trivial" | "low" | "medium" | "high" | "very_high";
export type PatchFormat = "diff" | "full_file" | "instructions";
export type PatchVerificationStatus = "pending" | "passed" | "failed";

export interface RepairAnalysis {
  id: string;
  session_id: string;
  failure_category: string;
  root_cause: string;
  confidence_score: number;
  affected_components?: string[];
  evidence?: Record<string, unknown>;
  repair_approach: RepairApproach;
  estimated_effort: EstimatedEffort;
  created_at: string;
}

export interface RepairPrompt {
  id: string;
  session_id: string;
  company_id: string;
  prompt_version: number;
  prompt_type: "initial" | "retry" | "follow_up" | "clarification";
  system_context: string;
  repair_instructions: string;
  context_files?: Array<{ path: string; relevance: string }>;
  constraints?: string[];
  success_criteria?: string[];
  token_estimate?: number;
  is_active: boolean;
  sent_at?: string;
  created_at: string;
}

export interface RepairResponse {
  id: number;
  session_id: string;
  prompt_id: string;
  response_type: RepairResponseType;
  response_content: string;
  files_modified?: string[];
  confidence_score?: number;
  requires_review: boolean;
  received_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_decision?: "accepted" | "rejected" | "modified";
}

export interface RepairPatch {
  id: string;
  session_id: string;
  response_id?: number;
  patch_content: string;
  patch_format: PatchFormat;
  files_affected?: string[];
  lines_added: number;
  lines_removed: number;
  is_applied: boolean;
  applied_at?: string;
  applied_by?: string;
  verification_status?: PatchVerificationStatus;
  created_at: string;
}

export interface RepairHistory {
  id: number;
  session_id: string;
  event_type: string;
  event_data?: Record<string, unknown>;
  actor_id?: string;
  occurred_at: string;
}

/**
 * One page of repair sessions, as the paginated endpoint returns it.
 *
 * Written down so the sessions list is not typed `any` — the consumer reads
 * `.data`, and an `any` there means a rename on the server surfaces as an empty
 * table rather than a type error.
 */
export interface RepairSessionPage {
  data: RepairSession[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

export interface RepairSession {
  id: string;
  company_id: string;
  source_type: string;
  source_id?: string;
  status: RepairSessionStatus;
  failure_type: RepairFailureType;
  failure_summary: string;
  failure_context?: Record<string, unknown>;
  root_cause_category?: string;
  root_cause_description?: string;
  retry_count: number;
  max_retries: number;
  timeout_at?: string;
  started_at?: string;
  completed_at?: string;
  failed_reason?: string;
  created_at: string;
  updated_at: string;
  analysis?: RepairAnalysis;
  prompts?: RepairPrompt[];
  responses?: RepairResponse[];
  patches?: RepairPatch[];
  history?: RepairHistory[];
}

export interface RepairClaudePackage {
  session_id: string;
  prompt_id: string;
  prompt_version: number;
  formatted_prompt: string;
  token_estimate?: number;
  constraints: string[];
  success_criteria: string[];
  context_files: Array<{ path: string; relevance: string }>;
}

export interface RepairDashboard {
  total_sessions: number;
  active_sessions: number;
  completed_today: number;
  failed_today: number;
  success_rate: number;
  recent_sessions: RepairSession[];
  by_failure_type: Partial<Record<RepairFailureType, number>>;
  by_status: Partial<Record<RepairSessionStatus, number>>;
}
