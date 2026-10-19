# ADR-027 — Agent Communication Protocol (ACP v1)

**Status:** Approved
**Date:** 2026-07-22
**Authors:** Engineering Platform Team
**Supersedes:** None (first ACP specification)
**Related:** ADR-026 (Worker Lifecycle), ADR-025 (Engineering Cloud Architecture)

---

## 1. Context

EngineeringAgents are autonomous workers that connect to the Engineering Cloud server to receive, execute, and report on EngineeringTasks. These agents may run on ephemeral cloud VMs, on-premise machines, or containerized environments. Network conditions are unreliable, execution windows span hours, and payloads range from a few bytes (heartbeat ACK) to hundreds of megabytes (build artifacts).

A formal wire protocol is required to:

- Authenticate agents without exposing long-lived secrets after initial registration
- Deliver task assignments reliably even under intermittent connectivity
- Stream structured execution logs and progress updates in near-real-time
- Transfer large artifacts efficiently without blocking the control channel
- Support graceful shutdown, pause/resume, and crash recovery without losing work
- Version the protocol so server and agent can negotiate compatibility

This document defines the complete Agent Communication Protocol version 1 (ACP v1): message shapes, connection lifecycle, authentication, heartbeat cadence, reconnection strategy, offline buffering, compression rules, timeout matrix, and error codes.

---

## 2. Protocol Overview

ACP v1 uses a **hybrid channel model**:

| Channel | Transport | Direction | Purpose |
|---|---|---|---|
| Control Channel | WebSocket over TLS | Bidirectional | Task assignments, heartbeats, progress, control signals |
| Data Channel | HTTPS REST | Agent to Server | Artifacts, log batches, payloads over 100 KB |

### 2.1 Design Principles

**Control Channel is authoritative.** All state transitions (task accept, start, complete, fail) are signaled over WebSocket. The Data Channel is a bulk-transfer supplement only.

**Idempotent operations.** Every message carries a unique `id`. The server deduplicates by `id` for a rolling 1-hour window. Agents may safely retry any message whose ACK was lost.

**Server is the clock.** Agent timestamps are recorded for audit but server timestamps are authoritative for SLA calculations. Clock skew above 60 seconds generates a warning; above 300 seconds the registration is rejected.

**Fail-closed on silence.** Missing heartbeats, missing ACKs, and missing task.start signals all trigger server-side protective actions. The protocol assumes connectivity loss, not successful quiet execution.

**Structured errors everywhere.** No plain-text error messages leave the protocol layer. Every failure carries a machine-readable error code, a human-readable reason, and a recovery hint.

---

## 3. Message Envelope

Every WebSocket frame carries a single JSON object conforming to the following envelope. All fields are required unless marked optional.

```
{
  "v":              <integer>       — ACP protocol version; currently 1
  "type":           <string>        — message type identifier (see Section 4)
  "id":             <string UUID>   — unique message ID (UUIDv4, sender-generated)
  "correlation_id": <string UUID|null> — ID of the message this is responding to; null for unsolicited messages
  "timestamp":      <string ISO8601> — sender wall-clock time, e.g. "2026-07-22T09:15:00.000Z"
  "agent_id":       <string UUID>   — UUID of the sending EngineeringAgent; null before registration completes
  "session_id":     <string UUID|null> — active ExecutionSession UUID if a task is in progress; otherwise null
  "payload":        <object>        — type-specific payload (see Section 4 per message type)
}
```

**Envelope validation rules:**

- `v` must equal 1 or a version the server has declared it supports (see Section 13).
- `id` must be a valid UUIDv4. Duplicate IDs within the deduplication window are silently ACKed without reprocessing.
- `timestamp` must parse as ISO8601. Values more than 300 seconds from server time are rejected with error code 4010.
- `agent_id` must be null only in the `agent.register` message. All subsequent messages with a null `agent_id` from an authenticated connection are rejected with error code 4020.
- `payload` must be a JSON object, never null, never an array. An empty payload is represented as `{}`.
- Maximum uncompressed envelope size on the Control Channel is 512 KB. Larger payloads must use the Data Channel.

---

## 4. Message Type Catalog

Messages are listed in logical lifecycle order. Direction notation: **A→S** = Agent to Server, **S→A** = Server to Agent, **B** = Bidirectional.

---

### 4.1 agent.register

**Direction:** A→S
**When sent:** Immediately after WebSocket upgrade, before any other message. Must arrive within 10 seconds of connection establishment or the server closes the connection with code 4003.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `api_key` | string | Agent API key issued during worker provisioning. Never reused after first successful registration in a session. |
| `name` | string | Human-readable agent name, 1–128 characters, used in dashboards and logs. |
| `agent_type` | string | Enum: `build`, `test`, `deploy`, `review`, `analysis`, `general`. Determines task routing eligibility. |
| `capabilities` | array of string | List of WorkerCapability identifiers the agent can fulfill, e.g. `["php:8.3", "node:20", "docker:24", "git:2.44"]`. |
| `resource_spec` | object | Hardware description: `cpu_cores` (integer), `memory_mb` (integer), `disk_gb` (integer), `architecture` (string: `x86_64` or `arm64`). |
| `acp_version` | integer | Protocol version the agent speaks. Server will negotiate down if compatible. |
| `agent_version` | string | Agent software version string, e.g. `"1.4.2"`. For diagnostics. |
| `hostname` | string | Machine hostname. For diagnostics and deduplication detection. |
| `reconnect_token` | string or null | Opaque token from a previous session's `agent.registered` response. Enables session resume. Null on first connection. |

**Expected response:** `agent.registered` on success, `agent.reject` on failure.

**Error handling:** If no response is received within 10 seconds, the agent closes the connection and begins reconnection backoff (Section 8).

---

### 4.2 agent.registered

