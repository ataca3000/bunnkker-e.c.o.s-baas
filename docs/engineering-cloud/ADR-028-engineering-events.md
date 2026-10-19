# ADR-028 — Engineering Events

**Status:** Approved
**Date:** 2026-07-22
**Author:** Engineering OS
**Supersedes:** None
**Related:** ADR-011 (Event-Driven Architecture), ADR-024 (Single Source of Truth), TASK-ENG-007 (Enterprise Pipeline Platform)

---

## 1. Context

Engineering Cloud is event-driven. Every significant state change in the system — task lifecycle, worker connectivity, workspace provisioning, release progression, pipeline execution — is expressed as an immutable, timestamped event. This document is the authoritative event catalog for the Engineering Cloud domain.

All services, listeners, and integrations must reference this document when publishing or consuming events. Any event not listed here is not an official Engineering Cloud event and must not be treated as one.

---

## 2. Event Design Principles

- **Immutability.** Events are facts about the past. They are never modified after publication.
- **Past-tense naming.** All event types use PascalCase past tense (e.g., `TaskCreated`, not `CreateTask`).
- **Universal envelope.** Every event carries a standard envelope (see Section 3) regardless of its category.
- **Post-commit publication.** Events are published only after the database transaction that produced the state change has committed successfully. No speculative events.
- **Idempotent consumers.** All consumers must handle duplicate delivery gracefully. Consumers use `event_id` for deduplication.
- **Schema versioning.** `schema_version` increments when the payload changes in a backward-incompatible way. Consumers must handle the current and the immediately preceding version.
- **Correlation propagation.** `correlation_id` is set by the originating request and forwarded through all downstream events triggered by the same operation. Never generate a new `correlation_id` mid-chain.
- **Actor attribution.** Every event records who or what caused it: a human user, an automated agent, or the system itself.

---

## 3. Event Envelope

Every event — regardless of category or delivery channel — carries the following top-level fields before its payload.

| Field | Type | Description | Required |
|---|---|---|---|
| `event_id` | UUID | Globally unique identifier for this event instance | Yes |
| `event_type` | string | Canonical event name (e.g., `TaskCreated`) | Yes |
| `schema_version` | integer | Payload schema version; starts at 1 | Yes |
| `occurred_at` | ISO 8601 | UTC timestamp of when the fact occurred | Yes |
| `correlation_id` | UUID | Traces a chain of causally related events | Yes |
| `company_id` | UUID | Tenant identifier; all data is scoped to this company | Yes |
| `actor_id` | UUID | ID of the agent, user, or system that caused the event | Yes |
| `actor_type` | enum | `agent`, `user`, or `system` | Yes |
| `payload` | object | Event-specific fields (defined per event below) | Yes |

---

## 4. Complete Event Catalog

---

### 4.1 Task Events

---

#### **TaskCreated**

- **Producer:** TaskManagementService when a new EngineeringTask is persisted
- **Consumers:** ExecutionQueue (eligibility check), NotificationService (mentions), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the new EngineeringTask | Yes |
| `title` | string | Human-readable task title | Yes |
| `description` | string | Full task description | No |
| `task_type` | string | Classification (feature, bug, migration, release, etc.) | Yes |
| `priority` | string | `critical`, `high`, `medium`, `low` | Yes |
| `status` | string | Always `Draft` at creation | Yes |
| `assigned_worker_id` | UUID | Pre-assigned EngineeringWorker, if any | No |
| `workspace_id` | UUID | Target Workspace, if specified at creation | No |
| `estimated_duration_seconds` | integer | Estimated execution time | No |
| `tags` | string[] | Searchable labels | No |
| `dependency_task_ids` | UUID[] | Tasks that must complete before this one starts | No |

**Notes:** If `dependency_task_ids` is non-empty, the task remains in `Draft` until all dependencies reach `Completed`. The ExecutionQueue listener evaluates this on every `TaskDependencyResolved` event.

---

#### **TaskUpdated**

- **Producer:** TaskManagementService on any field mutation outside of status transitions
- **Consumers:** AuditTrailService, NotificationService (if assignment changes)
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the modified EngineeringTask | Yes |
| `changed_fields` | string[] | Names of fields that were modified | Yes |
| `previous_values` | object | Key-value map of old values for changed fields | Yes |
| `new_values` | object | Key-value map of new values for changed fields | Yes |
| `update_reason` | string | Human-supplied reason for the change | No |

**Notes:** Status transitions are not published through `TaskUpdated`; they each have a dedicated event. Do not publish this event when only `updated_at` changes.

---

#### **TaskQueued**

- **Producer:** ExecutionQueue when a task is promoted from `Draft` to `Queued`
- **Consumers:** WorkerDispatchService (worker matching), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `queue_position` | integer | Position in the execution queue at time of queuing | Yes |
| `priority` | string | Task priority used for queue ordering | Yes |
| `required_capabilities` | string[] | Capabilities an EngineeringWorker must have to accept this task | No |
| `queued_at` | ISO 8601 | Timestamp when task entered the queue | Yes |

**Notes:** Queue position is a snapshot value and does not update as other tasks are inserted ahead or behind.

---

#### **TaskAssigned**

