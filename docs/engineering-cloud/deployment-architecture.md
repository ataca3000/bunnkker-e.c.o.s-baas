# Engineering Cloud — Deployment Architecture

**Version:** 1.0 | **Status:** Frozen | **Date:** 2026-07-22

---

## 1. Infrastructure Overview

```
╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║  INTERNET BOUNDARY                                                                           ║
╠══════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                              ║
║   ┌─────────────────┐    ┌─────────────────┐    ┌───────────────────────────────────────┐  ║
║   │  Developer       │    │  GitHub          │    │  CI/CD Pipeline                       │  ║
║   │  Agents          │    │  (source + PRs)  │    │  (Release Manager, build triggers)    │  ║
║   └────────┬─────────┘    └────────┬─────────┘    └───────────────────┬───────────────────┘  ║
║            │ HTTPS/WSS             │ Webhooks                         │ HTTPS                ║
╚════════════╪═══════════════════════╪══════════════════════════════════╪═════════════════════╝
             │                       │                                  │
             ▼                       ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│  DMZ (PUBLIC ZONE)                                                                         │
│                                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  Load Balancer (NGINX / Cloud LB)                                                    │ │
│  │  ┌───────────────────────────────┐  ┌────────────────────────────────────────────┐  │ │
│  │  │  HTTPS  :443                  │  │  WSS  :443 → :6001 (sticky sessions)       │  │ │
│  │  │  /api/* → API Server pool     │  │  /ws/* → WebSocket Server pool             │  │ │
│  │  │  /health → health checks      │  │  Pusher-protocol passthrough               │  │ │
│  │  └───────────────────────────────┘  └────────────────────────────────────────────┘  │ │
│  └──────────────────────┬───────────────────────────────────────┬──────────────────────┘ │
│                         │                                       │                         │
│  ┌──────────────────────┴──────────┐       ┌────────────────────┴────────────────────┐   │
│  │  WebSocket Server Pool  :6001   │       │  (API traffic routes to App Zone below) │   │
│  │                                 │       └─────────────────────────────────────────┘   │
│  │  ┌──────────────────────────┐   │                                                     │
│  │  │  WS Instance 1           │   │                                                     │
│  │  │  Laravel WebSockets      │   │                                                     │
│  │  │  Max 10,000 connections  │   │                                                     │
│  │  └──────────────────────────┘   │                                                     │
│  │  ┌──────────────────────────┐   │                                                     │
│  │  │  WS Instance 2           │   │                                                     │
│  │  │  Laravel WebSockets      │   │                                                     │
│  │  │  Max 10,000 connections  │   │                                                     │
│  │  └──────────────────────────┘   │                                                     │
│  │  (scale-out, sticky sessions)   │                                                     │
│  └──────────────┬──────────────────┘                                                     │
│                 │ Redis pub/sub (channel state)                                           │
└─────────────────╪───────────────────────────────────────────────────────────────────────┘
                  │
┌─────────────────╪───────────────────────────────────────────────────────────────────────┐
│  APPLICATION ZONE (INTERNAL)                                                             │
│                 │                                                                        │
│  ┌──────────────┴──────────────────────────────────────────────────────────────────┐   │
│  │  Engineering API Server Pool  (PHP-FPM, Laravel)                                │   │
│  │                                                                                  │   │
│  │  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────────────┐ │   │
│  │  │  API Instance 1       │  │  API Instance 2       │  │  API Instance N      │ │   │
│  │  │  GET /health          │  │  GET /health          │  │  (auto-scale ≤ 10)   │ │   │
│  │  │  Graceful shutdown    │  │  Graceful shutdown    │  │                      │ │   │
│  │  │  30s drain            │  │  30s drain            │  │                      │ │   │
│  │  └───────────────────────┘  └───────────────────────┘  └──────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
│                 │                                                                        │
│  ┌──────────────┴───────────────────────┐   ┌────────────────────────────────────────┐  │
│  │  Scheduler Process (single active)   │   │  Queue Workers — Laravel Horizon       │  │
│  │                                      │   │                                        │  │
│  │  Redis leader election lock          │   │  ┌─────────────────────────────────┐  │  │
│  │  Tick interval: 5 seconds            │   │  │  engineering-critical  × 4       │  │  │
│  │  GET /health (Scheduler)             │   │  │  max job timeout: 60s            │  │  │
│  │  Standby replica waits on lock       │   │  └─────────────────────────────────┘  │  │
│  └──────────────────────────────────────┘   │  ┌─────────────────────────────────┐  │  │
│                                             │  │  engineering-default   × 8       │  │  │
│                                             │  │  max job timeout: 300s           │  │  │
│                                             │  └─────────────────────────────────┘  │  │
│                                             │  ┌─────────────────────────────────┐  │  │
│                                             │  │  engineering-bulk      × 2       │  │  │
│                                             │  │  max job timeout: 900s (logs)    │  │  │
│                                             │  └─────────────────────────────────┘  │  │
│                                             │  ┌─────────────────────────────────┐  │  │
│                                             │  │  engineering-releases  × 2       │  │  │
│                                             │  │  max job timeout: 120s           │  │  │
│                                             │  └─────────────────────────────────┘  │  │
│                                             └────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                  │                                         │
                  │ (all app-zone components connect below)  │
                  ▼                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DATA ZONE (NO EXTERNAL ACCESS)                                                         │
│                                                                                         │
│  ┌──────────────────────────────────────┐   ┌───────────────────────────────────────┐  │
│  │  PostgreSQL 14+                      │   │  Redis Cluster (3 nodes)              │  │
│  │                                      │   │                                       │  │
│  │  ┌───────────────────────────────┐   │   │  ┌─────────────┐  ┌───────────────┐  │  │
│  │  │  Primary (writes)             │   │   │  │  Node 1     │  │  Node 2       │  │  │
│  │  │  PgBouncer (transaction mode) │   │   │  │  (primary)  │  │  (replica)    │  │  │
│  │  └───────────────────────────────┘   │   │  └─────────────┘  └───────────────┘  │  │
│  │  ┌───────────────────────────────┐   │   │  ┌─────────────┐                     │  │
│  │  │  Read Replica                 │   │   │  │  Node 3     │  AOF persistence    │  │
│  │  │  PgBouncer (transaction mode) │   │   │  │  (replica)  │  enabled            │  │
│  │  └───────────────────────────────┘   │   │  └─────────────┘                     │  │
│  │                                      │   │                                       │  │
│  │  Backup: daily full + hourly incr.   │   │  Roles: queue backend, WS channel     │  │
│  │  UUID PKs, company_id isolation,     │   │  state, rate limiting, nonce cache,   │  │
│  │  soft deletes                        │   │  scheduler lock, session cache,       │  │
│  │                                      │   │  workspace warm pool state            │  │
│  └──────────────────────────────────────┘   └───────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  STORAGE ZONE                                                                           │
│                                                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Object Storage (S3-compatible)                                                   │  │
│  │                                                                                   │  │
│  │  Bucket: engineering-artifacts    Bucket: engineering-logs                        │  │
│  │  Lifecycle: Glacier 30d → del 90d  Lifecycle: standard 90d → del                 │  │
│  │  Release artifacts: 1-year retain  Cross-region replication: enabled              │  │
│  │                                                                                   │  │
│  │  Access: presigned URLs only — agents upload/download directly, no API proxy      │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  MONITORING STACK (existing ECOS)                                                       │
│                                                                                         │
│  Prometheus scrape ← /metrics (all components)                                          │
│  Grafana dashboards: API latency, WS connections, queue depth, scheduler, error rate    │
│  Log aggregation: JSON stdout → centralized log store (trace_id, company_id fields)     │
│  Alerting: PagerDuty / Slack on threshold breach                                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 Engineering API Servers

| Property | Value |
|---|---|
| Framework | Laravel PHP-FPM |
| Minimum instances | 2 |
| Maximum instances | 10 (auto-scale) |
| Health check endpoint | `GET /api/v1/engineering/health` |
| Graceful shutdown | 30-second drain window |
| Authentication | Laravel Sanctum (UI sessions), JWT (agent requests), API Keys (worker registration) |
| Isolation | All queries scoped by `company_id`; soft deletes enforced on all entity tables |

The API servers are stateless. All session and shared state is stored in Redis. Any instance can serve any request, enabling unrestricted round-robin load balancing for API traffic. WebSocket events are broadcast through Redis pub/sub so that an event produced by Instance 1 reaches clients connected to Instance 2.

### 2.2 WebSocket Server

| Property | Value |
|---|---|
| Technology | Laravel WebSockets (Pusher protocol) |
| Process | Separate long-running process, distinct from PHP-FPM |
| Port | 6001 (TLS terminated at load balancer, forwarded as WSS) |
| Max connections per instance | 10,000 |
| Load balancing requirement | Sticky sessions (IP hash or cookie-based) |
| State backend | Redis (channel presence, subscription tracking) |
| Health endpoint | `GET /health` on internal port |

Sticky sessions are mandatory because a WebSocket connection is a persistent TCP session. The load balancer must route all frames from a given client to the same backend instance for the duration of the connection. Redis pub/sub ensures that broadcast events originating from any API server reach all WebSocket instances, which then fan out to their respective connected clients.

### 2.3 Scheduler Process

| Property | Value |
|---|---|
| Active instances | 1 (leader-elected) |
| Standby instances | 1 (waits on Redis lock, promotes within 10 seconds on leader loss) |
| Leader election | Redis `SET NX PX` lock with TTL 15 seconds, renewed every 5 seconds |
| Tick interval | Every 5 seconds |
| Health endpoint | `GET /health` (reports lock held status and last tick timestamp) |
| Responsibilities | Queuing overdue EngineeringTasks, expiring stale WorkspaceLocks, advancing ExecutionQueue, publishing heartbeat signals to WorkerHeartbeat checks |

Only the leader executes scheduled work. The standby process remains dormant, polling the lock key. If the leader crashes or fails to renew the lock within the TTL window, the standby acquires the lock and becomes the new leader without operator intervention.

### 2.4 Queue Workers — Laravel Horizon

Horizon supervises all worker processes. Each queue group is isolated so that bulk or long-running log processing jobs cannot starve real-time critical work.

| Queue | Workers | Max Job Timeout | Primary Work |
|---|---|---|---|
| `engineering-critical` | 4 | 60 seconds | TaskLock acquisition, WorkerHeartbeat updates, urgent state transitions |
| `engineering-default` | 8 | 300 seconds | General task dispatch, ExecutionLog writes, event publishing |
| `engineering-bulk` | 2 | 900 seconds | PipelineArtifact log ingestion, TaskAttachment processing, bulk archival |
| `engineering-releases` | 2 | 120 seconds | ReleaseCandidate packaging, ReleaseBundle assembly, staging promotion |

Workers are scaled per-group independently (see Section 4.3). Horizon's dashboard is restricted to internal network access only.

### 2.5 PostgreSQL

| Property | Value |
|---|---|
| Version | 14 or higher |
| Write target | Primary instance (all INSERT / UPDATE / DELETE) |
| Read target | Read replica (reporting queries, list endpoints, analytics) |
| Connection pooling | PgBouncer in transaction mode (both primary and replica) |
| Primary key type | UUID (v4) on all tables |
| Row isolation | `company_id` column on all tenant-scoped tables, enforced at query scope |
| Soft deletes | `deleted_at` timestamp on all entity tables |
| Full backup | Daily |
| Incremental backup | Hourly WAL archiving |
| Backup retention | 30 days |
| Recovery test cadence | Monthly restore drill (documented in Runbook OPS-DB-001) |

The read replica lags behind the primary by a bounded window (target: under 500ms under normal load). Queries that require read-your-writes consistency (immediate post-write reads) are directed to the primary by the application layer.

### 2.6 Redis Cluster

| Property | Value |
|---|---|
| Topology | Cluster mode, 3 nodes minimum (1 primary shard + 2 replicas, or 3 primary shards with replicas) |
| Persistence | AOF (Append-Only File) enabled — `appendfsync everysec` |
| Eviction policy | `noeviction` (Engineering Cloud data must never be silently dropped) |
| TLS | Required for all inter-node and client connections |

**Key namespace allocations:**

| Prefix | Purpose |
|---|---|
| `queue:*` | Laravel queue backend (job payloads, delayed jobs) |
| `ws:channel:*` | WebSocket channel subscription state |
| `rl:*` | Rate limiting counters (per agent, per endpoint) |
| `nonce:*` | JWT nonce cache (replay prevention) |
| `scheduler:lock` | Scheduler leader election lock |
| `session:*` | API session cache |
| `workspace:warm:*` | Workspace warm pool state (pre-provisioned Workspace metadata) |

### 2.7 Object Storage

| Property | Value |
|---|---|
| Compatibility | S3-compatible API (AWS S3, MinIO, or equivalent) |
| Access method | Presigned URLs — agents and workers upload/download directly; API servers issue signed URLs only and never proxy binary data |
| Server-side encryption | AES-256 (SSE-S3 or SSE-KMS) |

**Buckets:**

| Bucket | Contents | Lifecycle |
|---|---|---|
| `engineering-artifacts` | TaskArtifacts, PipelineArtifacts, TaskAttachments | Transition to Glacier after 30 days; hard delete after 90 days. Release artifacts (tagged `release=true`) retained for 1 year. |
| `engineering-logs` | ExecutionLog bulk exports, raw agent stdout archives | Transition to Glacier after 30 days; hard delete after 90 days. |

Cross-region replication is enabled on both buckets. Replication lag target is under 15 minutes.

---

## 3. Network Architecture

### 3.1 Network Zones

| Zone | Components | External Access |
|---|---|---|
| DMZ (Public) | Load Balancer, WebSocket Server Pool | Yes — internet-facing |
| Application Zone (Internal) | API Server Pool, Scheduler Process, Queue Workers (Horizon) | No — reachable only from DMZ via load balancer |
| Data Zone | PostgreSQL Primary, PostgreSQL Read Replica, PgBouncer, Redis Cluster | No — reachable only from Application Zone |
| Storage Zone | Object Storage | Agents access via presigned URLs (HTTPS, direct to storage endpoint); API servers access storage API over internal network |
| Monitoring Zone | Prometheus, Grafana, Log Aggregator | Internal dashboards only; scrape endpoints restricted by IP allowlist |

### 3.2 Firewall Rules

| Source | Destination | Port | Protocol | Purpose |
|---|---|---|---|---|
| Internet | Load Balancer | 443 | HTTPS/WSS | All inbound traffic (API + WebSocket) |
| Load Balancer | API Server Pool | 9000 | TCP (FPM) | API request forwarding |
| Load Balancer | WebSocket Server Pool | 6001 | TCP | WebSocket connection forwarding (sticky) |
| API Server Pool | PostgreSQL Primary (PgBouncer) | 5432 | TCP | Write queries |
| API Server Pool | PostgreSQL Read Replica (PgBouncer) | 5433 | TCP | Read queries |
| API Server Pool | Redis Cluster | 6379–6381 | TCP | Session, queue, broadcast, rate limit |
| API Server Pool | Object Storage | 443 | HTTPS | Presigned URL generation (metadata only) |
| WebSocket Server Pool | Redis Cluster | 6379–6381 | TCP | Channel state, pub/sub subscription |
| Queue Workers | PostgreSQL Primary (PgBouncer) | 5432 | TCP | Job data reads and writes |
| Queue Workers | PostgreSQL Read Replica (PgBouncer) | 5433 | TCP | Read-only job queries |
| Queue Workers | Redis Cluster | 6379–6381 | TCP | Queue backend |
| Queue Workers | Object Storage | 443 | HTTPS | Artifact and log writes |
| Scheduler Process | Redis Cluster | 6379–6381 | TCP | Leader lock, task scheduling |
| Scheduler Process | PostgreSQL Primary (PgBouncer) | 5432 | TCP | Task state queries |
| Monitoring Stack | All components | 9091 (metrics) | HTTP | Prometheus scrape |
| GitHub | Load Balancer | 443 | HTTPS | Webhook delivery (CI/CD triggers) |
| CI/CD Pipeline | Load Balancer | 443 | HTTPS | Deployment API calls |
| Agents (external) | Load Balancer | 443 | HTTPS/WSS | API requests and WebSocket connections |

All other traffic is denied by default. Inter-zone traffic not listed above is blocked at the firewall level.

### 3.3 Agent Connectivity

Developer Agents and EngineeringWorkers operate exclusively over the public internet and connect only through the Load Balancer. No agent has any direct network path to the PostgreSQL cluster, Redis cluster, or internal application servers.

**Agent connection model:**

1. Agent authenticates at `POST /api/v1/engineering/auth/token` using an API Key issued during registration. The server returns a short-lived JWT.
2. For real-time events, the agent opens a WebSocket connection through `wss://<domain>/ws`. The load balancer routes this to a WebSocket Server instance using sticky sessions.
3. For artifact uploads, the agent requests a presigned URL from the API (`POST /api/v1/engineering/tasks/{id}/artifacts/upload-url`). The API server generates a time-limited presigned URL against the object storage bucket. The agent uploads the binary directly to object storage without passing through the API server.
4. For artifact downloads, the agent requests a presigned download URL from the API. The same direct-to-storage pattern applies.

