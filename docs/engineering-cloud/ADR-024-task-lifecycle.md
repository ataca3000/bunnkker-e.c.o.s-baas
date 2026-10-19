# ADR-024 — Engineering Task Lifecycle

**Status:** Approved
**Date:** 2026-07-22
**Authors:** Platform Engineering
**Scope:** Engineering Cloud — Task Orchestration Layer
**Related:** ADR-023 (Order Snapshot Policy), Engineering OS Task Model

---

## 1. Context

Autonomous engineering work introduces a fundamentally different trust model compared to human-initiated workflows. An EngineeringAgent operates without continuous human supervision: it accepts tasks, acquires resources, executes multi-step programs, and reports results — all asynchronously and potentially across distributed workers.

Without a formal task lifecycle, the following failure modes emerge:

- **Orphaned tasks**: an EngineeringWorker crashes mid-execution with no record of partial progress, leaving the task stuck in an apparent running state indefinitely.
- **Concurrent mutation races**: two agents attempt to claim the same task simultaneously, producing split-brain execution where both believe they own the task.
- **Invisible failures**: a task silently times out without triggering alerting, retry logic, or escalation paths.
- **Audit gaps**: state transitions occur without timestamped records, making post-mortem analysis and compliance reporting impossible.
- **Release coupling errors**: a Completed task that should trigger ReleaseCandidate creation instead falls through because the transition to Completed was never formally defined as a trigger boundary.

A formal task lifecycle with explicit state definitions, guarded transitions, a locking protocol, and automatic timeout enforcement eliminates these failure modes. Every EngineeringTask must pass through this lifecycle from creation to archival. No implementation may bypass or shortcut any state.

---

## 2. State Definitions

### 2.1 Draft

**Description:** The task has been created but is not yet eligible for execution. It exists as a structured specification that may still be incomplete, under author review, or waiting for dependency resolution. No agent has seen or claimed it.

**Entry Conditions:**
- EngineeringTask record created via the Task Management API or by an orchestration system.
- No WorkerCapability match is required at this point; the task may describe capabilities not yet satisfied by any registered worker.

**Exit Conditions:**
- Author or system submits the task for scheduling, moving it to Queued.
- Author cancels the task before submission, moving it to Cancelled.

**Allowed Actions:**
- Edit task specification (title, description, parameters, priority, required capabilities).
- Attach TaskAttachment records.
- Add TaskComment entries.
- Assign TaskDependency relationships to upstream tasks.
- Cancel (actor: human author or orchestration system).

**Retention Policy:** Draft tasks are retained indefinitely until explicitly submitted or cancelled. After 90 days without modification, the system emits a `TaskStaleDraft` alert to the owning team. After 180 days, the task is automatically moved to Cancelled with the reason `stale_draft_timeout`.

---

### 2.2 Queued

**Description:** The task has been validated and placed in the ExecutionQueue, awaiting assignment to a suitable EngineeringWorker. The task specification is frozen at this point; no further edits to parameters or required capabilities are permitted. The task is visible to the scheduler.

**Entry Conditions:**
- Task was in Draft state and all mandatory fields (title, task type, required capabilities) are populated.
- All declared TaskDependency tasks are in Completed or Released state.
- At least one registered EngineeringWorker reports the required WorkerCapability (soft requirement; absence triggers an alert but does not block queuing).

**Exit Conditions:**
- Scheduler assigns the task to a worker, moving it to Assigned.
- Author or administrator cancels the task, moving it to Cancelled.
- Queue timeout elapses (see Section 8), moving it to Cancelled with reason `queue_timeout`.

**Allowed Actions:**
- Read task specification.
- Add TaskComment entries.
- Reprioritize within the queue (actor: administrator only).
- Cancel.

**Retention Policy:** Queued tasks are retained in the active queue. After 48 hours without assignment (no capable worker available), the system escalates with a `TaskQueueStarvation` alert. The task remains Queued until a capable worker becomes available, is cancelled, or hits the queue timeout.

---

### 2.3 Assigned

**Description:** The scheduler has selected a specific EngineeringWorker for this task and recorded the assignment. The worker has been notified but has not yet acknowledged acceptance. A TaskLock is held by the scheduler during the assignment handshake to prevent concurrent assignment.

**Entry Conditions:**
- Task was in Queued state.
- A Worker in Idle state with the matching WorkerCapability set was identified.
- TaskLock acquired on the task record by the scheduler process.
- Worker state transitioned to Busy atomically with task assignment.

**Exit Conditions:**
- Worker sends an acceptance acknowledgment, moving task to Accepted.
- Worker sends a rejection (capability mismatch discovered at runtime, resource unavailability), returning task to Queued with the assigning worker flagged.
- Acceptance timeout elapses (see Section 8), returning task to Queued and marking the worker Offline.

