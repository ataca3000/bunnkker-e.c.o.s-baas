# Event Architecture
## ECOS AI Operations Platform

**Document ID:** AIOP-EA-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## 1. Event Design Principles

AIOP extends the ECOS Enterprise Event Platform (ADR-011). Every significant state change is expressed as an immutable domain event. Events are:

- **Immutable:** Events are never modified after emission
- **Actor-stamped:** Every event records who or what caused it (user, worker, system)
- **Append-only:** The event log never has deletions
- **Idempotent consumers:** All subscribers are designed to handle duplicate delivery safely
- **At-least-once delivery:** Events may be delivered more than once; subscribers use idempotency keys

---

## 2. Event Naming Convention

```
AiopTask{Action}           — Task lifecycle events
AiopWorker{Action}         — Worker lifecycle events
AiopExecution{Action}      — Execution lifecycle events
AiopReview{Action}         — Review lifecycle events
AiopArtifact{Action}       — Artifact events
AiopAgent{Action}          — Agent registry events
```

---

## 3. Event Catalog

### 3.1 Task Events

#### AiopTaskCreated

```
Event: AiopTaskCreated
Emitted by: API controller (user creates a task)
Payload:
  task_id:            UUID
  workspace_id:       UUID
  project_id:         UUID
  title:              string
  type:               string
  priority:           string
  created_by_user_id: UUID
  occurred_at:        timestamp

Subscribers:
  — NotificationService: notify workspace members that a new task was created
  — AuditTrailListener: write to aiop_audit_log
```

#### AiopTaskQueued

```
Event: AiopTaskQueued
Emitted by: QueueTaskAction (user queues a task for execution)
Payload:
  task_id:            UUID
  queued_by_user_id:  UUID
  required_capabilities: string[]
  occurred_at:        timestamp

Subscribers:
  — TaskDispatcher: begin worker matching process
  — NotificationService: notify worker operators that a task is waiting
  — AuditTrailListener
```

#### AiopTaskAssigned

```
Event: AiopTaskAssigned
Emitted by: TaskDispatcher (control plane assigns task to worker)
Payload:
  task_id:            UUID
  worker_id:          UUID
  execution_id:       UUID
  agent_id:           UUID
  occurred_at:        timestamp

Subscribers:
  — NotificationService: notify task creator that execution started
  — AuditTrailListener
```

#### AiopTaskCompleted

```
Event: AiopTaskCompleted
Emitted by: CompleteExecutionAction (after all reviews pass and merge succeeds)
Payload:
  task_id:            UUID
  execution_id:       UUID
  merge_commit_sha:   string
  tokens_used:        integer | null
  duration_seconds:   integer
  occurred_at:        timestamp

Subscribers:
  — NotificationService: notify creator and workspace members
  — ReportingService: aggregate task metrics
  — AuditTrailListener
```

#### AiopTaskCancelled

```
Event: AiopTaskCancelled
Emitted by: CancelTaskAction (user or admin cancels)
Payload:
  task_id:            UUID
  cancelled_by_user_id: UUID
  reason:             string
  occurred_at:        timestamp

Subscribers:
  — NotificationService: notify assigned worker (if any)
  — WorkerCommandService: send abort command to worker (if executing)
  — AuditTrailListener
```

#### AiopTaskChangesRequested

```
Event: AiopTaskChangesRequested
Emitted by: SubmitReviewDecisionAction (reviewer requests changes)
Payload:
  task_id:            UUID
  review_id:          UUID
  reviewer_user_id:   UUID
  comment:            string
  occurred_at:        timestamp

Subscribers:
  — NotificationService: notify task creator
  — AuditTrailListener
```

---

### 3.2 Execution Events

#### AiopExecutionStarted

```
Event: AiopExecutionStarted
Emitted by: Worker (via API call) when execution begins
Payload:
  execution_id:       UUID
  task_id:            UUID
  worker_id:          UUID
  agent_id:           UUID
  attempt_number:     integer
  agent_version:      string
  occurred_at:        timestamp

Subscribers:
  — AuditTrailListener
  — RealtimeNotificationService: push to user's browser session
```

#### AiopExecutionCompleted

```
Event: AiopExecutionCompleted
Emitted by: Worker (via API call) when execution finishes successfully
Payload:
  execution_id:       UUID
  task_id:            UUID
  worker_id:          UUID
  tokens_used:        integer | null
  duration_seconds:   integer
  files_changed:      integer
  occurred_at:        timestamp

Subscribers:
  — ReviewInitiationService: create Review record, notify reviewer
  — NotificationService: notify task creator
  — AuditTrailListener
```

#### AiopExecutionFailed

```
Event: AiopExecutionFailed
Emitted by: Worker (via API call) or Control Plane (timeout detection)
Payload:
  execution_id:       UUID
  task_id:            UUID
  worker_id:          UUID
  failure_code:       string
  failure_message:    string | null
  attempt_number:     integer
  occurred_at:        timestamp

Subscribers:
  — RetryPolicyService: check retry policy, re-queue if retries remain
  — NotificationService: notify creator and admins
  — AuditTrailListener
```

#### AiopExecutionLogChunkReceived

```
Event: AiopExecutionLogChunkReceived
Emitted by: Control Plane (when log chunk received from worker)
Payload:
  execution_id:       UUID
  chunk_start_seq:    integer
  chunk_end_seq:      integer
  occurred_at:        timestamp

Subscribers:
  — RealtimeLogStreamer: push new log lines to subscribed browser sessions
  
Note: This event is NOT persisted to the main event store due to high frequency.
      It is only dispatched via Redis pub/sub for real-time streaming.
```

