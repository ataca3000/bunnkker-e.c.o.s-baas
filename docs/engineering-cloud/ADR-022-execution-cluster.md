# ADR-022 — Execution Cluster

**Status:** Approved
**Date:** 2026-07-22
**Output Directory:** docs/engineering-cloud/

---

## 1. Context

The Engineering Cloud requires a reliable, observable, and scalable substrate for running EngineeringTask workloads. Tasks arrive from multiple companies, carry varying priority levels, demand different resource profiles, and must execute with strong isolation guarantees.

The Execution Cluster is the layer responsible for everything between "a task enters the ExecutionQueue" and "an ExecutionLog entry is written for the result." It manages the lifecycle of EngineeringWorker processes, the scheduling algorithm that matches tasks to workers, the allocation of Workspaces, enforcement of per-session resource limits, horizontal scaling of the cluster itself, and recovery from all categories of failure.

This ADR defines the canonical model for the Execution Cluster. All other Engineering Cloud ADRs that touch scheduling, worker management, or runtime resource allocation defer to this document.

### 1.1 Driving Requirements

- A task queued with Critical priority must reach a worker within 30 seconds under normal load.
- No company may starve another company's tasks indefinitely through high submission volume.
- A worker node failure must not cause permanent task loss — tasks must be recoverable to Queued state.
- Resource consumption (CPU, memory, disk) must be metered per task, per EngineeringAgent, and per company.
- The cluster must scale out automatically under load and scale in safely without disrupting active ExecutionSessions.
- Parallel execution per company is bounded and configurable to enforce fair resource allocation.

### 1.2 Canonical Entities Referenced

- **EngineeringTask** — the unit of work, with a canonical state machine (Draft → Queued → Assigned → Accepted → Running → Paused → Completed → Failed → Cancelled → Released → Archived).
- **EngineeringAgent** — the external autonomous bot that registers with the cluster, claims tasks, and drives execution.
- **EngineeringWorker** — the server-side execution slot that hosts one agent's work at a time.
- **ExecutionSession** — the runtime context created when a worker begins executing a task.
- **ExecutionQueue** — the ordered, prioritized queue of tasks waiting for a worker.
- **Workspace** — the isolated file-system and environment provisioned for an ExecutionSession.
- **WorkspaceLock** — a distributed lock that ensures only one session holds a workspace at any moment.
- **WorkerCapability** — a declared skill or toolset a worker supports (e.g., `php`, `node`, `docker`, `gpu`).
- **WorkerResource** — the current resource state of a worker (available CPU, memory, disk).
- **WorkerHeartbeat** — the periodic signal a worker sends to confirm it is alive and healthy.
- **ExecutionLog** — the append-only record of every event within an ExecutionSession.

---

## 2. Worker Model

### 2.1 Worker vs. Agent

These two entities are distinct and must not be conflated.

**EngineeringAgent** is an external autonomous process — a bot, a CI runner, or an AI agent — that authenticates with the cluster using a JWT credential, registers itself, and then picks up tasks. The agent is the actor; it has identity, capabilities, and a company affiliation. An agent's lifecycle is driven by external events: it can disconnect, reconnect, or be revoked.

**EngineeringWorker** is the server-side resource slot that the cluster manages. A worker represents a bounded execution environment: a set of CPU cores, a memory ceiling, a disk quota, and a declared set of WorkerCapabilities. Workers are provisioned and decommissioned by the cluster. A worker exists in the cluster's registry independently of any particular agent.

The relationship is: **one agent occupies one worker at a time.** When an agent claims a task, the scheduler assigns that agent to an available worker that satisfies the task's resource and capability requirements. The worker is then in Busy state for the duration of the ExecutionSession. When the session ends (Completed, Failed, or Aborted), the worker returns to Idle and the agent may claim another task.

This separation means:
- Worker capacity is tracked server-side and cannot be misreported by an agent.
- An agent that disconnects mid-task does not release its worker — the cluster detects the disconnection via WorkerHeartbeat timeout and initiates recovery.
- Workers can be pre-provisioned, warmed, and held in a pool before any agent connects.

### 2.2 Worker Tiers

All workers are classified into one of four tiers. The tier determines the resource envelope available to any ExecutionSession hosted on that worker. A task's `resource_spec` field in the ExecutionQueue item must match one of these tiers exactly — no fractional or interpolated tiers.

| Tier | CPU Cores | RAM | Disk | Intended Use Cases |
|---|---|---|---|---|
| **Micro** | 1 | 2 GB | 10 GB | Linting, formatting, schema validation, lightweight code generation, documentation tasks, small unit test suites |
| **Standard** | 2 | 4 GB | 20 GB | Full feature branch analysis, medium test suites, API contract generation, migration authoring, dependency audits |
| **Heavy** | 4 | 8 GB | 50 GB | Full test suite execution, multi-module refactors, static analysis across large codebases, integration test runs |
| **Intensive** | 8 | 16 GB | 100 GB | End-to-end test orchestration, parallel sub-agent workloads, large-scale code transformation, AI-assisted architecture analysis |