**Allowed Actions:**
- Worker may accept or reject the assignment.
- Administrator may forcibly re-queue (returns to Queued, releases TaskLock).
- Read-only access for all other actors.

**Retention Policy:** No special retention. Assignment records are kept as part of the task audit trail for the full task lifetime.

---

### 2.4 Accepted

**Description:** The assigned EngineeringWorker has acknowledged the task and is actively preparing its execution environment. The WorkerHeartbeat mechanism is now active. The task is committed to this worker; no re-assignment occurs unless the worker goes Offline.

**Entry Conditions:**
- Task was in Assigned state.
- Worker sent a valid acceptance message including its session token and estimated start time.
- ExecutionSession record created and set to Initializing.

**Exit Conditions:**
- Worker signals execution start, moving task to Running.
- Worker initialization fails (environment error, tool unavailability), moving task to Failed with a structured failure record.
- Accepted timeout elapses without a start signal (see Section 8), moving task to Failed with reason `initialization_timeout`.

**Allowed Actions:**
- Worker may start execution or report an initialization failure.
- Worker emits WorkerHeartbeat events every 30 seconds.
- Read-only access for all other actors.
- Administrator may abort (moves to Failed with reason `admin_abort`).

**Retention Policy:** No special retention. ExecutionSession initialization logs are attached to the task for post-mortem access.

---

### 2.5 Running

**Description:** The EngineeringWorker is actively executing the task body. ExecutionLog records are being written. WorkerHeartbeat events confirm liveness. This is the primary execution state; all business logic occurs here.

**Entry Conditions:**
- Task was in Accepted state.
- Worker emitted a `TaskExecutionStarted` event.
- ExecutionSession transitioned to Running.

**Exit Conditions:**
- Worker signals successful completion, moving task to Completed.
- Worker signals failure (unrecoverable error), moving task to Failed.
- Human operator pauses the task, moving it to Paused.
- Heartbeat timeout elapses (no heartbeat received within 90 seconds), moving task to Failed with reason `heartbeat_timeout`.
- Human operator cancels the task, moving it to Cancelled.

**Allowed Actions:**
- Worker appends ExecutionLog entries.
- Worker emits WorkerHeartbeat events.
- Worker uploads PipelineArtifact records.
- Worker may self-pause (e.g., waiting for an external dependency signal).
- Operator may pause or cancel.

**Retention Policy:** ExecutionLog records for Running tasks are stored in hot storage. Upon task completion or failure, logs are compressed and moved to warm storage after 7 days.

---

### 2.6 Paused

**Description:** Execution has been suspended. The assigned worker retains the task but suspends active processing. The Pause may be human-initiated (for inspection or environment changes) or system-initiated (resource pressure, scheduled maintenance window). The worker transitions to Paused state and holds its context.

**Entry Conditions:**
- Task was in Running state.
- A pause signal was issued by a human operator or by the worker itself (self-pause for external dependency).
- Worker acknowledged the pause and emitted `TaskPaused`.
- ExecutionSession moved to Paused.

**Exit Conditions:**
- Operator issues a resume command, returning task to Running.
- Operator cancels the task while paused, moving it to Cancelled.
- Paused timeout elapses (see Section 8), moving task to Failed with reason `paused_timeout`.

**Allowed Actions:**
- Operator may resume or cancel.
- Worker may not execute task logic but must continue emitting WorkerHeartbeat.
- Read-only access to ExecutionLog for all actors.

**Retention Policy:** No special retention beyond the running task policy. Paused state is considered a transient hold, not a terminal resting point.

---

### 2.7 Completed

**Description:** The task has been executed successfully. All expected outputs are available as PipelineArtifact or TaskArtifact records. The ExecutionSession is in Completing or Completed state. The task result is validated and accepted by the system.

**Entry Conditions:**
- Task was in Running state.
- Worker emitted `TaskCompleted` with a structured result payload.
- All required output artifacts declared in the task specification are present and have passed checksum validation.
- ExecutionSession moved to Completing, then Completed.

**Exit Conditions:**
- Release workflow picks up the task, moving it to Released (see Section 10).
- Archival policy triggers, moving it to Archived.
- No direct human transitions out of Completed except archival.

**Allowed Actions:**
- System automatically initiates ReleaseCandidate creation (see Section 10).
- Read artifact outputs.
- Add TaskComment entries (post-execution review notes).
- Initiate archival (actor: system scheduler or administrator).

**Retention Policy:** Completed tasks are retained in active storage for 30 days after completion. After 30 days, they are moved to Archived automatically.

---

### 2.8 Failed