This design ensures that binary data never transits the API servers, preserving API server capacity for control-plane operations.

---

## 4. Scaling Strategy

### 4.1 API Server Scaling

| Trigger | Action |
|---|---|
| CPU utilization exceeds 70% (sustained 2 minutes) | Add 2 instances |
| Request queue depth exceeds 100 (upstream load balancer metric) | Add 2 instances |
| CPU utilization below 30% for 10 consecutive minutes | Remove 1 instance |
| Instance count at minimum (2) | Scale-in blocked |
| Instance count at maximum (10) | Scale-out blocked; alert fired |

New instances receive traffic only after their health check (`GET /api/v1/engineering/health`) returns HTTP 200 for three consecutive checks at 10-second intervals. Instances draining for scale-in stop accepting new connections and allow in-flight PHP-FPM workers to complete within the 30-second graceful shutdown window before termination.

### 4.2 WebSocket Server Scaling

WebSocket servers scale horizontally only. Vertical scaling is not used because sticky sessions mean that connection capacity scales linearly with instance count, and memory per connection is bounded.

| Trigger | Action |
|---|---|
| P95 connection establishment latency exceeds 500ms | Add 1 WebSocket instance |
| Connection count on any instance exceeds 8,000 | Add 1 WebSocket instance |
| All instances below 4,000 connections for 15 minutes | Remove 1 instance (never below 2) |

