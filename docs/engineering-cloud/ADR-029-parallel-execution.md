# ADR-029 — Parallel Execution

## Status: Approved | Date: 2026-07-22

---

## 1. Context

Engineering Cloud runs multiple EngineeringTask instances concurrently across multiple EngineeringWorker instances. Without a formal parallel execution model, concurrent task execution risks file conflicts, resource overcommit, workspace corruption, and starvation of lower-priority work.

This ADR defines the complete parallel execution model: what may run in parallel, how the WorkerScheduler arbitrates assignments, how priority queues are structured, how Workspace reservations and WorkspaceLock acquisition are handled, and how deadlocks and failures are detected and recovered.

All entity names, state values, and event names follow the canonical vocabulary established for Engineering Cloud.

---

## 2. Parallelism Model

### 2.1 What Can Run in Parallel

Two or more EngineeringTask instances may execute concurrently when all of the following conditions hold:

- No declared TaskDependency relationship exists between them (neither directly nor transitively).
- Their target modules are distinct — no shared module root path is written by both tasks simultaneously.
- Their declared file write targets do not intersect (evaluated by the conflict detection algorithm defined in Section 5.2).
- No task holds or is waiting on a WorkspaceLock that the other task requires.
- The company parallelism limit for the applicable queue tier has not been reached.

### 2.2 What Cannot Run in Parallel

Two or more tasks must not execute concurrently when any of the following conditions applies:

- A TaskDependency exists: a task that declares another task as a dependency cannot enter Running state until that dependency reaches Completed.
- A file conflict is detected: both tasks declare overlapping write targets in the same branch.
- Both tasks require the same WorkspaceLock (same workspace scope).
- The company-level concurrency limit for the relevant queue tier is already at capacity.
- One task requires a specific WorkerCapability tier that is fully occupied by existing Running tasks.

---

## 3. Worker Scheduler Architecture

### 3.1 Scheduler Design

A single active scheduler instance is maintained at all times via leader election. Leader election uses Redis `SETNX` with a configurable TTL (default: 30 seconds). Any scheduler instance that cannot acquire the leader key skips that scheduling cycle entirely — it does not attempt partial assignment.

The scheduler runs on a fixed interval of 5 seconds.

**Scheduling algorithm — executed each cycle:**

**Step 1:** Attempt to acquire the scheduler lock via Redis `SETNX`. If the lock cannot be acquired, another scheduler instance is active. Skip this cycle and wait for the next interval.

**Step 2:** Fetch all EngineeringTask records in the Queued state, ordered by `priority_score` descending. Include only tasks whose `company_id` corresponds to a tenant with an active subscription and at least one Idle EngineeringWorker registered.

**Step 3:** For each candidate task, evaluate the following checks in sequence. If any check fails, skip the task and continue to the next:

- All TaskDependencies for this task are in the Completed state.
- At least one EngineeringWorker with the required `WorkerCapability` tier is in the Idle state.
- No conflict exists between this task's file write targets and any currently Running task's file write targets (see Section 5.2).
- The company's parallelism limit for the applicable queue tier has not been reached (see Section 4.1).

If all checks pass, assign the task: transition the EngineeringTask to Assigned, transition the selected EngineeringWorker to Busy, create an ExecutionSession in Initializing state, and reserve the Workspace slot.

**Step 4:** Release the scheduler lock unconditionally (even if an error occurred during Step 3).

**Step 5:** Publish scheduling metrics to the observability layer (see Section 11).

### 3.2 Priority Score Formula

Each ExecutionQueue item carries a computed `priority_score` used for ordering within the scheduler's candidate list. The score is recalculated on each scheduler cycle.

```
priority_score = (task_priority × 100) + (seconds_in_queue ÷ 60)
```

**Starvation bonus:** For each 5 full minutes a task has spent in the Queued state without being assigned, +1 is added to its `priority_score`. This bonus accumulates without an upper bound until the task is assigned or the 2-hour starvation escalation threshold is reached (see Section 3.3).

**Dependency penalty:** Any task that is blocked by an incomplete TaskDependency receives a penalty of −1000 applied to its `priority_score`. This ensures dependency-blocked tasks are never selected during normal scheduling cycles, while still appearing in the ordered list for observability purposes.

### 3.3 Starvation Prevention

The starvation bonus defined in Section 3.2 ensures that low-priority tasks gradually accumulate enough `priority_score` to be selected ahead of newly enqueued lower-priority tasks.

If a task has waited in the Queued state for longer than 2 hours without assignment:

