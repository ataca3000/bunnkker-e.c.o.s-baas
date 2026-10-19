# Engineering Cloud — Domain Model

**Version:** 1.0 | **Status:** Frozen | **Date:** 2026-07-22

---

## 1. Bounded Context Overview

The Engineering Cloud bounded context is the operational nucleus of ECOS's internal software-delivery platform. It owns the full lifecycle of engineering work: from task authorship and dependency resolution, through autonomous agent registration and worker dispatch, to workspace provisioning, pipeline execution, and release promotion. It defines what work exists (EngineeringTask), who or what performs it (EngineeringAgent, EngineeringWorker), where it runs (Workspace, ExecutionSession), and what it produces (PipelineArtifact, ReleaseBundle, ReleaseCandidate). Crucially, it does not own application business logic — it delegates domain events outward to the broader ECOS platform via the EnterpriseEventBus and consumes only identity (company_id, user context) from the Organisation bounded context. Authentication strategy is bifurcated: human operators authenticate through Laravel Sanctum, while autonomous agents authenticate through short-lived JWTs and are registered via API Keys. All persistence targets PostgreSQL with UUID primary keys, company_id row-level isolation, and soft deletes on every mutable entity.

---

## 2. Aggregates

### 2.1 Task Aggregate

**Aggregate Root:** `EngineeringTask`

**Contained Entities:** `TaskDependency`, `TaskComment`, `TaskAttachment`, `TaskArtifact`, `TaskLock`, `ExecutionLog`

**Invariants:**
- A task may only transition through the canonical state machine: Draft → Queued → Assigned → Accepted → Running → Paused → Completed | Failed | Cancelled → Released → Archived.
- A task cannot be moved to Queued if any upstream `TaskDependency` is not in a terminal state (Completed, Released, or Archived).
- A `TaskLock` must be held by the current `EngineeringWorker` before any state transition from Accepted onward; no two workers may hold the lock simultaneously.
- `ExecutionLog` entries are immutable once written; only appends are permitted.
- Attachments and comments may be added at any non-terminal state; they are read-only once the task reaches Archived.

**Boundary Rationale:** All information about a unit of engineering work — its metadata, dependencies, collaborative commentary, and execution trace — must change together to preserve consistency. A task's progress cannot be safely understood without its lock state, its dependency graph, and its execution history; therefore they live inside a single transactional boundary.

---

### 2.2 Worker Aggregate

**Aggregate Root:** `EngineeringWorker`

**Contained Entities:** `WorkerCapability`, `WorkerResource`, `WorkerHeartbeat`, `ExecutionSession`

**Invariants:**
- A worker in Offline or Terminated state may not accept new `ExecutionSession` assignments.
- `WorkerHeartbeat` records must arrive within the configured TTL; absence beyond the TTL triggers an automatic transition to Offline.
- A worker may hold at most one `ExecutionSession` in Running state at any given moment unless the worker declares a concurrent-session capability.
- `WorkerCapability` entries define the contract for task matching; removing a capability while a session is Running is prohibited.
- `WorkerResource` reflects real-time headroom and must be updated atomically with heartbeat submission.

**Boundary Rationale:** The worker is the execution unit. Its health signal, resource availability, declared capabilities, and active sessions are tightly coupled — a scheduler cannot safely assign work without reading all four together. Enclosing them in one aggregate eliminates partial reads and race conditions during assignment.

---

### 2.3 Workspace Aggregate

**Aggregate Root:** `Workspace`

**Contained Entities:** `WorkspaceLock`

**Invariants:**
- Only one `WorkspaceLock` may be active (non-released) per Workspace at any time.
- A Workspace in Archiving or Archived state may not accept new locks.
- Provisioning must complete within a system-defined timeout; failure triggers a transition to the Failed state and emits `WorkspaceProvisioningFailed`.
- A Workspace in Active state with no lock held transitions to Idle after a configurable idle TTL.

**Boundary Rationale:** Workspace provisioning and locking are the only two operations that affect the workspace's state machine. Keeping WorkspaceLock inside the aggregate ensures that the lock check and state transition are atomic with no gap for concurrent provisioning.

---

### 2.4 Release Aggregate

**Aggregate Root:** `ReleaseCandidate`

**Contained Entities:** `ReleaseBundle`, `PipelineRun`, `PipelineArtifact`