---

### 3.3 Worker Events

#### AiopWorkerRegistered

```
Event: AiopWorkerRegistered
Emitted by: RegisterWorkerAction
Payload:
  worker_id:              UUID
  workspace_id:           UUID
  name:                   string
  hostname:               string
  agent_id:               UUID
  registered_by_user_id:  UUID
  occurred_at:            timestamp

Subscribers:
  — AuditTrailListener
  — NotificationService: notify workspace admins
```

#### AiopWorkerOnline / AiopWorkerOffline

```
Events: AiopWorkerOnline, AiopWorkerOffline
Emitted by: Worker lifecycle API endpoints
Payload:
  worker_id:          UUID
  agent_version:      string
  occurred_at:        timestamp

Subscribers:
  — WorkerStatusService: update worker.status in DB
  — NotificationService: alert if worker was expected to be running
  — AuditTrailListener
```

#### AiopWorkerHeartbeatMissed

```
Event: AiopWorkerHeartbeatMissed
Emitted by: Control Plane background job (HeartbeatMonitorJob)
Payload:
  worker_id:          UUID
  last_seen_at:       timestamp
  missed_at:          timestamp
  active_execution_id: UUID | null

Subscribers:
  — WorkerStatusService: mark worker offline
  — ExecutionFailureHandler: if active execution, mark failed with worker_crashed
  — NotificationService: alert workspace admins
  — AuditTrailListener
```

#### AiopWorkerDeregistered

```
Event: AiopWorkerDeregistered
Emitted by: DeregisterWorkerAction (admin removes worker)
Payload:
  worker_id:              UUID
  deregistered_by_user_id: UUID
  reason:                 string | null
  occurred_at:            timestamp

Subscribers:
  — TokenRevocationService: invalidate worker token immediately
  — AuditTrailListener
```

---

### 3.4 Review Events

#### AiopReviewRequested

```
Event: AiopReviewRequested
Emitted by: ReviewInitiationService (after execution completes)
Payload:
  review_id:          UUID
  task_id:            UUID
  execution_id:       UUID
  reviewer_user_id:   UUID
  stage:              string
  sla_deadline:       timestamp
  occurred_at:        timestamp

Subscribers:
  — NotificationService: notify reviewer (in-app + email)
  — SLAMonitor: schedule SLA breach check
  — AuditTrailListener
```

#### AiopReviewApproved

```
Event: AiopReviewApproved
Emitted by: SubmitReviewDecisionAction
Payload:
  review_id:          UUID
  task_id:            UUID
  approver_user_id:   UUID
  stage:              string
  next_stage:         string | null    // null if final approval
  occurred_at:        timestamp

Subscribers:
  — ReviewWorkflowService: advance to next stage or trigger merge
  — NotificationService: notify task creator
  — AuditTrailListener
```

#### AiopReviewSlaBreached

```
Event: AiopReviewSlaBreached
Emitted by: SLAMonitorJob
Payload:
  review_id:          UUID
  task_id:            UUID
  reviewer_user_id:   UUID
  sla_deadline:       timestamp
  breach_at:          timestamp

Subscribers:
  — NotificationService: urgent alert to reviewer + manager
  — EscalationService: optionally auto-escalate based on policy
  — AuditTrailListener
```

---

### 3.5 Artifact Events

#### AiopArtifactUploaded

```
Event: AiopArtifactUploaded
Emitted by: ConfirmArtifactUploadAction
Payload:
  artifact_id:        UUID
  execution_id:       UUID
  task_id:            UUID
  type:               string
  size_bytes:         integer
  occurred_at:        timestamp

Subscribers:
  — ArtifactVerificationJob: verify checksum
  — AuditTrailListener
```

#### AiopArtifactVerified / AiopArtifactVerificationFailed

```
Events: AiopArtifactVerified, AiopArtifactVerificationFailed
Emitted by: ArtifactVerificationJob
Payload:
  artifact_id:        UUID
  execution_id:       UUID
  checksum_match:     bool
  occurred_at:        timestamp

Subscribers (ArtifactVerificationFailed only):
  — NotificationService: alert admins
  — ExecutionFailureHandler: optionally re-run if primary artifact failed
  — AuditTrailListener
```

---

## 4. Idempotency

All event subscribers use the `event_id` (UUID) as an idempotency key. If the same event is delivered twice (due to queue retry), the subscriber checks whether it has already processed that event before acting.

Implementation: Each subscriber maintains a `processed_aiop_events` set in Redis (TTL: 48 hours), storing `event_id` values it has handled. Before processing, check: if `event_id` in set → skip; else → process and add to set.

---

## 5. Event Storage and Replay

All events (except high-frequency log chunks) are persisted to the ECOS Enterprise Event Store as defined in ADR-011. This enables:

- Full audit trail reconstruction
- Debugging task lifecycle history
- Analytics and reporting on task completion rates, failure patterns
- Future replay capability for testing

Retention: Events are retained for 2 years, then archived to cold storage.

---

## 6. Event Transport

| Event Category | Transport | Notes |
|---|---|---|
| Domain events (all above) | Laravel Queue → Database (events table) | Durable; survives restarts |
| Real-time log chunks | Redis pub/sub | Ephemeral; UI only |
| Worker heartbeat commands | Heartbeat response payload | No separate event; inline |
| SLA breach checks | Laravel Scheduler → Job | Timer-based; not event-sourced |
