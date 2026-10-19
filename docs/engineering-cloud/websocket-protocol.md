# Engineering Cloud — WebSocket Protocol

**Version:** 1.0 | **Status:** Frozen | **Date:** 2026-07-22

---

## 1. Overview

The Engineering Cloud uses two distinct WebSocket connection types:

1. **Agent Control Channel** — a persistent, authenticated connection between an EngineeringAgent (worker process) and the server. Used for task assignment, execution control, progress reporting, and heartbeat.
2. **UI Dashboard Channel** — a browser-facing connection using the Laravel WebSockets / Pusher protocol. Used to push real-time events to the engineering dashboard without polling.

Both channels share the same underlying Laravel WebSockets server but use separate authentication mechanisms, message schemas, and lifecycle rules.

---

## 2. Connection Establishment

### 2.1 Agent Control Channel

| Property | Value |
|---|---|
| URL | `wss://{host}/api/v1/engineering/ws/agent` |
| Transport | WebSocket over TLS (WSS) |
| Auth parameter | `token={ws_token}` (query string) |
| Token source | `GET /api/v1/engineering/ws/token` |
| Token TTL | 60 seconds |
| Register deadline | Agent must send `agent.register` within 10 seconds of connect, or server closes the connection with code 4001 |

**Token acquisition flow:**

1. EngineeringAgent calls `GET /api/v1/engineering/ws/token` using its long-lived API key in the `X-Api-Key` header.
2. Server validates the API key, generates a one-time WS token (UUID, 60-second TTL, stored in Redis).
3. Agent opens the WebSocket URL with `?token={ws_token}`.
4. Server validates the token on upgrade, associates the connection with the worker record, and removes the token from Redis (one-use).

### 2.2 UI Dashboard Channel

| Property | Value |
|---|---|
| URL | `wss://{host}/app/{app_key}` |
| Protocol | Pusher Wire Protocol v7 |
| Auth | Laravel Echo with Sanctum cookie or `Authorization: Bearer {sanctum_token}` |
| Private channel | `private-engineering.{company_id}` |
| Presence channel | `presence-engineering.{company_id}` |

Channel authorization is handled by `POST /broadcasting/auth` (standard Laravel Echo flow). The server verifies the Sanctum session or Bearer token and confirms the authenticated user belongs to `company_id`.

---

## 3. Agent Connection Lifecycle

The sequence below uses ASCII art to show the full lifecycle of an agent connection from HTTP upgrade through graceful shutdown.

```
Agent (EngineeringWorker)                          Server
        |                                              |
        |--- HTTP GET /api/v1/engineering/ws/agent --->|
        |    Headers:                                  |
        |      Upgrade: websocket                      |
        |      Connection: Upgrade                     |
        |      Sec-WebSocket-Key: <base64>             |
        |      Sec-WebSocket-Version: 13               |
        |                                              |
        |<-- HTTP 101 Switching Protocols -------------|
        |    Headers:                                  |
        |      Upgrade: websocket                      |
        |      Connection: Upgrade                     |
        |      Sec-WebSocket-Accept: <hash>            |
        |                                              |
        |--- agent.register --------------------------->|
        |    { worker_id, capabilities[], version,     |
        |      hostname, resources{} }                 |
        |                                              |
        |    (server validates API key, upserts        |
        |     EngineeringWorker, issues JWT)           |
        |                                              |
        |<-- agent.registered -------------------------|
        |    { worker_id, jwt, server_time,            |
        |      heartbeat_interval_seconds: 30 }        |
        |                                              |
        |============ HEARTBEAT LOOP ==================|
        |                                              |
        |--- agent.heartbeat (every 30s) ------------->|
        |    { worker_id, cpu_percent,                 |
        |      memory_mb_used, disk_free_gb,           |
        |      sent_at }                               |
        |                                              |
        |<-- agent.heartbeat.ack ----------------------|
        |    { server_time, next_expected_at }         |
        |                                              |
        |============ TASK EXECUTION ==================|
        |                                              |
        |<-- task.assign ------------------------------|
        |    { task_id, title, type, priority,         |
        |      workspace_id, timeout_seconds,          |
        |      payload{} }                             |
        |                                              |
        |--- task.accept ------------------------------>|
        |    { task_id, accepted_at }                  |
        |                                              |
        |--- task.start -------------------------------->|
        |    { task_id, started_at,                    |
        |      session_id }                            |
        |                                              |
        |--- task.progress (repeated) ---------------->|
        |    { task_id, session_id,                    |
        |      percent_complete, message,              |
        |      log_lines[], metrics{} }                |
        |                                              |
        |--- task.complete ---------------------------->|
        |    { task_id, session_id,                    |
        |      exit_code, artifacts[],                 |
        |      completed_at }                          |
        |                                              |
        |============ GRACEFUL SHUTDOWN ===============|
        |                                              |
        |--- agent.shutdown --------------------------->|
        |    { worker_id, reason }                     |
        |                                              |
        |<-- agent.shutdown.ack -----------------------|
        |    { acknowledged_at }                       |
        |                                              |
        |--- WebSocket Close frame (code 1000) ------->|
        |<-- WebSocket Close frame (code 1000) --------|
        |                                              |
       [connection closed]
```