**Invariants:**
- A `ReleaseCandidate` may only be promoted to Staged after reaching the Approved state; Approved requires at least one reviewer approval recorded in the audit trail.
- A `PipelineRun` failure in the Staged phase rolls the candidate back to Draft and emits `ReleaseCandidateRolledBack`.
- `PipelineArtifact` checksums must be verified before a release transitions to Released; checksum mismatch is a hard block.
- A `ReleaseBundle` groups one or more `TaskArtifact` references; the bundle is immutable once the candidate reaches Approved.
- Only one `PipelineRun` may be in a terminal-pending (non-completed, non-failed) state per candidate at a time.

**Boundary Rationale:** A release is a versioned, auditable unit of deployable software. The pipeline that validates it, the artifacts it carries, and the candidate metadata are inseparable for traceability and rollback purposes. Managing them as one aggregate ensures that release state and artifact integrity are always consistent.

---

### 2.5 Agent Aggregate

**Aggregate Root:** `EngineeringAgent`

**Contained Entities:** registered capabilities (modeled as a JSON capability manifest on the root; no separate child entity table)

**Invariants:**
- An agent must present a valid API Key during registration; the key is hashed and stored, never stored in plaintext.
- An agent's JWT token must be rotated before expiry; an expired token causes the agent to be treated as Unregistered until re-authentication.
- Capability claims are validated against a system-maintained registry of known capability types at registration time; unknown capabilities are rejected.
- An agent may not register more capabilities than its tier allows; capability count is bounded per company plan.

**Boundary Rationale:** An agent is a self-contained autonomous actor. Its identity, authentication material, and declared capabilities must be managed as one unit to prevent partial registration states where a JWT is valid but capabilities are unresolved.

---

## 3. Entity Definitions