- An escalation alert is sent to the EngineeringLead.
- The task's queue tier is temporarily promoted by one level for the current scheduling cycle only (does not persist).
- A `TaskStarvationEscalated` event is published.

---

## 4. Priority Queue Design

### 4.1 Queue Tiers

Four tiers are defined. Each tier enforces a per-company concurrency ceiling that the scheduler respects during Step 3 of the scheduling algorithm.

| Tier | Priority Range | Max Concurrent (per company) | Preemption |
|---|---|---|---|
| CRITICAL | 9–10 | 2 | May preempt NORMAL tasks |
| HIGH | 6–8 | 5 | None |
| NORMAL | 3–5 | 10 | None (default tier) |
| LOW | 1–2 | 3 | Background only; no preemption |

**Preemption policy for CRITICAL tier:** If a CRITICAL task is ready for assignment but no Idle worker exists, and a NORMAL task is currently Running on a compatible worker, the scheduler may preempt the NORMAL task. Preemption transitions the NORMAL task from Running back to Queued, releases its WorkspaceLock, and marks the ExecutionSession as Aborted with reason `preempted_by_critical`. The CRITICAL task is then assigned to the freed worker.

Preemption is never applied to HIGH or LOW tier tasks. LOW tier tasks are scheduled only when no CRITICAL, HIGH, or NORMAL tasks are waiting.

### 4.2 Queue Persistence

The ExecutionQueue is backed by a dedicated database table. The database record is the authoritative source of truth for all queue state, including `priority_score`, `status`, and assignment history.

Redis is used exclusively for real-time scheduling signals (leader election lock, cycle trigger notifications, and metric counters). Redis data is considered ephemeral and non-authoritative. If Redis is unavailable, the scheduler falls back to polling the database table directly, with a degraded cycle interval of 15 seconds and an alert published to the observability layer.

### 4.3 Queue Item Schema

Each ExecutionQueue row contains the following fields:

| Field | Description |
|---|---|
| `id` | UUID primary key |
| `task_id` | Foreign key to EngineeringTask |
| `company_id` | Tenant isolation key |
| `priority` | Raw integer priority value (1–10) |
| `priority_score` | Computed score (recalculated each cycle) |
| `tier_required` | Queue tier label: CRITICAL, HIGH, NORMAL, or LOW |
| `capabilities_required` | JSON array of required WorkerCapability identifiers |
| `status` | Current queue item state: Pending, Reserved, Assigned, Expired, Cancelled |
| `enqueued_at` | Timestamp when the item was first inserted |
| `reserved_at` | Timestamp when workspace reservation was acquired |
| `assigned_at` | Timestamp when the worker assignment completed |
| `deadline` | Optional hard deadline; items past deadline are escalated |
| `attempts` | Count of assignment attempts made |
| `last_attempt_at` | Timestamp of the most recent assignment attempt |
| `failure_reason` | Free-text reason if the most recent attempt failed |

---

## 5. Workspace Reservation

### 5.1 Reservation Flow

Workspace reservation is performed as part of task assignment during Step 3 of the scheduler algorithm, after all eligibility checks pass and before the task transitions to Assigned.

The reservation sequence:

1. Reserve a Workspace slot for the task: set the Workspace state to Provisioning if it was Idle, or confirm capacity if the Workspace is already Active.
2. Acquire the WorkspaceLock for the target scope using optimistic locking (see Section 5.3).
3. If the WorkspaceLock cannot be acquired: increment `attempts` on the ExecutionQueue item, record `failure_reason` as `workspace_unavailable`, and schedule a retry after 30 seconds.
4. If all three acquisition attempts fail: leave the task in Queued state with `failure_reason` set to `workspace_unavailable_after_retries`. The scheduler will attempt assignment again in a future cycle once the lock becomes available.

### 5.2 Conflict Detection Algorithm

File conflict detection is evaluated for every candidate task during Step 3 of the scheduler algorithm. The algorithm operates on declared file write targets stored in task metadata, supplemented by a pre-flight git diff estimation for tasks that declare broad module targets rather than explicit file lists.

**Step 1:** Load the candidate task's declared file write targets. If explicit targets are not declared, estimate targets from the task's module scope and the most recent git diff for that module in the active branch.

**Step 2:** Load the file write targets of all EngineeringTask records currently in the Running state within the same company and same branch.

**Step 3:** Compute the intersection of the candidate task's targets with each Running task's targets. If the intersection is non-empty for any Running task, a conflict is detected between the candidate and that Running task.

**Step 4:** Conflict resolution:

- If the candidate task has a lower `priority_score` than the conflicting Running task: the candidate remains Queued. No preemption occurs.
- If the candidate task has a higher `priority_score` than the conflicting Running task: the conflicting Running task is preempted only if it is in the NORMAL tier and the candidate is in the CRITICAL tier (per Section 4.1 preemption policy). Otherwise, the candidate waits.
- If `priority_score` values are equal: FIFO ordering determines priority — the task with the earlier `enqueued_at` timestamp proceeds; the other waits.

### 5.3 Locking Strategy

WorkspaceLock uses optimistic locking via a `version` integer field on the lock record. The scheduler reads the current version, performs its eligibility checks, and then issues an `UPDATE ... WHERE version = :expected_version`. If the row was modified concurrently, the update affects zero rows and the acquisition is treated as a failure — the scheduler retries as defined in Section 5.1.

During ExecutionQueue assignment, the scheduler issues a `SELECT FOR UPDATE` on the specific ExecutionQueue row being assigned. This prevents two concurrent scheduler instances (which should not exist under normal leader election, but may occur briefly during failover) from assigning the same item twice.

WorkspaceLock records carry a TTL. If a lock holder crashes without releasing the lock, a background process releases stale locks after the TTL expires (default TTL: 10 minutes). A `WorkspaceLockExpired` event is published when a stale lock is released.

---

## 6. Resource Limits

Resource capacity for each Workspace and EngineeringWorker is tracked in terms of CPU allocation units and RAM allocation units. The scheduler checks available capacity against the task's declared resource requirements before completing assignment.

**Overcommit policy:**

- CPU: 10% overcommit is permitted. The scheduler may assign tasks that would nominally exceed available CPU by up to 10% of total cluster capacity.
- RAM: 0% overcommit. The scheduler will not assign a task if doing so would exceed available RAM. The task remains Queued until sufficient RAM is freed.

Per-company resource limits are configurable by platform administrators and are enforced independently from the per-tier concurrency limits in Section 4.1. Both limits must pass for an assignment to proceed.

---

## 7. Deadlock Prevention

### 7.1 Deadlock Scenarios

Two deadlock classes are possible in the parallel execution model:

**Scenario A — Circular TaskDependency:** Task A declares Task B as a dependency, and Task B declares Task A as a dependency (directly or transitively). Both tasks remain Queued indefinitely because each waits for the other to reach Completed.

**Scenario B — WorkspaceLock contention:** Two tasks are each Ready for assignment but each requires a WorkspaceLock that the other holds. Neither can proceed; both retry and fail in each scheduler cycle.

### 7.2 Prevention Mechanisms

**For Scenario A:** The TaskDependency graph is constrained to be a directed acyclic graph (DAG). Cycle detection is enforced at task creation time. When a new TaskDependency is submitted, the system traverses the existing dependency graph from the declared dependency target and verifies that the requesting task is not reachable. If a cycle is detected, the dependency submission is rejected with a validation error and no TaskDependency record is created. A `TaskDependencyCycleRejected` event is published.

**For Scenario B:** WorkspaceLock TTL prevents indefinite lock holding. The scheduler uses total ordering by `priority_score` when resolving contention — the higher-scoring task is always preferred, which provides a consistent global ordering and prevents symmetric contention. Because the scheduler is single-active (via leader election), two tasks cannot be simultaneously selected for conflicting locks within a single cycle.

### 7.3 Deadlock Recovery

A dedicated deadlock detector runs as a background process every 60 seconds. It scans for the following conditions:

- Any set of EngineeringTask records in Queued state whose TaskDependency graph contains a cycle (should not occur given prevention, but included as a safety net for data integrity violations).
- Any group of tasks that have each failed workspace reservation more than 5 consecutive times within a 10-minute window, suggesting mutual WorkspaceLock contention.

When a deadlock is detected:

1. The task with the lowest `priority_score` among the deadlocked set is preempted: its ExecutionSession is set to Aborted, its WorkspaceLock is released, and it is returned to Queued with `failure_reason` set to `deadlock_recovery_preemption`.
2. A `DeadlockDetected` event is published with the full set of involved task IDs and the resolution action taken.
3. An alert is sent to the EngineeringLead.

---

## 8. File Locking

**Within a single Workspace:** Each Workspace is operated by a single EngineeringAgent at a time. No file-level locking is required within a workspace because concurrent writes from multiple agents to the same workspace are architecturally prevented — a Workspace may only have one Active ExecutionSession at any moment.