- **Producer:** WorkerDispatchService when a task is matched and sent to an EngineeringWorker
- **Consumers:** EngineeringWorker (via WebSocket broadcast), AuditTrailService, NotificationService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`) + Broadcast channel `workers.{worker_id}`
- **Retry Strategy:** max_attempts: 5, backoff: exponential 10s/30s/60s/120s/300s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `worker_id` | UUID | Identifier of the assigned EngineeringWorker | Yes |
| `worker_name` | string | Display name of the worker | Yes |
| `workspace_id` | UUID | Workspace the worker will use | No |
| `assignment_strategy` | string | Strategy used: `capability_match`, `round_robin`, `manual` | Yes |
| `accept_deadline_at` | ISO 8601 | Worker must accept by this time or the task is re-queued | Yes |

**Notes:** If the worker does not emit `TaskAccepted` before `accept_deadline_at`, the WorkerDispatchService re-queues the task and publishes `TaskRejected` on the worker's behalf.

---

#### **TaskAccepted**

- **Producer:** EngineeringWorker via the Worker API after receiving an assignment
- **Consumers:** TaskManagementService (status update), WorkspaceService (provision if needed), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `worker_id` | UUID | Worker accepting the task | Yes |
| `accepted_at` | ISO 8601 | Timestamp of acceptance | Yes |
| `estimated_start_at` | ISO 8601 | Worker's estimated start time | No |

---

#### **TaskRejected**

- **Producer:** EngineeringWorker (explicit rejection) or WorkerDispatchService (acceptance timeout)
- **Consumers:** ExecutionQueue (re-queue logic), AuditTrailService, AlertingService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `worker_id` | UUID | Worker that rejected or timed out | Yes |
| `rejection_reason` | string | `worker_busy`, `capability_mismatch`, `acceptance_timeout`, `worker_error`, `manual` | Yes |
| `rejection_detail` | string | Free-text explanation | No |
| `requeue_immediately` | boolean | Whether the task should be re-queued without delay | Yes |

**Notes:** `requeue_immediately` is `false` for `worker_error` rejections to prevent tight retry loops. The ExecutionQueue applies a 60-second cooldown in that case.

---

#### **TaskStarted**

- **Producer:** EngineeringWorker via the Worker API when execution begins
- **Consumers:** TaskManagementService (status → Running), ExecutionSessionService (open session), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`) + Broadcast channel `company.{company_id}.tasks`
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `worker_id` | UUID | Worker executing the task | Yes |
| `session_id` | UUID | Identifier of the new ExecutionSession | Yes |
| `workspace_id` | UUID | Workspace where execution occurs | No |
| `started_at` | ISO 8601 | Actual execution start time | Yes |

---

#### **TaskProgressUpdated**

- **Producer:** EngineeringWorker during execution at regular intervals or on milestone completion
- **Consumers:** AuditTrailService, DashboardBroadcastService (real-time UI)
- **Delivery:** Broadcast channel `company.{company_id}.tasks` + Redis queue (`engineering.progress`) — low priority
- **Retry Strategy:** max_attempts: 2, backoff: linear 5s/5s, dead-letter: none (progress events are non-critical)

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `session_id` | UUID | Active ExecutionSession | Yes |
| `worker_id` | UUID | Reporting worker | Yes |
| `progress_percent` | integer | Completion percentage 0–100 | Yes |
| `current_step` | string | Human-readable description of the current step | No |
| `steps_completed` | integer | Number of discrete steps finished | No |
| `steps_total` | integer | Total discrete steps expected | No |
| `log_excerpt` | string | Last N lines of execution log (truncated at 2 KB) | No |
| `reported_at` | ISO 8601 | Timestamp of this progress snapshot | Yes |

**Notes:** Workers should emit this event no more than once every 5 seconds to avoid flooding the broadcast channel. The UI throttles rendering to once per second regardless.

---

#### **TaskPaused**

- **Producer:** EngineeringWorker (self-pause) or TaskManagementService (operator pause)
- **Consumers:** ExecutionSessionService (suspend session), WorkspaceService (release lock if idle), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`) + Broadcast channel `company.{company_id}.tasks`
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `session_id` | UUID | Active ExecutionSession being suspended | Yes |
| `worker_id` | UUID | Worker that was running the task | Yes |
| `paused_by` | enum | `worker`, `operator`, `system` | Yes |
| `pause_reason` | string | Human-readable reason | No |
| `resume_after_at` | ISO 8601 | Optional scheduled resume time | No |
| `checkpoint_data` | object | Serialized worker state for resumption | No |

---

#### **TaskResumed**

- **Producer:** TaskManagementService (operator resume) or EngineeringWorker (self-resume after scheduled pause)
- **Consumers:** WorkerDispatchService (if worker changed), ExecutionSessionService (resume session), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`) + Broadcast channel `workers.{worker_id}`
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `session_id` | UUID | ExecutionSession being resumed | Yes |
| `worker_id` | UUID | Worker resuming the task | Yes |
| `resumed_by` | enum | `worker`, `operator`, `system` | Yes |
| `resumed_at` | ISO 8601 | Timestamp of resumption | Yes |
| `checkpoint_data` | object | Checkpoint data passed back to the worker | No |

---

#### **TaskCompleted**