### 3.1 EngineeringTask

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| title | string(255) | Human-readable task title | not null |
| description | text | Full task specification | nullable |
| state | enum | Current lifecycle state | Draft\|Queued\|Assigned\|Accepted\|Running\|Paused\|Completed\|Failed\|Cancelled\|Released\|Archived; not null; default Draft |
| priority | integer | Scheduling priority (1 = highest) | not null; default 50; range 1–100 |
| assigned_worker_id | UUID | Worker currently holding the task | FK → engineering_workers.id; nullable |
| workspace_id | UUID | Workspace where execution occurs | FK → workspaces.id; nullable |
| estimated_duration_minutes | integer | Planner estimate | nullable; positive |
| actual_duration_minutes | integer | Calculated on completion | nullable; positive |
| scheduled_at | timestamp | Earliest eligible execution time | nullable |
| completed_at | timestamp | Timestamp of terminal state entry | nullable |
| deleted_at | timestamp | Soft delete sentinel | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.2 EngineeringAgent

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| name | string(255) | Human-readable agent name | not null |
| api_key_hash | string(255) | Hashed registration API key | not null; unique |
| jwt_expires_at | timestamp | Current JWT expiry | not null |
| state | enum | Registration lifecycle state | Unregistered\|Registering\|Idle\|Busy\|Paused\|Draining\|Offline\|Terminated; not null |
| capability_manifest | jsonb | Declared capability list | not null; default '[]' |
| last_seen_at | timestamp | Last successful authentication | nullable |
| tier | string(50) | Plan-based capability tier | not null; default 'standard' |
| deleted_at | timestamp | Soft delete sentinel | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.3 EngineeringWorker

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| agent_id | UUID | Owning agent | FK → engineering_agents.id; not null |
| name | string(255) | Worker display name | not null |
| state | enum | Worker operational state | Unregistered\|Registering\|Idle\|Busy\|Paused\|Draining\|Offline\|Terminated; not null |
| concurrent_session_limit | integer | Max simultaneous sessions | not null; default 1; range 1–16 |
| heartbeat_interval_seconds | integer | Expected heartbeat cadence | not null; default 30 |
| heartbeat_timeout_seconds | integer | TTL before Offline transition | not null; default 90 |
| last_heartbeat_at | timestamp | Timestamp of most recent heartbeat | nullable |
| deleted_at | timestamp | Soft delete sentinel | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.4 ExecutionSession

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| worker_id | UUID | Executing worker | FK → engineering_workers.id; not null |
| task_id | UUID | Task being executed | FK → engineering_tasks.id; not null |
| state | enum | Session lifecycle state | Initializing\|Running\|Paused\|Completing\|Completed\|Failed\|Aborted; not null |
| started_at | timestamp | Session initialisation time | not null |
| ended_at | timestamp | Terminal state timestamp | nullable |
| exit_code | integer | Process exit code | nullable |
| retry_count | integer | Number of retry attempts | not null; default 0 |
| retry_policy | jsonb | RetryPolicy value object snapshot | nullable |
| environment | jsonb | Injected environment variables | nullable |
| deleted_at | timestamp | Soft delete sentinel | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.5 ExecutionQueue

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| name | string(255) | Queue label (e.g. "critical", "batch") | not null |
| priority_weight | integer | Relative scheduling weight | not null; default 100 |
| max_concurrent_tasks | integer | Concurrency cap for this queue | not null; default 10 |
| is_paused | boolean | Temporarily halts dequeue | not null; default false |
| task_count | integer | Denormalised queue depth | not null; default 0 |
| last_dequeued_at | timestamp | Timestamp of last pop | nullable |
| deleted_at | timestamp | Soft delete sentinel | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.6 Workspace

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| name | string(255) | Workspace identifier | not null |
| state | enum | Workspace lifecycle state | Pending\|Provisioning\|Active\|Idle\|Archiving\|Archived\|Failed; not null |
| resource_spec | jsonb | ResourceSpec value object | not null |
| provisioned_at | timestamp | When provisioning completed | nullable |
| idle_timeout_seconds | integer | Seconds before Idle transition | not null; default 1800 |
| archived_at | timestamp | When archiving completed | nullable |
| failure_reason | text | Human-readable failure detail | nullable |
| deleted_at | timestamp | Soft delete sentinel | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.7 WorkspaceLock

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| workspace_id | UUID | Locked workspace | FK → workspaces.id; not null |
| holder_worker_id | UUID | Worker that holds the lock | FK → engineering_workers.id; not null |
| acquired_at | timestamp | Lock acquisition timestamp | not null |
| expires_at | timestamp | Lock TTL expiry | not null |
| released_at | timestamp | Voluntary release timestamp | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.8 ReleaseCandidate

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| version | string(50) | SemVer string | not null; validated by SemVer VO |
| state | enum | Release lifecycle state | Draft\|UnderReview\|Approved\|Staged\|Released\|RolledBack; not null |
| title | string(255) | Release title / changelog summary | not null |
| authored_by | UUID | User who created the candidate | FK → users.id; not null |
| approved_by | UUID | Reviewer who approved | FK → users.id; nullable |
| approved_at | timestamp | Approval timestamp | nullable |
| released_at | timestamp | Production promotion timestamp | nullable |
| rollback_reason | text | Rollback justification | nullable |
| deleted_at | timestamp | Soft delete sentinel | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.9 ReleaseBundle

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| release_candidate_id | UUID | Parent candidate | FK → release_candidates.id; not null |
| name | string(255) | Bundle label | not null |
| artifact_ids | jsonb | Array of PipelineArtifact UUIDs | not null; default '[]' |
| checksum | string(64) | ArtifactChecksum of bundle manifest | not null |
| is_locked | boolean | True once candidate reaches Approved | not null; default false |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.10 TaskDependency

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| task_id | UUID | Dependent (downstream) task | FK → engineering_tasks.id; not null |
| depends_on_task_id | UUID | Upstream prerequisite task | FK → engineering_tasks.id; not null |
| dependency_type | enum | Relationship qualifier | finish_to_start\|start_to_start\|finish_to_finish; not null; default finish_to_start |
| is_satisfied | boolean | True when upstream reaches terminal state | not null; default false |
| satisfied_at | timestamp | Timestamp of satisfaction | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.11 TaskComment

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| task_id | UUID | Parent task | FK → engineering_tasks.id; not null |
| author_id | UUID | Commenting user or agent | FK → users.id; not null |
| body | text | Comment content (Markdown) | not null |
| is_system | boolean | True for machine-generated comments | not null; default false |
| edited_at | timestamp | Last edit timestamp | nullable |
| deleted_at | timestamp | Soft delete sentinel | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.12 TaskAttachment

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| task_id | UUID | Parent task | FK → engineering_tasks.id; not null |
| uploaded_by | UUID | User who attached the file | FK → users.id; not null |
| filename | string(255) | Original file name | not null |
| mime_type | string(100) | MIME type | not null |
| storage_path | string(1000) | Internal storage path | not null |
| size_bytes | bigint | File size | not null; positive |
| checksum | string(64) | ArtifactChecksum of file content | not null |
| deleted_at | timestamp | Soft delete sentinel | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.13 ExecutionLog

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| session_id | UUID | Parent execution session | FK → execution_sessions.id; not null |
| task_id | UUID | Denormalised task reference | FK → engineering_tasks.id; not null |
| level | enum | Log severity | debug\|info\|warning\|error\|critical; not null |
| message | text | Log body | not null |
| context | jsonb | Structured key-value context | nullable |
| logged_at | timestamp | Precise log emission timestamp | not null |
| created_at | timestamp | Record creation | not null |