When a WebSocket instance is removed, existing connections are not forcibly closed immediately. The instance is drained: the load balancer stops routing new connections to it while existing connections are allowed to persist. Agents reconnect naturally when their connections drop (network fluctuation, idle timeout) and are routed to remaining instances.

### 4.3 Queue Worker Scaling

Each queue group scales independently. The Horizon dashboard exposes queue depth metrics that feed the auto-scaler.

| Queue | Scale-out trigger (depth) | Scale-in trigger | Min workers | Max workers |
|---|---|---|---|---|
| `engineering-critical` | > 50 jobs | < 10 jobs for 5 min | 4 | 12 |
| `engineering-default` | > 50 jobs | < 10 jobs for 10 min | 8 | 24 |
| `engineering-bulk` | > 50 jobs | < 5 jobs for 15 min | 2 | 8 |
| `engineering-releases` | > 50 jobs | < 5 jobs for 10 min | 2 | 6 |

Workers are terminated gracefully: Horizon sends `SIGTERM`, the worker finishes its current job, then exits. No job is lost during scale-in because the job payload remains in Redis until it is either completed (acknowledged) or fails and is re-queued.

---

## 5. Monitoring and Logging

### 5.1 Metrics

All Engineering Cloud components expose a `/metrics` endpoint in Prometheus text format. The Prometheus scraper (part of the existing ECOS Monitoring Stack) polls each endpoint on a 15-second interval.