**Direction:** S→A
**When sent:** Immediately after a successful `agent.register` validation.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `jwt_token` | string | Short-lived JWT (TTL 8 hours) signed with the server's private key. Must be presented as `Authorization: Bearer <token>` on all Data Channel REST calls. |
| `worker_id` | string UUID | The EngineeringWorker UUID assigned to this agent. Stable across reconnections for the same physical agent if `reconnect_token` was used. |
| `server_version` | string | Engineering Cloud server version string. |
| `heartbeat_interval_seconds` | integer | How frequently the agent must send `agent.heartbeat`. Typically 30. |
| `heartbeat_grace_seconds` | integer | Maximum latency the server will tolerate before marking a heartbeat as missed. Typically 5. |
| `supported_acp_versions` | array of integer | Protocol versions the server supports, e.g. `[1]`. Used for future negotiation. |
| `reconnect_token` | string | New opaque token the agent must persist to disk and present on the next `agent.register` for session continuity. Rotated on every registration. |
| `assigned_queue` | string | Name of the ExecutionQueue this worker has been placed in. |
| `clock_skew_ms` | integer | Measured difference between agent timestamp and server time in milliseconds. Positive means agent clock is ahead. |

**Expected response:** None. The agent transitions to Idle state and begins the heartbeat loop.

---

### 4.3 agent.reject

**Direction:** S→A
**When sent:** When `agent.register` fails validation.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `error_code` | integer | ACP error code from the 4xxx series (see Section 12). |
| `reason` | string | Human-readable rejection reason. |
| `retryable` | boolean | Whether the agent may attempt re-registration after a backoff period. False for permanent failures such as invalid or revoked API keys. |
| `retry_after_seconds` | integer or null | Minimum seconds before retrying. Null if `retryable` is false. |

**Expected response:** None. The server closes the WebSocket after sending.

**Error handling:** Agent must not retry immediately. Observe `retry_after_seconds` or apply default backoff if null and `retryable` is true.

---

### 4.4 agent.heartbeat

**Direction:** A→S
**When sent:** Every `heartbeat_interval_seconds` seconds, starting immediately after entering Idle state. Sent regardless of whether a task is in progress.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `cpu_percent` | number (0–100) | Current CPU utilization across all cores, averaged over the last interval. |
| `memory_mb_used` | integer | Current physical memory consumed in megabytes. |
| `disk_free_gb` | number | Free disk space available to the agent workspace in gigabytes. |
| `load_average` | number | 1-minute Unix load average. 0 on non-Unix platforms. |
| `active_task_id` | string UUID or null | UUID of the EngineeringTask currently being executed, or null if idle. |
| `worker_state` | string | Current WorkerState: `Idle`, `Busy`, `Paused`, or `Draining`. |

**Expected response:** `agent.heartbeat.ack` within `heartbeat_grace_seconds`.

**Error handling:** Three consecutive missed ACKs trigger the reconnection protocol (Section 8). The agent does not stop executing its current task during reconnection.

---

### 4.5 agent.heartbeat.ack

**Direction:** S→A
**When sent:** In response to every `agent.heartbeat`.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `server_time` | string ISO8601 | Server's current time at ACK generation. Used by agent to measure clock drift. |
| `next_expected_at` | string ISO8601 | Absolute time by which the next heartbeat must arrive. |
| `worker_state_confirmed` | string | Worker state the server has recorded. If it differs from what the agent reported, the agent should log a warning. |

**Expected response:** None.

---

### 4.6 task.available

**Direction:** S→A
**When sent:** When a new EngineeringTask enters the Queued state and matches the agent's `agent_type` and `capabilities`. Also sent to Idle agents when the server restarts or re-evaluates the queue. This is a notification, not an assignment.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The EngineeringTask UUID available for pickup. |
| `priority` | integer (1–10) | Task priority; 10 is highest. |
| `estimated_duration_seconds` | integer or null | Server's estimate of execution time based on historical data. Null if no history exists. |
| `task_type` | string | Brief category label, e.g. `"build"`, `"test-suite"`, `"deployment"`. For agent-side filtering. |
| `expires_at` | string ISO8601 | Time after which this notification is stale and the task may have been assigned elsewhere. |

**Expected response:** `task.pull` if the agent wishes to claim the task, or no response if the agent is already at capacity. Multiple agents may receive this notification; the first to issue `task.pull` wins.

**Error handling:** Agents must not issue `task.pull` after `expires_at`. Doing so returns error code 4030.

---

### 4.7 task.pull

**Direction:** A→S
**When sent:** When the agent decides to claim a task, either in response to `task.available` or proactively when the agent becomes Idle and wishes to solicit work.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID or null | UUID of a specific task to claim, taken from a prior `task.available` notification. Null to request any matching task from the queue. |
| `max_duration_seconds` | integer or null | Maximum wall-clock seconds the agent is willing to commit. Server will not assign tasks whose estimated duration exceeds this. Null means no limit. |

**Expected response:** `task.assign` if a matching task is available and the agent won the race, or `error` with code 4031 if the task was already claimed by another agent, or `error` with code 4032 if no matching tasks exist.

**Error handling:** On 4031, the agent may immediately send another `task.pull` with `task_id: null` to request any available work.

---

### 4.8 task.assign

**Direction:** S→A
**When sent:** In response to a successful `task.pull`. The task transitions to the Assigned state on the server.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The assigned EngineeringTask UUID. |
| `title` | string | Task title for logging and display. |
| `priority` | integer (1–10) | Task priority. |
| `deadline` | string ISO8601 or null | Hard deadline by which the task must complete. Null if no deadline is set. |
| `accept_timeout_seconds` | integer | Seconds within which the agent must send `task.accept`. Failure returns the task to Queued. Typically 30. |
| `workspace` | object | Workspace details: `workspace_id` (UUID), `workspace_path` (string), `workspace_state` (string), `provisioned_at` (ISO8601 or null). |
| `git_branch` | string | Git branch the agent must check out before beginning work. |
| `git_commit` | string or null | Specific commit SHA to pin to. Null means the branch HEAD. |
| `repository_url` | string | HTTPS URL of the repository. Authentication via the JWT token as a bearer credential. |
| `environment_variables` | object | Map of string keys to string values. Injected into the task execution environment. Values may be encrypted; see `encrypted_env_keys`. |
| `encrypted_env_keys` | array of string | Keys in `environment_variables` whose values are encrypted with the agent's public key. Agent must decrypt before use. |
| `input_artifact_ids` | array of UUID | PipelineArtifacts the agent must download from the Data Channel before starting. |
| `task_definition` | object | Full task specification including steps, timeout policies, retry limits, and expected output contract. |

**Expected response:** `task.accept` or `task.reject` within `accept_timeout_seconds`.