Tier selection is the responsibility of the EngineeringTask definition. Task authors must specify the minimum tier that satisfies their workload. Over-specifying wastes capacity; under-specifying causes out-of-memory failures that trigger retry overhead.

The cluster does not dynamically promote a task to a higher tier at runtime. If a task exhausts its tier's memory ceiling, the ExecutionSession is marked Failed with reason `resource_limit_exceeded` and the retry policy applies.

### 2.3 Worker Pool Configuration

The cluster supports two pool modes that may be mixed within the same deployment.

**Static Pool:** A fixed number of workers are provisioned at cluster startup and remain registered until explicitly decommissioned. Static workers are appropriate for baseline throughput guarantees — they eliminate cold-start latency and are suitable for Reserved tier capacity.

**Dynamic Scaling:** The cluster auto-provisions workers in response to queue pressure and decommissions them when utilization drops. Dynamic workers are suitable for burst capacity. See Section 6 for scaling triggers and scale-in safety rules.

**Reserved Workers:** Workers pre-allocated to a specific company or priority tier. Reserved workers are held out of the general pool. A Critical-priority task from a company with a reserved worker will always find capacity, regardless of general pool saturation.

**Spot Workers:** Workers provisioned opportunistically from lower-cost infrastructure. Spot workers may be reclaimed by the infrastructure provider with a 90-second notice. The cluster monitors for spot interruption signals and begins graceful drain immediately on receipt. Tasks on spot workers are paused at the next safe pause point and returned to Queued. Only tasks with `spot_eligible: true` in their resource spec may be scheduled on spot workers.

---

## 3. Worker Scheduling

### 3.1 Scheduling Algorithm

The scheduler runs as a singleton process protected by a Redis distributed lock (see Section 7.3 for split-brain handling). It operates on a polling interval of 500 milliseconds and processes the ExecutionQueue in batches of up to 50 items per cycle.

The scheduling decision for each queue item follows four sequential gates:

**Gate 1 — Capability Filter**
Eliminate all workers whose declared WorkerCapabilities do not fully satisfy the task's `required_capabilities` set. A worker missing any single required capability is excluded. Capabilities are declared strings (e.g., `php:8.3`, `node:20`, `docker`, `postgres:15`). Partial version matches are not supported — `php:8.3` does not satisfy `php:8.2`.

**Gate 2 — Resource Fit**
From capability-eligible workers, eliminate any worker whose available WorkerResource does not accommodate the task's resource_spec tier. Available resources are computed as `worker_tier_total - sum(active_session_reservations)`. A worker running one Micro session on a Standard tier worker has headroom for the Standard ceiling minus the Micro reservation.

**Gate 3 — Company Parallelism Check**
Verify that assigning this task would not exceed the company's configured `max_parallel_executions` (default: 5). Count all active ExecutionSessions for the company across all workers. If the count equals the maximum, the task remains in the queue for this cycle. This gate enforces fair resource sharing and prevents monopolization.

**Gate 4 — Priority-Weighted Worker Selection**
From the remaining eligible workers, select the worker with the lowest current load score. The load score is calculated as:

```
load_score = (active_session_count / worker_capacity) * 100
```

For workers with equal load scores, prefer the worker whose last ExecutionSession completed most recently (warm worker preference — the workspace cache may still be valid).

**Priority Score Formula**

Tasks are sorted before the gate evaluation pass using the following priority score, computed at dequeue time:

```
priority_score = (task_priority * 100) + floor(seconds_in_queue / 60)
```

Where `task_priority` maps to: Critical = 4, High = 3, Normal = 2, Low = 1.

This formula ensures that a Critical task always outranks a High task initially, but a High task that has waited 100 minutes accumulates a score of 3 × 100 + 100 = 400 — equal to a fresh Critical task's base score of 400 — preventing indefinite starvation of lower-priority work.

The scheduler processes items from highest priority_score to lowest within each cycle batch. Items not scheduled in a cycle retain their queue position and their score increases naturally with elapsed time.

### 3.2 ExecutionQueue Design

The ExecutionQueue is a Redis sorted set keyed by `priority_score` (descending), backed by a PostgreSQL `execution_queue` table for durability. The Redis sorted set is the live scheduling surface; PostgreSQL is the source of truth. On cluster restart, the Redis set is reconstructed from PostgreSQL rows in `Queued` state.

**Queue Tiers**

Four named tiers map to the `task_priority` field:

| Tier | Priority Value | Target Time-to-Worker | Notes |
|---|---|---|---|
| Critical | 4 | ≤ 30 seconds | Reserved for production incidents, security patches, release blockers |
| High | 3 | ≤ 5 minutes | Feature work with deadline commitments |
| Normal | 2 | ≤ 30 minutes | Standard development tasks |
| Low | 1 | Best effort | Background housekeeping, archival tasks, analytics generation |

**Queue Item Fields**

Each entry in the ExecutionQueue carries the following data:

| Field | Type | Description |
|---|---|---|
| `task_id` | UUID | Foreign key to EngineeringTask |
| `priority` | integer (1–4) | Mapped from priority tier |
| `required_capabilities` | string[] | Capability strings that must match a worker |
| `resource_spec` | enum | Micro, Standard, Heavy, or Intensive |
| `enqueued_at` | timestamp | When the task transitioned to Queued state |
| `deadline` | timestamp\|null | Hard deadline; tasks past deadline are failed automatically |
| `spot_eligible` | boolean | Whether this task may run on a spot worker |
| `retry_count` | integer | Number of prior failed attempts for this task |
| `company_id` | UUID | Owning company for parallelism enforcement |

### 3.3 Preemption Policy

Preemption is the act of pausing a Running task to free its worker for a higher-priority task. Preemption is supported but constrained.

**When Preemption Is Triggered**

The scheduler may initiate preemption when:
- A Critical-priority task has been in the queue for more than 10 seconds and no eligible idle worker is available.
- All eligible workers are occupied by tasks with priority lower than the waiting task's priority.
- At least one occupied worker is running a task that has declared `preemptible: true` in its resource spec.

Tasks with `preemptible: false` (the default) are never preempted.

**Safe Pause Points**

An EngineeringAgent signals safe pause points by emitting a `TaskPausePointReached` event through the session channel. The scheduler only issues a preemption signal at the next declared safe pause point after the decision is made. The cluster never forcibly kills a session mid-operation — forcible termination risks corrupting Workspace state.

If the agent does not reach a safe pause point within 60 seconds of a preemption signal, the preemption request is cancelled and the scheduler re-evaluates alternative workers for the waiting Critical task.

**Task State on Preemption**

When a task is successfully preempted:
1. The ExecutionSession transitions to Aborted (preempted subtype).
2. The EngineeringTask transitions from Running back to Queued.
3. The task re-enters the ExecutionQueue with its original priority and the `retry_count` is not incremented (preemption is not a failure).
4. The Workspace is snapshotted and placed in the warm pool if the workspace type supports it; otherwise it is released.
5. The worker transitions to Idle and is immediately available for scheduling.

---

## 4. Workspace Allocation

A Workspace is the isolated execution environment — a file system checkout, environment variable set, tool installation state, and network context — in which an ExecutionSession runs. Workspace allocation happens between task assignment and ExecutionSession start.

### 4.1 Allocation Decision

On task assignment, the cluster's WorkspaceAllocator evaluates the following in order:

**Step 1 — Warm Pool Lookup**
Query the warm pool for a Workspace in Idle state matching the task's `workspace_profile` (a hash of: repository URL, branch, base commit SHA, required tool versions). A warm pool hit means the workspace already has the repository cloned, dependencies installed, and tools present. Allocation latency for a warm hit is typically under 2 seconds.

**Step 2 — Cache Hit Evaluation**
If no exact warm pool match exists, check for a workspace with a matching repository and a commit SHA that is an ancestor of the target commit. A partial cache hit can be updated via `git fetch` and incremental dependency installation rather than a full cold clone. This typically saves 60–80% of cold provisioning time.

**Step 3 — Fresh Provision**
If neither warm nor partial cache is available, the cluster provisions a fresh Workspace. This involves: cloning the repository, installing declared tool versions, running any workspace bootstrap scripts defined in the task's profile. A WorkspaceLock is acquired before provisioning begins to prevent duplicate provisioning races.

### 4.2 Warm Pool Strategy

The warm pool is maintained proactively. After each Completed or Failed ExecutionSession, the Workspace is not immediately destroyed. Instead, it transitions to Idle and is held in the warm pool for a configurable retention period (default: 30 minutes). The WorkspaceLock is released so the workspace is available for the next matching task.

The warm pool is bounded per worker tier:
- Micro: up to 10 Idle workspaces per cluster node
- Standard: up to 6 Idle workspaces per cluster node
- Heavy: up to 4 Idle workspaces per cluster node
- Intensive: up to 2 Idle workspaces per cluster node

When the pool reaches its limit, the Least Recently Used workspace is evicted (transitioned to Archiving, then Archived).

### 4.3 Allocation Timeout

If a Workspace cannot be allocated within 5 minutes (for any reason: provisioning failure, all workers busy, WorkspaceLock contention), the assignment is rolled back. The task returns to Queued state. A `WorkspaceAllocationTimeout` event is emitted to the ExecutionLog and an alert is fired to the cluster operations channel. The retry policy (Section 7.2) applies with a minimum 60-second delay before re-queuing.