**Key metrics:**

| Metric | Labels | Description |
|---|---|---|
| `engineering_api_response_time_seconds` (P50 / P95 / P99) | `endpoint`, `method`, `status_code` | API response latency distribution |
| `engineering_websocket_connection_count` | `instance` | Active WebSocket connections per server instance |
| `engineering_queue_depth` | `queue` | Current number of jobs waiting per queue group |
| `engineering_queue_job_duration_seconds` | `queue`, `job_class` | Actual job processing time |
| `engineering_scheduler_cycle_duration_seconds` | — | Time taken for a single scheduler tick |
| `engineering_scheduler_leader` | `instance` | 1 if this instance holds the leader lock, 0 otherwise |
| `engineering_error_rate_per_minute` | `endpoint`, `error_type` | Count of 4xx and 5xx responses per endpoint per minute |
| `engineering_task_state_transitions_total` | `from_state`, `to_state` | Counter of all EngineeringTask state transitions |
| `engineering_worker_heartbeat_age_seconds` | `worker_id` | Seconds since last WorkerHeartbeat received |
| `engineering_object_storage_upload_bytes_total` | `bucket` | Cumulative bytes written to each storage bucket |

Grafana dashboards are pre-configured for: API health overview, WebSocket connection saturation, queue throughput and backlog, scheduler liveness, and worker fleet status.

