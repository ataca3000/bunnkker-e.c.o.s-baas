# ADR-021 — Developer Agent Architecture

**Status:** Approved
**Date:** 2026-07-22
**Author:** Engineering Platform Team
**Supersedes:** None
**Related:** ADR-020 (Engineering Cloud Vision), ADR-024 (Task Lifecycle)

---

## 1. Context and Problem

### Why a Formal Agent Architecture Is Needed

The Engineering Cloud platform introduces autonomous software agents that execute engineering tasks — writing code, running tests, analyzing dependencies, generating documentation — without direct human intervention on each action. As the fleet grows beyond a handful of manually managed processes, informal conventions break down rapidly. Without a formal architecture, the following failure modes emerge:

- **Registration ambiguity.** Without a defined handshake, the platform cannot distinguish a legitimate agent from a misconfigured process, a crashed zombie, or a replay of a stale registration.
- **Capability mismatch.** Tasks assigned to workers that lack the required runtime, language toolchain, or hardware accelerator fail silently or produce corrupt artifacts.
- **Orphaned workspaces.** When an agent crashes mid-task, its workspace lock is never released, blocking future assignment of the same workspace.
- **Heartbeat absence.** The platform has no reliable signal to distinguish a busy agent from a dead one, causing tasks to stall indefinitely.
- **Cross-agent data leakage.** Without an explicit isolation boundary, concurrent agents sharing a host can read each other's working directories, credentials, or environment variables.
- **Audit gaps.** Autonomous execution produces accountability questions — which agent wrote which artifact, under which identity, at what time — that cannot be answered retroactively without structured logging.

### The Challenges of Managing an Autonomous Agent Fleet

An agent fleet is not a pool of long-running servers. Agents start, execute one or more tasks, and may terminate. New agent versions deploy alongside old ones. Agents span clouds, on-premises hardware, and developer laptops. This creates challenges that static infrastructure tooling does not address:

- **Dynamic membership.** The fleet membership is not static; agents join and leave continuously. The platform must track live membership without requiring manual registration.
- **Heterogeneous capability.** A database specialist agent and a frontend agent may share the same base binary but differ in installed runtimes, available credentials, and permitted task types. Capability must be declared, not assumed.
- **Trust establishment.** The platform issues tasks that result in code commits and artifact publications. Each agent must be positively identified before it receives any work, and its authority must expire if it goes silent.
- **Fault at scale.** Any individual agent may crash, lose network connectivity, exhaust disk, or encounter an unhandled exception. The fleet as a whole must absorb individual failures without degrading throughput.
- **Observability.** Human engineers need real-time visibility into what each agent is doing, what it has produced, and why it failed, without logging into individual machines.

This ADR establishes the canonical architecture that all agents — regardless of implementation language, deployment environment, or specialization — must conform to.

---

## 2. Agent Types

Three agent types are recognized. Each has a distinct scope of authority, capability surface, and hardware profile. No other agent types may be introduced without a superseding ADR.

### 2.1 StandardAgent

**Description.** A general-purpose worker capable of executing the common task categories: code generation, refactoring, documentation, lightweight analysis, and artifact packaging. StandardAgent is the default type and the most widely deployed.

**Capabilities.** Language runtimes for the primary platform stack (PHP, TypeScript, Python), standard CLI tools (git, composer, npm, docker), file system read and write within its assigned workspace, REST and WebSocket client, artifact upload via the Data Channel.

**Hardware Requirements.** 2 vCPU, 4 GB RAM, 20 GB ephemeral disk. No GPU required. Network egress to platform endpoints and configured source hosts (GitHub, package registries).

**Trust Level.** Standard. The agent is authenticated via JWT and may only access workspaces explicitly assigned to it. It cannot spawn child agents, cannot access other agents' workspaces, and cannot promote its own task priority.

---

### 2.2 SpecialistAgent

**Description.** A capability-specific agent built and deployed for a defined specialization. Current specializations are: database (schema migrations, query optimization, index analysis), frontend (React and TypeScript builds, visual regression), and testing (test generation, coverage analysis, mutation testing). A SpecialistAgent declares one or more specialization tags during registration; the task scheduler uses these tags to route tasks that require specialist skills.

**Capabilities.** All StandardAgent capabilities plus the specialization-specific runtime (PostgreSQL client tools for database agents, browser engine for frontend agents, mutation testing frameworks for testing agents). Specialization credentials are injected at registration time through the platform's secret manager and are not stored on the agent host.