---

### 4.9 task.accept

**Direction:** A→S
**When sent:** After the agent validates the `task.assign` payload, confirms workspace availability, and decides it can proceed. The task transitions to Accepted state.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The task being accepted. Must match the most recently received `task.assign.task_id`. |
| `estimated_start_seconds` | integer | Seconds from now until the agent will send `task.start`. Allows server-side scheduling dashboards to display accurate ETA. |
| `workspace_ready` | boolean | Whether the agent found the workspace already provisioned and ready. False means provisioning is in progress. |

**Expected response:** None. The server logs the acceptance and waits for `task.start`.

---

### 4.10 task.reject

**Direction:** A→S
**When sent:** When the agent cannot accept the assigned task. The task returns to Queued state and is re-offered to other agents.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The task being rejected. |
| `reason_code` | string | Machine-readable reason: `workspace_unavailable`, `capability_mismatch`, `resource_exhausted`, `deadline_unreachable`, `dependency_unresolved`, `agent_draining`, `other`. |
| `reason` | string | Human-readable explanation. Max 512 characters. |
| `retry_eligible` | boolean | Whether the agent believes another agent could succeed, or if the task itself has a fundamental issue. |

**Expected response:** None.

---

### 4.11 task.start

**Direction:** A→S
**When sent:** When the agent begins actual execution — after workspace is provisioned, input artifacts downloaded, and environment configured. The task transitions to Running state and an ExecutionSession is created.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The task now starting. |
| `session_id` | string UUID | The ExecutionSession UUID the agent generates for this run. Must be unique. The agent sets this as `session_id` in all subsequent envelope headers until the task ends. |
| `workspace_path` | string | Absolute path of the workspace on the agent machine. For diagnostics. |
| `git_commit_resolved` | string | The actual commit SHA checked out. Matches `git_commit` from `task.assign` if pinned, or the resolved HEAD SHA otherwise. |
| `started_at` | string ISO8601 | Agent's local timestamp when execution began. |

**Expected response:** None. The server starts the task SLA timer.

---

### 4.12 task.progress

**Direction:** A→S
**When sent:** Periodically during task execution to report progress. Recommended interval: every 30 seconds or on significant step transitions, whichever comes first. Not required; tasks without progress updates are still valid.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The task in progress. |
| `percent_complete` | integer (0–100) | Estimated percentage of work completed. Must be monotonically non-decreasing. |
| `message` | string | Short human-readable status message, e.g. `"Running test suite: 142/380 passed"`. Max 256 characters. |
| `current_step` | string | Name of the currently executing step as defined in the task definition. |
| `elapsed_seconds` | integer | Wall-clock seconds since `task.start` was sent. |
| `estimated_remaining_seconds` | integer or null | Agent's estimate of remaining time. Null if unknown. |

**Expected response:** None. The server stores the latest progress snapshot.

---

### 4.13 task.pause

**Direction:** S→A
**When sent:** When an operator or automated policy requests task execution be suspended. Reasons include resource pressure, higher-priority task preemption, operator intervention, or scheduled maintenance.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The task to pause. |
| `reason` | string | Human-readable explanation. Max 512 characters. |
| `checkpoint_deadline_seconds` | integer | Maximum seconds allowed to reach a safe checkpoint. After this deadline, the server will forcibly close the connection if `task.paused` has not been received. |
| `resumable` | boolean | Whether the server expects to resume this task. False means the agent should clean up after checkpointing. |

**Expected response:** `task.paused` within `checkpoint_deadline_seconds`.

---

### 4.14 task.paused

**Direction:** A→S
**When sent:** After the agent has reached a safe checkpoint and suspended execution.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The task now paused. |
| `checkpoint_path` | string or null | Path to the checkpoint file or directory on the agent machine, relative to the workspace. Null if no checkpoint was created (stateless pause). |
| `checkpoint_artifact_id` | string UUID or null | If the agent uploaded the checkpoint via the Data Channel, the resulting PipelineArtifact UUID. Null otherwise. |
| `paused_at_step` | string | The step name at which execution was paused. |
| `paused_at_percent` | integer (0–100) | Progress percentage at pause time. |

**Expected response:** None. The task transitions to Paused state on the server.

---

### 4.15 task.resume

**Direction:** S→A
**When sent:** When execution should continue after a pause.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The task to resume. |
| `checkpoint_artifact_id` | string UUID or null | If the checkpoint was stored server-side, the artifact to download before resuming. Null if the checkpoint remains on the agent. |
| `resume_from_step` | string or null | Override: restart from a specific step rather than the paused step. Null means continue from where paused. |

**Expected response:** `task.start` with the same `session_id` as the original session, followed by `task.progress` updates.

---

### 4.16 task.complete

**Direction:** A→S
**When sent:** When the task has finished successfully. The task transitions to Completed state.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The completed task. |
| `summary` | string | Human-readable completion summary. Max 2048 characters. |
| `artifact_ids` | array of UUID | PipelineArtifact UUIDs produced during this task and uploaded via the Data Channel. May be empty. |
| `duration_seconds` | integer | Total wall-clock execution time from `task.start` to completion. |
| `exit_code` | integer | Process exit code of the primary workload. 0 for success. |
| `output_contract_met` | boolean | Whether all outputs specified in the task definition's expected output contract were produced. |
| `metrics` | object | Key-value map of execution metrics: `tests_passed`, `tests_failed`, `lint_errors`, `coverage_percent`, `build_size_bytes`, etc. All values are numbers. Extensible. |

**Expected response:** None. The server closes the ExecutionSession and marks the task Completed.

---

### 4.17 task.fail

**Direction:** A→S
**When sent:** When the task has failed and cannot continue. The task transitions to Failed state unless `will_retry` is true, in which case it returns to Queued with incremented attempt count.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The failed task. |
| `error_code` | string | Machine-readable failure category: `timeout`, `build_error`, `test_failure`, `deploy_error`, `workspace_error`, `dependency_failure`, `oom_killed`, `signal_killed`, `unknown`. |
| `error_message` | string | Human-readable error description. Max 4096 characters. |
| `will_retry` | boolean | Whether the agent believes a retry would succeed. The server makes the final retry decision based on task retry policy, but this signal influences it. |
| `failed_at_step` | string or null | Step name where failure occurred. Null if failure happened before step execution began. |
| `partial_artifact_ids` | array of UUID | Any artifacts produced before failure. May be useful for diagnostics. May be empty. |