---

### 3.14 PipelineRun

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| release_candidate_id | UUID | Owning release | FK → release_candidates.id; not null |
| provider | string(50) | CI provider identifier (e.g. github_actions) | not null |
| external_run_id | string(255) | Provider-side run identifier | nullable |
| state | enum | Run outcome state | pending\|running\|succeeded\|failed\|cancelled; not null |
| triggered_by | UUID | User or agent that triggered the run | FK → users.id; nullable |
| started_at | timestamp | Provider-reported start | nullable |
| finished_at | timestamp | Provider-reported end | nullable |
| log_url | string(1000) | Link to provider log | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.15 PipelineArtifact

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| pipeline_run_id | UUID | Parent pipeline run | FK → pipeline_runs.id; not null |
| name | string(255) | Artifact label | not null |
| artifact_type | string(100) | Classification (build\|report\|coverage\|package) | not null |
| storage_path | string(1000) | Internal storage path | not null |
| size_bytes | bigint | Artifact size | not null; positive |
| checksum | string(64) | ArtifactChecksum | not null |
| expires_at | timestamp | Retention expiry | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.16 WorkerCapability

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| worker_id | UUID | Owning worker | FK → engineering_workers.id; not null |
| capability_key | string(100) | Canonical capability identifier | not null; validated against registry |
| capability_version | string(50) | SemVer of the capability | not null |
| parameters | jsonb | Capability-specific configuration | nullable |
| is_active | boolean | Whether currently offered | not null; default true |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.17 WorkerResource

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| worker_id | UUID | Owning worker | FK → engineering_workers.id; not null |
| cpu_cores_total | decimal(6,2) | Total CPU allocation | not null; positive |
| cpu_cores_used | decimal(6,2) | Currently consumed CPU | not null; default 0 |
| memory_mb_total | integer | Total memory in megabytes | not null; positive |
| memory_mb_used | integer | Currently consumed memory | not null; default 0 |
| disk_gb_total | decimal(8,2) | Total disk in gigabytes | not null; positive |
| disk_gb_used | decimal(8,2) | Currently consumed disk | not null; default 0 |
| measured_at | timestamp | Snapshot timestamp | not null |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.18 WorkerHeartbeat

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| worker_id | UUID | Sending worker | FK → engineering_workers.id; not null |
| signal | jsonb | HeartbeatSignal value object | not null |
| received_at | timestamp | Server receipt timestamp | not null |
| is_late | boolean | True if beyond interval threshold | not null; default false |
| sequence_number | bigint | Monotonically increasing per worker | not null |
| created_at | timestamp | Record creation | not null |

---

### 3.19 TaskArtifact

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| task_id | UUID | Producing task | FK → engineering_tasks.id; not null |
| session_id | UUID | Session that produced the artifact | FK → execution_sessions.id; not null |
| name | string(255) | Artifact label | not null |
| artifact_type | string(100) | Classification (output\|log\|report\|binary) | not null |
| storage_path | string(1000) | Internal storage path | not null |
| size_bytes | bigint | File size | not null; positive |
| checksum | string(64) | ArtifactChecksum | not null |
| expires_at | timestamp | Retention expiry | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

### 3.20 TaskLock

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | UUID | Primary key | PK, not null |
| company_id | UUID | Tenant scope | FK → companies.id, not null, indexed |
| task_id | UUID | Locked task | FK → engineering_tasks.id; not null; unique (one active lock per task) |
| held_by_worker_id | UUID | Lock-holding worker | FK → engineering_workers.id; not null |
| acquired_at | timestamp | Lock acquisition timestamp | not null |
| expires_at | timestamp | Lock TTL expiry | not null |
| released_at | timestamp | Voluntary release timestamp | nullable |
| created_at | timestamp | Record creation | not null |
| updated_at | timestamp | Last mutation | not null |

