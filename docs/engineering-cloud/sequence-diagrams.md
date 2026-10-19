# Engineering Cloud — Sequence Diagrams
## Version: 1.0 | Status: Frozen | Date: 2026-07-22

---

## 1. Task Creation Flow

**Participants:** User (Browser), API Server, TaskService, Database, EventBus, WebSocket Server

```
User (Browser)      API Server          TaskService         Database            EventBus            WebSocket Server
      |                   |                   |                   |                   |                   |
      |-- POST /tasks --> |                   |                   |                   |                   |
      |   {title,         |                   |                   |                   |                   |
      |    type,          |                   |                   |                   |                   |
      |    priority,      |                   |                   |                   |                   |
      |    metadata}      |                   |                   |                   |                   |
      |                   |-- validate -----> |                   |                   |                   |
      |                   |   request         |                   |                   |                   |
      |                   |                   |-- INSERT -------> |                   |                   |
      |                   |                   |   engineering_    |                   |                   |
      |                   |                   |   tasks           |                   |                   |
      |                   |                   |   status=Draft    |                   |                   |
      |                   |                   |                   |-- row created --> |                   |
      |                   |                   |                   |   returns uuid    |                   |
      |                   |                   | <-- task record --|                   |                   |
      |                   |                   |                   |                   |                   |
      |                   |                   |-- publish ------> |                   |                   |
      |                   |                   |   TaskCreated     |                   |                   |
      |                   |                   |   {task_id,       |                   |                   |
      |                   |                   |    company_id,    |                   |                   |
      |                   |                   |    actor_id,      |                   |                   |
      |                   |                   |    status=Draft}  |                   |                   |
      |                   |                   |                   |          - -> broadcast --------->  |
      |                   |                   |                   |               task.created          |
      |                   |                   |                   |               to channel            |
      |                   |                   |                   |               engineering-          |
      |                   |                   |                   |               tasks                 |
      |                   | <-- EngineeringTask resource -------> |                   |                   |
      | <-- 201 Created --|                   |                   |                   |                   |
      |   {id, status:    |                   |                   |                   |                   |
      |    "Draft", ...}  |                   |                   |                   |                   |
```

**Key design decisions:**

- **Draft status on creation.** A newly created task is never immediately queued. The creator may attach files, add comments, or set dependencies before the task enters the scheduler's view. Transitioning to Queued is an explicit second action, keeping task creation lightweight and side-effect-free for the writer.
- **Synchronous DB write, asynchronous broadcast.** The API returns 201 only after the database row is committed, guaranteeing the client holds a valid task ID. The WebSocket broadcast is fired after the response is dispatched; a broadcast failure never blocks task creation.
- **EventBus as the single fan-out point.** TaskService does not know which WebSocket channels or downstream listeners care about TaskCreated. It publishes one event and the EventBus routes it. This decouples the creation path from the notification infrastructure.
- **company_id stamped at creation.** All tasks carry the creating user's company_id, enforcing tenant isolation from row zero. No tenant-scoping filter can be omitted later in queries because the FK is non-nullable.

---

## 2. Task Assignment Flow

**Participants:** Scheduler, ExecutionQueue (DB), EngineeringTask (DB), EngineeringWorker (DB), WebSocket Server, EngineeringAgent

```
Scheduler           ExecutionQueue      EngineeringTask     EngineeringWorker   WebSocket Server    EngineeringAgent
    |                    (DB)                (DB)                (DB)                |                   |
    |-- wake (60s) ----> |                   |                   |                   |                   |
    |                    |                   |                   |                   |                   |
    |-- SELECT queued -->|                   |                   |                   |                   |
    |   tasks ORDER BY   |                   |                   |                   |                   |
    |   priority,        |                   |                   |                   |                   |
    |   queued_at        |                   |                   |                   |                   |
    | <-- task list ----|                   |                   |                   |                   |
    |                    |                   |                   |                   |                   |
    |-- SELECT idle workers ----------------------------------------> |                   |                   |
    |   WHERE status=Idle,                                         |                   |                   |
    |   capabilities @>                                            |                   |                   |
    |   task.required_caps                                         |                   |                   |
    | <-- worker list --------------------------------------------|                   |                   |
    |                    |                   |                   |                   |                   |
    |-- score & rank --->|                   |                   |                   |                   |
    |   (priority x      |                   |                   |                   |                   |
    |    wait_time x     |                   |                   |                   |                   |
    |    worker_affinity)|                   |                   |                   |                   |
    |                    |                   |                   |                   |                   |
    |-- BEGIN TX ------> |                   |                   |                   |                   |
    |-- UPDATE tasks ------------------->    |                   |                   |                   |
    |   SET status=Assigned,                 |                   |                   |                   |
    |   worker_id=:wid,                      |                   |                   |                   |
    |   assigned_at=now()                    |                   |                   |                   |
    | <-- OK --------------------------------|                   |                   |                   |
    |-- UPDATE workers --------------------------------------------> |                   |                   |
    |   SET status=Busy                                          |                   |                   |
    | <-- OK -----------------------------------------------------|                   |                   |
    |-- COMMIT TX ------------------------------------------------|                   |                   |
    |                    |                   |                   |                   |                   |
    |-- send task.assign -------------------------------------------------->          |                   |
    |   {task_id,                                                                     |                   |
    |    task_type,                                                                   |                   |
    |    priority,                                                                    |                   |
    |    metadata,                                                                    |                   |
    |    workspace_hint}                                                              |                   |
    |                    |                   |                   |-- task.assign --> |                   |
    |                    |                   |                   |   (worker channel)|                   |
    |                    |                   |                   |                   | <-- task.accept --|
    |                    |                   |                   |                   |   {task_id}       |
    |-- UPDATE tasks ------------------->    |                   |                   |                   |
    |   SET status=Accepted,                 |                   |                   |                   |
    |   accepted_at=now()                    |                   |                   |                   |
    | <-- OK --------------------------------|                   |                   |                   |
    |                    |                   |                   |                   |                   |
    |-- initiate workspace provisioning -------------------------------->             |                   |
    |   (async, see Flow 5)                                                           |                   |
```