**Hardware Requirements.** Vary by specialization. Database agents: 4 vCPU, 8 GB RAM, 40 GB disk. Frontend agents: 4 vCPU, 8 GB RAM, 20 GB disk plus a headless browser engine. Testing agents: 4 vCPU, 16 GB RAM, 40 GB disk (mutation testing is memory-intensive).

**Trust Level.** Elevated for specialization-scoped operations only. A database SpecialistAgent may execute schema migration scripts that a StandardAgent may not. The elevation is bounded: a database agent cannot perform frontend operations, and its elevated scope is declared in its WorkerCapability records and validated on every task assignment.

---

### 2.3 OrchestratorAgent

**Description.** A meta-agent that accepts a high-level task, decomposes it into subtasks, submits those subtasks to the ExecutionQueue, monitors their progress, aggregates their artifacts, and reports the composite result. An OrchestratorAgent does not execute subtasks directly. Its role is coordination, not execution.

**Capabilities.** Task submission (create EngineeringTask records), task monitoring (read ExecutionLog and TaskArtifact records for its own submitted tasks), artifact aggregation (assemble a ReleaseBundle from multiple TaskArtifacts), dependency graph resolution. An OrchestratorAgent may not write code, modify files, or access any workspace directly.

**Hardware Requirements.** 2 vCPU, 2 GB RAM, 5 GB disk. The OrchestratorAgent performs no heavy computation; its workload is I/O — polling, aggregating, and writing coordination records.

**Trust Level.** Coordinator. The OrchestratorAgent has read access to the status and artifact metadata of all tasks it submitted. It has no read access to the workspaces of its subtasks and cannot inspect file contents produced by those tasks until they are formally published as TaskArtifacts. It cannot modify tasks submitted by other orchestrators.

---

## 3. Agent Anatomy

Every agent, regardless of type, must implement the following seven components. These are protocol obligations, not implementation suggestions. An agent that omits any component is non-conformant and will be rejected at registration.

---

### 3.1 Protocol Handler

**Responsibility.** Manages all communication with the platform. Owns the WebSocket connection for the Control Channel and the HTTP client for the Data Channel. Serializes and deserializes the JSON message envelope defined in Section 6.3. Dispatches inbound messages to the correct internal component. Ensures all outbound messages carry the required envelope fields.

**Interface.** Exposes `connect(endpoint, token)`, `disconnect(reason)`, `send(message)`, and `on(type, handler)`. All other components communicate with the platform exclusively through the Protocol Handler. No component may open its own network connection to the platform.

---

### 3.2 Task Runner

**Responsibility.** Receives an assigned task from the Protocol Handler. Validates that the task type matches the agent's declared capabilities. Executes the task — invoking CLI tools, language runtimes, or internal logic as required. Emits progress events at regular intervals during execution. Captures stdout, stderr, and structured logs and forwards them to the Log Streamer. On completion, hands off produced files to the Artifact Manager. On failure, captures the exception, produces a structured failure record, and reports it back through the Protocol Handler.

**Interface.** Exposes `accept(task)`, `pause()`, `resume()`, `abort(reason)`. Returns a `TaskResult` containing status, exit code, error detail (if any), and a list of artifact paths. The Task Runner is the only component permitted to perform actions that modify the assigned workspace.

---

### 3.3 Workspace Manager

**Responsibility.** Provisions and tears down the local workspace for each task. On task acceptance, creates the workspace directory, writes the task context (task ID, parameters, configuration) to a local manifest file, and acquires the WorkspaceLock by notifying the platform. On task completion or failure, archives logs, releases the WorkspaceLock, and cleans the workspace directory. On crash recovery (detected at next startup), identifies any lingering workspace from a previous session and triggers cleanup before registering.

**Interface.** Exposes `provision(task)`, `release(task_id, outcome)`, `cleanup_stale()`. The Workspace Manager owns the local file system path for the workspace. No other component may resolve or create file paths independently.

---

### 3.4 Artifact Manager

**Responsibility.** Accepts file paths from the Task Runner after task completion. Computes a SHA-256 checksum for each file. Uploads each file to the platform via the Data Channel (multipart HTTP POST). Receives a PipelineArtifact record ID for each successful upload and stores the mapping locally. Reports the artifact manifest (list of artifact IDs and their checksums) as part of the task completion message. Retries failed uploads up to three times with exponential backoff before reporting an upload failure.

**Interface.** Exposes `upload(file_path, task_id, artifact_type)`, `get_manifest(task_id)`. The Artifact Manager is the only component that writes to the Data Channel.

---

### 3.5 Health Reporter