- **Producer:** EngineeringWorker on successful task completion
- **Consumers:** TaskManagementService (status → Completed), TaskDependencyService (unblock dependents), ReleaseCandidateService (if tagged for release), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`) + Broadcast channel `company.{company_id}.tasks`
- **Retry Strategy:** max_attempts: 5, backoff: exponential 10s/30s/60s/120s/300s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `session_id` | UUID | ExecutionSession that ran the task | Yes |
| `worker_id` | UUID | Worker that completed the task | Yes |
| `completed_at` | ISO 8601 | Timestamp of completion | Yes |
| `duration_seconds` | integer | Total wall-clock execution time | Yes |
| `output_summary` | string | Brief summary of results (max 1 KB) | No |
| `artifact_ids` | UUID[] | Identifiers of TaskArtifacts produced | No |
| `metrics` | object | Arbitrary key-value metrics reported by the worker | No |

**Notes:** Upon receipt, TaskDependencyService evaluates all tasks that listed this `task_id` as a dependency and publishes `TaskDependencyResolved` for each one now fully unblocked.

---

#### **TaskFailed**

- **Producer:** EngineeringWorker on unrecoverable error, or TaskManagementService on timeout
- **Consumers:** TaskManagementService (status → Failed), AlertingService, AuditTrailService, PostMortemService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`) + Broadcast channel `company.{company_id}.tasks`
- **Retry Strategy:** max_attempts: 5, backoff: exponential 10s/30s/60s/120s/300s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `session_id` | UUID | ExecutionSession that was running | Yes |
| `worker_id` | UUID | Worker that reported the failure | Yes |
| `failed_at` | ISO 8601 | Timestamp of failure | Yes |
| `failure_code` | string | Machine-readable error code | Yes |
| `failure_message` | string | Human-readable error description | Yes |
| `stack_trace` | string | Full stack trace if available (max 8 KB) | No |
| `partial_artifact_ids` | UUID[] | Any partial artifacts produced before failure | No |
| `retryable` | boolean | Whether the task can be retried automatically | Yes |
| `retry_count` | integer | Number of times this task has already failed and been retried | Yes |

**Notes:** If `retryable` is `true` and `retry_count` is below the task's configured `max_retries`, the ExecutionQueue re-queues the task automatically with exponential backoff.

---

#### **TaskCancelled**

- **Producer:** TaskManagementService on operator or system cancellation
- **Consumers:** EngineeringWorker (abort signal via WebSocket), ExecutionSessionService (abort session), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`) + Broadcast channel `workers.{worker_id}`
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `session_id` | UUID | Active session to abort, if any | No |
| `worker_id` | UUID | Worker to notify, if assigned | No |
| `cancelled_by` | enum | `user`, `system`, `operator` | Yes |
| `cancellation_reason` | string | Human-readable reason | No |
| `immediate` | boolean | Whether the worker should abort mid-step or finish current step | Yes |

---

#### **TaskReleased**

- **Producer:** ReleaseCandidateService when a task is bundled into an approved ReleaseCandidate
- **Consumers:** TaskManagementService (status → Released), AuditTrailService, ChangelogService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.releases`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.releases`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `release_candidate_id` | UUID | ReleaseCandidate this task is included in | Yes |
| `release_bundle_id` | UUID | ReleaseBundle containing this task | Yes |
| `released_at` | ISO 8601 | Timestamp of release | Yes |
| `release_version` | string | Semantic version of the release | Yes |

---

#### **TaskArchived**

- **Producer:** TaskManagementService on operator archive action or automated retention policy
- **Consumers:** AuditTrailService, SearchIndexService (remove from active index)
- **Delivery:** Redis queue (`engineering.tasks`) — low priority, async only
- **Retry Strategy:** max_attempts: 3, backoff: exponential 30s/90s/270s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `archived_at` | ISO 8601 | Timestamp of archival | Yes |
| `archived_by` | enum | `user`, `system` | Yes |
| `retention_policy` | string | Policy that triggered archival, if automated | No |

---

#### **TaskDependencyResolved**

- **Producer:** TaskDependencyService after evaluating a completed task's dependents
- **Consumers:** ExecutionQueue (promote newly unblocked tasks to `Queued`), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.tasks`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.tasks`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `unblocked_task_id` | UUID | EngineeringTask that is now fully unblocked | Yes |
| `resolved_dependency_task_id` | UUID | The task whose completion resolved this dependency | Yes |
| `remaining_dependency_count` | integer | Number of unresolved dependencies remaining (0 = fully unblocked) | Yes |
| `auto_queue` | boolean | Whether the task was automatically promoted to `Queued` | Yes |

**Notes:** Published once per unblocked task per triggering completion. If a task has five dependencies and two are completed in the same batch, five events are published — one per resolution check, not one per batch.

---

#### **TaskLockAcquired**

- **Producer:** TaskLockService when a worker or operator acquires a TaskLock
- **Consumers:** AuditTrailService, ConflictDetectionService
- **Delivery:** Synchronous in-process dispatch
- **Retry Strategy:** Not retried; lock acquisition is transactional

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the locked EngineeringTask | Yes |
| `lock_id` | UUID | Identifier of the TaskLock record | Yes |
| `locked_by_id` | UUID | Worker or user that holds the lock | Yes |
| `locked_by_type` | enum | `agent`, `user` | Yes |
| `lock_scope` | string | `execution`, `edit`, `release` | Yes |
| `expires_at` | ISO 8601 | Lock expiry time | Yes |
| `acquired_at` | ISO 8601 | Timestamp of acquisition | Yes |

---

#### **TaskLockReleased**

- **Producer:** TaskLockService on explicit release or expiry
- **Consumers:** AuditTrailService, ConflictDetectionService, WorkerDispatchService (if lock release unblocks assignment)
- **Delivery:** Synchronous in-process dispatch
- **Retry Strategy:** Not retried; lock release is transactional

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `task_id` | UUID | Identifier of the EngineeringTask | Yes |
| `lock_id` | UUID | Identifier of the released TaskLock | Yes |
| `released_by_id` | UUID | Actor that released the lock | Yes |
| `released_by_type` | enum | `agent`, `user`, `system` | Yes |
| `release_reason` | string | `completed`, `cancelled`, `expired`, `forced` | Yes |
| `released_at` | ISO 8601 | Timestamp of release | Yes |

---

### 4.2 Worker Events

---

#### **WorkerRegistered**

- **Producer:** WorkerRegistrationService when a new EngineeringWorker completes registration
- **Consumers:** WorkerDispatchService (add to pool), CapabilityRegistryService, AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.workers`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.workers`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `worker_id` | UUID | Identifier of the new EngineeringWorker | Yes |
| `worker_name` | string | Human-readable worker name | Yes |
| `worker_type` | string | `automated_agent`, `human_operator`, `pipeline_runner` | Yes |
| `capabilities` | object[] | Array of WorkerCapability objects (name, version, config) | Yes |
| `resource_limits` | object | WorkerResource declaration (cpu_cores, memory_mb, disk_gb) | Yes |
| `api_key_id` | UUID | Identifier of the API key used for registration | Yes |
| `registered_at` | ISO 8601 | Timestamp of successful registration | Yes |

**Notes:** Workers register with an API key. After registration, the worker transitions to `Idle` and subsequent communication uses JWT tokens.

---

#### **WorkerHeartbeatReceived**

- **Producer:** WorkerHealthService on receipt of a heartbeat ping from a worker
- **Consumers:** WorkerHealthMonitor (reset missed-heartbeat counter), AuditTrailService (sampled — 1 in 100)
- **Delivery:** Synchronous in-process only — not queued
- **Retry Strategy:** Not applicable

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `worker_id` | UUID | Identifier of the EngineeringWorker | Yes |
| `heartbeat_id` | UUID | Identifier of this specific WorkerHeartbeat | Yes |
| `status` | string | Worker's self-reported state at heartbeat time | Yes |
| `current_task_id` | UUID | Task currently running, if any | No |
| `resource_snapshot` | object | Current cpu_percent, memory_used_mb, disk_used_gb | No |
| `received_at` | ISO 8601 | Timestamp of receipt | Yes |

**Notes:** Heartbeat events are high-frequency (every 30 seconds per worker). They are processed in-process only and not written to the event log except at a 1-in-100 sampling rate to control storage volume.

---

#### **WorkerHeartbeatMissed**

- **Producer:** WorkerHealthMonitor when a worker fails to heartbeat within the configured window (default: 90 seconds)
- **Consumers:** AlertingService, WorkerDispatchService (suspend assignments), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.workers`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.workers`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `worker_id` | UUID | Identifier of the EngineeringWorker | Yes |
| `last_heartbeat_at` | ISO 8601 | Timestamp of the last successful heartbeat | Yes |
| `missed_count` | integer | Consecutive missed heartbeats | Yes |
| `grace_period_ends_at` | ISO 8601 | Time after which the worker is declared `Offline` | Yes |
| `current_task_id` | UUID | Task that was running when heartbeats stopped | No |

**Notes:** A single missed heartbeat triggers this event. After three consecutive misses, `WorkerDisconnected` is published and the worker transitions to `Offline`.

---

#### **WorkerBecameIdle**

- **Producer:** WorkerDispatchService when a worker transitions from `Busy` to `Idle`
- **Consumers:** ExecutionQueue (trigger next assignment attempt), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.workers`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.workers`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `worker_id` | UUID | Identifier of the EngineeringWorker | Yes |
| `previous_task_id` | UUID | Task that just finished | No |
| `idle_since` | ISO 8601 | Timestamp of transition to Idle | Yes |
| `available_capabilities` | string[] | Capability names the worker can accept | Yes |

---

#### **WorkerBecameBusy**

- **Producer:** WorkerDispatchService when a worker transitions from `Idle` to `Busy`
- **Consumers:** ExecutionQueue (remove from available pool), AuditTrailService
- **Delivery:** Synchronous in-process dispatch
- **Retry Strategy:** Not retried; state is transactional

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `worker_id` | UUID | Identifier of the EngineeringWorker | Yes |
| `assigned_task_id` | UUID | Task the worker is now executing | Yes |
| `busy_since` | ISO 8601 | Timestamp of transition to Busy | Yes |

---

#### **WorkerDraining**

- **Producer:** WorkerManagementService when an operator initiates graceful shutdown
- **Consumers:** WorkerDispatchService (stop new assignments), EngineeringWorker (via WebSocket), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Broadcast channel `workers.{worker_id}`
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.workers`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `worker_id` | UUID | Identifier of the EngineeringWorker | Yes |
| `drain_initiated_by` | UUID | Operator user ID | Yes |
| `drain_reason` | string | Human-readable reason | No |
| `current_task_id` | UUID | Task currently in progress, to be completed before shutdown | No |
| `drain_deadline_at` | ISO 8601 | Time by which draining must complete; tasks are forcibly cancelled after | Yes |