---

## 4. Value Objects

### 4.1 TaskId

| Field | Type | Validation Rule |
|---|---|---|
| value | UUID (string) | Must be a valid RFC 4122 v4 UUID; not null; immutable after creation |

---

### 4.2 AgentId

| Field | Type | Validation Rule |
|---|---|---|
| value | UUID (string) | Must be a valid RFC 4122 v4 UUID; not null; immutable after creation |

---

### 4.3 WorkspaceId

| Field | Type | Validation Rule |
|---|---|---|
| value | UUID (string) | Must be a valid RFC 4122 v4 UUID; not null; immutable after creation |

---

### 4.4 ResourceSpec

| Field | Type | Validation Rule |
|---|---|---|
| cpu_cores | decimal | Positive; minimum 0.25; maximum 256; step 0.25 |
| memory_mb | integer | Positive; minimum 512; maximum 524288 (512 GB); must be a multiple of 256 |
| disk_gb | decimal | Positive; minimum 10; maximum 65536; step 1 |

Validation: `cpu_cores`, `memory_mb`, and `disk_gb` must all be present together; partial specs are rejected. The object is immutable once the Workspace reaches Active state.

---

### 4.5 SemVer

| Field | Type | Validation Rule |
|---|---|---|
| major | integer | Non-negative integer |
| minor | integer | Non-negative integer |
| patch | integer | Non-negative integer |
| pre_release | string | Optional; alphanumeric and hyphens only; e.g. `alpha.1` |
| build_metadata | string | Optional; alphanumeric and hyphens only; e.g. `20260722` |

Validation: Serialises to and deserialises from the canonical format `MAJOR.MINOR.PATCH[-pre_release][+build_metadata]`. Comparison ignores build_metadata per SemVer specification. Versions within a company must be monotonically increasing per release stream.

---

### 4.6 ArtifactChecksum

| Field | Type | Validation Rule |
|---|---|---|
| algorithm | enum | Must be one of: sha256, sha512 |
| hex_digest | string | Must be 64 characters (sha256) or 128 characters (sha512); lowercase hexadecimal only |

Validation: Algorithm and digest must be consistent in length. Digest must not be all-zero (indicative of a computation failure). The object is produced at write time and verified at read time before any release promotion.

---

### 4.7 HeartbeatSignal

| Field | Type | Validation Rule |
|---|---|---|
| worker_id | UUID | Must match the authenticated worker identity; not null |
| state | enum | Must be a valid Worker state; not null |
| cpu_utilisation_pct | decimal | 0.00 – 100.00 inclusive |
| memory_utilisation_pct | decimal | 0.00 – 100.00 inclusive |
| active_session_count | integer | Non-negative; must not exceed `concurrent_session_limit` |
| emitted_at | timestamp | Must not be in the future; must not be older than 5 × `heartbeat_interval_seconds` |

Validation: All fields are required. A signal with `emitted_at` older than the tolerated window is accepted but flagged as late (`is_late = true`). The sequence_number on the stored `WorkerHeartbeat` must be strictly greater than the previous record for the same worker.

---

### 4.8 RetryPolicy

| Field | Type | Validation Rule |
|---|---|---|
| max_attempts | integer | 1 – 10 inclusive; not null |
| backoff_strategy | enum | fixed\|linear\|exponential; not null |
| initial_delay_seconds | integer | 1 – 3600; not null |
| max_delay_seconds | integer | Must be >= `initial_delay_seconds`; maximum 86400 |
| jitter | boolean | Whether to apply random jitter to delay calculation; not null; default false |

Validation: `exponential` backoff with `max_delay_seconds` set below `initial_delay_seconds` is rejected. A `max_attempts` of 1 is valid and means no retries. The policy is snapshotted onto the `ExecutionSession` at creation time and is immutable thereafter.

---

## 5. Domain Events Published by this Bounded Context