**Description:** The task encountered an unrecoverable error during execution, initialization, or system oversight (heartbeat timeout, paused timeout). The cause is recorded in a structured failure record attached to the task. The assigned worker is released and returned to Idle or flagged Offline depending on failure type.

**Entry Conditions:**
- Task was in Accepted, Running, or Paused state (or Queued for queue timeout).
- A failure condition was met: worker reported unrecoverable error, a timeout elapsed, or an administrator issued an abort.
- A failure record with `failure_reason`, `failure_code`, `worker_id`, and `occurred_at` was written.

**Exit Conditions:**
- Administrator triggers a retry, which creates a new EngineeringTask in Draft or Queued state (the failed task itself remains Failed — retries are new tasks).
- Archival policy triggers, moving it to Archived.
- No in-place recovery to Running is permitted; a Failed task cannot be un-failed.

**Allowed Actions:**
- Read failure record and ExecutionLog.
- Add TaskComment entries (incident notes, root cause analysis).
- Initiate archival.
- Trigger retry (creates a new task, does not modify this record).

**Retention Policy:** Failed tasks are retained in active storage for 90 days (longer than Completed, to support incident investigation). After 90 days they move to Archived.

---

### 2.9 Cancelled

**Description:** The task was explicitly cancelled before reaching a terminal execution state. Cancellation may occur from Draft, Queued, Assigned, Accepted, Running, or Paused. It is always a human- or system-initiated decision (never automatic timeout except stale Draft and queue timeout, which use Cancelled as the timeout target).

**Entry Conditions:**
- A cancel signal was received from a human operator, the author, or the system (timeout-based cancel triggers from Draft and Queued).
- If the task was Running or Paused, the assigned worker received and acknowledged the cancel signal, and stopped processing.
- A cancellation record with `cancelled_by`, `cancel_reason`, and `cancelled_at` was written.

**Exit Conditions:**
- Archival policy triggers, moving it to Archived.
- No recovery from Cancelled; the task is permanently cancelled.

**Allowed Actions:**
- Read task record and any partial ExecutionLog.
- Add TaskComment entries.
- Initiate archival.

**Retention Policy:** Cancelled tasks are retained in active storage for 14 days, then archived automatically.

---

### 2.10 Released

**Description:** The task and its outputs have been formally incorporated into a ReleaseBundle through the release workflow. The release has been reviewed, approved, and stamped against this task. Released is the successful end-of-lifecycle state for tasks whose outputs become part of a product release.

**Entry Conditions:**
- Task was in Completed state.
- A ReleaseCandidate was created referencing this task's outputs (see Section 10).
- The ReleaseCandidate moved through UnderReview and Approved states and reached Released.
- A `TaskReleased` event was emitted, linking the task to the ReleaseBundle.

**Exit Conditions:**
- Archival policy triggers, moving it to Archived.
- No other transitions out of Released.

**Allowed Actions:**
- Read task record, artifacts, and release linkage.
- Add TaskComment entries (post-release notes).
- Initiate archival.

**Retention Policy:** Released tasks are retained in active storage for 90 days after the associated release date, then archived. Release linkage metadata is retained permanently in the audit log even after archival.

---

### 2.11 Archived

**Description:** The task record has been moved to cold storage. All associated ExecutionLog, PipelineArtifact, and TaskAttachment data is compressed and moved to archival tiers. The task is no longer visible in active operational views but remains fully accessible via the archive API for audit and compliance purposes.

**Entry Conditions:**
- Task was in Completed, Failed, Cancelled, or Released state.
- The applicable retention window for the source state has elapsed.
- An archival job ran successfully, compressing logs and artifacts, and emitted `TaskArchived`.

**Exit Conditions:**
- None. Archived is a terminal state. Data may be deleted per the data retention policy but the task record header (id, state, timestamps, actor) is retained permanently.

**Allowed Actions:**
- Read-only access to the compressed archive via the archive API.
- No comments, no attachments, no state changes.

**Retention Policy:** Archive records are kept for 7 years to satisfy audit and compliance requirements. After 7 years, full deletion may be approved by the Data Governance committee.

---

## 3. State Transition Matrix