**Responsibility.** Maintains the agent's runtime metrics: CPU utilization, memory usage, disk usage, current task ID (if any), and uptime. Composes and transmits the heartbeat payload on the 30-second interval defined in Section 7. Tracks consecutive missed heartbeat acknowledgements. If three acknowledgements are missed, triggers a reconnect attempt through the Protocol Handler. If reconnect fails after five attempts, initiates graceful shutdown.

**Interface.** Exposes `start()`, `stop()`, `get_metrics()`. The Health Reporter operates on its own timer and does not block the Task Runner.

---

### 3.6 Log Streamer

**Responsibility.** Receives log lines from the Task Runner in real time. Buffers lines into 100-line or 5-second batches (whichever comes first). Uploads batches to the platform via the Data Channel as structured JSON (each line carries a timestamp, level, source, and text). Ensures logs are flushed and uploaded before the Task Runner reports task completion, so the platform always has a complete log before it marks a task terminal.

**Interface.** Exposes `write(level, source, text)`, `flush()`. The Log Streamer is append-only during a task and may not modify previously uploaded log batches.

---

### 3.7 Security Module

**Responsibility.** Stores the API key (used only at registration) and the current JWT (used for all subsequent requests). Validates that the JWT has not expired before each outbound request; if it has, requests a token refresh before proceeding. Prevents the API key from appearing in any log line or artifact. Enforces that the agent accesses only its own workspace directory and does not follow symbolic links that escape the workspace boundary. Clears all secrets from memory on shutdown.

**Interface.** Exposes `get_token()`, `refresh_token()`, `validate_path(path)`. All components that require authentication call `get_token()` rather than reading credentials directly. Path validation is called by the Workspace Manager before any file operation.

---

## 4. Agent Lifecycle

### 4.1 Registration Flow

When an agent process starts, it proceeds through the following steps before it may receive work.

**Step 1 — Startup self-check.** The agent reads its local configuration file (environment variables or a config file in a well-known location). It validates that required fields are present: `AGENT_API_KEY`, `AGENT_TYPE`, `PLATFORM_WS_ENDPOINT`, `PLATFORM_REST_ENDPOINT`, and `AGENT_CAPABILITIES`. It calls `cleanup_stale()` on the Workspace Manager to remove any workspace left over from a previous crash.

**Step 2 — API key authentication.** The agent sends a POST to `{PLATFORM_REST_ENDPOINT}/agents/register` with the `X-Agent-Key` header containing its API key, and a JSON body containing the `AgentRegistrationPayload` (defined in Section 8). The platform's AuthService verifies the key against the bcrypt hash stored in the database. If verification fails, the platform returns HTTP 401 and the agent exits with a non-zero code. The API key is never stored in a log line.

**Step 3 — JWT issuance.** On successful verification, the AuthService issues an RS256-signed JWT with a 24-hour TTL and a unique `jti` claim. The JWT is returned in the registration response body. The agent stores it in the Security Module.

**Step 4 — Worker record creation.** The platform's WorkerService creates an EngineeringWorker record in the database with state `Registering`. It records the agent type, declared capabilities, and a worker slot identifier.

**Step 5 — Capability advertisement.** The WorkerService creates one WorkerCapability record per declared capability. Each record links the worker to a capability tag and records the proficiency level and any required configuration keys.

**Step 6 — WebSocket connection.** The agent opens the WebSocket connection to `{PLATFORM_WS_ENDPOINT}/agents/channel` presenting the JWT in the `Authorization: Bearer` header. The WebSocket server validates the token and binds the connection to the worker record.

**Step 7 — Ready signal.** The agent sends a `worker.ready` message over the Control Channel. The WorkerService transitions the worker state from `Registering` to `Idle` and the agent begins its heartbeat loop.

**ASCII Sequence Diagram — Registration:**