---

## 5. Resource Management

### 5.1 Limits Enforcement

Resource limits are enforced at the ExecutionSession level by the worker's resource governor. Limits are derived from the task's assigned tier and may not be overridden by the agent.

**CPU Throttling**
Each ExecutionSession is assigned to a cgroup (Linux) or equivalent isolation mechanism. CPU shares are proportional to the tier's core count. Burst above the tier's CPU allocation is permitted for up to 10 seconds before throttling engages. Sustained CPU usage above the ceiling triggers a `ResourcePressureWarning` event but does not terminate the session — the session is throttled rather than killed.

**Memory Limits**
Memory is a hard limit. If a session exceeds the tier's RAM ceiling, the worker's OOM handler triggers. The session is marked Failed with reason `out_of_memory`. The task enters the retry flow (Section 7.2). If the task has already failed twice with `out_of_memory` on the same tier, the system emits a `TierUpgradeRecommended` event and suspends automatic retry, requiring manual intervention to reassign to a higher tier.

**Disk Quotas**
Disk usage within the Workspace is monitored via periodic du scans (every 60 seconds). If the session writes beyond 90% of the tier's disk quota, a `DiskQuotaWarning` event is emitted. At 100% of the quota, writes are blocked — not the session itself. The session receives a write error from the OS. If the agent does not self-correct within 5 minutes, the session is marked Failed with reason `disk_quota_exceeded`.

**Network Isolation**
Each ExecutionSession is permitted outbound HTTPS only, subject to an allowlist of approved hostnames (GitHub, npm registry, Packagist, PyPI, and configured internal registries). Inbound connections to the session are blocked. Violations are logged and the session is terminated with reason `network_policy_violation`.

### 5.2 Resource Accounting

All resource consumption is metered and stored per:
- **ExecutionSession** — the finest granularity; full CPU-seconds, peak memory, bytes read/written, duration.
- **EngineeringTask** — aggregated across all ExecutionSessions for the task (including retries).
- **EngineeringAgent** — rolling 24-hour and 30-day consumption totals.
- **Company** — daily and monthly totals used for quota enforcement and billing reconciliation.

Accounting records are written to the `execution_resource_usage` table at session end. For sessions running longer than 5 minutes, intermediate accounting snapshots are written every 5 minutes to enable partial charging on failure.

### 5.3 Resource Reservation

Resources are reserved at the moment of assignment — before the ExecutionSession starts and before the Workspace is allocated. This prevents double-booking races where two scheduler cycles simultaneously assign the same worker.

The reservation record is written to `worker_resource_reservations` and references the EngineeringTask UUID. The worker's available resource calculation always subtracts active reservations, not just active sessions. This means a worker that has been assigned a task but has not yet started the session is correctly counted as partially consumed.

Reservations are released in two scenarios:
- **Normal completion:** reservation released after the ExecutionSession transitions to Completed or Failed and the ExecutionLog entry is committed.
- **Failure before session start:** if workspace allocation fails or the agent does not accept the assignment within 60 seconds (agent timeout), the reservation is released and the task returns to Queued.

Reservations are never held indefinitely. A reservation older than the maximum expected session duration for the tier (Micro: 30 min, Standard: 60 min, Heavy: 120 min, Intensive: 240 min) is considered stale. The cluster's reservation janitor job runs every 5 minutes and releases stale reservations, emitting a `StaleReservationReleased` alert for investigation.

---

## 6. Scaling Strategy

### 6.1 Horizontal Scaling

The cluster scales by adding or removing worker nodes. Worker nodes are homogeneous within a tier — a new Heavy node provides exactly 4 CPU / 8 GB RAM / 50 GB disk of additional capacity. The cluster does not vertically resize nodes at runtime.

**Scale-Out Triggers**

The auto-scaler evaluates the following metrics every 30 seconds. Any single trigger being true initiates a scale-out evaluation:

| Trigger | Threshold | Description |
|---|---|---|
| Queue depth | Critical queue > 0 for 30s, or any queue > 20 items for 5 min | Sustained backlog indicates insufficient worker count |
| Worker utilization | Average utilization > 80% across all workers of a tier for 3 consecutive intervals | Workers are consistently near capacity |
| P95 queue wait | P95 time-in-queue > 2× the priority SLA for that tier | Tasks are waiting significantly longer than target |
| Reserved capacity exhaustion | Reserved worker pool at 100% utilization for 60s | Reserved capacity for a company or tier is fully consumed |

When a scale-out trigger fires, the auto-scaler requests a configurable number of new worker nodes (default: 2 nodes of the triggering tier). New nodes register with the cluster via the standard WorkerRegistered flow. The scheduler begins routing tasks to new nodes immediately upon registration.