**State transitions triggered by this sequence:**

| Message | EngineeringWorker state | EngineeringTask state |
|---|---|---|
| `agent.registered` | `Registering` → `Idle` | — |
| `task.assign` sent | `Idle` → `Busy` | `Queued` → `Assigned` |
| `task.accept` | — | `Assigned` → `Accepted` |
| `task.start` | — | `Accepted` → `Running` |
| `task.complete` (exit_code=0) | `Busy` → `Idle` | `Running` → `Completed` |
| `task.complete` (exit_code≠0) | `Busy` → `Idle` | `Running` → `Failed` |
| `agent.shutdown` | `Busy`/`Idle` → `Draining` | — |
| connection closed | `Draining` → `Terminated` | — |

---

## 4. Heartbeat Design

### 4.1 Agent Control Channel

The heartbeat mechanism detects stale connections and tracks worker resource state without a separate polling endpoint.

**Agent sends `agent.heartbeat` every 30 seconds:**

```json
{
  "type": "agent.heartbeat",
  "worker_id": "uuid",
  "cpu_percent": 42.5,
  "memory_mb_used": 1024,
  "disk_free_gb": 18.3,
  "sent_at": "2026-07-22T10:00:00.000Z"
}
```

**Server responds `agent.heartbeat.ack` within 5 seconds:**

```json
{
  "type": "agent.heartbeat.ack",
  "server_time": "2026-07-22T10:00:00.100Z",
  "next_expected_at": "2026-07-22T10:00:30.000Z"
}
```

**Failure escalation:**

| Condition | Agent Action |
|---|---|
| No ACK received within 10 seconds | Agent retries the heartbeat immediately |
| 3 consecutive failures | Agent initiates reconnect sequence (see Section 5) |
| Server misses 2 expected heartbeats | Server marks worker `Offline`, releases any assigned tasks back to `Queued` |

Resource data from each heartbeat is written to a `WorkerHeartbeat` record. The server uses the latest heartbeat to inform task scheduling decisions (e.g., skip workers above 90% memory).

### 4.2 UI Dashboard Channel

The UI channel uses the standard WebSocket ping/pong mechanism:

- Server sends a WebSocket ping frame every 30 seconds.
- Browser responds with a WebSocket pong frame automatically (handled by the browser WebSocket API).
- If no pong is received within 15 seconds, the server closes the connection with code 1001 (Going Away).
- Laravel Echo reconnects automatically on disconnect.

---

## 5. Reconnection Strategy (Agent)

When the Agent Control Channel drops unexpectedly (network error, server restart, TLS timeout), the agent follows an exponential backoff schedule before switching to Offline mode.

### 5.1 Backoff Schedule

| Attempt | Delay | Jitter |
|---|---|---|
| 1 | 2 seconds | none |
| 2 | 4 seconds | none |
| 3 | 8 seconds | none |
| 4 | 16 seconds | none |
| 5 and beyond | 30 seconds | ±5 seconds (uniform random) |
| After 10 failures | Offline mode | — |

Jitter on attempt 5+ prevents thundering herd when many agents reconnect after a server restart.

### 5.2 Offline Mode

When an agent enters Offline mode after 10 consecutive failures:

- The agent logs the condition locally with timestamps.
- No further reconnect attempts are made automatically.
- A human operator or external watchdog process must restart the agent process.
- The server marks the `EngineeringWorker` state as `Offline` after missing 2 heartbeat windows.
- Any `Running` tasks owned by the worker are transitioned to `Failed` after the server-side execution timeout expires (see Section 10).

### 5.3 Reconnect Handshake

When reconnect succeeds (before Offline mode), the agent sends `session.reconnect` instead of `agent.register`:

```json
{
  "type": "session.reconnect",
  "worker_id": "uuid",
  "session_id": "uuid",
  "last_heartbeat_at": "2026-07-22T10:00:00.000Z",
  "last_progress_percent": 65
}
```

The server uses `session_id` to locate the active `ExecutionSession`. If the session is still `Running`, the server acknowledges the reconnect and the agent resumes progress reporting from where it left off. If the session has already been marked `Failed` by the server (timeout elapsed), the server sends a `session.expired` message and the agent must not attempt to complete the task.

---

## 6. Compression

WebSocket compression uses the `permessage-deflate` extension, negotiated during the HTTP upgrade handshake:

```
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
```

**Compression policy:**

| Message size | Compression |
|---|---|
| Under 1 KB | Raw JSON, no compression |
| 1 KB and above | `permessage-deflate` applied |

This threshold avoids the overhead of compressing small control messages (heartbeats, task assignments) while reducing bandwidth for log batch messages and large progress payloads.

Artifact uploads bypass the WebSocket channel entirely and use REST (see Section 8).

---

## 7. UI Dashboard Events

All events are broadcast on `private-engineering.{company_id}`. Each event carries the `company_id` in its payload for client-side validation.

### 7.1 Event Catalog

**TaskCreated**
```json
{
  "id": "uuid",
  "title": "string",
  "status": "Draft",
  "priority": "High",
  "created_at": "ISO8601"
}
```

**TaskStatusChanged**
```json
{
  "id": "uuid",
  "from_status": "Queued",
  "to_status": "Assigned",
  "updated_at": "ISO8601"
}
```

**TaskProgressUpdated**
```json
{
  "id": "uuid",
  "percent_complete": 65,
  "message": "Running unit tests…"
}
```

**WorkerStatusChanged**
```json
{
  "id": "uuid",
  "status": "Busy",
  "current_task_id": "uuid | null"
}
```