**Expected response:** None.

---

### 4.18 artifact.upload.init

**Direction:** A→S (over Control Channel, but the actual upload uses the Data Channel)
**When sent:** Before uploading a large artifact. Initiates a multipart upload session and returns an upload URL for the Data Channel.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | string UUID | The task this artifact belongs to. |
| `filename` | string | Original filename including extension. Max 512 characters. |
| `content_type` | string | MIME type, e.g. `"application/zip"`, `"application/octet-stream"`. |
| `size_bytes` | integer | Total artifact size in bytes. Server rejects if this exceeds the configured artifact size limit (default 10 GB). |
| `checksum_algorithm` | string | Algorithm used for integrity verification: `sha256` or `sha512`. |
| `checksum` | string | Hex-encoded checksum of the complete artifact computed before upload begins. |
| `artifact_type` | string | Semantic label: `build_output`, `test_report`, `coverage_report`, `deployment_package`, `checkpoint`, `log_archive`, `other`. |
| `retention_days` | integer or null | Requested retention period. Null means use server default. Server may override. |

**Expected response:** `artifact.upload.ready` (S→A) with `upload_id` (UUID), `upload_url` (HTTPS URL), `expires_at` (ISO8601), and `part_size_bytes` (integer, minimum chunk size for multipart).

**Error handling:** If no `artifact.upload.ready` is received within 30 seconds, the agent retries `artifact.upload.init` with the same `id` (server deduplication returns the same upload session).

---

### 4.19 artifact.upload.complete

**Direction:** A→S
**When sent:** After all Data Channel upload parts have been PUT successfully. Triggers server-side checksum verification and artifact finalization.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `upload_id` | string UUID | The upload session ID from `artifact.upload.ready`. |
| `etag` | string | ETag returned by the storage layer after the final part was received. Passed back for server-side multipart completion. |
| `parts` | array of object | For multipart uploads: `[{"part_number": 1, "etag": "..."}]`. Empty array for single-part uploads. |

**Expected response:** `artifact.finalized` (S→A) with `artifact_id` (UUID), `confirmed_checksum` (string), and `url` (string, download URL). Error response `error` with code 4060 if checksum mismatch.

---

### 4.20 log.batch

**Direction:** A→S
**When sent:** Periodically (every 10 seconds or when 500 log entries accumulate, whichever is first) to ship structured execution logs. Always sent over the Data Channel (HTTP POST) when the batch exceeds 50 KB; smaller batches may use the Control Channel.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `session_id` | string UUID | The active ExecutionSession. |
| `task_id` | string UUID | The task these logs belong to. |
| `batch_sequence` | integer | Monotonically increasing batch number for this session. Used to detect gaps. |
| `entries` | array of object | Log entries (see entry schema below). Maximum 500 entries per batch. |

**Entry schema:**

| Field | Type | Description |
|---|---|---|
| `level` | string | `debug`, `info`, `warning`, `error`, `critical`. |
| `message` | string | Log message text. Max 8192 characters. |
| `context` | object | Structured key-value context. All keys are strings; values are string, number, or boolean. Max 50 keys. |
| `timestamp` | string ISO8601 | When the log line was emitted on the agent. |
| `sequence` | integer | Monotonically increasing sequence number within the session. Allows reconstruction of exact order even if batches arrive out of order. |
| `step` | string or null | Task step name active when this log was emitted. |
| `stream` | string | `stdout` or `stderr` for captured process output; `agent` for agent-generated logs. |

**Expected response:** HTTP 202 Accepted on the Data Channel. On Control Channel: no response (fire-and-forget).

---

### 4.21 agent.shutdown

**Direction:** A→S
**When sent:** When the agent process is terminating, either due to operator signal (SIGTERM), auto-scaling scale-in, or internal decision.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `graceful` | boolean | True if the agent is shutting down cleanly and has completed or checkpointed all work. False if it is shutting down urgently (e.g. SIGKILL imminent). |
| `drain_timeout_seconds` | integer | How many seconds the agent waited for in-progress work to complete before sending this message. 0 for ungraceful shutdown. |
| `active_task_id` | string UUID or null | If a task was in progress, its UUID. The server will requeue it. |
| `reason` | string | Shutdown reason: `operator_signal`, `scale_in`, `watchdog_timeout`, `unrecoverable_error`, `agent_upgrade`, `scheduled_maintenance`. |

**Expected response:** `agent.shutdown.ack`.

---

### 4.22 agent.shutdown.ack

**Direction:** S→A
**When sent:** In response to `agent.shutdown`.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `acknowledged` | boolean | Always true. Confirms the server has recorded the shutdown and will requeue any active task. |
| `requeued_task_id` | string UUID or null | The task UUID that was requeued, if any. |

**Expected response:** None. The server closes the WebSocket after sending.

---

### 4.23 session.reconnect

**Direction:** A→S
**When sent:** As the first message after `agent.registered` when a `reconnect_token` was used and the server confirmed session continuity. Allows the server to reconcile state missed during the disconnection window.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `session_id` | string UUID | The ExecutionSession UUID that was active during the disconnection. |
| `last_heartbeat_at` | string ISO8601 | Timestamp of the last heartbeat the agent successfully sent before losing connectivity. |
| `last_progress_percent` | integer (0–100) or null | Progress percentage at time of disconnection. Null if no task was in progress. |
| `buffered_log_count` | integer | Number of log entries buffered locally during offline mode that will be replayed via `log.batch` after this message. |
| `task_still_running` | boolean | Whether the task was still executing during the disconnection and has continued running offline. |
| `offline_duration_seconds` | integer | Approximate seconds the agent was disconnected. |

**Expected response:** `session.reconnect.ack` (S→A) with `state_delta` (object describing any server-side state changes during the gap), `replay_accepted` (boolean), and `instructions` (string or null, any special recovery instructions such as `"abort_and_requeue"`).

---

### 4.24 error

**Direction:** B (Bidirectional)
**When sent:** When either party encounters a protocol-level error processing a received message.

**Payload schema:**