**Scale-In Triggers**

Scale-in is evaluated every 5 minutes to prevent thrashing:

| Trigger | Threshold | Description |
|---|---|---|
| Worker utilization | Average utilization < 30% across a tier for 10 consecutive minutes | Tier is significantly over-provisioned |
| Queue depth | Zero items in queue for all tiers for 5 consecutive minutes | No work to schedule |
| Idle worker count | More than 50% of a tier's workers have been Idle for 15+ minutes | Excess standby capacity |

Scale-in removes the node(s) with the lowest recent utilization, subject to the safety rules below. The minimum cluster size per tier is 1 node (never scale to zero). Scaling below the configured minimum reserved capacity is not permitted.

### 6.2 Scale-In Safety

Removing a node that has an active ExecutionSession would abruptly terminate that session and lose the work in progress. Scale-in therefore follows a strict drain protocol.

**Drain Initiation**
When a node is selected for removal, the cluster marks the node as Draining. A Draining node:
- Accepts no new task assignments from the scheduler.
- Continues to run all active ExecutionSessions to completion.
- Continues to send WorkerHeartbeats.
- Is removed from all scheduler candidate sets.

**Drain Timeout**
The cluster waits up to 30 minutes for a draining node to become idle (all its ExecutionSessions complete). At the 30-minute mark, if sessions are still active, the cluster issues a pause signal to all remaining sessions on the node (following the safe pause point protocol from Section 3.3). Paused sessions return their tasks to Queued state. The node is then decommissioned.

**Drain Cancellation**
If a scale-out trigger fires while a node is draining, the drain is cancelled and the node is returned to Active state. This prevents oscillation in rapidly fluctuating load scenarios.

**Minimum Active Nodes**
The cluster enforces a minimum of 1 Active (non-Draining) node per tier at all times, regardless of scale-in pressure.

---

## 7. Failure Recovery

### 7.1 Worker Node Failure

Worker nodes are expected to fail. The cluster's WorkerHealthMonitor continuously evaluates WorkerHeartbeat signals.

**Detection**
A worker emits a WorkerHeartbeat every 15 seconds. If the cluster does not receive a heartbeat from a worker for 3 consecutive intervals (45 seconds), the worker is considered unhealthy. After a 4th missed heartbeat (60 seconds total), the worker is declared Failed.

**Immediate Response on Declaration**
1. All ExecutionSessions on the failed worker are marked Failed with reason `worker_node_failure`.
2. All EngineeringTasks associated with those sessions return to Queued state, with `retry_count` incremented.
3. All WorkspaceLocks held by the failed worker are forcibly released.
4. All resource reservations for the failed worker are released.
5. A `WorkerNodeFailure` event is emitted to the cluster operations channel.

**Task Return to Queue**
Tasks returned to Queued after node failure re-enter the ExecutionQueue with their original priority. The retry_count increment ensures that tasks that repeatedly fail due to infrastructure issues are eventually escalated rather than silently retried forever (see Section 7.2 for escalation thresholds).

**Node Recovery**
A failed worker may re-register. Re-registration is treated as a new worker with a new WorkerRegistered event. The old worker record is moved to Terminated state. Any Workspace that was in Active state on the old node is moved to Archived — it cannot be safely reused without knowing the exact state at failure.

### 7.2 Task Execution Failure

When an ExecutionSession fails due to a task-level error (not infrastructure failure), the retry policy applies.

**Retry Policy**

| Attempt | Delay Before Re-queue | Behavior |
|---|---|---|
| 1st failure | 60 seconds | Task returns to Queued with `retry_count = 1` |
| 2nd failure | 120 seconds | Task returns to Queued with `retry_count = 2` |
| 3rd failure | 300 seconds | Task returns to Queued with `retry_count = 3` |
| 4th failure | — | Task transitions to Failed (terminal). No further automatic retry. |

The retry delay is enforced by setting the task's `earliest_eligible_at` timestamp on the ExecutionQueue item. The scheduler filters out items where `earliest_eligible_at > now()`.

**Non-Retryable Failures**
The following failure reasons bypass the retry policy and immediately transition the task to terminal Failed state:
- `network_policy_violation` — deliberate policy breach.
- `disk_quota_exceeded` after warning — agent failed to self-correct.
- `authentication_revoked` — agent's JWT was revoked during execution.
- `task_cancelled` — cancellation was requested by the user or system.

**Retry Escalation**
When `retry_count = 3` and the task is re-queued for its final attempt, a `TaskApproachingRetryLimit` event is emitted. Subscribed operations staff receive an alert. If the 4th attempt fails, a `TaskExhaustedRetries` event is emitted with the full ExecutionLog history attached.