---

#### **WorkerDisconnected**

- **Producer:** WorkerHealthMonitor after three consecutive missed heartbeats
- **Consumers:** TaskManagementService (mark running tasks as Failed or re-queue), AlertingService, AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.workers`)
- **Retry Strategy:** max_attempts: 5, backoff: exponential 10s/30s/60s/120s/300s, dead-letter: `dlq.engineering.workers`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `worker_id` | UUID | Identifier of the disconnected EngineeringWorker | Yes |
| `disconnected_at` | ISO 8601 | Estimated time of disconnection | Yes |
| `last_known_task_id` | UUID | Task that was running at last known contact | No |
| `missed_heartbeat_count` | integer | Number of consecutive missed heartbeats | Yes |
| `recovery_action` | string | `requeue_task`, `fail_task`, `await_reconnect` | Yes |

**Notes:** `recovery_action` is determined by the task's `retryable` flag and the worker's historical reliability score.

---

#### **WorkerTerminated**

- **Producer:** WorkerManagementService on explicit termination or after failed reconnection window
- **Consumers:** WorkerDispatchService (remove from all pools permanently), CapabilityRegistryService (deregister capabilities), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.workers`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.workers`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `worker_id` | UUID | Identifier of the terminated EngineeringWorker | Yes |
| `terminated_at` | ISO 8601 | Timestamp of termination | Yes |
| `termination_reason` | string | `operator_request`, `heartbeat_failure`, `security_violation`, `capacity_reduction` | Yes |
| `terminated_by` | UUID | Operator ID, or null for system termination | No |
| `tasks_affected` | UUID[] | Task IDs that were interrupted | No |

---

#### **WorkerCapabilityUpdated**

- **Producer:** WorkerManagementService when a worker's capabilities change (version upgrade, new capability added, capability revoked)
- **Consumers:** CapabilityRegistryService, WorkerDispatchService (re-evaluate pending assignments), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.workers`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.workers`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `worker_id` | UUID | Identifier of the EngineeringWorker | Yes |
| `added_capabilities` | object[] | Newly added WorkerCapability objects | No |
| `removed_capabilities` | string[] | Capability names that were removed | No |
| `updated_capabilities` | object[] | Capabilities whose version or config changed | No |
| `effective_at` | ISO 8601 | When the new capability set takes effect | Yes |

---

### 4.3 Workspace Events

---

#### **WorkspaceProvisioned**

- **Producer:** WorkspaceService when a new Workspace is created and ready for use
- **Consumers:** WorkerDispatchService (notify assigned worker), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.workspaces`) + Broadcast channel `workers.{worker_id}`
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.workspaces`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `workspace_id` | UUID | Identifier of the provisioned Workspace | Yes |
| `workspace_name` | string | Human-readable workspace name | Yes |
| `workspace_type` | string | `ephemeral`, `persistent`, `shared` | Yes |
| `task_id` | UUID | Task this workspace was provisioned for | No |
| `worker_id` | UUID | Worker that will use this workspace | No |
| `storage_path` | string | Filesystem or object-storage path | Yes |
| `resource_allocation` | object | Allocated cpu_cores, memory_mb, disk_gb | Yes |
| `provisioned_at` | ISO 8601 | Timestamp of successful provisioning | Yes |
| `expires_at` | ISO 8601 | Workspace expiry time (for ephemeral type) | No |

---

#### **WorkspaceLockAcquired**

- **Producer:** WorkspaceLockService on successful lock acquisition
- **Consumers:** AuditTrailService, ConflictDetectionService
- **Delivery:** Synchronous in-process dispatch
- **Retry Strategy:** Not retried; lock acquisition is transactional

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `workspace_id` | UUID | Identifier of the locked Workspace | Yes |
| `lock_id` | UUID | Identifier of the WorkspaceLock record | Yes |
| `locked_by_id` | UUID | Worker or user holding the lock | Yes |
| `locked_by_type` | enum | `agent`, `user` | Yes |
| `lock_purpose` | string | `task_execution`, `maintenance`, `archival` | Yes |
| `expires_at` | ISO 8601 | Lock expiry time | Yes |
| `acquired_at` | ISO 8601 | Timestamp of acquisition | Yes |

---

#### **WorkspaceLockReleased**

- **Producer:** WorkspaceLockService on explicit release or expiry
- **Consumers:** AuditTrailService, WorkspaceService (evaluate archival if workspace is Idle)
- **Delivery:** Synchronous in-process dispatch
- **Retry Strategy:** Not retried; lock release is transactional

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `workspace_id` | UUID | Identifier of the Workspace | Yes |
| `lock_id` | UUID | Identifier of the released WorkspaceLock | Yes |
| `released_by_id` | UUID | Actor that released the lock | Yes |
| `released_by_type` | enum | `agent`, `user`, `system` | Yes |
| `release_reason` | string | `task_completed`, `task_failed`, `expired`, `forced` | Yes |
| `released_at` | ISO 8601 | Timestamp of release | Yes |

---

#### **WorkspaceArchived**

- **Producer:** WorkspaceService on operator archival or automated retention policy
- **Consumers:** StorageService (compress and move to cold storage), AuditTrailService
- **Delivery:** Redis queue (`engineering.workspaces`) — async, low priority
- **Retry Strategy:** max_attempts: 3, backoff: exponential 60s/180s/540s, dead-letter: `dlq.engineering.workspaces`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `workspace_id` | UUID | Identifier of the archived Workspace | Yes |
| `archived_at` | ISO 8601 | Timestamp of archival | Yes |
| `archived_by` | enum | `user`, `system` | Yes |
| `archive_path` | string | Cold-storage location of the archived data | Yes |
| `size_bytes` | integer | Total archived data size | No |
| `retention_policy` | string | Policy name that triggered archival | No |

---

#### **WorkspaceFailed**

- **Producer:** WorkspaceService on provisioning failure or critical runtime error
- **Consumers:** AlertingService, WorkerDispatchService (halt task if workspace is required), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.workspaces`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.workspaces`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `workspace_id` | UUID | Identifier of the failed Workspace | Yes |
| `failed_at` | ISO 8601 | Timestamp of failure | Yes |
| `failure_phase` | string | `provisioning`, `runtime`, `archival` | Yes |
| `failure_code` | string | Machine-readable error code | Yes |
| `failure_message` | string | Human-readable description | Yes |
| `affected_task_id` | UUID | Task using this workspace at time of failure | No |
| `affected_worker_id` | UUID | Worker using this workspace | No |
| `recoverable` | boolean | Whether reprovisioning is possible | Yes |

---

### 4.4 Release Events

---

#### **ReleaseCandidateCreated**

- **Producer:** ReleaseCandidateService when an operator initiates a new release
- **Consumers:** ReviewService (open review queue), AuditTrailService, ChangelogService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.releases`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.releases`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `release_candidate_id` | UUID | Identifier of the new ReleaseCandidate | Yes |
| `version` | string | Semantic version string (e.g., `2.14.0`) | Yes |
| `release_type` | string | `major`, `minor`, `patch`, `hotfix` | Yes |
| `included_task_ids` | UUID[] | EngineeringTask IDs bundled in this release | Yes |
| `pipeline_run_id` | UUID | PipelineRun that validated these tasks | No |
| `created_by` | UUID | Operator user ID | Yes |
| `created_at` | ISO 8601 | Timestamp of creation | Yes |
| `target_environment` | string | `staging`, `production` | Yes |
| `release_notes_summary` | string | Auto-generated summary from task titles | No |

---

#### **ReleaseCandidateApproved**

- **Producer:** ReviewService when all required approvers have signed off
- **Consumers:** ReleaseBundleService (trigger bundle preparation), AuditTrailService, NotificationService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.releases`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.releases`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `release_candidate_id` | UUID | Identifier of the approved ReleaseCandidate | Yes |
| `approved_by` | UUID[] | Ordered list of approver user IDs | Yes |
| `approved_at` | ISO 8601 | Timestamp of final approval | Yes |
| `approval_notes` | string | Aggregate reviewer notes | No |
| `conditions` | string[] | Conditions attached to approval, if any | No |

---

#### **ReleaseCandidateRejected**

- **Producer:** ReviewService when an approver rejects the release
- **Consumers:** ReleaseCandidateService (status → Draft for revision), AuditTrailService, NotificationService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.releases`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.releases`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `release_candidate_id` | UUID | Identifier of the rejected ReleaseCandidate | Yes |
| `rejected_by` | UUID | Reviewer user ID | Yes |
| `rejected_at` | ISO 8601 | Timestamp of rejection | Yes |
| `rejection_reason` | string | Human-readable reason | Yes |
| `blocking_findings` | string[] | Specific findings or issues that blocked approval | No |

---

#### **ReleaseBundlePrepared**

- **Producer:** ReleaseBundleService after packaging all artifacts into a deployable ReleaseBundle
- **Consumers:** AuditTrailService, StorageService (persist bundle), DeploymentService (await staging)
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.releases`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 30s/90s/270s, dead-letter: `dlq.engineering.releases`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `release_bundle_id` | UUID | Identifier of the new ReleaseBundle | Yes |
| `release_candidate_id` | UUID | Parent ReleaseCandidate | Yes |
| `version` | string | Semantic version string | Yes |
| `bundle_path` | string | Storage path of the packaged bundle | Yes |
| `bundle_size_bytes` | integer | Total bundle size | Yes |
| `artifact_ids` | UUID[] | PipelineArtifact IDs included in the bundle | Yes |
| `checksum_sha256` | string | Bundle integrity hash | Yes |
| `prepared_at` | ISO 8601 | Timestamp of bundle preparation | Yes |