| Field | Type | Description |
|---|---|---|
| `error_code` | integer | ACP error code from the 4xxx series (see Section 12). |
| `error_message` | string | Human-readable description. Max 512 characters. |
| `original_message_id` | string UUID or null | The `id` of the message that caused the error. Null if the error is not attributable to a specific message. |
| `original_message_type` | string or null | The `type` of the offending message. Null if undetermined. |
| `recoverable` | boolean | Whether the connection remains usable after this error. False means the sender will close the connection. |
| `recovery_hint` | string or null | Optional human-readable suggestion for how to recover. |

**Expected response:** None.

---

## 5. Connection Lifecycle

The following ASCII sequence diagram covers the full lifecycle from TCP connect to graceful shutdown.

```
Agent                                    Server
  |                                        |
  |------ TCP Connect (TLS) ------------->|
  |<----- TLS Handshake Complete ---------|
  |                                        |
  |------ HTTP Upgrade: WebSocket ------->|
  |<----- 101 Switching Protocols --------|
  |                                        |
  |=== CONTROL CHANNEL OPEN ===============|
  |                                        |
  |------ agent.register ---------------->|  (within 10s of upgrade)
  |           api_key, capabilities,       |
  |           resource_spec, acp_version   |
  |                                        |
  |       [server validates API key]       |
  |       [creates EngineeringWorker]      |
  |       [assigns ExecutionQueue]         |
  |                                        |
  |<----- agent.registered ---------------|
  |           jwt_token, worker_id,        |
  |           heartbeat_interval=30s       |
  |                                        |
  |=== HEARTBEAT LOOP (every 30s) =========|
  |                                        |
  |------ agent.heartbeat --------------->|
  |           cpu, memory, disk, state     |
  |<----- agent.heartbeat.ack ------------|
  |           server_time, next_expected   |
  |                                        |
  |       (loop continues...)              |
  |                                        |
  |=== TASK ASSIGNMENT ====================|
  |                                        |
  |<----- task.available -----------------|  (server broadcasts to eligible agents)
  |           task_id, priority            |
  |                                        |
  |------ task.pull --------------------->|  (agent claims the task)
  |           task_id                      |
  |                                        |
  |<----- task.assign --------------------|
  |           title, workspace, git_branch,|
  |           environment, artifacts       |
  |                                        |
  |       [agent provisions workspace]     |
  |       [downloads input artifacts]      |
  |       [clones/checks out repo]         |
  |                                        |
  |------ task.accept ------------------->|
  |           task_id, est_start_seconds   |
  |                                        |
  |=== EXECUTION ==========================|
  |                                        |
  |------ task.start -------------------->|
  |           task_id, session_id,         |
  |           git_commit_resolved          |
  |                                        |
  |------ task.progress (periodic) ------->|
  |           percent, message, step       |
  |                                        |
  |------ log.batch (periodic) ----------->|  (Data Channel: HTTP POST)
  |           session_id, entries[]        |
  |                                        |
  |------ artifact.upload.init ----------->|  (if artifacts produced)
  |           filename, size, checksum     |
  |<----- artifact.upload.ready ----------|
  |           upload_id, upload_url        |
  |                                        |
  |       [HTTP PUT to upload_url]         |  (Data Channel)
  |                                        |
  |------ artifact.upload.complete ------->|
  |           upload_id, etag              |
  |<----- artifact.finalized -------------|
  |           artifact_id                  |
  |                                        |
  |------ task.complete ----------------->|
  |           summary, artifact_ids,       |
  |           duration_seconds, metrics    |
  |                                        |
  |       [server marks task Completed]    |
  |       [closes ExecutionSession]        |
  |                                        |
  |=== IDLE → NEXT TASK OR SHUTDOWN =======|
  |                                        |
  |------ agent.shutdown (SIGTERM) ------->|
  |           graceful=true, reason        |
  |<----- agent.shutdown.ack -------------|
  |           acknowledged=true            |
  |                                        |
  |------ WebSocket Close Frame ---------->|
  |<----- WebSocket Close Frame ----------|
  |                                        |
  |------ TCP FIN ------------------------>|
  |<----- TCP FIN ------------------------|
  |                                        |
```

**Pause/Resume interlude** (inserted between task.progress and task.complete when a pause is requested):

```
Agent                                    Server
  |                                        |
  |<----- task.pause ---------------------|  (operator or policy trigger)
  |           task_id, reason,             |
  |           checkpoint_deadline=60s      |
  |                                        |
  |       [agent reaches safe checkpoint]  |
  |       [optionally uploads checkpoint   |
  |        via Data Channel]               |
  |                                        |
  |------ task.paused ------------------->|
  |           checkpoint_path, step,       |
  |           percent                      |
  |                                        |
  |       (heartbeat loop continues)       |
  |                                        |
  |<----- task.resume --------------------|
  |           task_id,                     |
  |           checkpoint_artifact_id       |
  |                                        |
  |------ task.start -------------------->|  (same session_id as before)
  |           ...                          |
```

---

## 6. Authentication Handshake

### 6.1 Initial Registration

1. The server opens a WebSocket endpoint at `wss://<host>/engineering-cloud/agents/ws`.
2. The agent connects and immediately sends `agent.register` with its API key.
3. **If no `agent.register` arrives within 10 seconds**, the server sends an `error` with code 4001 and closes the connection with WebSocket close code 4000.
4. The server validates the API key against the `engineering_agents` table. API keys are hashed (bcrypt) at rest and compared using constant-time comparison.
5. On success, the server issues a JWT (RS256, TTL 8 hours, claims: `sub` = worker_id, `agent_id`, `company_id`, `queue`, `iat`, `exp`) and sends `agent.registered`.
6. API keys are one-time-use per connection. The same API key cannot be used to open a second simultaneous connection; the second attempt receives error code 4005.

### 6.2 Data Channel Authorization

All Data Channel HTTPS requests must include:

```
Authorization: Bearer <jwt_token>
X-Agent-ID: <agent_id UUID>
X-Worker-ID: <worker_id UUID>
X-Session-ID: <session_id UUID>
```

JWTs are verified on every request. Expired JWTs on the Data Channel receive HTTP 401, at which point the agent must request a token refresh by sending `agent.token.refresh` (A→S) over the Control Channel.

### 6.3 Token Refresh