**Idempotency Requirement**
Tasks must be designed for idempotent re-execution. The cluster does not guarantee that a retried task will not see side effects from prior partial runs. Task authors are responsible for designing agents that inspect existing state before writing.

### 7.3 Cluster Split-Brain

The scheduler is a singleton: only one scheduler process must be active at any moment. Multiple active schedulers would double-assign tasks, corrupt queue state, and violate company parallelism limits.

**Leader Election via Redis Distributed Lock**

The scheduler acquires a Redis lock with key `engineering_cluster:scheduler:leader` and TTL of 10 seconds. The lock is refreshed every 5 seconds by the active scheduler process. If the active scheduler process dies, the lock expires after at most 10 seconds. A standby scheduler process waiting on the lock will acquire it and become the new leader within 10 seconds.

The lock value is set to the scheduler process's UUID. Before acting on any scheduling decision, the active scheduler verifies that it still holds the lock (the value matches). If the lock has been acquired by another process (indicating a race), the current process immediately stops scheduling and re-enters the standby wait loop.

**Standby Schedulers**
A minimum of 2 scheduler processes run at all times: 1 active and 1 standby. Standby schedulers monitor the lock key and are ready to promote in under 10 seconds. In clusters spanning multiple availability zones, one standby per additional zone is recommended.

**Split-Brain Detection**
If two schedulers believe they are simultaneously active (detectable via the task assignment log — two assignments for the same task within the same second), the cluster emits a `SchedulerSplitBrainDetected` alert. The response is to immediately stop all schedulers, drain in-flight assignments (roll back any task to Queued that was assigned in the last 30 seconds), and restart schedulers cleanly. This is a manual recovery procedure.

---

## 8. Parallel Execution

### 8.1 Per-Company Parallelism

Each company has a configurable maximum number of simultaneously running ExecutionSessions, enforced at Gate 3 of the scheduling algorithm (Section 3.1).

- **Default maximum:** 5 concurrent sessions per company.
- **Maximum ceiling:** 50 concurrent sessions (requires explicit cluster-level approval for a company).
- **Minimum:** 1 (a company always gets at least one slot if a worker is available).

The configured limit is stored in `company_cluster_settings` and is respected across all workers — it is a cluster-wide limit, not a per-node limit.

When a company is at its parallelism limit, its queued tasks remain in the ExecutionQueue but are skipped by the scheduler until a slot opens. This does not cause those tasks to lose queue position relative to other companies' tasks of the same priority. They simply wait.

### 8.2 Global Cluster Limit

The cluster has a global maximum concurrent session count equal to the sum of all worker capacities minus a 10% headroom reserve. The headroom reserve ensures the scheduler always has margin to accept Critical-priority tasks without being fully saturated.

When the global limit is reached, no new assignments are made for Normal or Low priority tasks. High-priority tasks may still be assigned up to 95% of global capacity. Critical tasks are always schedulable, even if this temporarily exceeds the headroom (Critical tasks may use the reserved 10%).

### 8.3 Starvation Prevention

The priority score formula (Section 3.1) provides the primary starvation prevention mechanism: low-priority tasks accumulate priority score over time and will eventually outrank freshly submitted higher-priority tasks.

As a secondary safeguard, the scheduler enforces a per-cycle minimum dispatch quota:
- At least 1 Low-priority task is scheduled per 10 scheduling cycles (5 seconds), provided an eligible worker exists, regardless of higher-priority queue depth.
- At least 1 Normal-priority task is scheduled per 4 cycles (2 seconds) under the same condition.

These minimum quotas ensure that even under sustained Critical/High load, Low and Normal tasks make forward progress.

---

## 9. Monitoring Metrics

The following metrics are emitted by the cluster and must be collected by the monitoring infrastructure. All metrics are labeled with `tier`, `company_id` (where applicable), and `cluster_region`.