| Event Name | Trigger Entity | Key Payload Fields | Subscribers |
|---|---|---|---|
| TaskCreated | EngineeringTask | task_id, company_id, title, state, priority, created_at | ExecutionQueue dispatcher, Audit service |
| TaskStateChanged | EngineeringTask | task_id, company_id, previous_state, new_state, actor_id, changed_at | ExecutionQueue dispatcher, Notification service, Audit service |
| TaskAssigned | EngineeringTask | task_id, company_id, worker_id, assigned_at | Worker aggregate, Notification service |
| TaskCompleted | EngineeringTask | task_id, company_id, worker_id, actual_duration_minutes, completed_at | Release aggregate, Audit service, Dashboard KPI service |
| TaskFailed | EngineeringTask | task_id, company_id, worker_id, failure_reason, retry_count, failed_at | Retry scheduler, Notification service, Audit service |
| TaskLockAcquired | TaskLock | lock_id, task_id, worker_id, acquired_at, expires_at | Audit service |
| TaskLockReleased | TaskLock | lock_id, task_id, worker_id, released_at | Audit service |
| TaskDependencySatisfied | TaskDependency | dependency_id, task_id, depends_on_task_id, satisfied_at | Task state machine (Queued eligibility check) |
| WorkerRegistered | EngineeringWorker | worker_id, company_id, agent_id, capabilities, registered_at | ExecutionQueue dispatcher |
| WorkerStateChanged | EngineeringWorker | worker_id, company_id, previous_state, new_state, changed_at | Scheduler, Notification service |
| WorkerHeartbeatReceived | WorkerHeartbeat | worker_id, company_id, state, sequence_number, received_at, is_late | Health monitor |
| WorkerOffline | EngineeringWorker | worker_id, company_id, last_heartbeat_at, offline_at | Task reassignment service, Notification service |
| WorkerTerminated | EngineeringWorker | worker_id, company_id, terminated_at | Audit service, Session cleanup service |
| ExecutionSessionStarted | ExecutionSession | session_id, task_id, worker_id, company_id, started_at | Audit service, Dashboard KPI service |
| ExecutionSessionCompleted | ExecutionSession | session_id, task_id, worker_id, exit_code, ended_at | Task aggregate (Completed transition trigger) |
| ExecutionSessionFailed | ExecutionSession | session_id, task_id, worker_id, exit_code, failure_reason, retry_count | Retry scheduler, Notification service |
| WorkspaceProvisioned | Workspace | workspace_id, company_id, resource_spec, provisioned_at | Task scheduler |
| WorkspaceProvisioningFailed | Workspace | workspace_id, company_id, failure_reason, failed_at | Notification service, Audit service |
| WorkspaceArchived | Workspace | workspace_id, company_id, archived_at | Resource reclamation service |
| ReleaseCandidateCreated | ReleaseCandidate | release_id, company_id, version, authored_by, created_at | Notification service, Audit service |
| ReleaseCandidateApproved | ReleaseCandidate | release_id, company_id, version, approved_by, approved_at | Pipeline trigger service |
| ReleaseCandidateReleased | ReleaseCandidate | release_id, company_id, version, released_at | Deployment service, Audit service, Dashboard KPI service |
| ReleaseCandidateRolledBack | ReleaseCandidate | release_id, company_id, version, rollback_reason, rolled_back_at | Notification service, Audit service |
| PipelineRunStarted | PipelineRun | run_id, release_id, company_id, provider, external_run_id, started_at | Audit service |
| PipelineRunSucceeded | PipelineRun | run_id, release_id, company_id, finished_at | Release aggregate (Staged → Released gate) |
| PipelineRunFailed | PipelineRun | run_id, release_id, company_id, failure_reason, finished_at | Release aggregate (rollback trigger), Notification service |
| AgentRegistered | EngineeringAgent | agent_id, company_id, name, capability_manifest, registered_at | Audit service |
| AgentJwtRotated | EngineeringAgent | agent_id, company_id, new_expires_at, rotated_at | Audit service |

---

## 6. Relationships Summary