**Key design decisions:**

- **Atomic assignment transaction.** The task status update and the worker status update are committed in a single database transaction. If either write fails, both roll back. This prevents the scheduler from sending a WebSocket message for an assignment that was never persisted, and prevents a worker from being marked Busy while its task remains Queued.
- **Capability matching in SQL.** Worker selection uses a PostgreSQL array containment operator (`@>`) to filter workers whose capability set is a superset of the task's required capabilities. Scoring happens in application memory only over the pre-filtered worker list, keeping the candidate set small.
- **Explicit accept handshake.** The server does not treat delivery of `task.assign` as confirmation. The agent must send `task.accept` before the task advances to Accepted. This catches the case where the agent receives the message but fails before it can begin work — the task remains Assigned and the scheduler can re-assign after a timeout.
- **Workspace provisioning is deferred.** The scheduler does not block on workspace creation. It fires provisioning asynchronously after recording Accepted so the assignment loop continues processing the next queued task without waiting for infrastructure spin-up.

---

## 3. Worker Registration Flow

**Participants:** EngineeringAgent, WebSocket Server, AuthService, WorkerService, Database, EventBus

```
EngineeringAgent    WebSocket Server     AuthService         WorkerService       Database            EventBus
      |                   |                   |                   |                   |                   |
      |-- WS connect ---> |                   |                   |                   |                   |
      |   ?token=         |                   |                   |                   |                   |
      |   <ws_token>      |                   |                   |                   |                   |
      |                   |-- validate -----> |                   |                   |                   |
      |                   |   ws_token        |                   |                   |                   |
      |                   |   (short-lived    |                   |                   |                   |
      |                   |    Sanctum token) |                   |                   |                   |
      |                   | <-- valid --------|                   |                   |                   |
      |                   |                   |                   |                   |                   |
      | <-- WS connected--|                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |
      |-- agent.register ->                   |                   |                   |                   |
      |   {api_key,       |                   |                   |                   |                   |
      |    agent_version, |                   |                   |                   |                   |
      |    capabilities:  |                   |                   |                   |                   |
      |    [...],         |                   |                   |                   |                   |
      |    resources:     |                   |                   |                   |                   |
      |    {cpu,memory},  |                   |                   |                   |                   |
      |    hostname}      |                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |
      |                   |-- validate -----> |                   |                   |                   |
      |                   |   api_key         |                   |                   |                   |
      |                   |   (HMAC check +   |                   |                   |                   |
      |                   |    company_id     |                   |                   |                   |
      |                   |    extraction)    |                   |                   |                   |
      |                   | <-- company_id,   |                   |                   |                   |
      |                   |    agent_id ------                    |                   |                   |
      |                   |                   |                   |                   |                   |
      |                   |-- register -----> |                   |                   |                   |
      |                   |   {company_id,    |                   |                   |                   |
      |                   |    agent_id,      |                   |                   |                   |
      |                   |    capabilities,  |                   |                   |                   |
      |                   |    resources,     |                   |                   |                   |
      |                   |    hostname}      |                   |                   |                   |
      |                   |                   |                   |-- UPSERT -------> |                   |
      |                   |                   |                   |   engineering_    |                   |
      |                   |                   |                   |   agents          |                   |
      |                   |                   |                   |   (on conflict    |                   |
      |                   |                   |                   |    update         |                   |
      |                   |                   |                   |    version,caps)  |                   |
      |                   |                   |                   |-- INSERT -------> |                   |
      |                   |                   |                   |   engineering_    |                   |
      |                   |                   |                   |   workers         |                   |
      |                   |                   |                   |   status=Idle     |                   |
      |                   |                   |                   | <-- worker_id ----|                   |
      |                   |                   | <-- worker_id,    |                   |                   |
      |                   |                   |    agent record --|                   |                   |
      |                   |                   |                   |                   |                   |
      |                   |-- issue JWT -----> |                   |                   |                   |
      |                   |   {sub: worker_id,|                   |                   |                   |
      |                   |    company_id,    |                   |                   |                   |
      |                   |    exp: 8h}       |                   |                   |                   |
      |                   | <-- JWT -----------|                   |                   |                   |
      |                   |                   |                   |                   |                   |
      | <-- agent.registered               |                   |                   |                   |
      |   {worker_id,     |                   |                   |                   |                   |
      |    jwt,           |                   |                   |                   |                   |
      |    heartbeat_     |                   |                   |                   |                   |
      |    interval: 30s} |                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |
      |                   |-- publish ----------------------------------------->    |                   |
      |                   |   WorkerRegistered                                      |                   |
      |                   |   {worker_id,                                           |                   |
      |                   |    company_id,                                          |                   |
      |                   |    capabilities,                                        |                   |
      |                   |    registered_at}                                       |                   |
```

**Key design decisions:**