| # | Metric Name | Type | Description |
|---|---|---|---|
| 1 | `cluster_queue_depth` | Gauge | Current number of items in ExecutionQueue, segmented by priority tier (Critical/High/Normal/Low) |
| 2 | `cluster_worker_utilization_pct` | Gauge | Percentage of worker capacity in use, per worker tier |
| 3 | `cluster_worker_count` | Gauge | Number of workers by state (Idle, Busy, Draining, Offline), per tier |
| 4 | `cluster_assignment_latency_seconds` | Histogram | Time from task entering Queued state to Assignment, P50/P95/P99 per priority tier |
| 5 | `cluster_workspace_allocation_seconds` | Histogram | Time to allocate a Workspace (warm hit vs. cache hit vs. cold provision), P50/P95/P99 |
| 6 | `cluster_execution_duration_seconds` | Histogram | Duration of ExecutionSessions, P50/P95/P99 per tier and task type |
| 7 | `cluster_session_failure_rate` | Counter | Count of failed ExecutionSessions per hour, segmented by failure reason |
| 8 | `cluster_retry_rate` | Counter | Count of task retries per hour, segmented by retry_count (1st/2nd/3rd retry) |
| 9 | `cluster_retry_exhaustion_count` | Counter | Count of tasks that exhausted all retries and entered terminal Failed state per day |
| 10 | `cluster_preemption_count` | Counter | Count of preemption events per hour, segmented by preempted task priority |
| 11 | `cluster_scale_out_events` | Counter | Number of auto-scale-out events, segmented by tier |
| 12 | `cluster_scale_in_events` | Counter | Number of auto-scale-in events and drain completions, segmented by tier |
| 13 | `cluster_worker_heartbeat_misses` | Counter | Count of missed heartbeats per worker, rolling 5-minute window |
| 14 | `cluster_node_failure_count` | Counter | Count of worker node failure declarations per day |
| 15 | `cluster_resource_cpu_usage_seconds` | Counter | Cumulative CPU-seconds consumed per company per day |
| 16 | `cluster_resource_memory_peak_bytes` | Gauge | Peak memory usage observed per ExecutionSession |
| 17 | `cluster_resource_disk_usage_bytes` | Gauge | Current disk usage within active Workspaces, per tier |
| 18 | `cluster_stale_reservation_count` | Counter | Count of stale reservation releases by the janitor job |
| 19 | `cluster_company_parallelism_blocked` | Counter | Count of scheduling cycles where a company task was skipped due to parallelism limit |
| 20 | `cluster_warm_pool_hit_rate_pct` | Gauge | Percentage of Workspace allocations served from the warm pool, per tier |
| 21 | `cluster_scheduler_leader_election_count` | Counter | Count of scheduler leadership transitions (failovers) |
| 22 | `cluster_spot_interruption_count` | Counter | Count of spot worker interruption signals received and drain events triggered |

**Alerting Thresholds (recommended defaults)**

| Alert | Condition | Severity |
|---|---|---|
| Critical queue stalled | Critical queue depth > 0 for > 60 seconds | PagerDuty / immediate |
| High failure rate | session_failure_rate > 10/hour | High |
| Worker node failure | cluster_node_failure_count increments | High |
| Scheduler failover | cluster_scheduler_leader_election_count increments unexpectedly | High |
| Retry exhaustion | cluster_retry_exhaustion_count > 0 | Medium |
| Warm pool degraded | cluster_warm_pool_hit_rate_pct < 50% for 10 minutes | Medium |
| Stale reservations | cluster_stale_reservation_count > 5 in a 5-minute window | Medium |

---

## 10. Operational Procedures

### 10.1 Rolling Cluster Update

A rolling update replaces worker nodes one at a time without cluster downtime. This procedure is used for OS patches, worker daemon upgrades, and tier configuration changes.

**Procedure**

1. **Announce drain window.** Set the target node to Draining state via the cluster management API. The scheduler immediately stops routing new tasks to this node. In-flight sessions continue.

2. **Wait for drain.** Monitor `cluster_worker_count{state="Busy"}` for the target node. The drain is complete when this value reaches 0 or the 30-minute drain timeout elapses (whichever comes first). If sessions remain at timeout, the safe-pause protocol is invoked.

3. **Decommission and update.** Once the node is Idle, stop the worker daemon, apply the update, and restart.

4. **Re-register.** The updated worker daemon re-registers with the cluster via the standard WorkerRegistered flow. The scheduler begins routing tasks within 30 seconds of successful registration.

5. **Repeat for next node.** Proceed to the next node only after confirming the updated node is in Active state and receiving heartbeats.

**Constraints**
- Never drain more than 25% of a tier's nodes simultaneously.
- If the queue depth for any tier exceeds 50 items during a rolling update, pause the update procedure and allow the cluster to recover before continuing.
- Rolling updates during peak hours (configurable per deployment, default: 08:00–20:00 local time) require explicit operator approval via the management API.

### 10.2 Emergency Drain

An emergency drain removes all tasks from the cluster as fast as safely possible. This procedure is used for security incidents, data center events, or critical configuration errors discovered mid-operation.

**Procedure**

1. **Set all workers to Draining.** Issue a cluster-wide drain command via the management API. This atomically marks every worker as Draining and stops the scheduler from making new assignments.

2. **Issue pause signals.** For all active ExecutionSessions, immediately issue pause signals. The safe pause point protocol applies — sessions complete their current operation before pausing.

3. **Force-pause timeout.** If sessions have not paused within 5 minutes, issue forcible termination. Sessions are marked Aborted. Tasks return to Queued state with `retry_count` preserved.

4. **Verify empty.** Confirm all workers show 0 active sessions. Emit a `ClusterEmergencyDrainComplete` event.

5. **Post-incident.** Before re-enabling the cluster, the operations team must review the incident report, confirm the triggering condition is resolved, and explicitly mark the cluster as cleared via the management API.