---

#### **ReleasePublishedToReleaseManager**

- **Producer:** DeploymentService when the bundle is handed off to the Engineering AI Release Manager
- **Consumers:** ReleaseManagerService, AuditTrailService, NotificationService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.releases`)
- **Retry Strategy:** max_attempts: 5, backoff: exponential 10s/30s/60s/120s/300s, dead-letter: `dlq.engineering.releases`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `release_bundle_id` | UUID | Identifier of the ReleaseBundle being handed off | Yes |
| `release_candidate_id` | UUID | Associated ReleaseCandidate | Yes |
| `version` | string | Semantic version string | Yes |
| `target_environment` | string | Deployment target | Yes |
| `handoff_at` | ISO 8601 | Timestamp of handoff | Yes |
| `release_manager_run_id` | UUID | Identifier assigned by the Release Manager for tracking | Yes |
| `deployment_config` | object | Environment-specific deployment parameters | No |

---

#### **ReleaseCompleted**

- **Producer:** ReleaseManagerService after successful deployment and smoke test
- **Consumers:** TaskManagementService (mark tasks Released), ChangelogService (publish), AuditTrailService, NotificationService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.releases`) + Broadcast channel `company.{company_id}.releases`
- **Retry Strategy:** max_attempts: 5, backoff: exponential 10s/30s/60s/120s/300s, dead-letter: `dlq.engineering.releases`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `release_candidate_id` | UUID | Identifier of the completed ReleaseCandidate | Yes |
| `release_bundle_id` | UUID | Deployed ReleaseBundle | Yes |
| `version` | string | Semantic version string | Yes |
| `environment` | string | Environment that received the release | Yes |
| `completed_at` | ISO 8601 | Timestamp of successful deployment | Yes |
| `deployment_duration_seconds` | integer | Total time from handoff to completion | Yes |
| `smoke_test_results` | object | Summary of post-deployment validation results | No |