Alerting thresholds:

| Alert | Condition | Severity |
|---|---|---|
| High API latency | P95 > 1 second for 3 minutes | Warning |
| Critical API latency | P99 > 3 seconds for 1 minute | Critical |
| WebSocket saturation | Any instance > 9,000 connections | Warning |
| Queue backlog | Any queue depth > 200 for 5 minutes | Warning |
| Scheduler dead | No tick recorded for 30 seconds | Critical |
| Worker offline | WorkerHeartbeat age > 60 seconds for registered worker | Warning |
| Error rate spike | Error rate > 5% of requests for 2 minutes | Critical |

### 5.2 Log Aggregation

All components write structured JSON logs to stdout. The container runtime captures stdout and forwards to the centralized log aggregator (existing ECOS log infrastructure).

**Required fields on every log entry:**

| Field | Type | Description |
|---|---|---|
| `timestamp` | ISO-8601 string | UTC timestamp with millisecond precision |
| `level` | string | `debug`, `info`, `warning`, `error`, `critical` |
| `service` | string | Component name: `api`, `websocket`, `scheduler`, `horizon`, `horizon-<queue>` |
| `trace_id` | UUID string | Request-scoped trace identifier (propagated via HTTP header `X-Trace-ID`) |
| `company_id` | UUID string or null | Tenant identifier (null for system-level events) |
| `message` | string | Human-readable event description |
| `context` | object | Structured key-value payload relevant to the event |