When a JWT is within 30 minutes of expiry, the server proactively sends `agent.token.refresh` (S→A) with a new `jwt_token`. The agent begins using the new token immediately. The old token remains valid until its `exp` claim.

---

## 7. Heartbeat Protocol

### 7.1 Timing

- Agents send `agent.heartbeat` every `heartbeat_interval_seconds` (default 30).
- The server expects each heartbeat within `heartbeat_interval_seconds` + `heartbeat_grace_seconds` (default 30 + 5 = 35 seconds).
- The server sends `agent.heartbeat.ack` within 2 seconds of receiving a heartbeat.

### 7.2 Missed Heartbeat Escalation

| Consecutive Missed ACKs | Server Action | Agent Action |
|---|---|---|
| 1 | Log warning, record metric | Log warning, prepare to reconnect |
| 2 | Update WorkerHeartbeat.consecutive_misses = 2 | Retry heartbeat immediately |
| 3 | Set worker state to Draining; flag active task for potential requeue | Begin reconnection backoff (Section 8) |
| 5 | Requeue active task; set worker state to Offline | (Reconnecting) |
| 10 | Set worker state to Terminated if no reconnect within reconnect_timeout | (Reconnecting or Offline mode) |

### 7.3 Heartbeat as Liveness Proof

The heartbeat is the only signal the server uses to determine whether an agent is alive. An agent that is executing a task but not sending heartbeats will have its task requeued after the miss escalation above, even if the task is actually progressing. Agents must maintain the heartbeat loop on a separate goroutine/thread from task execution.

---

## 8. Reconnection Protocol

### 8.1 Trigger Conditions

The agent initiates reconnection when any of the following occur:

- WebSocket connection is closed by the server or by network interruption.
- Three consecutive heartbeat ACKs are missed.
- A WebSocket ping/pong timeout fires (agent sends pings every 15 seconds; expects pong within 5 seconds).
- The agent receives a WebSocket close frame.

### 8.2 Backoff Schedule

The agent applies exponential backoff with jitter. The base sequence in seconds is:

```
Attempt 1:   2s  ± 0.5s
Attempt 2:   4s  ± 1s
Attempt 3:   8s  ± 2s
Attempt 4:  16s  ± 4s
Attempt 5:  30s  ± 5s
Attempt 6+: 30s  ± 5s  (capped)
```

Jitter is uniformly distributed over the ± range. This prevents thundering herd when many agents lose connectivity simultaneously.

### 8.3 Failure Threshold and Offline Mode

After 10 consecutive failed reconnection attempts, the agent enters Offline Mode (Section 9). It continues attempting reconnection every 30 ± 5 seconds indefinitely, as long as the agent process is alive.

### 8.4 Successful Reconnection

On successful WebSocket upgrade:

1. Agent sends `agent.register` with the persisted `reconnect_token`.
2. Server recognizes the token, issues a new JWT and new `reconnect_token`, and responds with `agent.registered`.
3. Agent sends `session.reconnect` with the active session state.
4. Server sends `session.reconnect.ack` with reconciled state.
5. Agent replays buffered logs via `log.batch` (Data Channel).
6. Agent resumes normal operation: heartbeat loop, and if a task was in progress, `task.progress` updates.

### 8.5 Reconnection Token Rotation

The `reconnect_token` is a cryptographically random 256-bit value, hex-encoded, stored in a server-side table keyed by `worker_id`. It is rotated on every successful `agent.registered` response. An agent presenting a stale (previously rotated) token receives error code 4007, which triggers a full re-registration without session recovery.

---

## 9. Offline Mode

When an agent cannot reach the server, it must not abandon work. Offline Mode defines the local behavior contract:

### 9.1 Log Buffering

- Buffer up to 10,000 log entries in a local FIFO queue (the oldest entries are discarded when the buffer is full).
- The buffer is persisted to a local file (`<workspace>/.acp/offline_logs.jsonl`) so it survives agent process restarts.
- Each entry is stored as a single-line JSON object matching the log entry schema (Section 4.20).
- On reconnect, the entire buffer is shipped via `log.batch` before resuming live log streaming. The `batch_sequence` continues from where it left off; the server detects the gap and marks the intervening sequences as `offline_buffered`.

### 9.2 Task Progress State

- The agent writes a local state file at `<workspace>/.acp/task_state.json` on every `task.progress` event.
- The file records: `task_id`, `session_id`, `percent_complete`, `current_step`, `elapsed_seconds`, `updated_at`.
- On reconnect, the agent reads this file and includes its values in `session.reconnect`.

### 9.3 Continuation Policy

- The agent continues executing its current task during offline mode unless the task itself requires network access that is unavailable.
- The agent does not attempt to self-report completion or failure while offline. These signals are queued and sent immediately on reconnect.
- If the task completes while offline, the agent queues a `task.complete` message and replays it as the first message after `session.reconnect.ack`.

### 9.4 Artifact Handling

- Artifacts produced while offline are stored locally.
- Upload is deferred until reconnection.
- `artifact.upload.init` is sent after `session.reconnect.ack` and before `task.complete`.

---

## 10. Compression

### 10.1 Control Channel (WebSocket)

- The WebSocket connection is established with the `permessage-deflate` extension negotiated in the HTTP upgrade headers.
- Compression is applied automatically by the WebSocket library for all messages over 1 KB.
- Messages under 1 KB are sent uncompressed to avoid compression overhead exceeding payload size.
- Compression level: zlib level 6 (default). Agents must not force level 9 as it causes measurable CPU overhead on the server under high-concurrency conditions.
- `server_no_context_takeover` and `client_no_context_takeover` are both set to prevent memory accumulation on long-lived connections.

### 10.2 Data Channel (HTTPS REST)

- All HTTP requests and responses over 4 KB include `Content-Encoding: gzip`.
- Clients must send `Accept-Encoding: gzip` on all requests.
- Artifact uploads use streaming chunked transfer encoding; each chunk is compressed independently.
- Log batch uploads always use gzip regardless of size.

### 10.3 Artifact Storage

- Artifacts are stored compressed server-side (zstd level 3) regardless of the upload encoding.
- The agent-computed checksum (Section 4.18) is over the **uncompressed** content. The server decompresses and verifies before storing.

---

## 11. Timeout Matrix