- **Two-layer authentication.** The WebSocket connection itself requires a short-lived Sanctum `ws_token` (issued by the UI or a pre-auth endpoint) to prevent unauthenticated socket connections from reaching the registration handler. The subsequent `agent.register` message carries a long-lived API key that identifies the agent's company and identity. Separating these layers means the transport is authenticated before any payload is inspected.
- **UPSERT for agents, INSERT for workers.** An agent may reconnect after a crash without a new registration sequence — the UPSERT ensures its capability record is refreshed rather than duplicated. A new `engineering_workers` row is always inserted on registration because each connection is a new operational session; historical worker rows remain for audit purposes.
- **JWT issued post-registration.** The JWT is scoped to `worker_id` and `company_id` and is used by the agent for all subsequent REST calls (artifact uploads, log streaming). It is never stored server-side; validation is stateless. The 8-hour expiry aligns with a typical agent shift; the agent must re-register after expiry.
- **Capabilities stored server-side.** The scheduler reads capabilities from the database, not from WebSocket state. If the server restarts, the scheduler retains a complete picture of every registered worker's abilities without requiring a re-broadcast from agents.

---

## 4. Worker Heartbeat Flow

**Participants:** EngineeringAgent, WebSocket Server, WorkerService, Database, HeartbeatMonitor, AlertService

### 4a. Normal Path (every 30 seconds)

```
EngineeringAgent    WebSocket Server     WorkerService       Database            HeartbeatMonitor
      |                   |                   |                   |                   |
      |-- heartbeat ----> |                   |                   |                   |
      |   {worker_id,     |                   |                   |                   |
      |    ts: <now>,     |                   |                   |                   |
      |    cpu_pct,       |                   |                   |                   |
      |    mem_pct,       |                   |                   |                   |
      |    task_progress} |                   |                   |                   |
      |                   |-- record -------> |                   |                   |
      |                   |                   |-- UPDATE -------> |                   |
      |                   |                   |   worker_         |                   |
      |                   |                   |   heartbeats      |                   |
      |                   |                   |   SET last_seen=  |                   |
      |                   |                   |   now(), metrics  |                   |
      |                   |                   | <-- OK ------------|                   |
      |                   | <-- heartbeat.ack-|                   |                   |
      | <-- heartbeat.ack |                   |                   |                   |
      |                   |                   |                   |                   |
      |                   |                   |                   | <-- poll ---------|
      |                   |                   |                   |   (every 30s)     |
      |                   |                   |                   |-- last_seen for   |
      |                   |                   |                   |   all Busy/Idle   |
      |                   |                   |                   |   workers         |
      |                   |                   |                   |-- within threshold|
      |                   |                   |                   |   (90s) → OK      |
```

### 4b. Failure Path (3 missed heartbeats / 90 seconds without contact)

```
HeartbeatMonitor    WorkerService       TaskService         WorkspaceService    EventBus            AlertService
      |                   |                   |                   |                   |                   |
      |-- poll detects -->|                   |                   |                   |                   |
      |   last_seen > 90s |                   |                   |                   |                   |
      |   for worker W    |                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |
      |-- mark offline -->|                   |                   |                   |                   |
      |                   |-- UPDATE -------> |                   |                   |                   |
      |                   |   workers         |                   |                   |                   |
      |                   |   SET status=     |                   |                   |                   |
      |                   |   Offline         |                   |                   |                   |
      |                   |                   |                   |                   |                   |
      |-- return task ---> |                   |                   |                   |                   |
      |   to queue        |-- SELECT -------> |                   |                   |                   |
      |                   |   task WHERE      |                   |                   |                   |
      |                   |   worker_id=W     |                   |                   |                   |
      |                   |   AND status IN   |                   |                   |                   |
      |                   |   (Assigned,      |                   |                   |                   |
      |                   |    Accepted,      |                   |                   |                   |
      |                   |    Running,       |                   |                   |                   |
      |                   |    Paused)        |                   |                   |                   |
      |                   | <-- task row -----|                   |                   |                   |
      |                   |-- UPDATE task --> |                   |                   |                   |
      |                   |   SET status=     |                   |                   |                   |
      |                   |   Queued,         |                   |                   |                   |
      |                   |   worker_id=NULL, |                   |                   |                   |
      |                   |   failure_reason= |                   |                   |                   |
      |                   |   'agent_timeout' |                   |                   |                   |
      |                   |                   |                   |                   |                   |
      |-- publish ------------------------------------------>    |                   |                   |
      |   WorkerDisconnected                                     |                   |                   |
      |   {worker_id,                                            |                   |                   |
      |    company_id,                                           |                   |                   |
      |    last_seen,                                            |                   |                   |
      |    affected_tasks}                                       |                   |                   |
      |                                                          |                   |                   |
      |-- publish ------------------------------------------>    |                   |                   |
      |   TaskFailed                                             |                   |                   |
      |   {task_id,                                              |                   |                   |
      |    reason:                                               |                   |                   |
      |    'agent_heartbeat_timeout'}                            |                   |                   |
      |                                                          |                   |-- alert --------> |
      |                                                          |                   |   EngineeringLead |
      |                                                          |                   |   {worker_id,     |
      |                                                          |                   |    affected_task} |
```

**Key design decisions:**

- **90-second threshold, not missed-count.** The monitor compares `last_seen` timestamps rather than counting missed heartbeats. This is resilient to clock drift and to intervals that deviate slightly from 30 seconds. Any worker silent for more than 90 seconds (three nominal intervals) is considered disconnected.
- **Task returns to Queued, not Failed.** A heartbeat timeout does not mean the task is unrecoverable — it means the worker responsible for it is no longer reachable. Returning the task to Queued allows the scheduler to reassign it in the next cycle. The `failure_reason` field on the task is set to `agent_timeout` for observability, but the task's public status is Queued so the scheduler treats it normally.
- **Separate events for worker and task.** `WorkerDisconnected` and `TaskFailed` are distinct events because they have different consumers. The alerting system subscribes to `WorkerDisconnected` to notify the engineering team. The task lifecycle system subscribes to `TaskFailed` to handle retry logic. Neither event forces the other's behavior.
- **HeartbeatMonitor is a read-only poller.** It reads `last_seen` timestamps and delegates all mutations to WorkerService and TaskService. This keeps the monitor stateless and replaceable; if a second monitor instance runs during a deployment, both will detect the same timeout and attempt the same updates, which are idempotent.