Additional optional fields: `task_id`, `worker_id`, `session_id`, `pipeline_run_id`, `duration_ms`, `http_status`, `queue`.

Logs are retained in the hot tier for 14 days and in the warm tier for 90 days. Log search is available through the Grafana Loki integration or the ECOS internal log viewer.

### 5.3 Health Checks

| Component | Endpoint | Port | Expected Response | Load Balancer Action |
|---|---|---|---|---|
| API Server | `GET /api/v1/engineering/health` | 9000 (internal) | HTTP 200 JSON `{"status":"ok"}` | Remove from pool if 3 consecutive failures (30s) |
| WebSocket Server | `GET /health` | 6002 (internal sidecar) | HTTP 200 JSON `{"status":"ok","connections":N}` | Remove from pool if 3 consecutive failures (30s) |
| Scheduler | `GET /health` | 8080 (internal) | HTTP 200 JSON `{"leader":true,"last_tick":"<timestamp>"}` | Alert if unavailable; not load-balanced |
| Horizon Dashboard | `GET /horizon/api/stats` | internal | HTTP 200 | Restart worker supervisor if unavailable |

All health checks run every 10 seconds. Unhealthy instances are removed from the load balancer pool within 30 seconds (3 failures × 10 seconds). Removed instances receive a `SIGTERM` and enter the graceful shutdown sequence.