| Entity | Relationship | Related Entity | Cardinality | Notes |
|---|---|---|---|---|
| EngineeringTask | belongs to | EngineeringWorker | Many-to-one (nullable) | Null when unassigned; set on Assigned transition |
| EngineeringTask | belongs to | Workspace | Many-to-one (nullable) | Null until workspace is provisioned for the task |
| EngineeringTask | belongs to | ExecutionQueue | Many-to-one | Task enqueued via queue; queue_id stored on task |
| EngineeringTask | has many | TaskDependency | One-to-many | Both as dependent and as prerequisite |
| EngineeringTask | has many | TaskComment | One-to-many | Ordered by created_at |
| EngineeringTask | has many | TaskAttachment | One-to-many | Soft-deleted on task archive |
| EngineeringTask | has many | TaskArtifact | One-to-many | One per session output |
| EngineeringTask | has one | TaskLock | One-to-one (nullable) | Unique active lock constraint enforced at DB level |
| EngineeringTask | has many | ExecutionLog | One-to-many (via session) | Denormalised task_id on log for fast queries |
| EngineeringAgent | has many | EngineeringWorker | One-to-many | Agent spawns and manages workers |
| EngineeringWorker | belongs to | EngineeringAgent | Many-to-one | Worker is terminated when agent is terminated |
| EngineeringWorker | has many | WorkerCapability | One-to-many | Capabilities drive task matching |
| EngineeringWorker | has one | WorkerResource | One-to-one | Updated on each heartbeat |
| EngineeringWorker | has many | WorkerHeartbeat | One-to-many | Append-only; pruned by retention policy |
| EngineeringWorker | has many | ExecutionSession | One-to-many | One Running session per worker unless concurrent capable |
| ExecutionSession | belongs to | EngineeringTask | Many-to-one | Multiple sessions if retried |
| ExecutionSession | has many | ExecutionLog | One-to-many | All session stdout/stderr captured here |
| ExecutionSession | has many | TaskArtifact | One-to-many | Artifacts produced during session |
| Workspace | has one | WorkspaceLock | One-to-one (nullable) | One active lock at a time; enforced by aggregate |
| ReleaseCandidate | has many | ReleaseBundle | One-to-many | At least one bundle required before Approved |
| ReleaseCandidate | has many | PipelineRun | One-to-many | Each promotion stage may trigger a new run |
| PipelineRun | has many | PipelineArtifact | One-to-many | Stored per run; linked into ReleaseBundle |
| ReleaseBundle | references many | PipelineArtifact | Many-to-many (via jsonb) | Artifact UUIDs stored in bundle.artifact_ids |
| TaskDependency | references | EngineeringTask (upstream) | Many-to-one | depends_on_task_id must be in same company |
| WorkerHeartbeat | belongs to | EngineeringWorker | Many-to-one | Sequence must be monotonically increasing |
| WorkerCapability | belongs to | EngineeringWorker | Many-to-one | Deactivated (not deleted) when capability removed |

---

## 7. Lifecycle Summary

| Entity | Created By | Deleted By | Soft Delete | Retention Period |
|---|---|---|---|---|
| EngineeringTask | Human operator or EngineeringAgent via API | System on Archived transition | Yes | 365 days after Archived |
| EngineeringAgent | Human operator via admin UI | Human operator; system on decommission | Yes | 90 days after Terminated |
| EngineeringWorker | EngineeringAgent on spawn | System when agent is terminated; manual deregister | Yes | 90 days after Terminated |
| ExecutionSession | System when task transitions to Accepted | Cascades with task archival | Yes | 180 days after Completed/Failed/Aborted |
| ExecutionQueue | Platform administrator | Platform administrator | Yes | Permanent (no auto-expiry) |
| Workspace | System on task assignment requiring provisioning | System on Archived transition | Yes | 30 days after Archived |
| WorkspaceLock | System when worker acquires workspace | Not deleted; released_at is set | No | Permanent (audit record) |
| ReleaseCandidate | Human operator or EngineeringAgent | Human operator (Draft only); system on RolledBack | Yes | 730 days after Released/RolledBack |
| ReleaseBundle | System or operator during candidate assembly | Cascades with candidate hard delete | No | Inherits from ReleaseCandidate |
| TaskDependency | Task author at creation or edit | Task author before Queued; system on task cancel | No | Permanent (audit record) |
| TaskComment | Human operator or EngineeringAgent | Author (soft); system on task Archived cascade | Yes | Inherits from task retention |
| TaskAttachment | Human operator | Author before Running; system on task Archived | Yes | Inherits from task retention |
| ExecutionLog | System during session execution | Not deletable; pruned by retention job | No | 90 days after session terminal state |
| PipelineRun | System on release promotion trigger | Not deletable; cascades with candidate | No | Inherits from ReleaseCandidate |
| PipelineArtifact | System at pipeline run completion | Retention job after expires_at | No | Configurable; default 90 days |
| WorkerCapability | System at worker registration; operator updates | Deactivated (is_active = false); not hard deleted | No | Permanent |
| WorkerResource | System on first heartbeat | Overwritten on each heartbeat (upsert) | No | Single live record per worker |
| WorkerHeartbeat | System on each heartbeat receipt | Retention job | No | 30 days |
| TaskArtifact | System at session completion | Retention job after expires_at | No | Configurable; default 180 days |
| TaskLock | System on worker acceptance | released_at stamped on voluntary release; TTL expiry | No | Permanent (audit record) |