---

#### **ReleaseRolledBack**

- **Producer:** ReleaseManagerService or operator on rollback initiation
- **Consumers:** TaskManagementService (revert Released tasks to Completed), AlertingService, AuditTrailService, ChangelogService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.releases`) + Broadcast channel `company.{company_id}.releases`
- **Retry Strategy:** max_attempts: 5, backoff: exponential 10s/30s/60s/120s/300s, dead-letter: `dlq.engineering.releases`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `release_candidate_id` | UUID | Identifier of the rolled-back ReleaseCandidate | Yes |
| `release_bundle_id` | UUID | Bundle that was rolled back | Yes |
| `version` | string | Version that was rolled back | Yes |
| `rolled_back_to_version` | string | Previous stable version restored | Yes |
| `rolled_back_at` | ISO 8601 | Timestamp of rollback completion | Yes |
| `rollback_reason` | string | Human-readable reason | Yes |
| `initiated_by` | enum | `operator`, `system`, `automated_monitor` | Yes |
| `affected_task_ids` | UUID[] | Tasks whose Released status was reverted | Yes |
| `incident_id` | string | External incident reference, if applicable | No |

---

### 4.5 Pipeline Events

---

#### **PipelineRunStarted**

- **Producer:** PipelineRunnerService when a PipelineRun begins execution
- **Consumers:** AuditTrailService, DashboardBroadcastService, AlertingService (monitor for stuck runs)
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.pipelines`) + Broadcast channel `company.{company_id}.pipelines`
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.pipelines`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `pipeline_run_id` | UUID | Identifier of the PipelineRun | Yes |
| `pipeline_template` | string | Template name: `release`, `hotfix`, `docs`, or custom | Yes |
| `trigger` | string | `manual`, `scheduled`, `task_completed`, `webhook` | Yes |
| `triggered_by_id` | UUID | Actor that triggered the run | Yes |
| `triggered_by_type` | enum | `agent`, `user`, `system` | Yes |
| `task_id` | UUID | Associated EngineeringTask, if any | No |
| `release_candidate_id` | UUID | Associated ReleaseCandidate, if any | No |
| `started_at` | ISO 8601 | Timestamp of run start | Yes |
| `expected_duration_seconds` | integer | Estimated run duration | No |
| `stages` | string[] | Ordered list of stage names in this pipeline | Yes |

---

#### **PipelineRunCompleted**

- **Producer:** PipelineRunnerService on successful completion of all pipeline stages
- **Consumers:** ReleaseCandidateService (if run is a release gate), AuditTrailService, DashboardBroadcastService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.pipelines`) + Broadcast channel `company.{company_id}.pipelines`
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.pipelines`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `pipeline_run_id` | UUID | Identifier of the completed PipelineRun | Yes |
| `pipeline_template` | string | Template that was executed | Yes |
| `completed_at` | ISO 8601 | Timestamp of completion | Yes |
| `duration_seconds` | integer | Total wall-clock execution time | Yes |
| `stages_executed` | integer | Number of stages that ran | Yes |
| `artifact_ids` | UUID[] | PipelineArtifacts produced by this run | No |
| `quality_gate_passed` | boolean | Whether all quality gates were satisfied | Yes |
| `coverage_percent` | number | Test coverage percentage, if applicable | No |
| `findings_summary` | object | Count of critical/high/medium/low findings | No |

---

#### **PipelineRunFailed**

- **Producer:** PipelineRunnerService when a pipeline stage fails and the run cannot continue
- **Consumers:** AlertingService, AuditTrailService, PostMortemService, DashboardBroadcastService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.pipelines`) + Broadcast channel `company.{company_id}.pipelines`
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.pipelines`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `pipeline_run_id` | UUID | Identifier of the failed PipelineRun | Yes |
| `pipeline_template` | string | Template that was executing | Yes |
| `failed_at` | ISO 8601 | Timestamp of failure | Yes |
| `failed_stage` | string | Name of the stage that failed | Yes |
| `failure_code` | string | Machine-readable error code | Yes |
| `failure_message` | string | Human-readable description | Yes |
| `stages_completed` | string[] | Stages that succeeded before failure | No |
| `retry_eligible` | boolean | Whether the run can be retried from the failed stage | Yes |
| `retry_policy` | object | RetryPolicy VO: max_attempts, backoff_strategy, dead_letter | No |
| `partial_artifact_ids` | UUID[] | Artifacts produced before the failure | No |

---

#### **PipelineArtifactUploaded**

- **Producer:** PipelineRunnerService or individual pipeline stage after producing a PipelineArtifact
- **Consumers:** ArtifactRegistryService (index), ReleaseBundleService (collect for bundling), AuditTrailService
- **Delivery:** Synchronous in-process dispatch + Redis queue (`engineering.pipelines`)
- **Retry Strategy:** max_attempts: 3, backoff: exponential 5s/15s/45s, dead-letter: `dlq.engineering.pipelines`

**Payload Fields:**

| Field | Type | Description | Required |
|---|---|---|---|
| `artifact_id` | UUID | Identifier of the new PipelineArtifact | Yes |
| `pipeline_run_id` | UUID | Run that produced this artifact | Yes |
| `artifact_type` | string | `test_report`, `coverage_report`, `build_binary`, `docker_image`, `changelog`, `security_scan` | Yes |
| `artifact_name` | string | Human-readable artifact name | Yes |
| `storage_path` | string | Location in artifact storage | Yes |
| `size_bytes` | integer | Artifact file size | Yes |
| `checksum_sha256` | string | Integrity hash | Yes |
| `mime_type` | string | MIME type of the artifact | No |
| `uploaded_at` | ISO 8601 | Timestamp of upload | Yes |
| `expires_at` | ISO 8601 | When the artifact will be purged (if ephemeral) | No |

---

## 5. Event Bus Architecture

Engineering Cloud uses a layered event bus with three delivery modes. Each mode is chosen based on the consumer's location, latency requirement, and criticality.

### 5.1 Synchronous In-Process Dispatch

Used for domain events within the Engineering Cloud module boundary. Events are dispatched in the same PHP process, in the same request lifecycle, after database commit. Listeners execute synchronously before the HTTP response is returned.

- **When to use:** State transitions that must be reflected immediately; events whose consumers are within Engineering Cloud; events that must not be lost.
- **Implementation:** Laravel's `Event::dispatch()` with synchronous listeners registered in `EngineeringServiceProvider`.
- **Failure handling:** Listener exceptions propagate up and can roll back the parent transaction if still open. Dead-letter is not applicable.

### 5.2 Redis Queue (Async)

Used for cross-module integration events and high-volume events where immediate processing is not required. Events are serialized to JSON and pushed onto named Redis queues. Queue workers consume them in background processes.

- **Queues:**
  - `engineering.tasks` — task lifecycle events
  - `engineering.workers` — worker state events
  - `engineering.workspaces` — workspace events
  - `engineering.releases` — release lifecycle events
  - `engineering.pipelines` — pipeline execution events
  - `engineering.progress` — high-frequency progress updates (lower priority)
- **Dead-letter queues:** Each queue has a corresponding `dlq.*` queue. Messages land in the dead-letter queue after exhausting all retry attempts. The AlertingService monitors dead-letter queue depth.
- **Serialization:** JSON with full event envelope. `payload` field is the event-specific object.
- **Ordering:** FIFO within each queue, but consumers must not assume cross-queue ordering.

### 5.3 Broadcast (Laravel Echo / WebSockets)

Used for real-time UI updates. Events are pushed to named channels and delivered to connected browser clients via Laravel WebSockets. Broadcasting is fire-and-forget; missed events are not replayed.

- **Channels:**
  - `company.{company_id}.tasks` — task lifecycle updates for the dashboard
  - `company.{company_id}.pipelines` — pipeline progress for the Engineering OS UI
  - `company.{company_id}.releases` — release state changes
  - `workers.{worker_id}` — private channel for worker assignment and control signals
- **Authentication:** Channel authorization is enforced by `EngineeringChannelAuthPolicy`. Workers authenticate with JWT; users authenticate with Laravel Sanctum.
- **Payload size:** Broadcast payloads are trimmed to remove large fields (stack traces, log excerpts) before transmission. Full payloads are always available via API.

---

## 6. Event Ordering Guarantees

### 6.1 Per-Entity Ordering

Events for a single entity (one `task_id`, one `worker_id`, one `workspace_id`) are guaranteed to be processed in the order they were produced, within a single queue. The queue worker holds a per-entity processing lock while consuming events for that entity.

### 6.2 Cross-Entity Ordering

No cross-entity ordering guarantee is made. A `TaskCompleted` event for task A and a `WorkerBecameIdle` event for the same worker may be processed in either order by different consumers.

### 6.3 Idempotency Requirement

All consumers must be idempotent. The standard approach is to record the `event_id` in a processed-events log (keyed on `event_id`) before executing side effects. If the `event_id` is already present, skip processing and return success. This table is indexed and pruned on a 30-day retention window.

### 6.4 Event Deduplication Keys

| Event | Deduplication Key |
|---|---|
| TaskLockAcquired / TaskLockReleased | `lock_id` |
| WorkspaceLockAcquired / WorkspaceLockReleased | `lock_id` |
| WorkerHeartbeatReceived | `heartbeat_id` |
| All others | `event_id` |

---

## 7. Event Retention

| Event Category | Retention Period | Storage |
|---|---|---|
| Task lifecycle events (TaskCreated → TaskArchived) | 2 years | PostgreSQL `engineering_event_log` table |
| Worker state events | 90 days | PostgreSQL `engineering_event_log` table |
| WorkerHeartbeatReceived (sampled 1%) | 30 days | PostgreSQL `engineering_event_log` table |
| Workspace events | 1 year | PostgreSQL `engineering_event_log` table |
| Release events | 5 years (compliance) | PostgreSQL `engineering_event_log` table + cold archive |
| Pipeline events | 1 year | PostgreSQL `engineering_event_log` table |
| TaskProgressUpdated | 7 days | Redis time-series; not persisted to PostgreSQL |
| Broadcast events | Not persisted | WebSocket delivery only; no replay |
| Dead-letter queue entries | 30 days | Redis DLQ; operator must resolve or discard |
| Idempotency log entries | 30 days | PostgreSQL `engineering_processed_events` table |

---

## 8. Cross-Module Events

Engineering Cloud operates as a bounded context. It does not import or modify other ECOS modules. When Engineering Cloud needs to react to events from other domains, it does so through Anti-Corruption Listeners that translate external events into Engineering Cloud's own vocabulary.

### 8.1 Anti-Corruption Layer Design

Each cross-module listener implements the `CrossModuleEventListener` interface:

- Receives the external event in the source module's format
- Validates that the event is relevant to an Engineering Cloud entity
- Translates the external payload into an Engineering Cloud–internal representation
- Publishes a corresponding Engineering Cloud event, or directly invokes a domain service
- Never allows external event field names or semantics to leak into Engineering Cloud domain code

### 8.2 Consumed External Events

| Source Module | External Event | Engineering Cloud Response |
|---|---|---|
| Organization OS | `CompanyCreated` | Seeds default EngineeringWorker capability registry for the new tenant |
| Organization OS | `CompanyDeactivated` | Drains all active workers for the company; cancels queued tasks |
| Inventory Domain | `InventoryReservationFailed` | If a task depends on inventory availability, publishes `TaskFailed` with `failure_code: DEPENDENCY_UNAVAILABLE` |
| Enterprise Event Platform | `PipelineRunStarted` (legacy) | Translated to the canonical `PipelineRunStarted` defined in this document |
| Enterprise Event Platform | `PipelineRunCompleted` (legacy) | Translated to the canonical `PipelineRunCompleted` |
| Enterprise Event Platform | `PipelineRunFailed` (legacy) | Translated to the canonical `PipelineRunFailed` |

### 8.3 Anti-Corruption Listener Registration

All cross-module listeners are registered in `EngineeringAntiCorruptionServiceProvider`, which is loaded after all source module service providers. This ensures that Engineering Cloud never introduces load-order coupling into source modules.

### 8.4 Events Engineering Cloud Does Not Publish to Other Modules

Engineering Cloud does not publish events directly into other modules' queues or channels. Downstream consumers that need Engineering Cloud data (e.g., a Dashboard KPI service) subscribe to `company.{company_id}.tasks` and `company.{company_id}.releases` broadcast channels, or poll the Engineering Cloud API. This preserves the bounded context boundary and prevents Engineering Cloud from becoming an implicit dependency of unrelated modules.