---

## 6. Disaster Recovery

| Metric | Target |
|---|---|
| RTO (Recovery Time Objective) | 15 minutes |
| RPO (Recovery Point Objective) | 1 hour |

### 6.1 Backup and Restore

**PostgreSQL:**

- Full base backup: daily at 02:00 UTC, retained for 30 days.
- WAL archiving: continuous, enabling point-in-time recovery to any second within the retention window.
- Restore procedure:
  1. Provision a new PostgreSQL 14+ instance.
  2. Restore the most recent base backup.
  3. Replay WAL archives up to the desired recovery point.
  4. Update PgBouncer connection targets to point to the restored instance.
  5. Verify row counts and spot-check data integrity on key tables (`engineering_tasks`, `execution_sessions`, `pipeline_runs`).
  6. Update application environment configuration and perform a rolling restart of API servers.
  - Target restore time: under 10 minutes for the most recent daily backup with minimal WAL replay.

**Redis:**

- AOF files are persisted to durable storage (volume snapshot or S3 sync) every 60 minutes.
- On Redis cluster failure, recovery options in priority order:
  1. Cluster auto-failover: Redis Cluster promotes a replica automatically within 10–30 seconds. No operator action required for single-node failures.
  2. If all cluster data is lost: on startup, Laravel Horizon re-enqueues any jobs that are marked as running in the database but lack a corresponding `completed_at` timestamp. The queue backend rebuilds itself from the database as the authoritative source of truth. Session cache and WebSocket channel state rebuild on reconnection.
- Target recovery for total Redis loss: under 5 minutes (job re-queue from DB) + natural session re-establishment.

**Object Storage:**

- Cross-region replication is enabled on both buckets (`engineering-artifacts`, `engineering-logs`). Replication lag target: under 15 minutes.
- Restore procedure: update application presigned URL generation to target the replica bucket region. No data migration required.
- For accidental deletion: S3 Versioning is enabled on `engineering-artifacts`. Deleted objects can be recovered by removing the delete marker.

### 6.2 Failover Procedures

**API Server failure (one or more instances):**

The load balancer health check detects the failure within 30 seconds and removes the instance from the pool. Because API servers are stateless, remaining instances immediately absorb the traffic. If the pool falls below minimum capacity, the auto-scaler adds instances. No operator action is required for partial failures. Full pool loss triggers a Critical alert and requires manual intervention to provision replacement instances.

**PostgreSQL primary failure:**

1. PgBouncer detects the primary is unreachable and begins rejecting write connections (read connections continue to the replica).
2. Operator promotes the read replica to primary using `pg_ctl promote` or the managed database control plane.
3. PgBouncer primary target is updated to point to the promoted instance.
4. Write traffic resumes. A new replica is provisioned to restore redundancy.
5. Applications do not require a restart if PgBouncer handles the endpoint switch transparently.
- Target failover time: under 5 minutes with an on-call operator.
- RPO for primary failure: up to 500ms of WAL not yet shipped to the replica (bounded by synchronous_commit setting).

**Redis cluster failure:**