---

## 5. Task Execution Flow

**Participants:** EngineeringAgent, WorkspaceService, ExecutionService, TaskService, ArtifactService, Database, EventBus

```
EngineeringAgent    WorkspaceService    ExecutionService    TaskService         ArtifactService     Database            EventBus
      |                   |                   |                   |                   |                   |                   |
      |-- task.accept --> (delivered to Scheduler, see Flow 2)    |                   |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |                   |-- provision ----> |                   |                   |                   |                   |
      |                   |   workspace       |                   |                   |                   |                   |
      |                   |   (Pending →      |                   |                   |                   |                   |
      |                   |    Provisioning → |                   |                   |                   |                   |
      |                   |    Active)        |                   |                   |                   |                   |
      |                   |-- INSERT ----------------------------------------->     |                   |                   |
      |                   |   workspaces,                                            |                   |                   |
      |                   |   workspace_locks                                        |                   |                   |
      | <-- workspace.ready               |                   |                   |                   |                   |
      |   {workspace_id,  |                   |                   |                   |                   |                   |
      |    path,          |                   |                   |                   |                   |                   |
      |    env}           |                   |                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |-- session.start ->|                   |                   |                   |                   |                   |
      |   {workspace_id,  |                   |                   |                   |                   |                   |
      |    task_id}       |                   |                   |                   |                   |                   |
      |                   |-- create session ->                   |                   |                   |                   |
      |                   |                   |-- INSERT ----------------------------------------->    |                   |
      |                   |                   |   execution_sessions                                    |                   |
      |                   |                   |   status=Initializing                                   |                   |
      |                   |                   |-- UPDATE ----------------------------------------->    |                   |
      |                   |                   |   status=Running                                        |                   |
      |                   |                   |-- publish ----------------------------------------------------->           |
      |                   |                   |   TaskExecutionStarted                                              |           |
      |                   |                   |   {session_id,                                                      |           |
      |                   |                   |    task_id,                                                         |           |
      |                   |                   |    worker_id}                                                       |           |
      | <-- session.started               |                   |                   |                   |                   |
      |   {session_id}    |                   |                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |-- (work runs) --->|                   |                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |-- progress.update ->                  |                   |                   |                   |                   |
      |   {pct, log_line} |                   |                   |                   |                   |                   |
      |                   |                   |-- INSERT ----------------------------------------->    |                   |
      |                   |                   |   execution_logs                                        |                   |
      |                   |                   |-- publish ----------------------------------------------------->           |
      |                   |                   |   TaskProgressUpdated                                               |           |
      |   ... (repeats N times) ...           |                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |-- POST /artifacts/upload/init ----------------------------> |                   |                   |                   |
      |   (see Flow 6 for detail)             |                   |                   |                   |                   |
      | <-- upload_url, upload_id ------------|                   |                   |                   |                   |
      |   ... (upload completes, see Flow 6) ..                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |-- task.complete ->|                   |                   |                   |                   |                   |
      |   {task_id,       |                   |                   |                   |                   |                   |
      |    session_id,    |                   |                   |                   |                   |                   |
      |    exit_code: 0,  |                   |                   |                   |                   |                   |
      |    summary}       |                   |                   |                   |                   |                   |
      |                   |                   |-- UPDATE ----------------------------------------->    |                   |
      |                   |                   |   session: Completing                                   |                   |
      |                   |                   |-- UPDATE ----------------------------------------->    |                   |
      |                   |                   |   session: Completed                                    |                   |
      |                   |                   |-- UPDATE task ---------------------------------->       |                   |
      |                   |                   |   status=Completed                                      |                   |
      |                   |-- release lock -->|                   |                   |                   |                   |
      |                   |   DELETE          |                   |                   |                   |                   |
      |                   |   workspace_locks |                   |                   |                   |                   |
      |                   |-- UPDATE ----------------------------------------->     |                   |                   |
      |                   |   workspace                                              |                   |                   |
      |                   |   status=Idle                                            |                   |                   |
      |                   |                   |-- publish ----------------------------------------------------->           |
      |                   |                   |   TaskCompleted                                                     |           |
      |                   |                   |   {task_id,                                                         |           |
      |                   |                   |    session_id,                                                      |           |
      |                   |                   |    duration_ms,                                                     |           |
      |                   |                   |    artifact_count}                                                  |           |
      |                   |                   |                   |                   |                   |                   |
      |                   |                   |-- auto-create draft ReleaseCandidate -----------------------------------------> |
      |                   |                   |   (ReleaseCandidateService, see Flow 7)               |                   |
```

**Key design decisions:**

- **Two-phase session status (Initializing → Running).** The `Initializing` state covers the window between session record creation and the agent confirming it has begun executing. This allows the system to detect agents that received a workspace but never started — a distinct failure mode from agents that started and then went silent.
- **Progress updates are append-only.** Each `progress.update` message inserts a new row in `execution_logs` rather than updating a percentage column. This preserves a complete audit trail and allows the UI to reconstruct a timeline replay. A materialized `latest_progress` view or Redis key can serve real-time dashboards without re-reading the full log table.
- **WorkspaceLock released only on task terminal state.** The lock is held through the `Completing` state and released only after `Completed` is confirmed. If the session update fails mid-way, the lock remains, preventing a second agent from claiming the same workspace while state is ambiguous.
- **ReleaseCandidate created automatically.** On `TaskCompleted`, a draft `ReleaseCandidate` is created without any lead action. This ensures no completed task falls through the release pipeline. The lead may reject or ignore the candidate; the system never auto-approves.

