# Engineering Cloud — State Machines

**Version:** 1.0 | **Status:** Frozen | **Date:** 2026-07-22

---

## Table of Contents

1. [EngineeringTask State Machine](#1-engineeringtask-state-machine)
2. [EngineeringWorker State Machine](#2-engineeringworker-state-machine)
3. [Workspace State Machine](#3-workspace-state-machine)
4. [ReleaseCandidate State Machine](#4-releasecandidate-state-machine)
5. [ExecutionSession State Machine](#5-executionsession-state-machine)
6. [Cross-State-Machine Dependencies](#6-cross-state-machine-dependencies)
7. [State Machine Implementation Notes](#7-state-machine-implementation-notes)

---

## 1. EngineeringTask State Machine

### 1.1 ASCII State Diagram

```
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                      ENGINEERINGTASK LIFECYCLE                                  │
  └─────────────────────────────────────────────────────────────────────────────────┘

  [Draft] ──queue──> [Queued] ──assign──> [Assigned] ──accept──> [Accepted] ──start──> [Running]
                        ^                     │                                             │
                        │                  reject /                                    pause │
                        │                  timeout                                          │
                        │                     │                                        [Paused]
                        │                     v                                             │
                        └──────────── [Queued] <─────────────────────── resume ────────────┘
                                         ^
                                         │ retry
                                         │
  ┌──────────────── from any non-terminal state ─────────────────┐
  │                                                               │
  │  [Draft] ─────────────────────────────────────────────────── │
  │  [Queued] ─────────────────────────────────────────────────  │──> [Cancelled]
  │  [Assigned] ──────────────────────────────────────────────── │         │
  │  [Accepted] ──────────────────────────────────────────────── │         │ archive
  │  [Running] ──── cancel ───────────────────────────────────── │         │
  │  [Paused] ─────────────────────────────────────────────────  │         v
  └──────────────────────────────────────────────────────────────┘    [Archived]
                                                                            ^
  [Running] ──complete──> [Completed] ──release──> [Released] ─archive─────┘
                                                                            ^
  [Running] ──fail──> [Failed] ──retry──> [Queued]                         │
                           │                                                │
                           └─────────────── archive ────────────────────────┘

  ─────────────────────────────────────────────────────────────
  ACTIVE STATES           │  TERMINAL STATES
  ─────────────────────────────────────────────────────────────
  Draft                   │  Completed
  Queued                  │  Failed (if not retried)
  Assigned                │  Cancelled
  Accepted                │  Released
  Running                 │  Archived
  Paused                  │
  ─────────────────────────────────────────────────────────────
```

### 1.2 State Definitions Table

| State | Entry Conditions | Exit Conditions | Allowed Actions | Max Duration | On Timeout |
|---|---|---|---|---|---|
| **Draft** | Task created by engineer or system | Validation passes and operator queues task | Edit, Delete, Queue, Comment, Attach | None | N/A |
| **Queued** | Task queued manually or via retry trigger | Worker picks up task (assign) or operator cancels | Cancel, View, Comment, Reprioritize | 72 hours | Escalate to engineering lead; stay Queued |
| **Assigned** | Worker capacity available; task matched to worker | Worker accepts or rejects; timeout elapses | Cancel, View, Reassign | 15 minutes | Return to Queued; log assignment failure |
| **Accepted** | Worker sends acceptance acknowledgement | Worker signals start of execution | Cancel, View | 5 minutes | Return to Queued; flag worker as slow-start |
| **Running** | Worker signals execution has begun | Complete, Fail, Pause, or Cancel | Pause, Cancel, View, Log | Defined per task type; default 4 hours | Fail task; release worker; emit TaskTimedOut |
| **Paused** | Running task receives pause trigger (engineer or system) | Resume trigger received or cancel issued | Resume, Cancel, Comment | 24 hours | Auto-cancel if not resumed within limit |
| **Completed** | Worker emits task.complete with all artifacts saved | Release trigger issued by release manager | Release, Archive, Comment | None | N/A |
| **Failed** | Worker emits task.fail, or execution timeout reached | Retry (returns to Queued) or Archive | Retry, Archive, Comment, View | None | N/A |
| **Cancelled** | Cancel issued from any non-terminal active state | Archive trigger issued | Archive, View, Comment | None | N/A |
| **Released** | PipelineRun passes for this task's artifacts | Archive trigger issued | Archive, View | None | N/A |
| **Archived** | Archive trigger issued from terminal state | None (terminal, immutable) | View, Export | None | N/A |

### 1.3 Transition Table

| From | To | Trigger | Actor | Guard Conditions | Side Effects | Events Published |
|---|---|---|---|---|---|---|
| Draft | Queued | queue | Engineer / System | Task has title, type, priority set; no blocking dependency in Draft state | Task added to ExecutionQueue; priority slot reserved | TaskQueued |
| Queued | Assigned | assign | ExecutionQueue / Scheduler | Worker exists in Idle state; worker capability matches task type; no WorkspaceLock conflict | WorkerResource decremented; TaskLock created; assignment recorded | TaskAssigned |
| Queued | Cancelled | cancel | Engineer / Admin | Task not yet assigned | Remove from queue; release priority slot | TaskCancelled |
| Assigned | Accepted | accept | EngineeringWorker | Assignment belongs to requesting worker; worker still in Registering→Idle flow | Worker state → Busy; Workspace state → Active; assignment_accepted_at stamped | TaskAccepted |
| Assigned | Queued | reject | EngineeringWorker | Worker sends explicit rejection with reason | TaskLock released; worker capacity restored; rejection logged | TaskRejected, TaskQueued |
| Assigned | Queued | timeout | System (scheduler) | 15-minute acceptance window elapsed | TaskLock released; worker flagged for slow-start; back to queue head | TaskAssignmentTimedOut, TaskQueued |
| Accepted | Running | start | EngineeringWorker | Worker has confirmed workspace provisioned; no blocking dependency Running | ExecutionSession created (Initializing → Running); started_at stamped | TaskStarted, ExecutionSessionStarted |
| Running | Paused | pause | Engineer / System | Task is currently Running; worker acknowledges pause | Worker state → Paused; ExecutionSession state → Paused; paused_at stamped | TaskPaused |
| Running | Completed | complete | EngineeringWorker | All TaskArtifacts saved; exit code 0; worker signals task.complete | Worker state → Idle; Workspace state → Idle; completed_at stamped; duration recorded | TaskCompleted |
| Running | Failed | fail | EngineeringWorker / System | Worker emits task.fail with reason, or timeout exceeded | Worker state → Idle; Workspace state → Idle; failure reason recorded; retry_count incremented | TaskFailed |
| Running | Cancelled | cancel | Engineer / Admin | Task is Running; admin override or engineer abort | Worker receives cancel signal; worker state → Idle; ExecutionSession → Aborted | TaskCancelled, ExecutionSessionAborted |
| Running | Running | heartbeat | EngineeringWorker | Worker is Busy; session is Running | WorkerHeartbeat updated; last_seen_at refreshed | WorkerHeartbeatReceived |
| Paused | Running | resume | Engineer / System | Task is Paused; worker is available (still Paused state); Workspace still Active | Worker state → Busy; ExecutionSession state → Running; resumed_at stamped | TaskResumed |
| Paused | Cancelled | cancel | Engineer / Admin | Task is Paused | Worker state → Idle; Workspace state → Idle; ExecutionSession → Aborted | TaskCancelled |
| Paused | Queued | timeout | System (scheduler) | 24-hour pause limit elapsed without resume | Worker state → Idle; Workspace state → Idle; ExecutionSession → Aborted; task re-enters queue | TaskPauseTimedOut, TaskQueued |
| Failed | Queued | retry | Engineer / System | retry_count < max_retries (default 3); task type allows retry | retry_count incremented; backoff delay applied; ExecutionSession closed | TaskRetried, TaskQueued |
| Failed | Archived | archive | Engineer / Release Manager | Task is in Failed terminal state | task_archived_at stamped; artifacts retained per retention policy | TaskArchived |
| Completed | Released | release | Release Manager | ReleaseCandidate associated; PipelineRun passed; review approved | released_at stamped; ReleaseBundle linked | TaskReleased |
| Completed | Archived | archive | Engineer / System | Task is Completed and not part of active release | Artifacts compressed; task_archived_at stamped | TaskArchived |
| Released | Archived | archive | System (retention job) | Released age > retention threshold (default 90 days) | Artifacts moved to cold storage; task_archived_at stamped | TaskArchived |
| Cancelled | Archived | archive | Engineer / System | Task is Cancelled | task_archived_at stamped | TaskArchived |
| Draft | Cancelled | cancel | Engineer | Task has never been queued | Task soft-deleted from active view | TaskCancelled |

### 1.4 Terminal States

| Terminal State | Operational Meaning |
|---|---|
| **Completed** | The task executed successfully. All artifacts are saved and verified. The task awaits release or archival. No further execution actions are permitted. |
| **Failed** | The task execution ended in failure after exhausting retries, or an unrecoverable error was recorded. The task remains visible for post-mortem and may be archived or manually cloned for a new attempt. |
| **Cancelled** | The task was deliberately stopped before or during execution by an engineer or administrator. The reason is recorded. Resources are released immediately. |
| **Released** | The task's output has been formally released as part of a ReleaseCandidate and its pipeline passed. The task is frozen and awaiting archival per retention policy. |
| **Archived** | The task record is immutable and removed from active operational views. Artifacts are retained per the data retention policy. No transitions out of Archived are permitted. |

A task in any terminal state holds no worker capacity, no workspace resource, and no lock. Terminal tasks are excluded from queue calculations and scheduling algorithms.

---

## 2. EngineeringWorker State Machine

### 2.1 ASCII State Diagram

```
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                      ENGINEERINGWORKER LIFECYCLE                                │
  └─────────────────────────────────────────────────────────────────────────────────┘

  [Unregistered] ──register──> [Registering] ──accepted──> [Idle] ──assigned──> [Busy]
                                     │                        │                     │
                                  rejected                    │                task-done
                                     │                        │                     │
                                     v                        └─────────────────────┘
                              [Unregistered]                          (loop)

  [Busy] ──task-paused──> [Paused] ──resume──> [Busy]
    │                         │
    │                    shutdown-init
    │                         │
    └──── shutdown-init ──> [Draining] ──drained──> [Terminated]
                               ^
  [Idle] ──── shutdown-init ───┘
  [Paused] ── shutdown-init ───┘

  ─────────────── Heartbeat Failure Path ──────────────────────────────────────────

  [Idle]   ─┐
  [Busy]   ─┤──> heartbeat-timeout ──> [Offline] ──reconnect-within-5min──> [Idle]
  [Paused] ─┘                               │
                                       no-reconnect
                                            │
                                            v
                                      [Terminated]

  ─────────────────────────────────────────────────────────────
  ACTIVE STATES           │  TERMINAL STATES
  ─────────────────────────────────────────────────────────────
  Registering             │  Terminated
  Idle                    │
  Busy                    │  RECOVERY STATE
  Paused                  │  Offline (time-limited; resolves to
  Draining                │  Idle or Terminated)
  ─────────────────────────────────────────────────────────────
```

### 2.2 State Definitions Table

| State | Entry Conditions | Exit Conditions | Actions Allowed |
|---|---|---|---|
| **Unregistered** | Default state; worker process started but not yet authenticated | Registration request sent with valid API key and capability manifest | Register (send registration request) |
| **Registering** | Registration request received by platform; validation in progress | Platform accepts (→ Idle) or rejects (→ Unregistered) | Await response; re-register on rejection |
| **Idle** | Registration accepted; or task completed; or task paused and worker freed; or reconnect after Offline | Task assigned; or shutdown initiated; or heartbeat timeout | Accept task assignment; send heartbeat; initiate shutdown |
| **Busy** | Task assigned and accepted; execution underway | Task completes; task fails; task paused; shutdown initiated; heartbeat timeout | Send progress updates; send heartbeat; signal task.complete / task.fail / task.pause; accept emergency stop |
| **Paused** | Running task paused by engineer or system; worker holds task context | Resume signal received; shutdown initiated; heartbeat timeout | Hold task context; send heartbeat; accept resume or cancel signal |
| **Draining** | Shutdown initiated from Idle, Busy, or Paused; worker finishing in-flight work | All in-flight tasks completed or safely handed off | Complete current task; reject new assignments; report drain progress |
| **Offline** | Heartbeat not received within the 90-second window | Reconnect within 5 minutes (→ Idle); timeout expires without reconnect (→ Terminated) | Reconnect; none (platform-managed state) |
| **Terminated** | Drain completed; or Offline with no reconnect; or forced termination | None (terminal) | None — record is immutable |

### 2.3 Transition Table

| From | To | Trigger | Guard | Side Effects |
|---|---|---|---|---|
| Unregistered | Registering | register | Valid API key; capability manifest provided; platform capacity available | WorkerCapability records staged; registration_started_at stamped |
| Registering | Idle | accepted | Platform validates capabilities; no duplicate worker_id | WorkerCapability records committed; WorkerResource allocated; last_seen_at initialized; WorkerRegistered event emitted |
| Registering | Unregistered | rejected | Invalid capabilities; duplicate registration; platform at capacity | Rejection reason logged; worker must re-register with corrected manifest |
| Idle | Busy | assigned | Worker is Idle; task type matches WorkerCapability; WorkerResource available | WorkerResource decremented; task assignment recorded; task state → Assigned |
| Idle | Draining | shutdown-init | Shutdown signal received; no in-flight tasks | Draining state entered immediately; no task reassignment |
| Idle | Offline | heartbeat-timeout | No heartbeat received for > 90 seconds | In-flight task assignments (none for Idle) reviewed; alert emitted; WorkerHeartbeatMissed event |
| Busy | Idle | task-done | Worker signals task.complete or task.fail | WorkerResource incremented; task state updated; WorkerAvailable event emitted |
| Busy | Paused | task-paused | Engineer or system issues pause; worker acknowledges | Worker holds task execution context in memory; task state → Paused |
| Busy | Draining | shutdown-init | Shutdown signal received; worker is mid-task | Worker completes current task before draining; new assignments rejected |
| Busy | Offline | heartbeat-timeout | No heartbeat for > 90 seconds while task Running | Task state → Failed (timeout); WorkerCapacity restored; alert emitted |
| Paused | Busy | resume | Resume signal received; worker still holds task context | Task state → Running; ExecutionSession state → Running |
| Paused | Draining | shutdown-init | Shutdown signal received; task context surrendered | Task state → Failed or re-queued depending on retry policy |
| Paused | Offline | heartbeat-timeout | No heartbeat for > 90 seconds while Paused | Task state → Failed; context lost; WorkerCapacity restored |
| Draining | Terminated | drained | All in-flight work completed or handed off; drain confirmed | WorkerCapability records deactivated; WorkerResource freed; WorkerTerminated event emitted |
| Offline | Idle | reconnect-within-5min | Worker reconnects within 5-minute grace period; sends valid heartbeat | last_seen_at updated; WorkerReconnected event emitted; capacity restored |
| Offline | Terminated | no-reconnect | 5-minute grace period expires without reconnect | WorkerCapability records deactivated; WorkerResource freed; any lingering task assignments failed |

---

## 3. Workspace State Machine

### 3.1 ASCII State Diagram

```
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                         WORKSPACE LIFECYCLE                                     │
  └─────────────────────────────────────────────────────────────────────────────────┘

  [Pending] ──provision──> [Provisioning] ──ready──> [Active] ──task-complete──> [Idle]
                                  │                      │                           │
                               error                     │ task-done-no-demand        │ new-task
                                  │                      │                           │
                                  v                      v                           v
                            [Failed] <─── (stays on max retries) ──         [Active] (loop)
                                  │                                              │
                               retry                                             │
                                  │                                              │
                                  v                                              │
                            [Pending]                                            │
                                                                                 │ timeout-15min
  [Idle] ──timeout-15min──> [Archiving] ──cleanup-done──> [Archived]  <─────────┘
                                                               ^
  [Active] ──task-done-no-demand──> [Archiving] ──cleanup-done─┘

  ─────────────────────────────────────────────────────────────
  ACTIVE STATES           │  TERMINAL STATES
  ─────────────────────────────────────────────────────────────
  Pending                 │  Archived
  Provisioning            │  Failed (after max retries)
  Active                  │
  Idle                    │
  Archiving               │
  ─────────────────────────────────────────────────────────────
```

### 3.2 State Definitions Table

| State | Entry Conditions | Exit Conditions | Allowed Actions | Max Duration | On Timeout |
|---|---|---|---|---|---|
| **Pending** | Workspace requested by ExecutionQueue or worker; resources not yet allocated | Provisioning begins | Cancel, View | 5 minutes | Fail with resource-unavailable reason |
| **Provisioning** | Provisioning job dispatched; resource allocation in progress | Workspace ready signal received; or provisioning error | Cancel, View | 10 minutes | → Failed; log provisioning error |
| **Active** | Workspace ready and task assigned; worker is executing | Task completes; task fails; no further demand | View, Lock (WorkspaceLock), Force-archive | Per task SLA (default 4 hours) | → Archiving with WorkspaceForceArchived event |
| **Idle** | Task completed or failed; workspace still warm; may receive another task | New task assigned (→ Active); 15-minute idle timeout elapses | View, Force-archive | 15 minutes | → Archiving automatically |
| **Archiving** | Cleanup job dispatched; artifacts being saved to cold storage | Cleanup complete | View | 30 minutes | Force-complete archival; log incomplete cleanup |
| **Archived** | All artifacts saved; workspace resources fully released | None (terminal) | View, Export | None | N/A |
| **Failed** | Provisioning error occurred; or max retries exceeded | Retry (→ Pending); or remains Failed | Retry, View, Force-archive | None | N/A |

### 3.3 Transition Table

| From | To | Trigger | Guard | Side Effects | Events Published |
|---|---|---|---|---|---|
| Pending | Provisioning | provision | Resources available in target cluster; no WorkspaceLock conflict | Resource slots reserved; provisioning_started_at stamped | WorkspaceProvisioning |
| Pending | Failed | timeout | 5-minute pending window exceeded | Resource reservation released; error logged | WorkspaceProvisioningFailed |
| Provisioning | Active | ready | Provisioning job reports success; health check passes | Workspace URL and credentials recorded; ready_at stamped; ExecutionSession transitions to Running | WorkspaceReady |
| Provisioning | Failed | error | Provisioning job reports failure; or 10-minute timeout | Error reason stored; retry_count incremented | WorkspaceProvisioningFailed |
| Failed | Pending | retry | retry_count < max_retries (default 3); engineer or scheduler initiates | retry_count incremented; backoff applied | WorkspaceRetrying |
| Active | Idle | task-complete | Task finishes (Completed or Failed); no new task immediately queued | Worker state → Idle; idle_since stamped; idle timer started | WorkspaceIdle |
| Active | Archiving | task-done-no-demand | Task finishes; ExecutionQueue has no pending tasks for this workspace type | Archiving job dispatched; archiving_started_at stamped | WorkspaceArchiving |
| Active | Archiving | force-archive | Admin issues force-archive; or SLA timeout exceeded | In-flight task → Failed; archiving job dispatched | WorkspaceForceArchived |
| Idle | Active | new-task | New task assigned within 15-minute idle window; worker available | idle timer cancelled; WorkspaceLock created; task state → Assigned | WorkspaceActivated |
| Idle | Archiving | timeout-15min | 15-minute idle window elapses with no new task | Archiving job dispatched; archiving_started_at stamped | WorkspaceArchiving |
| Archiving | Archived | cleanup-done | Cleanup job completes; artifacts confirmed in cold storage | Resources fully released; archived_at stamped | WorkspaceArchived |
| Archiving | Archived | force-complete | 30-minute archiving timeout; admin override | Partial cleanup logged; resources released regardless | WorkspaceArchived |

---

## 4. ReleaseCandidate State Machine

### 4.1 ASCII State Diagram

```
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                    RELEASECANDIDATE LIFECYCLE                                   │
  └─────────────────────────────────────────────────────────────────────────────────┘

  [Draft] ──submit──> [UnderReview] ──approved──> [Approved] ──stage──> [Staged]
                            │                                               │
                      changes-requested                               pipeline-success
                            │                                               │
                            v                                               v
                         [Draft]                                       [Released]
                            │                                               │
                         rejected ──> (rejection recorded in              production-issue
                                       UnderReview; not a                   │
                                       separate state; candidate            v
                                       returned to Draft with           [RolledBack]
                                       rejection reason)

  [Staged] ──pipeline-fail──> [RolledBack]

  ─────────────────────────────────────────────────────────────
  TERMINAL STATES
  ─────────────────────────────────────────────────────────────
  Released     — successful production deployment
  RolledBack   — pipeline failure or production issue reversed deployment
  ─────────────────────────────────────────────────────────────
```

### 4.2 State Definitions Table

| State | Entry Conditions | Exit Conditions | Allowed Actions | Max Duration | On Timeout |
|---|---|---|---|---|---|
| **Draft** | ReleaseCandidate created; or returned from UnderReview with changes requested | Submit for review | Edit bundle, Add/remove tasks, Comment, Attach notes, Submit | None | N/A |
| **UnderReview** | Submit triggered; all linked tasks are in Completed or Released state | Reviewer approves, requests changes, or rejects | Approve, Request changes, Reject (returns to Draft with reason), Comment | 48 hours | Escalate to release manager; stay UnderReview |
| **Approved** | Reviewer approved; all review conditions met | Stage trigger issued by release manager | Stage, Revoke approval (→ Draft), Comment | 24 hours | Notify release manager; stay Approved |
| **Staged** | Stage triggered; deployment pipeline dispatched | Pipeline success (→ Released); pipeline failure (→ RolledBack) | View, Monitor pipeline, Abort pipeline (→ RolledBack) | Pipeline SLA (default 60 minutes) | → RolledBack; log pipeline timeout |
| **Released** | PipelineRun reports success; deployment verified in production | Production issue detected (→ RolledBack) | View, Export, Initiate rollback | None | N/A |
| **RolledBack** | Pipeline failure from Staged; or production issue from Released | None (terminal) | View, Post-mortem, Clone as new Draft | None | N/A |

### 4.3 Transition Table

| From | To | Trigger | Actor | Guard Conditions | Side Effects | Events Published |
|---|---|---|---|---|---|---|
| Draft | UnderReview | submit | Release Manager | All linked tasks in Completed or Released state; ReleaseBundle has at least one TaskArtifact; no open blocking issues | submitted_at stamped; reviewer notified | ReleaseCandidateSubmitted |
| UnderReview | Approved | approved | Reviewer | Reviewer has Release Reviewer role; all review checklist items confirmed | approved_at stamped; approved_by recorded | ReleaseCandidateApproved |
| UnderReview | Draft | changes-requested | Reviewer | Review comments attached | Returned to Draft with review comments; submitter notified | ReleaseCandidateChangesRequested |
| UnderReview | Draft | rejected | Reviewer | Rejection reason provided | Rejection reason recorded in Draft; submitter notified; candidate may be revised or discarded | ReleaseCandidateRejected |
| Approved | Staged | stage | Release Manager | PipelineRun not already active for this candidate; staging environment available | PipelineRun created; deployment pipeline dispatched; staged_at stamped | ReleaseCandidateStaged, PipelineRunStarted |
| Approved | Draft | revoke | Release Manager | Approval not yet acted upon (still in Approved state) | Approval revoked; candidate returned to Draft for revision | ReleaseCandidateApprovalRevoked |
| Staged | Released | pipeline-success | System (PipelineRun) | PipelineRun reports exit code 0; all smoke tests pass; deployment verification confirmed | released_at stamped; linked tasks transition to Released; ReleaseBundle frozen | ReleaseCandidateReleased, TaskReleased (per task) |
| Staged | RolledBack | pipeline-fail | System (PipelineRun) | PipelineRun reports failure or timeout | Rollback procedure executed; rollback_reason recorded; incident created | ReleaseCandidateRolledBack |
| Staged | RolledBack | abort-pipeline | Release Manager | Pipeline still running; release manager issues abort | Pipeline aborted; rollback executed; reason recorded | ReleaseCandidateRolledBack |
| Released | RolledBack | production-issue | Release Manager / Incident System | Production issue confirmed; rollback decision approved | Rollback executed; rollback_at stamped; incident linked | ReleaseCandidateRolledBack |

---

## 5. ExecutionSession State Machine

### 5.1 ASCII State Diagram

```
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                      EXECUTIONSESSION LIFECYCLE                                 │
  └─────────────────────────────────────────────────────────────────────────────────┘

  [Initializing] ──workspace-ready──> [Running] ──task.complete-received──> [Completing]
                                           │                                       │
                                        pause                              all-artifacts-saved
                                           │                                       │
                                      [Paused]                               [Completed]
                                           │
                                        resume
                                           │
                                           v
                                       [Running]

  [Running] ──task.fail──> [Failed]

  ─────────────── Emergency Stop (from any non-terminal state) ────────────────────

  [Initializing] ─┐
  [Running]       ─┤──> emergency-stop ──> [Aborted]
  [Paused]        ─┘
  [Completing]    ─┘

  ─────────────────────────────────────────────────────────────
  TERMINAL STATES
  ─────────────────────────────────────────────────────────────
  Completed   — session ended with verified artifact delivery
  Failed      — session ended with unrecoverable error
  Aborted     — session forcibly terminated by emergency stop
  ─────────────────────────────────────────────────────────────
```

### 5.2 State Definitions Table

| State | Entry Conditions | Exit Conditions | Allowed Actions | Max Duration | On Timeout |
|---|---|---|---|---|---|
| **Initializing** | Task accepted by worker; workspace provisioning confirmed | Workspace health check passes (→ Running); emergency stop issued; initialization timeout | Emergency stop | 5 minutes | → Aborted; log initialization failure; task → Failed |
| **Running** | Workspace ready; task execution underway | task.complete or task.fail received; pause issued; emergency stop | Receive heartbeats, log execution output, pause, emergency stop | Per task SLA (default 4 hours) | → Failed; task state → Failed |
| **Paused** | Pause trigger received while Running; worker holds context | Resume trigger received; emergency stop | Resume, emergency stop | 24 hours | → Aborted; task state → Cancelled |
| **Completing** | task.complete signal received; artifact upload in progress | All artifacts confirmed saved (→ Completed); emergency stop | Emergency stop | 15 minutes | → Aborted; partial artifacts flagged; task → Failed |
| **Completed** | All TaskArtifacts saved and checksums verified | None (terminal) | View, Export logs | None | N/A |
| **Failed** | task.fail received from worker; or execution timeout; or initialization failure | None (terminal) | View, Export logs | None | N/A |
| **Aborted** | Emergency stop issued from any non-terminal state | None (terminal) | View, Export partial logs | None | N/A |

### 5.3 Transition Table

| From | To | Trigger | Actor | Guard Conditions | Side Effects | Events Published |
|---|---|---|---|---|---|---|
| Initializing | Running | workspace-ready | System (Workspace) | Workspace state = Active; health check HTTP 200; worker acknowledged start | session_started_at stamped; log stream opened; task state → Running | ExecutionSessionStarted |
| Initializing | Aborted | emergency-stop | Engineer / Admin | Emergency stop issued before workspace ready | Workspace archiving triggered; task state → Failed | ExecutionSessionAborted |
| Initializing | Aborted | timeout | System | 5-minute initialization window exceeded | Workspace archiving triggered; task state → Failed; worker state → Idle | ExecutionSessionAborted, TaskFailed |
| Running | Paused | pause | Engineer / System | Task in Paused state; worker acknowledges pause signal | paused_at stamped; log stream suspended | ExecutionSessionPaused |
| Running | Completing | task.complete-received | EngineeringWorker | Worker sends task.complete signal; exit code 0 | Artifact upload job dispatched; completing_at stamped | ExecutionSessionCompleting |
| Running | Failed | task.fail | EngineeringWorker | Worker sends task.fail with reason and exit code | failure_reason recorded; failed_at stamped; worker state → Idle; workspace state → Idle | ExecutionSessionFailed |
| Running | Aborted | emergency-stop | Engineer / Admin | Emergency stop issued while Running | Worker receives abort signal; worker state → Idle; workspace → Archiving; task → Cancelled | ExecutionSessionAborted |
| Running | Aborted | timeout | System | SLA timeout exceeded with no completion signal | Worker receives timeout signal; worker state → Idle; workspace → Archiving; task → Failed | ExecutionSessionAborted, TaskFailed |
| Paused | Running | resume | Engineer / System | Task state = Running (re-set on resume); worker still holds context | paused_duration recorded; log stream resumed | ExecutionSessionResumed |
| Paused | Aborted | emergency-stop | Engineer / Admin | Emergency stop issued while Paused | Worker receives abort; context discarded; workspace → Archiving; task → Cancelled | ExecutionSessionAborted |
| Paused | Aborted | timeout | System | 24-hour pause limit exceeded | Treated as emergency stop; task → Cancelled | ExecutionSessionAborted, TaskCancelled |
| Completing | Completed | all-artifacts-saved | System (artifact job) | All TaskArtifact checksums verified; storage confirmed | completed_at stamped; log stream closed; worker state → Idle; workspace state → Idle | ExecutionSessionCompleted |
| Completing | Aborted | emergency-stop | Engineer / Admin | Emergency stop during artifact upload | Partial artifacts flagged as incomplete; task → Failed | ExecutionSessionAborted, TaskFailed |
| Completing | Aborted | timeout | System | 15-minute completing window exceeded | Partial artifacts flagged; task → Failed; worker → Idle | ExecutionSessionAborted, TaskFailed |

---

## 6. Cross-State-Machine Dependencies

### 6.1 Dependency Overview

The five state machines do not operate in isolation. EngineeringTask is the **driving state machine**: its transitions cascade required state changes into EngineeringWorker, Workspace, and ExecutionSession. ReleaseCandidate operates independently but consumes the terminal output of completed EngineeringTask records.

```
  EngineeringTask (driver)
        │
        ├──> EngineeringWorker (capacity enforcer)
        ├──> Workspace (environment provider)
        └──> ExecutionSession (execution context)

  EngineeringTask (terminal: Completed)
        │
        └──> ReleaseCandidate (aggregator)
```

### 6.2 Task Assigned — Cascade

When an EngineeringTask transitions from **Queued → Assigned**:

1. The matched **EngineeringWorker** transitions **Idle → Busy**. WorkerResource is decremented. The worker can no longer accept new assignments.
2. The target **Workspace** transitions **Pending → Provisioning** (if a new workspace is required) or **Idle → Active** (if a warm workspace is reused). A WorkspaceLock is created.
3. An **ExecutionSession** is created in **Initializing** state, linked to the task, worker, and workspace.

No task can be assigned unless a worker is Idle and either a warm Workspace is available or provisioning capacity exists. Guard conditions across all three machines must pass simultaneously — the assignment is atomic.

### 6.3 Task Starts — Cascade

When an EngineeringTask transitions **Accepted → Running** (worker signals start):

1. The **ExecutionSession** transitions **Initializing → Running**.
2. The **Workspace** is confirmed **Active**. The WorkspaceLock is held for the duration.
3. The **EngineeringWorker** remains **Busy** and begins emitting heartbeats.

### 6.4 Task Completes — Cascade

When an EngineeringTask transitions **Running → Completed** (worker signals task.complete):

1. The **ExecutionSession** transitions **Running → Completing → Completed** as artifacts are saved.
2. The **EngineeringWorker** transitions **Busy → Idle**. WorkerResource is incremented. The worker can accept new assignments.
3. The **Workspace** transitions **Active → Idle**. The WorkspaceLock is released. The 15-minute idle timer starts.
4. If no new tasks are queued for this workspace type within the idle window, the Workspace transitions **Idle → Archiving → Archived**.

### 6.5 Task Fails — Cascade

When an EngineeringTask transitions **Running → Failed**:

1. The **ExecutionSession** transitions **Running → Failed**. Failure reason and exit code are recorded.
2. The **EngineeringWorker** transitions **Busy → Idle**. Capacity is restored immediately.
3. The **Workspace** transitions **Active → Idle** (and subsequently **Archiving → Archived** if no demand).

If retry is issued (**Failed → Queued**), the cycle restarts at the assignment step. A new ExecutionSession is created for each retry — sessions are not reused.

### 6.6 Task Paused — Cascade

When an EngineeringTask transitions **Running → Paused**:

1. The **ExecutionSession** transitions **Running → Paused**.
2. The **EngineeringWorker** transitions **Busy → Paused**. The worker holds task execution context but does not accept new assignments.
3. The **Workspace** remains **Active**. The WorkspaceLock is held.

On resume, the reverse cascade restores all three machines to their Running/Busy/Active states.

### 6.7 Emergency Stop — Full Cascade

When an emergency stop is issued from any non-terminal state:

1. The **ExecutionSession** transitions to **Aborted**.
2. The **EngineeringWorker** transitions to **Idle** (context discarded).
3. The **Workspace** transitions to **Archiving** (WorkspaceLock released).
4. The **EngineeringTask** transitions to **Cancelled** (or **Failed** if the stop was system-initiated due to timeout).

### 6.8 ReleaseCandidate Consumption

A **ReleaseCandidate** in **Draft** state aggregates **EngineeringTask** records that are in **Completed** or **Released** state. It cannot include tasks in any active state. When a ReleaseCandidate transitions to **Released**, all linked tasks transition from **Completed → Released**. The ReleaseCandidate does not interact with EngineeringWorker or Workspace state machines — it operates only on already-closed task records.

---

## 7. State Machine Implementation Notes

### 7.1 Laravel Implementation Without External Packages

All state machines are implemented as pure PHP within the DDD module architecture. No external state machine packages are used. The approach uses explicit guard functions, event-driven side effects, and a dedicated audit table.

**State is stored on the domain model:**

Each entity stores its current state in a non-nullable `status` column with a database check constraint enumerating valid state values. The column never holds an unknown value.

**Transition logic lives in a dedicated service:**

Each entity has a corresponding `*StateMachine` service class in `Domain/Services/`. The service exposes one method per valid trigger (e.g., `queue()`, `assign()`, `accept()`). Each method:

1. Verifies the entity is in the correct current state.
2. Evaluates guard conditions as pure functions (no I/O inside guards).
3. Executes the state change within a database transaction.
4. Dispatches side effects as domain events after the transaction commits.

```
TaskStateMachine::queue(EngineeringTask $task, array $context): void
TaskStateMachine::assign(EngineeringTask $task, EngineeringWorker $worker): void
TaskStateMachine::accept(EngineeringTask $task, EngineeringWorker $worker): void
TaskStateMachine::start(EngineeringTask $task): void
TaskStateMachine::complete(EngineeringTask $task, array $artifactPayload): void
TaskStateMachine::fail(EngineeringTask $task, string $reason, int $exitCode): void
TaskStateMachine::pause(EngineeringTask $task, string $initiatedBy): void
TaskStateMachine::resume(EngineeringTask $task): void
TaskStateMachine::cancel(EngineeringTask $task, string $initiatedBy): void
TaskStateMachine::retry(EngineeringTask $task): void
TaskStateMachine::release(EngineeringTask $task, ReleaseCandidate $candidate): void
TaskStateMachine::archive(EngineeringTask $task): void
```

### 7.2 Guard Conditions as Pure Functions

Guards are static methods that receive only value objects and return bool. They have no database calls, no I/O, and no side effects. This makes them trivially testable and safe to call in validation layers before attempting a transition.

```
Guards::taskIsAssignable(EngineeringTask $task, EngineeringWorker $worker): bool
Guards::workerHasCapabilityFor(EngineeringWorker $worker, string $taskType): bool
Guards::workspaceIsAvailable(Workspace $workspace): bool
Guards::retryLimitNotExceeded(EngineeringTask $task, int $maxRetries = 3): bool
Guards::releaseBundleIsComplete(ReleaseCandidate $candidate): bool
```

If any guard returns false, the state machine method throws a `InvalidTransitionException` with a machine-readable reason code. The controller catches this and returns a structured 422 response.

### 7.3 Side Effects via Domain Events

Side effects (worker capacity changes, workspace state changes, notifications, queue updates) are never called directly inside the transition method. Instead, the transition dispatches a domain event, and dedicated listeners handle each side effect independently.

This pattern ensures:

- The transaction commits the state change atomically before any side effect runs.
- Side effects can fail independently without rolling back the state change.
- New side effects are added by registering new listeners, not by modifying the state machine.

Events are dispatched using `afterCommit: true` dispatch strategy so listeners only fire after the database transaction succeeds.

### 7.4 Audit via task_state_transitions Table

Every state change is recorded in the `task_state_transitions` table. This table is append-only and never updated or soft-deleted. It provides a complete, ordered audit trail for every entity.

**Table columns:**

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Unique transition record |
| `entity_type` | string | EngineeringTask, EngineeringWorker, Workspace, ReleaseCandidate, ExecutionSession |
| `entity_id` | UUID | FK to the entity |
| `company_id` | UUID | Tenant isolation |
| `from_state` | string | State before transition |
| `to_state` | string | State after transition |
| `trigger` | string | Machine-readable trigger name (e.g., `assign`, `complete`) |
| `actor_type` | string | Engineer, EngineeringWorker, System, Admin |
| `actor_id` | UUID | ID of the actor |
| `reason` | text | Optional human-readable reason (required for cancel, fail, reject) |
| `context` | jsonb | Additional transition context (retry count, exit code, artifact count, etc.) |
| `transitioned_at` | timestamp | Exact UTC timestamp of the transition |

Indexes: `(entity_type, entity_id)` for per-entity history; `(company_id, transitioned_at)` for tenant-scoped audit queries.

### 7.5 Invalid Transition Handling

Attempting an invalid transition (wrong current state, failed guard, business rule violation) raises `InvalidTransitionException`. The exception carries:

- `current_state` — the entity's actual current state
- `attempted_transition` — the trigger that was called
- `reason_code` — machine-readable failure reason (e.g., `GUARD_RETRY_LIMIT_EXCEEDED`, `GUARD_WORKER_CAPABILITY_MISMATCH`)
- `reason_message` — human-readable explanation for logging and API response

No partial state changes are written on an invalid transition. The entity remains unchanged.

### 7.6 Concurrency and Locking

State transitions use optimistic locking via a `state_version` integer column on each entity. The transition service reads the entity, increments `state_version`, and performs the update with a `WHERE state_version = :expected` clause. If another process has already modified the entity, the update affects zero rows and a `ConcurrentModificationException` is raised. The caller may retry with fresh state.

For high-contention scenarios (many workers competing for the same task), the assignment transition uses pessimistic locking (`SELECT FOR UPDATE`) scoped to the task record only. This prevents double-assignment without locking the entire worker or workspace tables.

---

*Document frozen: 2026-07-22. Changes require Engineering Cloud ADR amendment.*