Redis Cluster detects node failure and promotes a replica within 10–30 seconds automatically (no operator action for single-node failure). If quorum is lost (majority of masters unavailable), the cluster enters error state:
1. Alert fires immediately.
2. Operator restores quorum by replacing failed nodes.
3. Horizon re-enqueues orphaned jobs from the database.
- Target restoration: under 10 minutes.

**WebSocket Server failure (one or more instances):**

The load balancer removes the failed instance. Clients with connections to the failed instance receive a disconnect event. Client-side reconnection logic (built into the agent SDK) reconnects to the load balancer, which routes to a healthy instance. Agents re-subscribe to their task and session channels. The reconnection handshake is handled transparently without data loss because channel state is in Redis.

---

## 7. Deployment Pipeline for Engineering Cloud

The Engineering Cloud itself follows a structured deployment pipeline. This pipeline is separate from the Engineering Task pipelines it manages.

### 7.1 Pipeline Stages

```
Developer Push
      │
      ▼
┌─────────────────────────────┐
│  Stage 1: Test Suite        │
│  PHPUnit (Laravel Feature + │
│  Unit tests)                │
│  React Jest + Playwright    │
│  All tests must pass        │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Stage 2: Static Analysis   │
│  PHPStan (level 8)          │
│  TypeScript tsc --noEmit    │
│  PHP_CodeSniffer (PSR-12)   │
│  ESLint + Prettier check    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Stage 3: Build             │
│  Docker image build         │
│  Vite production bundle     │
│  Image tagged with Git SHA  │
│  Pushed to container        │
│  registry                   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Stage 4: Staging Deploy    │
│  Deploy image to staging    │
│  environment                │
│  Run pending migrations     │
│  (staging DB)               │
│  Rolling update applied     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Stage 5: Smoke Tests       │
│  GET /api/v1/engineering/   │
│  health → 200               │
│  WebSocket connection       │
│  handshake succeeds         │
│  Queue worker responds      │
│  Task create / read         │
│  round-trip succeeds        │
│  Scheduler tick confirmed   │
│  via health endpoint        │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Stage 6: Production Deploy │
│  (Blue-Green)               │
│  Green environment          │
│  provisioned with new image │
│  DB migrations run on Green │
│  Traffic shifted to Green   │
│  (10% → 50% → 100%)        │
│  Blue held for 10 minutes   │
│  Blue decommissioned on     │
│  no errors                  │
└─────────────┬───────────────┘
              │
              ▼
        Deployment Complete
```

### 7.2 Zero-Downtime Deployment

Zero-downtime is achieved through a combination of:

- **Blue-green deployment:** A complete parallel environment (Green) is provisioned and validated before any production traffic shifts to it. Blue continues to serve 100% of traffic until Green is confirmed healthy.
- **Database migrations:** All migrations must be backward-compatible with the previous application version. Additive changes (new columns with defaults, new tables) are applied before traffic shifts. Destructive changes (column drops, renames) are deferred to a subsequent deployment cycle after the old application version is fully retired.
- **Traffic shifting:** Load balancer weights are adjusted gradually (10% → 50% → 100%) with a 2-minute hold at each step. Error rates are monitored at each step; automatic rollback is triggered if the error rate on Green exceeds 1%.
- **Graceful shutdown:** Blue instances receive `SIGTERM` and drain existing connections within the 30-second window before termination.

### 7.3 Rollback Procedure

If any stage fails, or if post-deploy monitoring detects degradation within 30 minutes of a production deployment:

1. Load balancer traffic is shifted 100% back to the Blue environment (target: under 60 seconds).
2. The Green environment is decommissioned.
3. If forward-only migrations were applied to the database, a rollback migration is executed (must be prepared in advance alongside every forward migration).
4. An incident is opened and the deployment pipeline is locked for the Engineering Cloud service until the root cause is identified and resolved.

The previous container image (Blue) is always retained in the container registry for a minimum of 7 days following a successful deployment, enabling rollback to any recent version without a rebuild.

---

*Document owner: Engineering Platform Team. Review cycle: quarterly or on any infrastructure change. Next scheduled review: 2026-10-22.*