| From State | To State   | Trigger                                      | Actor                      | Guard Conditions                                                                 | Side Effects                                                                                     |
|------------|------------|----------------------------------------------|----------------------------|----------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Draft      | Queued     | Author submits task for scheduling           | Human / Orchestration      | All mandatory fields populated; all declared dependencies in Completed/Released  | TaskLock released; `TaskQueued` event emitted; task frozen for edits                             |
| Draft      | Cancelled  | Author cancels before submission             | Human                      | Task in Draft state                                                              | `TaskCancelled` event emitted; cancellation record written                                       |
| Draft      | Cancelled  | Stale draft timeout (180 days)               | System Scheduler           | Task unmodified for 180 days                                                     | `TaskCancelled` event with reason `stale_draft_timeout`; alert sent to owning team               |
| Queued     | Assigned   | Scheduler selects a capable idle worker      | System Scheduler           | Worker in Idle state; Worker has required WorkerCapability; TaskLock acquirable  | TaskLock acquired; Worker state → Busy; `TaskAssigned` event emitted; assignment record written  |
| Queued     | Cancelled  | Operator cancels queued task                 | Human Operator             | Task in Queued state                                                             | `TaskCancelled` event emitted; task removed from ExecutionQueue                                  |
| Queued     | Cancelled  | Queue timeout elapses (48 h default)         | System Scheduler           | No capable worker registered within timeout window                               | `TaskCancelled` with reason `queue_timeout`; `TaskQueueStarvation` alert escalated               |
| Assigned   | Accepted   | Worker sends acceptance acknowledgment       | EngineeringWorker          | Worker token valid; worker still in Busy state; within acceptance timeout        | TaskLock released by scheduler; ExecutionSession created (Initializing); `TaskAccepted` emitted  |
| Assigned   | Queued     | Worker rejects assignment                    | EngineeringWorker          | Worker sent rejection within acceptance timeout                                  | Worker state → Idle; TaskLock released; task re-enters queue; `TaskRejected` event emitted       |
| Assigned   | Queued     | Acceptance timeout elapses                   | System Scheduler           | No acceptance message received within timeout                                    | Worker marked Offline; TaskLock released; task re-enters queue; `WorkerTimeout` event emitted    |
| Accepted   | Running    | Worker signals execution start               | EngineeringWorker          | ExecutionSession in Initializing state; worker heartbeat active                  | ExecutionSession → Running; `TaskExecutionStarted` emitted; heartbeat monitor armed              |
| Accepted   | Failed     | Worker reports initialization failure        | EngineeringWorker          | Worker emitted failure payload within accepted timeout                           | Worker → Idle; ExecutionSession → Failed; failure record written; `TaskFailed` emitted           |
| Accepted   | Failed     | Accepted timeout elapses (no start signal)   | System Scheduler           | No start signal within timeout                                                   | Worker → Offline; ExecutionSession → Aborted; `TaskFailed` with reason `initialization_timeout`  |
| Running    | Completed  | Worker signals successful completion         | EngineeringWorker          | All required output artifacts present and checksum-valid                         | ExecutionSession → Completing → Completed; `TaskCompleted` emitted; ReleaseCandidate trigger fired|
| Running    | Failed     | Worker reports unrecoverable error           | EngineeringWorker          | Worker emitted structured failure payload                                        | Worker → Idle; ExecutionSession → Failed; failure record written; `TaskFailed` emitted           |
| Running    | Paused     | Operator issues pause command                | Human Operator             | Task in Running state; worker acknowledges pause                                 | Worker → Paused; ExecutionSession → Paused; `TaskPaused` emitted; paused timer armed             |
| Running    | Paused     | Worker self-pauses (external dependency)     | EngineeringWorker          | Worker emits self-pause with declared dependency reference                       | Same as operator pause; dependency watch registered                                              |
| Running    | Cancelled  | Operator cancels running task                | Human Operator             | Task in Running state; worker receives and acknowledges cancel                   | Worker → Idle; ExecutionSession → Aborted; `TaskCancelled` emitted; partial artifacts retained   |
| Running    | Failed     | Heartbeat timeout (90 s without heartbeat)   | System Scheduler           | No heartbeat received within 90 s from last received heartbeat                  | Worker marked Offline; ExecutionSession → Failed; `TaskFailed` with reason `heartbeat_timeout`   |
| Paused     | Running    | Operator issues resume command               | Human Operator             | Task in Paused state; worker still Paused and responsive                         | Worker → Busy; ExecutionSession → Running; `TaskResumed` emitted; paused timer disarmed          |
| Paused     | Cancelled  | Operator cancels paused task                 | Human Operator             | Task in Paused state                                                             | Worker → Idle; ExecutionSession → Aborted; `TaskCancelled` emitted                              |
| Paused     | Failed     | Paused timeout elapses                       | System Scheduler           | Task in Paused state beyond paused timeout                                       | Worker → Offline; ExecutionSession → Failed; `TaskFailed` with reason `paused_timeout`           |
| Completed  | Released   | ReleaseCandidate reaches Released state      | Release Workflow           | Linked ReleaseCandidate in Released state; ReleaseBundle created                 | `TaskReleased` emitted; task linked to ReleaseBundle; release metadata written                   |
| Completed  | Archived   | 30-day retention window elapses              | System Archival Scheduler  | Task in Completed state for 30+ days with no pending release linkage             | Logs compressed; artifacts moved to cold tier; `TaskArchived` emitted                            |
| Failed     | Archived   | 90-day retention window elapses              | System Archival Scheduler  | Task in Failed state for 90+ days                                                | Same as Completed archival                                                                       |
| Cancelled  | Archived   | 14-day retention window elapses              | System Archival Scheduler  | Task in Cancelled state for 14+ days                                             | Same as Completed archival                                                                       |
| Released   | Archived   | 90-day post-release retention elapses        | System Archival Scheduler  | Task in Released state for 90+ days after associated release date                | Same as Completed archival; release linkage metadata retained permanently                        |