**ReleaseCandidateCreated**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "version_tag": "v1.4.2-rc.3"
}
```

**PipelineRunStarted**
```json
{
  "id": "uuid",
  "release_candidate_id": "uuid"
}
```

**PipelineRunCompleted**
```json
{
  "id": "uuid",
  "status": "Completed | Failed",
  "duration_seconds": 142
}
```

### 7.2 Presence Channel

The `presence-engineering.{company_id}` channel tracks which dashboard users are currently online.

`member_data` supplied on channel auth:

```json
{
  "user_id": "uuid",
  "name": "Osama Fayez",
  "role": "Engineering Manager"
}
```

Standard Pusher presence events (`pusher:member_added`, `pusher:member_removed`) are handled by Laravel Echo automatically. The dashboard uses presence data to show an "online now" indicator on the engineering overview page.

---

## 8. Message Size Limits

| Limit | Value | Notes |
|---|---|---|
| Maximum WebSocket message | 64 KB | Enforced server-side; violations trigger error code `4008` |
| Log batch per message | 1000 lines maximum | Server flushes to database; client flushes every 5 seconds regardless of line count |
| Artifact uploads | REST only | `POST /api/v1/engineering/tasks/{id}/artifacts` with multipart; never over WebSocket |
| Messages exceeding 64 KB | REST data channel | Agent switches to `POST /api/v1/engineering/sessions/{id}/data` for oversized payloads |

When the agent detects a message would exceed 64 KB before sending, it must split or route to REST. The server never silently truncates; it closes the connection with code 4008 if an oversized frame arrives.

---

## 9. Protocol Error Handling

| Error Scenario | Server Behavior | Client Behavior |
|---|---|---|
| Invalid JSON | Sends `error` message: `{ code: 4400, reason: "invalid_json" }`, keeps connection open | Agent logs the error, does not retry the malformed message, continues operation |
| Unknown message type | Sends `error` message: `{ code: 4404, reason: "unknown_type", type: "<received>" }`, keeps connection open | Agent logs the warning, continues; unknown types are silently ignored by the UI channel |
| Expired or invalid WS token | Closes connection with code 4401 during upgrade (HTTP 401 if before upgrade) | Agent requests a new WS token via `GET /api/v1/engineering/ws/token` and reconnects |
| Rate limit exceeded | Sends `error` message: `{ code: 4429, reason: "rate_limit_exceeded", retry_after_ms: 5000 }`, keeps connection open | Agent backs off for `retry_after_ms` before sending the next message |
| Message too large (>64 KB) | Closes connection with code 4008: `{ reason: "message_too_large" }` | Agent switches the oversized payload to the REST data channel, then reconnects WebSocket |
| Out-of-sequence message (e.g., `task.complete` before `task.start`) | Sends `error` message: `{ code: 4409, reason: "out_of_sequence", expected: "<type>" }`, keeps connection open | Agent resends the correct sequence; if state cannot be recovered, agent sends `agent.shutdown` |

All error codes in the `4xxx` range are application-level (distinct from standard WebSocket close codes in the `1xxx` range).

---

## 10. Timeout Matrix

| Connection Phase | Timeout | Action on Timeout |
|---|---|---|
| WebSocket HTTP upgrade | 15 seconds | Server closes TCP connection; HTTP 408 returned |
| `agent.register` after connect | 10 seconds | Server closes WebSocket with code 4002: `registration_timeout` |
| Heartbeat ACK (server → agent) | 10 seconds | Agent retries heartbeat; after 3 consecutive misses, agent initiates reconnect |
| Server heartbeat window (agent → server) | 2 × 30 seconds (60 seconds missed) | Server marks worker `Offline`, releases assigned tasks to `Queued` |
| `task.accept` after `task.assign` | 30 seconds | Server reclaims the task, transitions back to `Queued`, reassigns to next eligible worker |
| Task execution (`Running` state) | Per-task `timeout_seconds` (default 3600) | Server sends `task.timeout` to agent; task transitions to `Failed`; worker transitions to `Idle` |
| Graceful shutdown drain | 120 seconds | Server force-closes the connection with code 1001; any in-progress task transitions to `Failed` |

Timeouts are implemented using Redis-backed deferred jobs. Each phase sets a Redis key with TTL; the job fires if the key expires without being cleared by the expected event.

---

## 11. Monitoring Metrics

The WebSocket server exposes the following metrics via the internal metrics endpoint (`GET /internal/metrics` — not publicly routable). Metrics are in Prometheus text format and scraped by the infrastructure monitoring agent every 15 seconds.

| Metric | Type | Description |
|---|---|---|
| `ws_active_connections_total` | Gauge | Current open connections, labeled by `type` (`agent` or `ui`) |
| `ws_messages_per_second` | Gauge | Rolling 10-second average of inbound and outbound messages, labeled by `direction` |
| `ws_reconnection_rate` | Counter | Total reconnect attempts by agents since process start |
| `ws_auth_failures_total` | Counter | Total authentication failures, labeled by `reason` (`invalid_token`, `expired_token`, `rate_limited`) |
| `ws_message_processing_latency_p95_ms` | Gauge | 95th-percentile time from message received to response sent, in milliseconds |
| `ws_connection_duration_seconds` | Histogram | Distribution of connection lifetimes across buckets: 1m, 5m, 15m, 30m, 1h, 4h, 8h+ |
| `ws_heartbeat_miss_total` | Counter | Total heartbeat windows missed by agents (leading indicator for Offline transitions) |
| `ws_message_size_bytes` | Histogram | Distribution of inbound message sizes; alerts trigger above the 64 KB limit threshold |

Alerting thresholds (managed in the infrastructure runbook, not in this document):

- `ws_auth_failures_total` rate above 10 per minute triggers an Ops notification.
- `ws_message_processing_latency_p95_ms` above 500ms triggers a performance alert.
- `ws_active_connections_total{type="agent"}` dropping to zero outside of a maintenance window triggers a critical alert.
