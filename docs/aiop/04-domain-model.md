# Domain Model
## ECOS AI Operations Platform

**Document ID:** AIOP-DM-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## 1. Domain Overview

AIOP's domain is organized around five aggregate roots:

```
┌─────────────────────────────────────────────────────────────────┐
│                      AIOP Domain                                │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Workspace  │    │   Agent      │    │    Worker        │  │
│  │  Aggregate  │    │  Aggregate   │    │   Aggregate      │  │
│  └──────┬──────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                  │                     │             │
│         │  contains        │  runs on            │  acquires   │
│         ▼                  ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Task Aggregate                         │  │
│  │  Task → TaskStep → Execution → ExecutionLog → Artifact  │  │
│  └──────────────────────────┬──────────────────────────────┘  │
│                             │ generates                        │
│                             ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Review Aggregate                       │  │
│  │              Review → Approval → Report                  │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Entity Definitions

### 2.1 Workspace

**Responsibility:** Organizational unit grouping projects and workers. A workspace represents an engineering team or department.

**Ownership:** Created by system administrators. Managed by engineering managers.

```
Workspace {
  id: UUID
  name: string                        // "Backend Team", "Mobile Team"
  slug: string                        // URL-safe identifier
  company_id: UUID                    // ECOS company reference
  owner_user_id: UUID                 // Primary engineering manager
  execution_policy_id: UUID           // Default execution policy
  review_policy_id: UUID              // Default review policy
  retry_policy_id: UUID               // Default retry policy
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
}
```

**Relationships:**
- Has many Projects
- Has many Workers (registered to this workspace)
- Has many Tasks
- Has one ExecutionPolicy (default)
- Has one ReviewPolicy (default)

---

### 2.2 Project

**Responsibility:** Represents a software project within a workspace, linked to a repository.

```
Project {
  id: UUID
  workspace_id: UUID
  name: string
  description: text | null
  repository_id: UUID
  default_branch: string              // "main"
  default_agent_id: UUID | null       // Preferred AI agent
  execution_policy_id: UUID | null    // Override workspace policy
  review_policy_id: UUID | null       // Override workspace policy
  is_active: boolean
}
```

---

### 2.3 Repository

**Responsibility:** Represents a git repository. Contains connection information and access credentials reference.

```
Repository {
  id: UUID
  workspace_id: UUID
  name: string
  url: string                         // https://github.com/org/repo
  provider: enum                      // github, gitlab, bitbucket, self-hosted
  default_branch: string
  deploy_key_secret_id: UUID          // Reference to encrypted secret
  ssh_key_secret_id: UUID | null
  webhook_secret_id: UUID | null
  is_active: boolean
}
```

---

### 2.4 AI Agent

**Responsibility:** Registry entry for an AI agent type. Describes what the agent can do and how to invoke it.

**Lifecycle:** Registered once, updated when new versions are available.

```
AiopAgent {
  id: UUID
  name: string                        // "Claude Code", "Gemini CLI"
  slug: string                        // "claude-code", "gemini-cli"
  connector_class: string             // "ClaudeCodeConnector"
  capabilities: string[]              // ["code_generation", "refactoring"]
  version_command: string             // CLI command to get version
  default_timeout_seconds: integer    // 1800 (30 min)
  default_model: string               // "claude-sonnet-5"
  cost_per_token: decimal | null
  is_active: boolean
  configuration_schema: JSON          // JSON Schema for config fields
}
```

**Relationships:**
- Has many Workers (workers that have this agent installed)
- Has many Executions

---

### 2.5 AI Worker

**Responsibility:** Represents a running worker instance on a physical machine. Workers acquire and execute tasks.

**Lifecycle:** Registered → Online → (Heartbeating) → Offline / Deregistered

```
AiopWorker {
  id: UUID
  workspace_id: UUID
  name: string                        // "Laptop-Osama", "CI-Server-01"
  hostname: string
  ip_address: string | null
  token_hash: string                  // Bcrypt hash of the API token
  agent_id: UUID                      // The AI agent installed on this worker
  agent_version: string               // "1.5.7"
  status: enum                        // online, offline, busy, maintenance
  last_heartbeat_at: timestamp
  registered_at: timestamp
  registered_by_user_id: UUID
  max_concurrent_executions: integer  // Default 1
  os_type: string                     // "linux", "macos", "windows"
  docker_available: boolean
  metadata: JSON                      // Machine specs, environment info
}
```

**Relationships:**
- Belongs to Workspace
- Has one Agent type
- Has many Executions (current and historical)
- Has many HeartbeatRecords

---

### 2.6 Worker Session

**Responsibility:** Tracks a single continuous online period for a worker. A new session starts each time the worker connects.

```
WorkerSession {
  id: UUID
  worker_id: UUID
  started_at: timestamp
  ended_at: timestamp | null
  end_reason: enum | null             // graceful, timeout, crash, revoked
  executions_count: integer
  heartbeats_count: integer
}
```

---

### 2.7 Task

**Responsibility:** The central aggregate. Represents a unit of engineering work to be performed by an AI agent.

**Lifecycle:** Governed by ADR-AIOP-003 state machine.

```
AiopTask {
  id: UUID
  workspace_id: UUID
  project_id: UUID
  title: string
  description: text                   // Detailed requirements for the AI
  status: enum                        // See ADR-AIOP-003 state machine
  type: enum                          // feature, bug_fix, refactor, test, migration, review
  priority: enum                      // critical, high, medium, low
  required_capabilities: string[]     // Capabilities the agent must have
  preferred_agent_id: UUID | null     // Pinned agent preference
  target_branch: string               // Branch to merge into
  source_branch: string | null        // Branch the AI should work from
  created_by_user_id: UUID
  assigned_worker_id: UUID | null
  assigned_at: timestamp | null
  execution_policy_id: UUID
  review_policy_id: UUID
  retry_policy_id: UUID
  max_cost_budget: decimal | null     // Optional cost ceiling
  estimated_tokens: integer | null
  actual_tokens_used: integer | null
  context: JSON                       // Additional structured context for the AI
  labels: string[]
  due_at: timestamp | null
  completed_at: timestamp | null
  cancelled_at: timestamp | null
  cancellation_reason: text | null
  metadata: JSON
}
```

**Relationships:**
- Belongs to Workspace, Project
- Has many TaskSteps
- Has many Executions (one per attempt)
- Has one current Execution
- Has many Reviews
- Has one final Approval

---

### 2.8 Task Step

**Responsibility:** A decomposition of a complex task into sub-steps that can be tracked individually.

```
TaskStep {
  id: UUID
  task_id: UUID
  sequence: integer
  title: string
  description: text | null
  status: enum                        // pending, in_progress, complete, skipped
  completed_at: timestamp | null
}
```

---

### 2.9 Execution

**Responsibility:** Records one attempt to execute a task. A task may have multiple executions (retries).

```
AiopExecution {
  id: UUID
  task_id: UUID
  worker_id: UUID
  agent_id: UUID
  attempt_number: integer             // 1 for first attempt, 2 for first retry
  status: enum                        // preparing, cloning, running, testing, uploading, complete, failed
  started_at: timestamp
  completed_at: timestamp | null
  duration_seconds: integer | null
  agent_version: string
  model_version: string
  tokens_used: integer | null
  cost_estimate: decimal | null
  failure_reason: text | null
  failure_code: string | null         // timeout, agent_crash, out_of_memory, etc.
  exit_code: integer | null
  metadata: JSON
}
```

---

### 2.10 Execution Log

**Responsibility:** A single log entry from an execution. Stored in bulk for streaming and retrospective analysis.

```
AiopExecutionLog {
  id: bigint (auto-increment)         // Not UUID — high volume
  execution_id: UUID
  sequence: integer
  level: enum                         // debug, info, warn, error
  source: enum                        // worker, agent, connector, system
  message: text
  logged_at: timestamp
  metadata: JSON | null
}
```

**Note:** Logs are NOT stored in MySQL/Postgres for long term. Real-time chunks go to Redis; completed logs go to S3. The database stores only a reference to the S3 log file.

---

### 2.11 Artifact

**Responsibility:** A file or structured output produced by an execution and stored in the artifact vault.

```
AiopArtifact {
  id: UUID
  execution_id: UUID
  task_id: UUID
  type: enum                          // code_diff, modified_files, report, test_results, log
  name: string
  storage_key: string                 // S3 object key
  size_bytes: bigint
  mime_type: string
  checksum_sha256: string
  is_primary: boolean                 // Is this the main deliverable?
  uploaded_at: timestamp
  verified_at: timestamp | null
  verification_status: enum          // pending, verified, failed
}
```

---

### 2.12 Report

**Responsibility:** A structured summary produced by the AI agent describing what it did, why, and what risks it identified.

```
AiopReport {
  id: UUID
  execution_id: UUID
  task_id: UUID
  artifact_id: UUID                   // Points to the stored JSON artifact
  summary: text                       // 1-paragraph human-readable summary
  files_changed: integer
  lines_added: integer
  lines_removed: integer
  tests_added: integer | null
  tests_passed: integer | null
  tests_failed: integer | null
  confidence_score: decimal | null    // 0.0–1.0 if the AI reported confidence
  identified_risks: JSON              // Array of risk descriptions
  suggested_review_focus: JSON        // Array of areas needing human attention
  generated_at: timestamp
}
```

---

### 2.13 Review

**Responsibility:** A human review of a completed execution.

```
AiopReview {
  id: UUID
  task_id: UUID
  execution_id: UUID
  reviewer_user_id: UUID
  stage: enum                         // technical, architecture, cto
  status: enum                        // pending, in_progress, approved, changes_requested, rejected
  comment: text | null
  started_at: timestamp | null
  completed_at: timestamp | null
  sla_deadline: timestamp
  sla_breached: boolean
}
```

---

### 2.14 Approval

**Responsibility:** The formal approval decision that allows a task to proceed to merge.

```
AiopApproval {
  id: UUID
  task_id: UUID
  review_id: UUID
  approver_user_id: UUID
  decision: enum                      // approved, rejected
  comment: text | null
  approved_at: timestamp
  merge_initiated_at: timestamp | null
  merge_completed_at: timestamp | null
  merge_commit_sha: string | null
}
```

---

### 2.15 Policy Value Objects

```
ExecutionPolicy {
  timeout_seconds: 1800
  max_concurrent_executions: 1
  allowed_capabilities: string[]
  network_access: none | restricted | full
  disk_limit_gb: 20
  memory_limit_gb: 4
}