---

## 6. Artifact Upload Flow

**Participants:** EngineeringAgent, ArtifactAPI, ObjectStorage, Database

```
EngineeringAgent    ArtifactAPI         ObjectStorage       Database
      |                   |                   |                   |
      |-- POST ---------> |                   |                   |
      |   /artifacts/     |                   |                   |
      |   upload/init     |                   |                   |
      |   {task_id,       |                   |                   |
      |    session_id,    |                   |                   |
      |    filename,      |                   |                   |
      |    content_type,  |                   |                   |
      |    size_bytes,    |                   |                   |
      |    checksum_sha256}                   |                   |
      |                   |                   |                   |
      |                   |-- validate -----> |                   |
      |                   |   task ownership, |                   |
      |                   |   session active, |                   |
      |                   |   size limit      |                   |
      |                   |                   |                   |
      |                   |-- generate -----> |                   |
      |                   |   presigned PUT   |                   |
      |                   |   URL (15 min TTL)|                   |
      |                   | <-- presigned URL-|                   |
      |                   |                   |                   |
      |                   |-- INSERT ----------------------------------------->
      |                   |   task_artifacts                                  |
      |                   |   status=pending                                  |
      |                   |   upload_id=<uuid>                                |
      |                   | <-- upload_id ------------------------------------|
      |                   |                   |                   |
      | <-- 200 OK -----  |                   |                   |
      |   {upload_id,     |                   |                   |
      |    upload_url,    |                   |                   |
      |    expires_at}    |                   |                   |
      |                   |                   |                   |
      |-- PUT <upload_url> --------> |                   |                   |
      |   (binary body)   |          |                   |                   |
      |                   |          |-- store object -> |                   |
      |                   |          | <-- 200 ETag -----|                   |
      | <-- 200 ETag -----|          |                   |                   |
      |   "abc123..."     |                   |                   |
      |                   |                   |                   |
      |-- POST ---------> |                   |                   |
      |   /artifacts/     |                   |                   |
      |   upload/complete |                   |                   |
      |   {upload_id,     |                   |                   |
      |    etag: "abc123"}|                   |                   |
      |                   |                   |                   |
      |                   |-- HEAD object --> |                   |
      |                   |   verify ETag     |                   |
      |                   |   verify size     |                   |
      |                   | <-- object meta --|                   |
      |                   |                   |                   |
      |                   |-- re-compute checksum from object     |
      |                   |   vs submitted checksum_sha256        |
      |                   |                   |                   |
      |                   |-- UPDATE ----------------------------------------->
      |                   |   task_artifacts                                  |
      |                   |   status=confirmed                                |
      |                   |   storage_path=<s3_key>                           |
      |                   |   etag=<etag>                                     |
      |                   | <-- OK --------------------------------------------|
      |                   |                   |                   |
      | <-- 200 OK -----  |                   |                   |
      |   {artifact_id,   |                   |                   |
      |    storage_path,  |                   |                   |
      |    confirmed_at}  |                   |                   |
```

**Key design decisions:**

- **Presigned URL pattern.** The agent uploads directly to object storage without the API server acting as a streaming proxy. This removes the API server from the data path, preventing large artifacts from consuming server memory and saturating the application tier. The API server issues the presigned URL and later verifies the result — it never touches the binary content.
- **Two-phase commit with checksum verification.** The agent submits a SHA-256 checksum in the init call before it knows the ETag. The server stores this intent. On completion, the server re-verifies both the ETag (confirming the correct object) and the checksum (confirming the content was not corrupted in transit). The artifact row remains in `pending` status until both checks pass.
- **15-minute presigned URL TTL.** The TTL is long enough for large artifacts over slow connections but short enough to limit exposure if the URL leaks. The server does not store the presigned URL — if the TTL expires before the agent finishes, the agent calls init again to receive a fresh URL.
- **Pending row created at init, not at complete.** Recording the artifact intent at init allows the server to detect orphaned uploads (init called, complete never called) and clean them up in a background job. Without the pending row, there would be no server-side record of an upload that started but never finished.

---

## 7. Release Creation and Approval Flow

**Participants:** EngineeringLead (User), API, ReleaseCandidateService, ApprovalService, ReleaseManagerBridge, EventBus, NotificationService