---

## 4. ASCII State Diagram

```
                         +----------+
                         |          |
                    +--> |  DRAFT   | ---cancel--> [CANCELLED]
                    |    |          |
                    |    +----------+
                    |         |
                    |      submit
                    |         |
                    |         v
                    |    +----------+
                    |    |          |
         reject --------  |  QUEUED  | ---cancel/timeout--> [CANCELLED]
         (returns)   |    |          |
                    |    +----------+
                    |         |
                    |      assign
                    |         |
                    |         v
                    |    +----------+
                    |    |          |
                    +--- | ASSIGNED | ---reject/timeout--> [QUEUED]
                         |          |
                         +----------+
                              |
                           accept
                              |
                              v
                         +----------+
                         |          |
                         | ACCEPTED | ---init-fail/timeout--> [FAILED]
                         |          |
                         +----------+
                              |
                           start
                              |
                              v
              pause    +----------+   cancel
     +-----<---------- |          | -----------> [CANCELLED]
     |                 | RUNNING  |
     |    +----------> |          | ---heartbeat-timeout--> [FAILED]
     |    |  resume    +----------+
     |    |                 |
     v    |              complete / fail
+----------+               |
|          |    fail-      v
|  PAUSED  | ---timeout-> [FAILED]
|          |
+----------+
     |
  cancel
     |
     v
[CANCELLED]


  On complete:
       |
       v
  +----------+
  |          |
  |COMPLETED | ---release-workflow--> [RELEASED] ---archival--> [ARCHIVED]
  |          |
  +----------+
       |
    archival
       |
       v
  [ARCHIVED]


  Terminal States (no further transitions except archival):
  +-------------+   +----------+   +------------+   +----------+
  | [COMPLETED] |   | [FAILED] |   |[CANCELLED] |   |[RELEASED]|
  +-------------+   +----------+   +------------+   +----------+
          \               |               /               |
           \              |              /                |
            +-------------+------------+                 |
                          |                              |
                          v                              v
                     [ARCHIVED] <-----------------------+
```

---

## 5. Automatic vs Manual Transitions

### 5.1 Automatic Transitions (System-Driven)

These transitions are initiated by the system without human intervention. They are triggered by time-based policies, event receipts from workers, or archival jobs.

| Transition                       | Trigger Mechanism                                                                                       |
|----------------------------------|---------------------------------------------------------------------------------------------------------|
| Draft → Cancelled (stale)        | A daily archival job checks Draft tasks older than 180 days and cancels them with `stale_draft_timeout`.|
| Queued → Assigned                | The ExecutionQueue scheduler runs a match loop every 5 seconds, pairing available workers to queued tasks by WorkerCapability.|
| Queued → Cancelled (starvation)  | If no capable worker is registered within 48 hours, the queue timeout job cancels the task.            |
| Assigned → Queued (accept timeout)| If no acceptance acknowledgment is received within the acceptance timeout window, the system returns the task to Queued and marks the worker Offline.|
| Accepted → Failed (init timeout) | If the worker does not emit a start signal within the initialization timeout, the system fails the task.|
| Running → Failed (heartbeat)     | If no WorkerHeartbeat is received within 90 seconds of the last, the heartbeat monitor fails the task.  |
| Paused → Failed (pause timeout)  | If the task remains Paused beyond the paused timeout, the system fails the task.                       |
| Completed → Released             | When the linked ReleaseCandidate moves to Released state, the release workflow automatically transitions the task.|
| Completed → Archived             | The archival scheduler runs daily; tasks in Completed state for 30+ days are archived.                  |
| Failed → Archived                | Tasks in Failed state for 90+ days are archived by the daily archival scheduler.                       |
| Cancelled → Archived             | Tasks in Cancelled state for 14+ days are archived by the daily archival scheduler.                    |
| Released → Archived              | Tasks in Released state for 90+ days after their release date are archived.                            |

### 5.2 Manual Transitions (Human-Initiated)

These transitions require an explicit decision by a human actor: the task author, a platform administrator, or an authorized operator.

