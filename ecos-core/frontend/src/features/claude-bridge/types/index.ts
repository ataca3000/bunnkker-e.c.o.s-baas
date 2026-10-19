export type TaskStatus =
  | 'draft'
  | 'pending'
  | 'queued'
  | 'running'
  | 'done'
  | 'failed'
  | 'approved'
  | 'changes_requested'
  | 'merged'
  | 'cancelled';

export type TaskPriority = 'low' | 'normal' | 'high';

export type ArtifactType = 'diff' | 'report' | 'log';

export type WorkerStatus = 'online' | 'offline';

export interface CbWorker {
  id: string;
  name: string;
  hostname: string;
  status: WorkerStatus;
  last_seen_at: string | null;
  claude_version: string | null;
  is_active: boolean;
  registered_at: string;
}

export interface CbExecution {
  id: string;
  attempt_number: number;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  tokens_used: number | null;
  claude_version: string | null;
  failure_code: string | null;
}

export interface CbArtifact {
  id: string;
  type: ArtifactType;
  filename: string;
  size_bytes: number;
}

export interface CbTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  status_label: string;
  priority: TaskPriority;
  repository_path: string;
  target_branch: string;
  worker: { id: string; name: string } | null;
  current_execution: CbExecution | null;
  artifacts: CbArtifact[];
  failure_reason: string | null;
  review_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CbLogLine {
  index: number;
  ts: string;
  stream: 'stdout' | 'stderr';
  text: string;
}

export interface CbDashboard {
  worker: { status: WorkerStatus; name: string; last_seen_at: string | null } | null;
  counts: {
    queued: number;
    running: number;
    awaiting_review: number;
    approved_today: number;
  };
  active_task: { id: string; title: string; started_at: string; elapsed_seconds: number } | null;
  recent_tasks: CbTask[];
}

export interface CbPaginated<T> {
  data: T[];
  meta: { page: number; per_page: number; total: number; last_page: number };
}