```
EngineeringLead     API                 ReleaseCandidateService ApprovalService    ReleaseManagerBridge EventBus           NotificationService
      |                   |                   |                   |                   |                   |                   |
      |                   |                   | <-- TaskCompleted event (from Flow 5) |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |                   |                   |-- INSERT -------> |                   |                   |                   |
      |                   |                   |   release_        |                   |                   |                   |
      |                   |                   |   candidates      |                   |                   |                   |
      |                   |                   |   status=Draft    |                   |                   |                   |
      |                   |                   |   {task_id,       |                   |                   |                   |
      |                   |                   |    artifacts[],   |                   |                   |                   |
      |                   |                   |    version_bump}  |                   |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |                   |                   |-- publish ------------------------------------------->  |                   |
      |                   |                   |   ReleaseCandidateCreated                               |                   |
      |                   |                   |   {candidate_id,                                        |                   |
      |                   |                   |    task_id,                                             |                   |
      |                   |                   |    company_id}                                          |                   |
      |                   |                   |                   |                   |                   |-- notify -------> |
      |                   |                   |                   |                   |                   |   EngineeringLead |
      |                   |                   |                   |                   |                   |   inbox           |
      | <-- notification--|                   |                   |                   |                   |                   |
      |   "Candidate      |                   |                   |                   |                   |                   |
      |    ready for      |                   |                   |                   |                   |                   |
      |    review"        |                   |                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |-- GET /release-candidates/{id} -----> |                   |                   |                   |                   |
      |   (review details,|                   |                   |                   |                   |                   |
      |    diff, artifacts|                   |                   |                   |                   |                   |
      | <-- candidate --  |                   |                   |                   |                   |                   |
      |   {status=Draft,  |                   |                   |                   |                   |                   |
      |    artifacts,     |                   |                   |                   |                   |                   |
      |    approvals:[]}  |                   |                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |-- POST /release-candidates/{id}/approve                   |                   |                   |                   |
      |   {comment}       |                   |                   |                   |                   |                   |
      |                   |-- approve() ----> |                   |                   |                   |                   |
      |                   |                   |-- record() -----> |                   |                   |                   |
      |                   |                   |                   |-- INSERT -------> |                   |                   |
      |                   |                   |                   |   release_        |                   |                   |
      |                   |                   |                   |   approvals       |                   |                   |
      |                   |                   |                   |   {approver_id,   |                   |                   |
      |                   |                   |                   |    approved_at,   |                   |                   |
      |                   |                   |                   |    comment}       |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |                   |                   |                   |-- quorum check -> |                   |                   |
      |                   |                   |                   |   approvals >=    |                   |                   |
      |                   |                   |                   |   required_count  |                   |                   |
      |                   |                   |                   | <-- quorum met -- |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |                   |                   |-- UPDATE -------> |                   |                   |                   |
      |                   |                   |   candidate       |                   |                   |                   |
      |                   |                   |   status=Approved |                   |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |                   |                   |-- publish() ---------------------------> |                   |                   |
      |                   |                   |   ReleaseCandidateApproved              |                   |                   |
      |                   |                   |                                         |                   |                   |
      |                   |                   |-- bridge.publish() -------------------------------> |                   |                   |
      |                   |                   |   (send to Release Manager module)              |                   |                   |
      |                   |                   |   {candidate_id,                                |                   |                   |
      |                   |                   |    artifacts,                                   |                   |                   |
      |                   |                   |    version,                                     |                   |                   |
      |                   |                   |    approvals}                                   |                   |                   |
      |                   |                   |                   |                   |                   |                   |
      |                   |                   |                   |                   |-- notify stakeholders --------->  |
      |                   |                   |                   |                   |   "Release Approved &             |
      |                   |                   |                   |                   |    sent to pipeline"              |
      | <-- 200 OK -----  |                   |                   |                   |                   |                   |
      |   {candidate_id,  |                   |                   |                   |                   |                   |
      |    status=Approved}                   |                   |                   |                   |                   |
```

**Key design decisions:**

- **Automatic candidate creation, explicit approval.** The system creates a draft ReleaseCandidate the moment a task completes so no completed work is invisible to the release process. However, approval is always a deliberate human action. The system never auto-promotes a candidate from Draft to Approved.
- **Quorum-based approval.** `ApprovalService` enforces a configurable required approval count per company or per task type. A single lead approval is sufficient in the default configuration, but regulated environments can require two or more approvers before the bridge fires. The quorum count is read from company configuration, not hard-coded.
- **ReleaseManagerBridge as an anti-corruption layer.** The Engineering Cloud's `ReleaseCandidate` model and the Release Manager module's models are separate. The bridge translates between them, preventing the two modules from sharing database tables or coupling their domain objects. Changes to the Release Manager's data shape do not require changes inside Engineering Cloud.
- **Notification before and after.** The lead is notified when a candidate is created (so review begins promptly) and stakeholders are notified after approval (so downstream teams know a release is in the pipeline). The two notification calls are distinct so each audience receives only the events relevant to it.

---

## 8. Pipeline Execution Monitoring Flow

**Participants:** ReleaseCandidateService, PipelineEventListener (anti-corruption), PipelineRunService, Database, EventBus, NotificationService

### 8a. Success Path

```
Release Manager         PipelineEventListener   PipelineRunService  Database            EventBus            NotificationService
(external module)       (anti-corruption layer) |                   |                   |                   |
      |                       |                   |                   |                   |                   |
      |-- PipelineStarted --> |                   |                   |                   |                   |
      |   (existing event,    |                   |                   |                   |                   |
      |    Release Manager    |                   |                   |                   |                   |
      |    domain)            |                   |                   |                   |                   |
      |                       |                   |                   |                   |                   |
      |                       |-- translate ----> |                   |                   |                   |
      |                       |   to Engineering  |                   |                   |                   |
      |                       |   Cloud context   |                   |                   |                   |
      |                       |   {candidate_id,  |                   |                   |                   |
      |                       |    pipeline_ref,  |                   |                   |                   |
      |                       |    triggered_at}  |                   |                   |                   |
      |                       |                   |                   |                   |                   |
      |                       |                   |-- INSERT -------> |                   |                   |
      |                       |                   |   pipeline_runs   |                   |                   |
      |                       |                   |   status=Running  |                   |                   |
      |                       |                   |   {candidate_id,  |                   |                   |
      |                       |                   |    pipeline_ref,  |                   |                   |
      |                       |                   |    started_at}    |                   |                   |
      |                       |                   | <-- run_id --------|                   |                   |
      |                       |                   |                   |                   |                   |
      |                       |                   |-- publish ------------------------------------------->  |                   |
      |                       |                   |   PipelineRunStarted                                    |                   |
      |                       |                   |   {run_id,                                              |                   |
      |                       |                   |    candidate_id,                                        |                   |
      |                       |                   |    company_id}                                          |                   |
      |                       |                   |                   |                   |                   |                   |
      |   ... pipeline stages execute (external) ...                  |                   |                   |                   |
      |                       |                   |                   |                   |                   |                   |
      |-- PipelineFinished -> |                   |                   |                   |                   |
      |   {result: success,   |                   |                   |                   |                   |
      |    artifacts,         |                   |                   |                   |                   |
      |    duration_ms}       |                   |                   |                   |                   |
      |                       |                   |                   |                   |                   |
      |                       |-- translate ----> |                   |                   |                   |
      |                       |                   |-- UPDATE -------> |                   |                   |
      |                       |                   |   pipeline_runs   |                   |                   |
      |                       |                   |   status=Completed|                   |                   |
      |                       |                   |   completed_at,   |                   |                   |
      |                       |                   |   duration_ms     |                   |                   |
      |                       |                   |-- UPDATE -------> |                   |                   |
      |                       |                   |   release_        |                   |                   |
      |                       |                   |   candidates      |                   |                   |
      |                       |                   |   status=Released |                   |                   |
      |                       |                   |-- UPDATE task --> |                   |                   |
      |                       |                   |   status=Released |                   |                   |
      |                       |                   |                   |                   |                   |
      |                       |                   |-- publish ------------------------------------------->  |                   |
      |                       |                   |   ReleaseCompleted                                      |                   |
      |                       |                   |   {task_id,                                             |                   |
      |                       |                   |    candidate_id,                                        |                   |
      |                       |                   |    run_id,                                              |                   |
      |                       |                   |    released_at}                                         |                   |
      |                       |                   |                   |                   |-- notify -------> |
      |                       |                   |                   |                   |   stakeholders    |
      |                       |                   |                   |                   |   "Released ✓"    |
```