```
Agent                    WebSocket Server         AuthService          WorkerService            DB
  |                            |                       |                     |                   |
  |-- POST /agents/register -->|                       |                     |                   |
  |   X-Agent-Key: <key>       |                       |                     |                   |
  |   AgentRegistrationPayload |                       |                     |                   |
  |                            |-- verify_key(key) --->|                     |                   |
  |                            |                       |-- SELECT worker --> |                   |
  |                            |                       |   WHERE api_key_hash|                   |
  |                            |                       |<-- worker found ----|                   |
  |                            |<-- JWT (RS256) --------|                     |                   |
  |<-- 200 { token, worker_id }|                       |                     |                   |
  |                            |                       |                     |                   |
  |                            |                       |                     |-- INSERT worker -->|
  |                            |                       |                     |   state=Registering|
  |                            |                       |                     |-- INSERT caps  -->|
  |                            |                       |                     |<-- OK ------------|
  |                            |                       |                     |                   |
  |-- WS CONNECT (JWT) ------->|                       |                     |                   |
  |                            |-- validate_jwt() ---->|                     |                   |
  |                            |<-- valid -------------|                     |                   |
  |                            |-- bind_connection() ->|                     |                   |
  |<-- WS OPEN ----------------|                       |                     |                   |
  |                            |                       |                     |                   |
  |-- worker.ready ----------->|                       |                     |                   |
  |                            |-- set_state(Idle) --->|                     |                   |
  |                            |                       |                     |-- UPDATE worker -->|
  |                            |                       |                     |   state=Idle       |
  |                            |                       |                     |<-- OK ------------|
  |<-- worker.activated -------|                       |                     |                   |
  |                            |                       |                     |                   |
```

---

### 4.2 Active Operation Loop

Once in the `Idle` state, the agent enters the active operation loop. This loop runs until the agent initiates shutdown or the platform terminates it.

**Heartbeat.** Every 30 seconds, the Health Reporter assembles the heartbeat payload and sends it over the Control Channel. The platform acknowledges with a `heartbeat.ack` message. The Health Reporter records the acknowledgement time.

**Task pull.** The platform uses a push model. When a task is routed to the agent, the WorkerService sends a `task.assigned` message over the Control Channel. The agent does not poll. If no task is assigned, the agent remains Idle, continuing its heartbeat loop.

**Task acceptance.** On receiving `task.assigned`, the Task Runner validates the task type against its declared capabilities. If the task is compatible, the agent sends `task.accepted` and transitions its worker state to `Busy`. The Workspace Manager provisions the workspace and acquires the WorkspaceLock. If the task is incompatible (a routing error), the agent sends `task.rejected` with a reason and remains Idle.

**Execution.** The Task Runner executes the task. The Log Streamer uploads log batches in real time. The Health Reporter continues its heartbeat loop in parallel — execution does not pause heartbeats.

**Artifact upload.** When execution finishes, the Task Runner hands artifact paths to the Artifact Manager. The Artifact Manager uploads all files to the platform and assembles the artifact manifest.

**Completion reporting.** The agent sends `task.completed` (or `task.failed`) over the Control Channel with the task result payload including status, exit code, artifact manifest, and a reference to the uploaded log batch IDs. The WorkerService updates the EngineeringTask record and the worker state returns to `Idle`.

**Return to Idle.** The Workspace Manager releases the WorkspaceLock and cleans the workspace directory. The agent is immediately eligible for the next task assignment.

---

### 4.3 Graceful Shutdown

A graceful shutdown is triggered by a `worker.drain` platform command, a local shutdown signal (SIGTERM), or an internal decision by the Health Reporter (failed reconnect attempts).

**Step 1 — Announce drain.** The agent sends `worker.draining` over the Control Channel. The WorkerService transitions the worker state to `Draining` and stops routing new tasks to this agent.

**Step 2 — Complete current work.** If a task is in progress, the Task Runner runs it to completion (or failure). No task is abandoned mid-execution during a graceful shutdown. If the task has already been running for more than its configured timeout, the Task Runner aborts it cleanly, uploads whatever artifacts and logs exist, and reports `task.failed` with reason `shutdown`.

**Step 3 — Release workspace lock.** The Workspace Manager releases the WorkspaceLock for any workspace associated with the agent. It archives the workspace directory (compressed) to the platform via the Data Channel before deletion, ensuring a post-mortem record exists.

**Step 4 — Deregister.** The agent sends `worker.deregistering` over the Control Channel. The WorkerService transitions the worker state to `Offline`.

**Step 5 — Close connection.** The Protocol Handler sends a WebSocket close frame with code 1000 (normal closure) and the Security Module clears all in-memory credentials. The process exits with code 0.

---

### 4.4 Crash Recovery

**Server-side detection.** The platform's WorkerService monitors heartbeat timestamps for all workers in `Idle` or `Busy` states. If a worker misses three consecutive expected heartbeats (90 seconds of silence), the WorkerService marks the worker as `Offline` and publishes a `WorkerHeartbeatMissed` event.

**Task reassignment policy.** Any task that was in the `Assigned` or `Accepted` state on the crashed worker is transitioned to `Queued`. The task's retry counter is incremented. If the retry counter is below the configured maximum (default: 3), the task is re-queued for assignment to another worker. If the retry counter reaches the maximum, the task transitions to `Failed` and a `TaskFailed` event is published with reason `worker_crash`.