ReviewPolicy {
  requires_technical_review: true
  technical_reviewer_role: string
  requires_architecture_review: bool
  requires_cto_approval: bool
  cto_approval_task_types: string[]
  sla_hours: 4
  auto_escalate_after_sla: bool
  require_reviewer_comment: bool
}

RetryPolicy {
  max_retries: 2
  retry_delay_minutes: 5
  retry_on_same_worker: false
  retry_on_different_agent: false
}
```

---

### 2.16 Secret

**Responsibility:** An encrypted credential stored in the control plane and injected into executions.

```
AiopSecret {
  id: UUID
  workspace_id: UUID
  project_id: UUID | null             // null = workspace-level secret
  name: string                        // "GITHUB_DEPLOY_KEY", "ANTHROPIC_API_KEY"
  type: enum                          // deploy_key, api_key, env_var, certificate
  encrypted_value: text               // AES-256-GCM encrypted
  encryption_key_id: string           // KMS key reference
  is_active: boolean
  last_rotated_at: timestamp | null
  created_by_user_id: UUID
}
```

---

### 2.17 Notification

**Responsibility:** A notification record for delivery to users via configured channels.

```
AiopNotification {
  id: UUID
  user_id: UUID
  task_id: UUID | null
  type: enum                          // task_assigned, review_requested, sla_breach, etc.
  title: string
  body: text
  channel: enum                       // in_app, email, slack, webhook
  status: enum                        // pending, sent, failed
  sent_at: timestamp | null
  read_at: timestamp | null
}
```

---

### 2.18 Queue

**Responsibility:** Virtual representation of the task queue state. Not a database table — derived from task statuses and Redis queue metadata.

```
Queue (conceptual, not a table) {
  queued_tasks: Task[]              // Tasks in QUEUED status
  pending_assignment: Task[]        // Tasks awaiting an available worker
  estimated_wait_time: integer      // Based on current execution durations
  available_workers: Worker[]
  busy_workers: Worker[]
}
```

---

### 2.19 Heartbeat

**Responsibility:** Records individual worker heartbeat events.

```
AiopHeartbeat {
  id: bigint (auto-increment)
  worker_id: UUID
  received_at: timestamp
  worker_status: enum               // idle, busy, error
  active_execution_id: UUID | null
  cpu_percent: decimal | null
  memory_percent: decimal | null
  disk_free_gb: decimal | null
}
```

**Note:** Heartbeats older than 24 hours are archived/pruned. Only the last 200 heartbeats per worker are kept in the hot table.