| Transition                      | Actor                  | Description                                                                                                     |
|---------------------------------|------------------------|-----------------------------------------------------------------------------------------------------------------|
| Draft → Queued (submit)         | Task Author            | The author reviews the task specification and explicitly submits it for scheduling.                            |
| Draft → Cancelled               | Task Author            | The author decides the task is no longer needed before it enters the queue.                                    |
| Queued → Cancelled              | Administrator / Author | An operator or the original author cancels the task while it is waiting in the queue.                          |
| Assigned → Queued (force re-queue)| Administrator        | An administrator overrides the current assignment and returns the task to the queue, releasing the worker.      |
| Running → Paused                | Human Operator         | An operator suspends execution for inspection, environment maintenance, or manual intervention.                 |
| Paused → Running (resume)       | Human Operator         | An operator resumes a previously paused task.                                                                  |
| Paused → Cancelled              | Human Operator         | An operator decides the paused task should not continue.                                                       |
| Running → Cancelled             | Human Operator         | An operator cancels an actively running task; the assigned worker is notified and must acknowledge.            |
| Any Active → Failed (admin abort)| Administrator         | An administrator issues a forced abort, failing the task immediately regardless of worker state.                |

### 5.3 Prohibited Transitions

These transitions are explicitly forbidden. Any attempt to perform them must be rejected by the system with an `InvalidStateTransition` error and logged to the audit trail.

| Prohibited Transition         | Reason                                                                                                                               |
|-------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Failed → Running              | A failed task cannot be un-failed. Recovery requires creating a new task. Allowing in-place un-failing would corrupt the failure audit record and potentially resume execution against a broken environment.|
| Failed → Queued               | Same reasoning as Failed → Running. Retries must be modeled as new tasks to preserve the integrity of each task's lifecycle record.  |
| Cancelled → Any Active State  | Cancellation is a permanent decision. Re-activating a cancelled task would invalidate the cancellation record and potentially create orphaned resource claims.|
| Completed → Running           | A completed task has produced validated outputs. Returning it to Running would invalidate those outputs and create a new undocumented execution segment.|
| Completed → Queued            | Same reasoning. New work is always a new task.                                                                                       |
| Archived → Any State          | Archived is the final terminal state. No transitions out of Archived are permitted. Re-work is always a new task.                    |
| Released → Running            | A released task's outputs are incorporated into a release bundle. Re-running would create a mismatch between the release record and actual execution history.|
| Draft → Running               | Tasks cannot bypass the queue. All execution must pass through Queued → Assigned → Accepted to ensure proper worker matching and resource accounting.|
| Draft → Accepted              | Same reasoning as Draft → Running.                                                                                                   |
| Queued → Running              | Worker assignment must occur before execution. Bypassing Assigned/Accepted skips the TaskLock handshake and worker commitment.        |
| Paused → Completed            | A paused task cannot be marked complete without resuming execution first. Completion requires the worker to emit a valid result payload.|
| Assigned → Completed          | A task that was assigned but never ran cannot be marked complete. The execution evidence (ExecutionLog, artifacts) does not exist.    |

---

## 6. Terminal States

A terminal state is a state from which no recovery or resumption of execution is possible within the same task record. Terminal states signify that the task's lifecycle has ended, whether successfully, unsuccessfully, or by decision.

### Terminal State Definitions

**Completed** — The task achieved its intended objective. All declared output artifacts were produced, validated by checksum, and accepted by the system. This state is the operationally positive terminal: the task fulfilled its contract.

**Failed** — The task did not achieve its intended objective due to an unrecoverable condition: a worker runtime error, an initialization failure, a heartbeat timeout indicating a lost worker, or an administrative abort. The failure record documents the exact cause. Failed is the operationally negative terminal for execution-side problems.

**Cancelled** — The task was explicitly abandoned before completing execution, either by the author, an operator, or the system (via stale or starvation timeout policy). Unlike Failed, Cancelled represents a deliberate decision rather than an execution error. Cancelled is the operationally neutral terminal for tasks that were superseded, deprioritized, or found unnecessary.

**Archived** — The task record has been moved to cold storage after all active retention windows have elapsed. Archived is the final administrative terminal for all tasks: every task eventually reaches Archived. Archived does not carry semantic meaning about success or failure; it signals that the task is no longer operationally active and lives only in the archive for compliance and audit purposes.

### Operational Meaning of Terminal

A terminal task record is immutable. No state fields, specification fields, or relationship fields may be modified after a task reaches a terminal state (except the addition of archival metadata when transitioning to Archived). Any new work based on a failed or cancelled task must be expressed as a new EngineeringTask, which may reference the original task as a dependency or predecessor via a TaskDependency record with `dependency_type = predecessor`.

---

## 7. TaskLock Protocol