### 8b. Failure Path

```
Release Manager         PipelineEventListener   PipelineRunService  Database            EventBus            AlertService
(external module)       (anti-corruption layer) |                   |                   |                   |
      |                       |                   |                   |                   |                   |
      |-- PipelineFinished -> |                   |                   |                   |                   |
      |   {result: failure,   |                   |                   |                   |                   |
      |    error,             |                   |                   |                   |                   |
      |    stage}             |                   |                   |                   |                   |
      |                       |-- translate ----> |                   |                   |                   |
      |                       |                   |-- UPDATE -------> |                   |                   |
      |                       |                   |   pipeline_runs   |                   |                   |
      |                       |                   |   status=Failed   |                   |                   |
      |                       |                   |   error,stage     |                   |                   |
      |                       |                   |-- UPDATE -------> |                   |                   |
      |                       |                   |   release_        |                   |                   |
      |                       |                   |   candidates      |                   |                   |
      |                       |                   |   status=         |                   |                   |
      |                       |                   |   RolledBack      |                   |                   |
      |                       |                   |                   |                   |                   |
      |                       |                   |-- publish ------------------------------------------->  |                   |
      |                       |                   |   PipelineRunFailed                                     |                   |
      |                       |                   |   {run_id,                                              |                   |
      |                       |                   |    candidate_id,                                        |                   |
      |                       |                   |    error,                                               |                   |
      |                       |                   |    stage}                                               |                   |
      |                       |                   |                   |                   |-- alert -------> |
      |                       |                   |                   |                   |   EngineeringLead |
      |                       |                   |                   |                   |   + Stakeholders  |
```

**Key design decisions:**

- **PipelineEventListener as an anti-corruption layer (ACL).** The Release Manager module publishes events in its own domain language (`PipelineStarted`, `PipelineFinished`). The Engineering Cloud must not import Release Manager models or depend on its event schemas. The listener receives Release Manager events, validates and translates them into Engineering Cloud terms (`PipelineRunStarted`, `ReleaseCompleted`), and forwards only the fields the Engineering Cloud domain cares about. The Release Manager's internal schema can evolve without touching Engineering Cloud code.
- **PipelineRun as a first-class record.** The Engineering Cloud maintains its own `pipeline_runs` table rather than reading pipeline state from the Release Manager. This provides a local audit trail, enables the Engineering Cloud dashboard to show pipeline history without cross-module joins, and decouples query performance from the Release Manager's database.
- **Task advances to Released on pipeline success.** The terminal task state `Released` is only set by a confirmed pipeline completion, not by approval alone. A task is considered shipped only when the artifact has passed through the pipeline. This prevents a scenario where a task is marked Released but its artifact was never actually deployed.
- **RolledBack on the candidate, not on the task.** When a pipeline fails, the `ReleaseCandidate` moves to `RolledBack` but the `EngineeringTask` does not move backward through its state machine (it stays at `Released` candidate stage, awaiting resubmission). This preserves the task's completion history and allows a new candidate to be created for a retry without resetting task history.

---

## 9. Failure Recovery Flow

**Participants:** HeartbeatMonitor, WorkerService, TaskService, ExecutionService, WorkspaceService, Scheduler, EventBus, AlertService

### 9a. Detection and Triage