| Message Type | Send Timeout | Response Timeout | No-Response Action |
|---|---|---|---|
| `agent.register` | Must send within 10s of WebSocket upgrade | 10s for `agent.registered` or `agent.reject` | Agent closes connection; begins backoff |
| `agent.heartbeat` | Must send within 35s of previous | 5s for `agent.heartbeat.ack` | Count miss; 3 misses = reconnect |
| `task.pull` | No constraint (agent-initiated) | 30s for `task.assign` or `error` | Agent may retry or remain idle |
| `task.accept` | Must send within `accept_timeout_seconds` (typically 30) | N/A | Server returns task to Queued |
| `task.reject` | Must send within `accept_timeout_seconds` | N/A | Server returns task to Queued after timeout |
| `task.start` | Must send within 120s of `task.accept` | N/A | Server returns task to Queued; logs warning |
| `task.progress` | Recommended every 30s; no hard limit | N/A | No server action; informational only |
| `task.paused` | Must send within `checkpoint_deadline_seconds` | N/A | Server closes connection; task requeued |
| `task.complete` | No constraint; send when done | N/A | N/A |
| `task.fail` | No constraint; send when failed | N/A | N/A |
| `artifact.upload.init` | No constraint | 30s for `artifact.upload.ready` | Agent retries with same message `id` |
| `artifact.upload.complete` | After all parts uploaded | 60s for `artifact.finalized` | Agent retries; server deduplicates by `upload_id` |
| `log.batch` (Control) | No constraint | N/A | Fire-and-forget |
| `log.batch` (Data Channel) | No constraint | HTTP response within 30s | Agent retries with same `batch_sequence` |
| `agent.shutdown` | No constraint | 10s for `agent.shutdown.ack` | Agent closes connection anyway |
| `session.reconnect` | Must send as first message after re-registration | 30s for `session.reconnect.ack` | Agent treats as fresh session |
| `agent.token.refresh` (server-initiated) | Sent 30 min before expiry | N/A | Agent continues using old token until exp |

---

## 12. Error Codes

All error codes are in the 4xxx series. Codes 4000–4099 are connection-level errors. Codes 4100–4199 are authentication and authorization errors. Codes 4200–4299 are task lifecycle errors. Codes 4300–4399 are artifact and data errors. Codes 4400–4499 are protocol and envelope errors.

| Code | Name | Meaning | Recovery Action |
|---|---|---|---|
| 4001 | `REGISTRATION_TIMEOUT` | No `agent.register` received within 10 seconds of WebSocket upgrade. | Agent should reconnect immediately; check network latency. |
| 4002 | `INVALID_API_KEY` | The provided `api_key` does not match any active EngineeringAgent record. | Agent must not retry; alert operator to provision a valid API key. |
| 4003 | `API_KEY_REVOKED` | The API key has been explicitly revoked. | Agent must not retry; contact administrator for a new key. |
| 4004 | `CLOCK_SKEW_EXCESSIVE` | Agent timestamp differs from server time by more than 300 seconds. | Synchronize agent system clock (NTP) before reconnecting. |
| 4005 | `DUPLICATE_CONNECTION` | Another connection using the same API key is already active. | Close the other connection before reconnecting. |
| 4006 | `WORKER_TERMINATED` | The EngineeringWorker record has been marked Terminated and cannot re-register. | Provision a new agent with a new API key. |
| 4007 | `STALE_RECONNECT_TOKEN` | The presented `reconnect_token` has been rotated and is no longer valid. | Discard the stale token; re-register without a reconnect token. |
| 4008 | `UNSUPPORTED_ACP_VERSION` | The `acp_version` in `agent.register` is not in the server's `supported_acp_versions` list. | Upgrade or downgrade the agent software to a compatible ACP version. |
| 4009 | `REGISTRATION_PAYLOAD_INVALID` | The `agent.register` payload fails schema validation. | Fix the payload (check required fields, type constraints) and reconnect. |
| 4010 | `JWT_EXPIRED` | The JWT presented on the Data Channel has expired. | Request a new token via `agent.token.refresh` on the Control Channel. |
| 4011 | `JWT_INVALID_SIGNATURE` | The JWT signature does not match the server's public key. | Reconnect and obtain a new JWT via `agent.registered`. |
| 4012 | `INSUFFICIENT_CAPABILITY` | The agent lacks a required WorkerCapability for the assigned task. This should not occur in normal operation; indicates a routing bug. | Report to engineering; reject the task with `capability_mismatch`. |
| 4020 | `MISSING_AGENT_ID` | A message was received with a null `agent_id` after registration was complete. | Agent bug; always set `agent_id` after receiving `agent.registered`. |
| 4021 | `SESSION_NOT_FOUND` | The `session_id` in the envelope does not match any active ExecutionSession for this worker. | Clear `session_id` from envelope headers if no task is active. |
| 4030 | `TASK_EXPIRED` | `task.pull` was sent after the `expires_at` time in the `task.available` notification. | Do not send `task.pull` for expired notifications; send with `task_id: null` for fresh work. |
| 4031 | `TASK_ALREADY_CLAIMED` | Another agent claimed the task before this `task.pull` was processed. | Send `task.pull` with `task_id: null` to request any available task. |
| 4032 | `NO_TASKS_AVAILABLE` | No tasks matching the agent's capabilities are currently in the queue. | Agent remains Idle; server will send `task.available` when work arrives. |
| 4033 | `TASK_NOT_ASSIGNED_TO_AGENT` | The agent sent a task lifecycle message (start/complete/fail) for a task not assigned to it. | Agent state desync; reconnect and send `session.reconnect`. |
| 4034 | `INVALID_STATE_TRANSITION` | The task lifecycle message would cause an illegal state transition (e.g., `task.complete` for a Paused task). | Check current task state via `session.reconnect.ack`; take corrective action. |
| 4035 | `CHECKPOINT_DEADLINE_EXCEEDED` | Agent did not send `task.paused` within `checkpoint_deadline_seconds`. | Server will requeue the task; agent must stop execution and reconnect. |
| 4060 | `ARTIFACT_CHECKSUM_MISMATCH` | The uploaded artifact's computed checksum does not match the declared checksum in `artifact.upload.init`. | Re-upload the artifact; the failed upload session is invalidated. |
| 4061 | `ARTIFACT_SIZE_EXCEEDED` | The artifact size exceeds the configured limit (default 10 GB). | Split the artifact into smaller parts or request a limit increase. |
| 4062 | `UPLOAD_SESSION_EXPIRED` | The upload URL from `artifact.upload.ready` has expired (TTL typically 4 hours). | Send a new `artifact.upload.init`; the previous `upload_id` is invalidated. |
| 4063 | `UPLOAD_PART_MISSING` | `artifact.upload.complete` was received but one or more declared parts were not received by storage. | Retry the missing parts and resend `artifact.upload.complete`. |
| 4080 | `ENVELOPE_PARSE_ERROR` | The received message is not valid JSON or does not conform to the envelope schema. | Agent or server bug; log the raw message for diagnostics. |
| 4081 | `MESSAGE_TOO_LARGE` | The Control Channel message exceeds 512 KB. | Route the payload through the Data Channel instead. |
| 4082 | `DEDUPLICATION_WINDOW_EXCEEDED` | The `id` is older than the 1-hour deduplication window; cannot guarantee idempotency. | Generate a new `id` for the retry. |
| 4083 | `RATE_LIMIT_EXCEEDED` | The agent is sending messages faster than the allowed rate (default: 100 messages/second on Control Channel). | Implement client-side throttling; back off for 1 second. |
| 4090 | `INTERNAL_SERVER_ERROR` | An unhandled error occurred on the server. The connection remains open unless `recoverable` is false. | If `recoverable: false`, reconnect; otherwise retry the last operation. |