The TaskLock entity prevents concurrent state mutations that would otherwise produce race conditions in a distributed multi-worker environment. Without locking, two scheduler processes could simultaneously select the same task from the queue, assign it to two different workers, and launch parallel executions of the same task body.

### 7.1 Lock Structure

A TaskLock record holds the following fields:

| Field         | Type      | Description                                                            |
|---------------|-----------|------------------------------------------------------------------------|
| `id`          | UUID      | Unique lock identifier                                                 |
| `task_id`     | UUID FK   | The EngineeringTask this lock protects                                 |
| `holder_id`   | UUID      | Identifier of the process or worker holding the lock (scheduler PID, worker UUID) |
| `acquired_at` | Timestamp | When the lock was acquired                                             |
| `expires_at`  | Timestamp | When the lock expires if not explicitly released (TTL enforcement)     |
| `purpose`     | String    | Semantic label for the lock context: `assignment`, `transition`, `heartbeat_check` |

### 7.2 Lock Acquisition

A lock is acquired using a database-level atomic operation: a conditional INSERT that succeeds only if no lock record currently exists for the target `task_id`. The database unique constraint on `task_id` guarantees that two concurrent processes cannot both succeed. The acquiring process must:

1. Attempt the conditional INSERT.
2. If successful, record the returned lock `id` for subsequent release.
3. If unsuccessful (constraint violation), treat the task as locked and abort the current operation, retrying after a backoff interval.

No application-level mutex or memory-based lock is sufficient. The lock must be persisted to the database to survive process restarts and cross-node scheduler instances.

### 7.3 Lock TTL

Every TaskLock has a default TTL of 30 seconds. The TTL is set at acquisition time by writing `expires_at = acquired_at + 30s`. A background job runs every 10 seconds to sweep expired locks and remove them, emitting a `TaskLockExpired` event for each. Expired locks free the task for re-acquisition by a new scheduler cycle.

The TTL exists to handle the scenario where the lock-holding process crashes before releasing the lock. The 30-second TTL is shorter than the acceptance timeout (see Section 8), ensuring that a crashed scheduler does not block the task indefinitely.

### 7.4 Lock Release Procedure

The holding process must release the lock explicitly upon completing the protected operation or upon encountering any error that prevents the operation from completing. Release is performed by deleting the TaskLock record by its `id`. The process must release the lock it holds, identified by its `holder_id` and the matching `id`, to prevent one process from releasing another process's lock.

Release must occur in a `finally` block or equivalent error-handling construct to ensure the lock is always freed, even if the transition logic throws an exception. Failure to release results in the lock expiring via TTL, which is safe but introduces a delay.

### 7.5 Lock Scope

TaskLocks are per-task. Multiple tasks may be locked simultaneously by different scheduler processes. The lock protects only state mutation (transitions). Read operations never acquire a TaskLock. High-frequency read operations such as dashboard polling must use the task record directly without acquiring a lock.

---

## 8. Timeout Policy Table

| State    | Default Timeout | On Timeout Action                                                                                                  |
|----------|-----------------|--------------------------------------------------------------------------------------------------------------------|
| Draft    | 180 days        | Transition to Cancelled with reason `stale_draft_timeout`; emit `TaskStaleDraft` alert at 90 days as a warning.   |
| Queued   | 48 hours        | Transition to Cancelled with reason `queue_timeout`; emit `TaskQueueStarvation` alert.                            |
| Assigned | 60 seconds      | Return task to Queued; mark the unresponsive worker Offline; emit `WorkerAcceptanceTimeout`.                      |
| Accepted | 5 minutes       | Transition to Failed with reason `initialization_timeout`; mark worker Offline; emit `TaskFailed`.                |
| Running  | 90 seconds (heartbeat window) | Transition to Failed with reason `heartbeat_timeout`; mark worker Offline; emit `TaskFailed`.     |
| Paused   | 24 hours        | Transition to Failed with reason `paused_timeout`; mark worker Offline; emit `TaskFailed`.                        |
| Completed| 30 days         | Transition to Archived; emit `TaskArchived`.                                                                       |
| Failed   | 90 days         | Transition to Archived; emit `TaskArchived`.                                                                       |
| Cancelled| 14 days         | Transition to Archived; emit `TaskArchived`.                                                                       |
| Released | 90 days (post-release) | Transition to Archived; emit `TaskArchived`; release linkage metadata retained permanently.                 |
| Archived | 7 years         | Eligible for full deletion subject to Data Governance committee approval. Task header record retained permanently. |

---

## 9. Audit Requirements

Every state transition, without exception, must be recorded as an immutable entry in the `task_state_transitions` table. This table is append-only; no row may be updated or deleted. It is the canonical audit trail for all task lifecycle activity.