---

## 8. Tenant Isolation Strategy

### 8.1 Principle

Every entity in the Engineering Cloud bounded context carries a `company_id` column that references `companies.id`. This column is non-nullable, carries a database-level foreign key constraint, and is indexed on every table. No query against any Engineering Cloud table may omit the `company_id` predicate. Data for one company is never visible to, writable by, or calculable from the context of another company under any code path.

### 8.2 Scoping at the Aggregate Boundary

All aggregate root repositories receive the authenticated company's `company_id` as a constructor dependency. Every `find`, `findAll`, `save`, and `delete` operation prepends `WHERE company_id = :company_id` as the first filter clause. Laravel Eloquent model scopes enforce this via a global scope registered in each model's `boot` method, ensuring that even ad-hoc query builder calls within the bounded context are protected.

Cross-aggregate references (e.g. `EngineeringTask.workspace_id`) must always be resolved through a repository call that itself applies the `company_id` scope. Direct joins across aggregate roots without a shared `company_id` predicate on both sides are prohibited; the codebase enforces this via a custom architecture fitness function that scans for unscoped joins in CI.

### 8.3 Agent and Worker Authentication

When an `EngineeringAgent` authenticates via JWT, the token payload carries `company_id` and `agent_id`. The middleware layer extracts and validates both claims and binds them to the request context. All downstream repository calls in the request lifecycle inherit this bound `company_id`. An agent cannot present a `company_id` different from the one its API Key was issued under; the key hash is validated against the company scope before a JWT is minted.

Workers inherit their `company_id` from their owning agent. A worker may not be created with a `company_id` that differs from `agent.company_id`; this is enforced as an invariant in the Worker aggregate factory.

### 8.4 Queue Isolation

`ExecutionQueue` records are scoped to `company_id`. The queue dispatcher queries only within the authenticated company's queues. There is no global queue visible across tenants. Priority weights, pause states, and concurrency caps are all per-company configurations.

### 8.5 Event Bus Isolation

All domain events published by this bounded context include `company_id` in their payload. The `EnterpriseEventBus` subscriber dispatching mechanism routes events only to listeners registered under the same `company_id`. Cross-company event fan-out is architecturally impossible because subscribers are resolved at subscription time with a company scope predicate.

### 8.6 Workspace and Session Isolation

Workspace provisioning requests carry the authenticated `company_id` into the infrastructure provisioning layer. The provisioning adapter tags all infrastructure resources with the company identifier. Two companies can never share a Workspace record, and infrastructure-level tagging provides an additional enforcement layer independent of the application database.

`ExecutionSession` records join to both `EngineeringTask` and `EngineeringWorker`; both parent records must share the same `company_id` as the session. The session factory validates this three-way `company_id` match before persisting. Any mismatch raises an `IsolationViolationException` and is recorded in the security audit log.

### 8.7 Artifact and Log Isolation

`PipelineArtifact`, `TaskArtifact`, and `ExecutionLog` records are scoped to `company_id` in the database and in the storage layer. Storage paths are prefixed with a company-specific path segment (`/{company_id}/engineering/...`). Pre-signed URL generation for artifact download includes a `company_id` claim verified by the storage layer, preventing URL sharing across tenants even if a URL were leaked.

### 8.8 Query Pattern Requirements

- Every Eloquent model must declare a `CompanyScopedGlobalScope` applied in `boot()`.
- All raw `DB::` queries within this bounded context must include `AND company_id = ?` as the first where-clause parameter after any primary key lookup.
- Repository interfaces expose no method that accepts a `company_id`-free signature for entity retrieval.
- Scheduled jobs (heartbeat expiry, artifact retention, log pruning) must operate in company-chunked batches using `EngineeringWorker::query()->distinct('company_id')` to enumerate affected tenants and process each independently.
- Admin-only endpoints accessible to platform staff must explicitly declare an `AdminScope` bypass and must log the access event to the cross-company audit trail; they are never available via the standard tenant-scoped API surface.