**Workspace cleanup on crash.** The WorkspaceLock held by the crashed worker is released by the WorkerService after a 5-minute recovery window. This window allows the agent to restart and reclaim its lock (see below). After the window expires, the WorkerService marks the workspace as requiring cleanup and a background job removes the stale workspace directory on the host if the agent was managed infrastructure, or logs a cleanup warning if the agent was on unmanaged hardware.

**Agent-side restart recovery.** When a crashed agent restarts, the Workspace Manager calls `cleanup_stale()` before attempting registration. It identifies any workspace directory whose lock file is still present (indicating the previous process did not release it), uploads the contents as an emergency artifact, and removes the directory. The agent then proceeds through the normal registration flow.

**Recovery window.** If the agent restarts and completes registration within 5 minutes of the crash detection event, the WorkerService reassigns the same tasks back to it, skipping the retry counter increment.

---

## 5. Authentication

### 5.1 Registration: API Key

Agents authenticate their initial registration request using an API key. The key is presented in the `X-Agent-Key` HTTP header. On the platform side, the key is stored as a bcrypt hash (cost factor 12) in the `engineering_workers` table. The plaintext key is generated once, displayed to the operator once, and never retrievable again. Lost keys require generating a new key and re-registering the agent.

API keys do not expire on a time schedule but are revocable immediately. When a key is revoked, all active WebSocket connections authenticated with tokens derived from that key are terminated at the next token validation boundary (within 30 seconds).

The API key is used exclusively for the registration endpoint. It must never appear in WebSocket messages, log lines, artifact content, or environment variables that are visible to other processes.

### 5.2 Session: JWT

On successful registration, the platform issues an RS256-signed JWT. The token payload contains:

- `sub` — the worker UUID
- `iss` — the platform endpoint identifier
- `iat` — issued-at timestamp
- `exp` — expiry timestamp (24-hour TTL from issuance)
- `jti` — a randomly generated UUID unique to this token issuance, used for replay protection
- `agent_type` — the registered agent type
- `capabilities` — an array of capability tags declared at registration

The token is validated on every WebSocket message receipt and on every Data Channel HTTP request. Expired tokens cause the connection or request to be rejected with HTTP 401 or WebSocket close code 4001. The `jti` claim is checked against a short-lived Redis cache (TTL equal to the token TTL) to detect token replay.

Agents refresh their token by sending a `worker.token_refresh` message over the Control Channel. The platform issues a new JWT and invalidates the old `jti`. Agents should refresh proactively when less than 2 hours of TTL remain.

### 5.3 Optional Mutual TLS

In high-security deployment environments, the platform supports mutual TLS (mTLS) in addition to JWT authentication. When mTLS is enabled for a deployment zone:

- Each agent is provisioned with a client certificate issued by the platform's internal certificate authority.
- The WebSocket server and the Data Channel REST API require client certificate presentation in addition to the JWT `Authorization` header.
- The client certificate's subject CN must match the registered worker UUID.
- Certificate rotation follows the standard 90-day schedule managed by the platform's certificate manager.

mTLS is configured per deployment zone and is not required for development or standard cloud deployments. It is recommended for on-premises deployments that handle production code or credentials.

---

## 6. Communication Architecture

### 6.1 Control Channel (WebSocket)

The Control Channel is a persistent WebSocket connection between the agent and the platform. It carries low-latency, bidirectional control traffic.

**Messages sent by the agent to the platform:**
- `worker.ready` — signals the agent has completed registration and is entering Idle state
- `worker.draining` — signals the agent is entering graceful shutdown
- `worker.deregistering` — signals the agent is about to close the connection
- `worker.token_refresh` — requests a new JWT
- `heartbeat` — periodic health payload (see Section 7)
- `task.accepted` — confirms acceptance of an assigned task
- `task.rejected` — declines an incompatible task assignment
- `task.progress` — periodic progress update during execution
- `task.completed` — reports successful task completion
- `task.failed` — reports task failure

**Messages sent by the platform to the agent:**
- `worker.activated` — confirms the worker entered Idle state
- `heartbeat.ack` — acknowledges a heartbeat
- `worker.new_token` — delivers a refreshed JWT
- `task.assigned` — pushes a task assignment to the agent
- `task.cancelled` — notifies the agent that a running task has been cancelled by the platform
- `worker.drain` — instructs the agent to begin graceful shutdown