### 9.1 Record Fields

| Field             | Type          | Description                                                                                                        |
|-------------------|---------------|--------------------------------------------------------------------------------------------------------------------|
| `id`              | UUID          | Unique identifier for this transition record.                                                                      |
| `task_id`         | UUID FK       | The EngineeringTask that underwent the transition.                                                                 |
| `from_state`      | String        | The state the task was in before this transition. Null for the initial Draft creation event.                       |
| `to_state`        | String        | The state the task entered as a result of this transition.                                                         |
| `triggered_by`    | String (enum) | Source of the trigger: `system`, `worker`, `operator`, `author`, `release_workflow`, `archival_scheduler`.        |
| `actor_id`        | UUID Nullable | UUID of the human user, EngineeringWorker, or system process that initiated the transition. Null for automated scheduler jobs.|
| `actor_type`      | String        | Entity type of the actor: `User`, `EngineeringWorker`, `SystemScheduler`, `ArchivalJob`, `ReleaseWorkflow`.       |
| `reason`          | String        | Human-readable reason or machine-readable code for the transition. Required for all transitions to Failed and Cancelled.|
| `failure_code`    | String Nullable | Structured failure code (e.g., `heartbeat_timeout`, `initialization_timeout`, `worker_error`). Populated on Failed transitions only.|
| `metadata`        | JSONB         | Additional context: worker session ID, lock ID used, artifact checksums validated, timeout configuration at the time of transition.|
| `occurred_at`     | Timestamp TZ  | The exact timestamp (microsecond precision, UTC) when the transition was recorded. Set by the database server, not the application layer, to prevent clock skew issues.|
| `task_state_after`| JSONB         | A snapshot of the task's key fields (status, priority, assigned_worker_id, session_id) at the moment of transition, for point-in-time reconstruction.|

### 9.2 Audit Integrity Rules

- No application code may issue an UPDATE or DELETE against `task_state_transitions`. Rows are inserted once and never touched.
- `occurred_at` must be set using `NOW()` in the database transaction, not `Carbon::now()` or any application-layer clock, to ensure consistency across multi-node deployments.
- Every state mutation in the `engineering_tasks` table must be wrapped in the same database transaction that inserts the corresponding `task_state_transitions` row. The transition record must not be optional or deferred.
- The audit trail is considered a compliance artifact. It is subject to the same 7-year retention policy as Archived task records.

---

## 10. Integration with Release Workflow

The Completed state is the integration boundary between the task lifecycle and the release workflow. When a task reaches Completed, it signals that executable outputs (artifacts, configurations, reports) are ready for review and formal release.

### 10.1 Trigger Mechanism

When the system records a transition to Completed (inserting the `task_state_transitions` row), it dispatches a `TaskCompleted` domain event. The Release Workflow Service listens for this event and evaluates whether the completed task is release-eligible based on two criteria:

1. The task has one or more PipelineArtifact or TaskArtifact records with `release_eligible = true`.
2. The task's `release_policy` field is not set to `none` (some tasks are internal, infrastructure tasks that produce no releasable output).

If both criteria are satisfied, the Release Workflow Service automatically creates a ReleaseCandidate record in Draft state, linking it to the completed task and copying its artifact manifest.

### 10.2 ReleaseCandidate Creation Record

The automatically created ReleaseCandidate contains:

- `source_task_id`: the UUID of the completing EngineeringTask.
- `artifact_manifest`: a copy of all release-eligible artifact references from the task.
- `created_by`: set to `system:release_workflow` to distinguish automatic from manual candidates.
- `initial_state`: Draft (the candidate then proceeds through the release workflow independently: Draft → UnderReview → Approved → Staged → Released → RolledBack if needed).

### 10.3 Task Transition to Released

The EngineeringTask record transitions from Completed to Released only after its linked ReleaseCandidate itself reaches the Released state. This decouples the task's execution completion from the release governance process: a task may sit in Completed for days while its release candidate is reviewed and approved. The Completed → Released transition is triggered by the release workflow emitting a `ReleaseCandidateReleased` event, which the task lifecycle listener catches and uses to perform the Completed → Released transition on all linked tasks.

### 10.4 Reference to ADR-023

ADR-023 (Order Snapshot Policy) establishes the principle that business outputs must be snapshotted at the moment of their creation rather than resolved dynamically from current state. The same principle applies here: the artifact manifest copied into the ReleaseCandidate at the moment of Completed transition is immutable. If artifacts are subsequently modified (which is itself prohibited for released artifacts), the release candidate retains the snapshot of the artifact state at completion time, not the modified state.

---

*Document maintained by Platform Engineering. All changes require a status update and a new entry in the ECOS Architecture Decision Record index.*