**Communication**
The emergency drain event triggers automatic notifications to:
- The engineering operations on-call via PagerDuty.
- All company accounts with active or queued tasks (via the in-app notification system).
- The cluster audit log with the initiating operator's identity.

### 10.3 Capacity Planning Guide

Capacity planning ensures the cluster can handle projected workload without breaching priority SLAs.

**Input Data Required**
- Current 30-day average and P95 task submission rate per priority tier.
- Current P95 task execution duration per tier and task type.
- Expected growth rate over the planning horizon (typically 90 days).
- Peak-to-average ratio observed in historical data (typically 2–3× for development workflows).

**Capacity Formula**

For each worker tier, the minimum number of workers required is:

```
required_workers = ceil(
    (peak_submissions_per_minute * p95_execution_minutes * (1 + growth_rate))
    / (utilization_target * worker_capacity_in_concurrent_sessions)
)
```

Where `utilization_target` should be set to 0.70 (70%) to preserve headroom for burst and for the 10% Critical reserve.

**Review Cadence**
- Capacity review is conducted monthly as part of the Engineering Cloud operational review.
- An out-of-cycle review is triggered automatically when `cluster_worker_utilization_pct` exceeds 80% for more than 3 consecutive days.
- Capacity changes (adding reserved workers, increasing per-company parallelism limits) require approval from the Engineering Cloud platform owner and a change record in the audit log.

**Tier Ratio Guidance**

Based on typical Engineering Cloud workload profiles, the recommended initial tier ratio is:

| Tier | Share of Total Workers |
|---|---|
| Micro | 40% |
| Standard | 35% |
| Heavy | 20% |
| Intensive | 5% |

Adjust based on observed usage. If Heavy utilization consistently exceeds 80% while Micro is below 40%, rebalance by converting Micro capacity to Heavy capacity at next cluster update.

---

## Appendix A — State Machine Summary

### EngineeringWorker States

| State | Meaning |
|---|---|
| Unregistered | Worker process started but registration not yet submitted |
| Registering | Registration request in flight |
| Idle | Registered, healthy, no active session |
| Busy | Hosting one or more active ExecutionSessions |
| Paused | Administratively paused; will not accept new assignments |
| Draining | Marked for removal; finishing active sessions only |
| Offline | Heartbeat timeout — awaiting failure declaration or recovery |
| Terminated | Decommissioned; no further heartbeats expected |

### Workspace States

| State | Meaning |
|---|---|
| Pending | Allocation requested, not yet started |
| Provisioning | Clone / install / bootstrap in progress |
| Active | Hosting an ExecutionSession |
| Idle | Session ended; held in warm pool |
| Archiving | Being snapshotted or compressed before eviction |
| Archived | No longer in warm pool; on-disk snapshot only |
| Failed | Provisioning failed; workspace is unusable |

---

## Appendix B — Key Configuration Parameters

| Parameter | Default | Description |
|---|---|---|
| `scheduler.poll_interval_ms` | 500 | Milliseconds between scheduling cycles |
| `scheduler.batch_size` | 50 | Maximum queue items processed per cycle |
| `scheduler.redis_lock_ttl_s` | 10 | Scheduler leader lock TTL in seconds |
| `scheduler.redis_lock_refresh_s` | 5 | Scheduler leader lock refresh interval |
| `workspace.warm_pool_retention_min` | 30 | Minutes an Idle workspace is retained in warm pool |
| `workspace.allocation_timeout_min` | 5 | Maximum minutes for workspace allocation before rollback |
| `worker.heartbeat_interval_s` | 15 | Seconds between WorkerHeartbeat emissions |
| `worker.heartbeat_failure_threshold` | 3 | Missed heartbeats before declaring Offline |
| `worker.heartbeat_failure_terminal` | 4 | Missed heartbeats before declaring Failed |
| `worker.drain_timeout_min` | 30 | Minutes before drain forces safe-pause |
| `company.default_max_parallel` | 5 | Default concurrent sessions per company |
| `company.max_parallel_ceiling` | 50 | Maximum configurable concurrent sessions per company |
| `retry.max_attempts` | 3 | Maximum automatic retries before terminal failure |
| `retry.delays_seconds` | [60, 120, 300] | Delay before each retry attempt |
| `preemption.signal_timeout_s` | 60 | Seconds to wait for agent to reach safe pause point |
| `scaling.evaluation_interval_s` | 30 | Seconds between auto-scaler evaluations |
| `scaling.scale_in_evaluation_interval_s` | 300 | Seconds between scale-in evaluations |
| `scaling.drain_timeout_min` | 30 | Minutes before scale-in drain forces safe-pause |
| `reservation.janitor_interval_min` | 5 | Minutes between stale reservation cleanup runs |