**Across Workspaces:** The conflict detection algorithm defined in Section 5.2 prevents concurrent write operations targeting the same files in the same branch across different workspaces. File-level OS locks are not used. Conflict resolution is handled entirely at the scheduler level before any agent begins writing.

---

## 9. Recovery from Parallel Execution Failures

When a Running task fails:

1. The EngineeringTask transitions from Running to Failed.
2. The ExecutionSession transitions from Running to Failed.
3. The WorkspaceLock is released unconditionally.
4. The Workspace slot is freed (Workspace transitions back to Idle if no other sessions are active).
5. The EngineeringWorker that was executing the task transitions from Busy to Idle.
6. All resources (CPU and RAM allocation units) assigned to the task are returned to the available pool.
7. TaskDependencies that were waiting on this task remain in Queued state. They are not automatically cancelled — the decision to cancel dependent tasks or retry the failed task is made by the EngineeringLead or by a configured retry policy.
8. A `TaskFailed` event is published with the failure reason and ExecutionSession ID.
9. The scheduler picks up the freed resources in the next cycle (within 5 seconds) and assigns new tasks as capacity allows.

---

## 10. Scaling Limits

Per-company concurrency limits are configurable by platform administrators independently for each queue tier. The defaults defined in Section 4.1 apply unless overridden.

Global cluster-level limits are enforced at the infrastructure layer and are not managed by the scheduler directly. The scheduler is informed of available worker capacity via EngineeringWorker heartbeat records and refuses to over-assign.

**Queue depth alerting thresholds:**

| Queue Depth (per company) | Action |
|---|---|
| Over 50 items | Alert sent to EngineeringLead via notification channel |
| Over 100 items | On-call page triggered; `QueueDepthCritical` event published |

Queue depth is measured as the total count of EngineeringTask records in the Queued state for a given `company_id` at the time of each scheduler cycle. Alerts are rate-limited to one per 15 minutes per company to prevent alert storms during burst periods.

---

## 11. Observability

The following metrics are emitted by the scheduler and conflict detection subsystems on each cycle and on each relevant event. All metrics are namespaced under `engineering_cloud.scheduler`.

| Metric | Description |
|---|---|
| `queue_depth_per_tier_per_company` | Gauge: current count of Queued tasks by tier and company_id |
| `scheduler_cycle_duration_ms` | Histogram: wall-clock duration of each full scheduler cycle |
| `conflict_detection_duration_ms` | Histogram: time spent in the conflict detection algorithm per cycle |
| `assignments_per_cycle` | Counter: number of tasks successfully assigned in each cycle |
| `skipped_dependency_blocked` | Counter: tasks skipped due to incomplete TaskDependencies |
| `skipped_conflict_detected` | Counter: tasks skipped due to file write conflict |
| `skipped_capacity_exhausted` | Counter: tasks skipped due to tier concurrency limit |
| `deadlock_rate` | Counter: number of deadlocks detected per hour |
| `starvation_events` | Counter: number of tasks that triggered starvation escalation |
| `average_queue_wait_ms_by_priority` | Histogram: time from `enqueued_at` to `assigned_at` segmented by priority value |
| `workspace_lock_acquisition_failures` | Counter: failed WorkspaceLock acquisition attempts |
| `preemptions_total` | Counter: NORMAL tasks preempted by CRITICAL tasks |
| `stale_lock_releases` | Counter: WorkspaceLock records released by TTL expiry |

All metrics are tagged with `company_id` and `tier` where applicable. Dashboards consuming these metrics should alert on `deadlock_rate > 0` and `average_queue_wait_ms_by_priority` exceeding tier-appropriate SLA thresholds.

---

## 12. Consequences

**Positive:**
- Single-active scheduler via leader election eliminates double-assignment races without requiring distributed locking on every task.
- Priority score formula with starvation bonus ensures fairness across priority levels over time.
- DAG enforcement at creation time eliminates circular dependency deadlocks before they can form.
- Database as source of truth for queue state provides durability across Redis restarts.

**Negative:**
- 5-second scheduler cycle introduces up to 5 seconds of latency between a task becoming eligible and its assignment. Acceptable for the Engineering Cloud use case; not suitable for sub-second latency requirements.
- Conflict detection based on declared file targets requires tasks to accurately declare their write scope. Tasks with underspecified targets may bypass conflict detection.
- Optimistic locking on WorkspaceLock may cause retries under high contention, increasing cycle duration.

**Mitigations:**
- File target estimation from git diff (Section 5.2) partially compensates for underspecified task metadata.
- Scheduler cycle duration metric (Section 11) provides early warning if retry overhead becomes significant.