---

## 13. Protocol Versioning

### 13.1 Version Negotiation

The `v` field in every message envelope carries the ACP version the sender is using. Version negotiation occurs at registration time:

1. The agent sends `agent.register` with `acp_version: 1` (the version it speaks).
2. The server sends `agent.registered` with `supported_acp_versions: [1]` (all versions the server supports).
3. If the agent's `acp_version` is not in `supported_acp_versions`, the server sends `agent.reject` with error code 4008 and closes the connection.
4. Once registered, all messages use the negotiated version. The `v` field in all subsequent envelopes must match the negotiated version.

### 13.2 Future Version Compatibility Rules

When a new ACP version is introduced:

- **Additive changes** (new optional fields in existing message payloads, new message types) do not require a version bump. Receivers must ignore unknown fields (tolerant reader pattern).
- **Breaking changes** (removed fields, changed field semantics, changed message type strings, changed state machine behavior) require a new version number.
- The server maintains support for the previous version for a minimum of 90 days after a new version is released. The deprecation timeline is announced via `agent.registered.deprecation_notice` (a new optional field added to `agent.registered` when applicable).

### 13.3 Downgrade Behavior

If an agent speaks a newer version than the server supports, the server may offer to negotiate down to its highest supported version via `agent.registered` with `negotiated_version: <N>`. The agent must honor this and use `v: <N>` in all subsequent messages. If the agent cannot operate at the lower version, it sends `agent.shutdown` with `reason: agent_upgrade` and terminates.

### 13.4 Version in the v Field

The `v` field is an integer. Future versions are `2`, `3`, etc. There is no minor version in the envelope; minor/patch compatibility is handled via the tolerant reader pattern (Section 13.2). The full semantic version of the ACP specification is tracked in the server's `/.well-known/acp-version` endpoint, which returns `{"acp_spec_version": "1.0.0", "supported_envelope_versions": [1]}`.

---

## Appendix A — Message Type Quick Reference

| Type | Direction | Section |
|---|---|---|
| `agent.register` | A→S | 4.1 |
| `agent.registered` | S→A | 4.2 |
| `agent.reject` | S→A | 4.3 |
| `agent.heartbeat` | A→S | 4.4 |
| `agent.heartbeat.ack` | S→A | 4.5 |
| `agent.shutdown` | A→S | 4.21 |
| `agent.shutdown.ack` | S→A | 4.22 |
| `agent.token.refresh` | S→A | 6.2 |
| `task.available` | S→A | 4.6 |
| `task.pull` | A→S | 4.7 |
| `task.assign` | S→A | 4.8 |
| `task.accept` | A→S | 4.9 |
| `task.reject` | A→S | 4.10 |
| `task.start` | A→S | 4.11 |
| `task.progress` | A→S | 4.12 |
| `task.pause` | S→A | 4.13 |
| `task.paused` | A→S | 4.14 |
| `task.resume` | S→A | 4.15 |
| `task.complete` | A→S | 4.16 |
| `task.fail` | A→S | 4.17 |
| `artifact.upload.init` | A→S | 4.18 |
| `artifact.upload.ready` | S→A | 4.18 |
| `artifact.upload.complete` | A→S | 4.19 |
| `artifact.finalized` | S→A | 4.19 |
| `log.batch` | A→S | 4.20 |
| `session.reconnect` | A→S | 4.23 |
| `session.reconnect.ack` | S→A | 4.23 |
| `error` | B | 4.24 |

---

## Appendix B — Data Channel Endpoint Reference

| Endpoint | Method | Purpose | Auth |
|---|---|---|---|
| `POST /api/v1/agents/artifacts/upload` | POST | Initiate and complete artifact upload | JWT Bearer |
| `GET /api/v1/agents/artifacts/{artifact_id}` | GET | Download artifact (for input artifacts) | JWT Bearer |
| `POST /api/v1/agents/logs` | POST | Ship `log.batch` payload | JWT Bearer |
| `GET /.well-known/acp-version` | GET | Query server ACP version info | None |
| `POST /api/v1/agents/token/refresh` | POST | Exchange expiring JWT for new JWT (fallback if Control Channel is degraded) | JWT Bearer |

All Data Channel endpoints require the four headers defined in Section 6.2.

---

## Appendix C — Canonical Entity States Referenced

**EngineeringTask states (lifecycle order):** Draft, Queued, Assigned, Accepted, Running, Paused, Completed, Failed, Cancelled, Released, Archived

**EngineeringWorker states:** Unregistered, Registering, Idle, Busy, Paused, Draining, Offline, Terminated

**ExecutionSession states:** Initializing, Running, Paused, Completing, Completed, Failed, Aborted

**Workspace states:** Pending, Provisioning, Active, Idle, Archiving, Archived, Failed