The Control Channel must not be used for large payloads. Messages must be under 64 KB. Artifact content, log batches, and other large data must use the Data Channel.

### 6.2 Data Channel (REST)

The Data Channel is a standard HTTPS REST API used for large payload transfers that would be inappropriate on the WebSocket Control Channel. All requests carry the `Authorization: Bearer {jwt}` header.

**Endpoints used by agents:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/v1/agents/artifacts | Upload a TaskArtifact file (multipart) |
| POST | /api/v1/agents/logs | Upload a structured log batch (JSON) |
| POST | /api/v1/agents/workspaces/{id}/archive | Upload a workspace archive on shutdown |
| GET | /api/v1/agents/tasks/{id} | Retrieve task context and parameters |

The Data Channel supports request payloads up to 512 MB for artifact uploads. Log batches are capped at 5 MB per request.

### 6.3 Message Format

All Control Channel messages use a JSON envelope. The envelope fields are mandatory on every message regardless of type.

```
{
  "type":           string   // Message type identifier, e.g. "heartbeat", "task.accepted"
  "id":             string   // UUID generated by the sender for this specific message
  "correlation_id": string   // UUID of the message this is responding to, or null for unsolicited messages
  "timestamp":      string   // ISO 8601 UTC timestamp of message creation
  "agent_id":       string   // The worker UUID of the sending agent
  "payload":        object   // Type-specific content; schema varies by message type
}
```

The `id` field enables idempotent message handling. The platform deduplicates messages with the same `id` within a 5-minute window. The `correlation_id` field links responses (such as `task.accepted`) to the triggering message (`task.assigned`). Implementations must not omit any envelope field; a missing field causes the message to be rejected with a `protocol.invalid_envelope` response.

---

## 7. Heartbeat Protocol

**Interval.** The agent's Health Reporter transmits a `heartbeat` message over the Control Channel every 30 seconds. The interval is fixed and is not configurable by the agent.

**Heartbeat Payload Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `worker_id` | UUID | The registered worker identifier |
| `state` | string | Current worker state (Idle, Busy, Paused, Draining) |
| `current_task_id` | UUID or null | ID of the task currently executing, null if Idle |
| `cpu_percent` | float | Current CPU utilization as a percentage (0–100) |
| `memory_mb` | integer | Current resident memory usage in megabytes |
| `disk_free_mb` | integer | Free disk space in megabytes on the workspace volume |
| `uptime_seconds` | integer | Seconds elapsed since the agent process started |
| `tasks_completed` | integer | Number of tasks completed in this session |
| `tasks_failed` | integer | Number of tasks failed in this session |
| `timestamp` | string | ISO 8601 UTC timestamp at which metrics were sampled |

**Server timeout.** The platform's WorkerService maintains the last-seen timestamp for each worker. If the current time exceeds the last-seen timestamp by more than 90 seconds (three missed intervals), the WorkerService marks the worker as `Offline` and triggers the crash recovery process described in Section 4.4.

**Recovery window.** After a crash detection event, the platform holds the worker record in `Offline` state for 5 minutes. If the agent reconnects and sends `worker.ready` within this window, the worker record transitions back to `Idle` without incrementing the crash counter on affected tasks. After the 5-minute window expires, the worker record transitions to `Terminated` and the agent must perform a full re-registration if it reconnects.

---

## 8. Capability Advertisement

### AgentRegistrationPayload Fields