```
HeartbeatMonitor    WorkerService       ExecutionService    TaskService         WorkspaceService    EventBus
      |                   |                   |                   |                   |                   |
      |-- poll (every 30s)|                   |                   |                   |                   |
      |   detects worker W|                   |                   |                   |                   |
      |   last_seen=90s ago                   |                   |                   |                   |
      |                   |                   |                   |                   |                   |
      |-- mark offline -->|                   |                   |                   |                   |
      |                   |-- UPDATE workers ->                   |                   |                   |
      |                   |   status=Offline  |                   |                   |                   |
      |                   |                   |                   |                   |                   |
      |-- abort session -->                   |                   |                   |                   |
      |                   |-- UPDATE -------> |                   |                   |                   |
      |                   |   execution_      |                   |                   |                   |
      |                   |   sessions        |                   |                   |                   |
      |                   |   status=Aborted  |                   |                   |                   |
      |                   |   aborted_reason= |                   |                   |                   |
      |                   |   'heartbeat_     |                   |                   |                   |
      |                   |    timeout'       |                   |                   |                   |
      |                   |                   |                   |                   |                   |
      |-- fail task -------------------------------->             |                   |                   |
      |                   |                   |-- UPDATE task --> |                   |                   |
      |                   |                   |   status=Failed  |                   |                   |
      |                   |                   |   failure_reason=|                   |                   |
      |                   |                   |   'agent_        |                   |                   |
      |                   |                   |   heartbeat_     |                   |                   |
      |                   |                   |   timeout'       |                   |                   |
      |                   |                   |   failed_at=now()|                   |                   |
      |                   |                   |                   |                   |                   |
      |-- release workspace lock ----------------------------->   |                   |                   |
      |                   |                   |                   |-- DELETE -------> |                   |
      |                   |                   |                   |   workspace_locks |                   |
      |                   |                   |                   |-- UPDATE -------> |                   |
      |                   |                   |                   |   workspaces      |                   |
      |                   |                   |                   |   status=Archiving|                   |
      |                   |                   |                   |   then Archived   |                   |
      |                   |                   |                   |                   |                   |
      |-- publish WorkerDisconnected ------------------------------------------------>                   |
      |   {worker_id,                                                                 |                   |
      |    company_id,                                                                |                   |
      |    last_seen,                                                                 |                   |
      |    affected_task_ids}                                                         |                   |
      |-- publish TaskFailed -------------------------------------------------------->                   |
      |   {task_id,                                                                   |                   |
      |    company_id,                                                                |                   |
      |    reason: 'agent_heartbeat_timeout',                                         |                   |
      |    retry_count,                                                               |                   |
      |    max_retries}                                                               |                   |
```

### 9b. Retry Branch (retry_count < max_retries)

```
AlertService        TaskService         Scheduler           EventBus
      |                   |                   |                   |
      | <-- TaskFailed event                  |                   |
      |-- alert EngineeringLead               |                   |
      |   "Task T failed: agent timeout"      |                   |
      |   "Retry {retry_count+1}/{max_retries}"                   |
      |                   |                   |                   |
      |                   |-- UPDATE task --> |                   |
      |                   |   status=Queued   |                   |
      |                   |   retry_count += 1|                   |
      |                   |   worker_id=NULL  |                   |
      |                   |   scheduled_after=|                   |
      |                   |   now()+backoff   |                   |
      |                   |                   |                   |
      |                   |-- publish ------------------------------------------->
      |                   |   TaskRetryQueued                                     |
      |                   |   {task_id,                                           |
      |                   |    retry_count,                                       |
      |                   |    max_retries}                                       |
      |                   |                   |                   |                   |
      |                   |                   |-- (next cycle) -->|                   |
      |                   |                   |   picks up task   |                   |
      |                   |                   |   from queue      |                   |
      |                   |                   |   (see Flow 2)    |                   |
```

### 9c. Max Retries Exceeded Branch

```
AlertService        TaskService         EventBus
      |                   |                   |
      | <-- TaskFailed event                  |
      |   (retry_count == max_retries)        |
      |                   |                   |
      |                   |-- task remains -->|
      |                   |   status=Failed   |
      |                   |   no Queued       |
      |                   |   transition      |
      |                   |                   |
      |                   |-- publish ------------------------------------------->
      |                   |   TaskEscalated                                       |
      |                   |   {task_id,                                           |
      |                   |    company_id,                                        |
      |                   |    retry_count,                                       |
      |                   |    failure_reason}                                    |
      |                   |                   |                                   |
      | <-- TaskEscalated event               |                                   |
      |-- escalation alert                    |                                   |
      |   EngineeringLead                     |                                   |
      |   + Engineering Manager               |                                   |
      |   "Task T permanently failed          |                                   |
      |    after {max_retries} attempts.      |                                   |
      |    Manual intervention required."     |                                   |
```

**Key design decisions:**

- **Ordered shutdown sequence.** Recovery always proceeds in the same order: mark worker Offline → abort session → mark task Failed → release workspace lock → archive workspace → publish events → evaluate retry. This ordering guarantees that no step assumes a resource is available that a prior step has already freed. Inverting the order (e.g., releasing the lock before aborting the session) would create a window where a new agent could claim the workspace while the previous session record still shows Running.
- **Exponential backoff on retry.** The `scheduled_after` field is set to `now() + backoff(retry_count)` rather than immediately re-queuing. This prevents a flapping agent from consuming all scheduler cycles in rapid succession. The backoff formula is configurable per company; the default is `30 * 2^(retry_count - 1)` seconds, capped at 10 minutes.
- **Two distinct alert severities.** A first failure triggers an informational alert ("retrying") so the engineering lead is aware but does not need to act immediately. Max retries exceeded triggers an escalation alert that reaches both the lead and a manager, with explicit language that manual intervention is required. These are different notification templates, not the same template with a different subject line.
- **TaskEscalated as a separate event.** The system publishes `TaskEscalated` independently of `TaskFailed` once max retries are exhausted. This allows subscribers (dashboards, on-call pagers, ticket-creation integrations) to distinguish a routine transient failure from a task that has permanently stopped making progress. `TaskFailed` fires on every failure; `TaskEscalated` fires at most once per task.
- **WorkspaceLock force-released.** The workspace lock is released unconditionally during recovery, regardless of whether the workspace itself is in a clean state. A dirty workspace is archived rather than returned to the Idle pool, preventing a future task from inheriting corrupted intermediate state. The workspace is not reused after a forced lock release.