The registration payload is submitted as the JSON body of the `POST /agents/register` request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_type` | string | Yes | One of: `StandardAgent`, `SpecialistAgent`, `OrchestratorAgent` |
| `agent_version` | string | Yes | Semantic version of the agent binary, e.g. `2.4.1` |
| `hostname` | string | Yes | The hostname or container ID of the agent host |
| `capabilities` | array | Yes | Array of capability objects (see below) |
| `hardware` | object | Yes | CPU count, memory MB, disk MB, GPU present boolean |
| `environment` | object | Yes | OS, runtime versions (PHP, Node, Python), tool versions (git, composer, npm) |
| `max_concurrent_tasks` | integer | Yes | Number of tasks the agent can run in parallel (typically 1 for StandardAgent) |
| `specialization_tags` | array | SpecialistAgent only | String tags declaring the agent's specialty, e.g. `["database", "migrations"]` |
| `metadata` | object | No | Arbitrary key-value pairs for operator use; not used by the scheduler |

**Capability object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Capability identifier, e.g. `php`, `typescript`, `postgres_migrations` |
| `proficiency` | string | One of: `basic`, `standard`, `expert` |
| `config_keys` | array | Environment variable names that must be present for this capability to be active |

### WorkerCapability Record Creation

On receipt of the `AgentRegistrationPayload`, the WorkerService creates one `WorkerCapability` record per capability object in the `capabilities` array. Each record stores the worker ID, capability name, proficiency level, and a boolean `active` flag. The `active` flag is set to `true` only if all `config_keys` for the capability are present in the platform's secret manager for the agent's deployment zone. A capability with `active = false` is ignored by the task scheduler.

### Capability Matching Algorithm

When the WorkerService routes a task, it uses the following matching algorithm:

1. Retrieve the task's `required_capabilities` array from the EngineeringTask record.
2. Query all workers in `Idle` state.
3. Filter: retain only workers where all capabilities in `required_capabilities` have a matching `WorkerCapability` record with `active = true`.
4. Score: for each remaining worker, compute a score as the sum of proficiency weights (basic = 1, standard = 2, expert = 3) across all matched required capabilities.
5. Sort: order by score descending, then by `tasks_completed` ascending (prefer less-loaded workers on a tie).
6. Select: assign to the top-scored worker. If no worker matches, the task remains `Queued` and the scheduler retries every 10 seconds.

---

## 9. Security Model

### Zero Trust

The Engineering Cloud applies Zero Trust principles to the agent fleet. No agent is trusted by virtue of its network location. Every request — Control Channel message, Data Channel upload, token refresh — is authenticated and authorized independently. Network-level access to the platform endpoints does not confer any privilege.

### Least Privilege

Each agent's JWT encodes only the capabilities it declared at registration. The platform's authorization layer validates that each action (task acceptance, workspace lock acquisition, artifact upload) is consistent with the agent's encoded capability set. An agent that declared no `database` capability may not accept a task with `required_capabilities: ["database"]`, even if it presents a valid JWT.

### Agent Isolation

Each agent is isolated from all other agents in the following ways:

- **Workspace isolation.** Each workspace is assigned a unique directory path that includes the workspace UUID. The Security Module validates every file path against this directory before permitting access. Paths that traverse outside the workspace boundary (via `..` segments or symbolic links) are rejected with a security violation log entry.
- **Secret isolation.** Secrets injected at registration are passed via environment variables scoped to the agent process. They are not written to disk and are cleared from environment on shutdown.
- **Log isolation.** Log records are tagged with the worker ID. The platform's log storage layer rejects log submissions where the `agent_id` in the envelope does not match the JWT `sub` claim.

### No Cross-Agent Data Access

An agent may not read artifact content, workspace files, or log records belonging to another agent. The Data Channel API enforces this: artifact retrieval requires that the requesting agent's JWT `sub` matches the `worker_id` on the artifact record, unless the requester is an OrchestratorAgent that submitted the task that produced the artifact.

### Rate Limiting

All agent-facing endpoints enforce rate limits to prevent runaway agents from degrading platform stability.

| Endpoint Category | Limit |
|------------------|-------|
| Registration | 10 requests per hour per API key |
| Control Channel messages | 120 messages per minute per worker |
| Data Channel artifact uploads | 60 uploads per hour per worker |
| Data Channel log batches | 360 batches per hour per worker |
| Token refresh | 24 requests per day per worker |

Rate limit violations return HTTP 429 or a `protocol.rate_limited` WebSocket response. Persistent rate limit violations trigger an automatic worker suspension and an alert to the platform operator.

---

## 10. Failure Taxonomy

| Failure Type | Detection Method | Recovery Action | Escalation Path |
|---|---|---|---|
| Heartbeat timeout | WorkerService detects 3 missed heartbeats (90 seconds of silence) | Worker marked Offline; running tasks re-queued; 5-minute recovery window started | If worker does not reconnect within window: tasks marked Failed after max retries; PlatformAlert event emitted; operator notified |
| Task execution error | Agent sends `task.failed` with structured error detail; or timeout on task duration exceeded | Task retry counter incremented; task re-queued if below max retries (default 3) | Task transitions to Failed state after max retries; TaskFailed event published; team notified via event subscriber |
| Workspace corruption | Workspace Manager detects missing manifest file or failed directory access on provision | Agent logs corruption event; task rejected with reason `workspace_corrupt`; WorkspaceLock released; workspace marked for cleanup | Platform operator alerted; workspace directory archived for forensics before deletion |
| Network partition | Heartbeat timeout detected server-side; agent-side WebSocket close received or send fails | Agent-side: Protocol Handler attempts reconnect with exponential backoff (max 5 attempts, 2-minute ceiling); Server-side: recovery window started | If reconnect fails: agent triggers graceful shutdown; server marks worker Offline; running task re-queued |
| Auth expiry | JWT exp claim exceeded; platform rejects request with 401 | Agent proactively refreshes token before expiry; if token is already expired when request is made, agent pauses action, refreshes token, retries once | If refresh fails (API key revoked): agent logs auth failure, enters drain state, closes connection cleanly |
| Resource exhaustion | Health Reporter detects disk_free_mb below threshold (default 500 MB) or memory_mb above 90% of hardware.memory_mb | Agent sends heartbeat with `state: Paused`; Task Runner pauses execution; agent waits for resource to recover | If resource does not recover within 10 minutes: agent aborts current task with reason `resource_exhaustion`, enters drain state; WorkerService triggers PlatformAlert |

---

## 11. Agent SDK Contract

Any conformant agent implementation — regardless of language — must satisfy the following protocol contract. This is not an API specification for a particular library; it is the behavioral specification that any library or custom implementation must fulfill.

An agent implementation is conformant if and only if it satisfies every item in this contract.

---

**Registration contract:**

- The agent must present its API key only in the `X-Agent-Key` header of the registration request. It must never include the key in any other message, log, or payload.
- The agent must submit a complete and valid `AgentRegistrationPayload`. All required fields must be present. Declared capabilities must reflect the agent's actual runtime environment at the time of registration.
- The agent must call `cleanup_stale()` before each registration attempt. Any workspace directory from a previous session that still holds a lock file must be archived and removed before proceeding.
- The agent must store the returned JWT in the Security Module and use it for all subsequent requests. The JWT must not be written to disk or included in log output.

**Heartbeat contract:**

- The agent must transmit a `heartbeat` message every 30 seconds while connected, in all states (Idle, Busy, Paused, Draining).
- The heartbeat payload must contain all fields defined in Section 7. Partial payloads are rejected.
- The agent must track acknowledgements. Three consecutive missed acknowledgements must trigger a reconnect attempt.

**Task contract:**

- The agent must send `task.accepted` or `task.rejected` within 10 seconds of receiving `task.assigned`. Silence is treated as rejection by the platform after the timeout.
- The agent must send `task.progress` at least every 60 seconds while a task is running. Silence for more than 90 seconds while `state = Busy` is treated the same as a missed heartbeat.
- The agent must upload all artifacts before sending `task.completed`. A completion message that references artifact IDs that have not been uploaded will cause the platform to reject the completion message and leave the task in Running state until a valid completion is received or the task times out.
- The agent must flush and upload all logs before sending `task.completed` or `task.failed`. The Log Streamer must call `flush()` as the last action before the completion message is composed.
- The agent must not mark a task as completed if the Task Runner exited with a non-zero exit code. A non-zero exit code is a task failure. The agent must send `task.failed` with the exit code and any captured error output.

**Workspace contract:**

- The agent must acquire the WorkspaceLock before writing any file to the workspace directory.
- The agent must validate every file path through the Security Module before access. Any path that escapes the workspace boundary must be rejected and logged as a security violation without executing the file operation.
- The agent must release the WorkspaceLock before sending `task.completed` or `task.failed`. A WorkspaceLock that is not released within 30 seconds of a terminal task message is force-released by the platform.

**Shutdown contract:**

- The agent must complete or abort any running task before closing the WebSocket connection. Closing the connection while a task is in progress without sending `task.completed` or `task.failed` constitutes an unclean shutdown and triggers the crash recovery path.
- The agent must send `worker.deregistering` before closing the connection during a graceful shutdown. Connections closed without this message are treated as crashes.
- The agent must clear all in-memory credentials in the Security Module before the process exits, including the JWT, the API key (if cached), and any injected secrets.

**Security contract:**

- The agent must not access file paths outside its assigned workspace directory.
- The agent must not initiate outbound network connections to any endpoint other than the platform's Control Channel, Data Channel, and the explicitly configured source hosts (source code repositories, package registries) required by its declared task types.
- The agent must not read environment variables belonging to other processes on the same host.
- The agent must not log the API key, the JWT, or any injected secret in plaintext. Log redaction of secret values is a mandatory implementation detail, not an optional enhancement.

---

*This document is the authoritative specification for all agent implementations on the Engineering Cloud platform. All conformance questions are resolved against the text of this ADR. Proposed exceptions require a superseding ADR approved by the Engineering Platform Team.*
