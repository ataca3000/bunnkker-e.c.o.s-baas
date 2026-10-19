# Worker Architecture
## ECOS AI Operations Platform

**Document ID:** AIOP-WA-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## 1. Overview

A Worker is a long-running daemon process installed on a developer machine or CI/CD server. It registers with the AIOP Control Plane, polls for tasks, executes them via a configured AI agent, and reports results back. Workers are the only component that directly executes AI agent commands.

```
Developer Machine / CI Server
┌─────────────────────────────────────────────────────┐
│                   Worker Daemon                     │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ Heartbeat    │  │  Task Poller │                 │
│  │ Loop (30s)   │  │  (10s poll)  │                 │
│  └──────────────┘  └──────┬───────┘                │
│                            │                        │
│                     ┌──────▼───────┐                │
│                     │  Execution   │                 │
│                     │  Manager     │                 │
│                     └──────┬───────┘                │
│                            │                        │
│          ┌─────────────────┼──────────────────┐    │
│          │                 │                  │    │
│   ┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──┐ │
│   │  Docker     │  │  AI Agent    │  │  Log     │ │
│   │  Lifecycle  │  │  Connector   │  │  Stream  │ │
│   └─────────────┘  └──────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────┘
                         │
              HTTP / HTTPS API calls
                         │
              ┌──────────▼──────────┐
              │   AIOP Control Plane │
              │     (Laravel)        │
              └──────────────────────┘
```

---

## 2. Worker Registration

### 2.1 Registration Flow

```
1. Administrator runs: aiop-worker register --name "Laptop-Osama" --workspace <slug>
2. Worker sends registration request to /api/aiop/workers/register:
   {
     name: string,
     hostname: string,
     workspace_token: string,   // Pre-shared workspace auth token
     agent: "claude-code",
     agent_version: string,
     os_type: string,
     docker_available: bool,
     max_concurrent: 1
   }
3. Control plane validates workspace_token, creates Worker record
4. Control plane returns worker_id + long-lived worker_token (JWT)
5. Worker stores worker_id + worker_token in local config file
   Location: ~/.aiop/config.json (or /etc/aiop/worker.json for system service)
```

### 2.2 Worker Token

The worker token is a signed JWT with the following claims:

```
{
  "sub": "<worker_id>",
  "workspace_id": "<workspace_id>",
  "token_type": "worker",
  "iat": <issued_at>,
  "exp": <expiry>   // 1 year default; configurable
}
```

Token is presented as `Authorization: Bearer <worker_token>` on every request. The control plane validates the signature, checks workspace membership, and checks that the worker record is not deregistered.

### 2.3 Token Rotation

- Tokens can be rotated by the administrator at any time via the AIOP Settings UI
- On rotation: the old token is immediately invalidated; the worker's next heartbeat fails with 401; the worker logs an error and pauses polling until the operator provides the new token
- Workers can also self-rotate via: `POST /api/aiop/workers/self/rotate-token`

---

## 3. Startup Sequence

```
1. Load config from ~/.aiop/config.json
2. Validate config (workspace, worker_id, token)
3. POST /api/aiop/workers/self/online  — register online status
4. Verify agent is available (run version check: `claude --version`)
5. Start Heartbeat Loop (every 30 seconds)
6. Start Task Polling Loop (every 10 seconds)
7. Log: "Worker [name] online. Agent: claude-code v1.5.7"
```

---

## 4. Heartbeat Loop

Workers send a heartbeat every 30 seconds while online.

### 4.1 Heartbeat Request

```
POST /api/aiop/worker/heartbeat
Headers: Authorization: Bearer <worker_token>

Body:
{
  "status": "idle" | "busy" | "error",
  "active_execution_id": "<uuid>" | null,
  "cpu_percent": 12.4,
  "memory_percent": 45.2,
  "disk_free_gb": 128.5
}
```

### 4.2 Heartbeat Response

```
200 OK
{
  "acknowledged": true,
  "server_time": "2026-07-18T10:00:00Z",
  "commands": []   // Optional: "pause", "drain", "update"
}

401 Unauthorized → token rotated; stop polling, alert operator
403 Forbidden    → worker deregistered; stop all activity, exit
```

### 4.3 Heartbeat Failure Handling

| Consecutive Failures | Action |
|---|---|
| 1–2 | Retry immediately |
| 3–5 | Log warning; exponential backoff (10s, 30s, 60s) |
| 5+ | Alert operator; pause task polling; continue heartbeat attempts |
| 10+ | If active execution: mark as potentially orphaned; stop container; send failure report |

### 4.4 Worker Offline Detection (Control Plane Side)

The control plane background job checks every 2 minutes:
- If `last_heartbeat_at` > 90 seconds ago → mark worker as `offline`
- If `last_heartbeat_at` > 5 minutes ago → mark any active execution as `failed` (timeout)
- SLA breach notification sent to workspace administrators

---

## 5. Task Polling

### 5.1 Poll Request

```
GET /api/aiop/worker/tasks/next
Headers: Authorization: Bearer <worker_token>

Response (task available):
200 OK
{
  "task": {
    "id": "<uuid>",
    "title": "...",
    "description": "...",
    "type": "feature",
    "priority": "high",
    "project": { "name": "...", "repository_url": "..." },
    "execution_policy": { "timeout_seconds": 1800, "memory_limit_gb": 4 },
    "secrets": [
      { "name": "ANTHROPIC_API_KEY", "encrypted_value": "...", "encryption_key": "..." }
    ],
    "context": { ... }
  },
  "execution_id": "<uuid>"   // Pre-created execution record
}

Response (no task):
204 No Content
```

### 5.2 Task Assignment

When a task is returned:
1. Worker immediately sends `PATCH /api/aiop/worker/executions/{execution_id}/start` to lock the task
2. If control plane rejects (task was raced by another worker) → discard and re-poll in 10s
3. Worker begins execution lifecycle (Section 6)

### 5.3 Backoff During Busy State

If `max_concurrent_executions` is reached:
- Worker stops polling for new tasks
- Continues heartbeat loop
- Resumes polling 10 seconds after current execution completes

---

## 6. Execution Lifecycle

```
Task Acquired
     │
     ▼
[1] Decrypt Secrets (in memory, never written to disk)
     │
     ▼
[2] Prepare Workspace Directory
    /workspaces/{task_id}_{execution_id}/
     │
     ▼
[3] Clone Repository
    git clone --depth 1 --branch {target_branch} {url} /workspace/
    (uses deploy key secret)
     │
     ▼
[4] Create / Start Docker Container  (or Tier 2 isolation)
    - Mount /workspace read-write
    - Set env vars: ANTHROPIC_API_KEY, GITHUB_TOKEN, TASK_DESCRIPTION, etc.
    - Resource limits: CPU, memory, time
     │
     ▼
[5] Stream execution: POST /api/aiop/worker/executions/{id}/log (every 100 lines)
     │
[6] AI Agent Executes
    connector.run(task, workspace_path, environment_vars)
    - Connector runs CLI command inside the container (or as subprocess)
    - Returns: success/failure, exit_code, output_summary
     │
     ▼
[7] Collect Artifacts
    - Compute git diff: git diff HEAD
    - List modified files
    - Collect test result files (if any)
     │
     ▼
[8] Request presigned upload URLs for each artifact
    POST /api/aiop/worker/artifacts/presign
     │
     ▼
[9] Upload Artifacts directly to S3 using presigned URLs
     │
     ▼
[10] Confirm artifact uploads
     POST /api/aiop/worker/artifacts/confirm
     │
     ▼
[11] Submit Execution Result
     POST /api/aiop/worker/executions/{id}/complete
     {
       "status": "complete" | "failed",
       "exit_code": 0,
       "tokens_used": 45000,
       "duration_seconds": 320
     }
     │
     ▼
[12] Cleanup
     - Stop and remove Docker container
     - Delete workspace directory  (configurable: keep for X hours for debug)
     - Clear secrets from memory
```

---

## 7. Progress Reporting

During step [6], the worker sends progress updates to allow real-time UI display:

```
POST /api/aiop/worker/executions/{id}/progress
{
  "substatus": "cloning" | "analyzing" | "generating" | "testing" | "finalizing",
  "message": "Running test suite...",
  "percent_complete": 65
}
```

Progress updates are best-effort and may be dropped if the worker is under load. The UI should handle gaps gracefully.

---

## 8. Execution Failure Handling

| Failure Cause | Exit Code | Worker Action |
|---|---|---|
| Agent timeout | `timeout` | Kill container; upload partial artifacts; report failed with `failure_code: timeout` |
| Out of memory | `oom` | Kill container; report failed with `failure_code: out_of_memory` |
| Agent crash | Non-zero exit | Collect crash dump; report failed with `failure_code: agent_crash` |
| Git clone fail | `clone_error` | Report failed without container start; `failure_code: repository_clone_failed` |
| S3 upload fail | — | Retry 3× with exponential backoff; if all fail, report `artifact_upload_failed` |
| Container start fail | — | Attempt Tier 2 fallback; if unavailable, report `container_start_failed` |

---

## 9. Crash and Offline Recovery

### 9.1 Worker Process Crash

If the worker daemon crashes while an execution is in progress:

1. Control plane detects heartbeat timeout after 90 seconds
2. Control plane marks execution as `failed` with `failure_code: worker_crashed`
3. Task moves back to `QUEUED` if retry policy permits
4. Orphaned Docker container is detected on worker restart via `docker ps` scan and terminated
5. Orphaned workspace directory is cleaned up on worker restart

### 9.2 Worker Restart after Crash

On startup, the worker:
1. Checks `docker ps` for any containers with `AIOP_EXECUTION_ID` label
2. If found: sends `POST /api/aiop/worker/executions/{id}/crashed` to notify the control plane
3. Terminates orphaned containers
4. Purges stale workspace directories older than 2 hours
5. Proceeds to normal startup sequence

### 9.3 Machine Reboot

The worker daemon should be configured as a system service (systemd / launchd / Windows Service) to auto-start on reboot. On start, the same recovery sequence as crash recovery runs.

---

## 10. Worker Auto-Update

Workers support self-update to ensure agent versions remain current:

1. Control plane tracks current recommended agent version per agent type
2. Heartbeat response may include `"commands": [{"type": "update", "version": "1.6.0", "download_url": "..."}]`
3. Worker: finishes current execution (if any), then downloads and verifies the update package
4. Worker: installs update, restarts daemon
5. Worker: sends heartbeat confirming new version

Auto-update can be disabled per-worker via config: `auto_update: false`.

---

## 11. Configuration Reference

```json
// ~/.aiop/config.json

{
  "worker_id": "...",
  "worker_name": "Laptop-Osama",
  "workspace_id": "...",
  "worker_token": "...",
  "api_base": "https://erp.company.com/api/aiop",
  "agent": {
    "type": "claude-code",
    "model": "claude-sonnet-5",
    "timeout_seconds": 1800
  },
  "execution": {
    "max_concurrent": 1,
    "docker_enabled": true,
    "docker_image": "ecos-aiop-worker-sandbox:latest",
    "workspace_base_path": "/var/aiop/workspaces",
    "keep_workspace_on_success": false,
    "keep_workspace_on_failure": true,
    "keep_workspace_hours": 24
  },
  "poll": {
    "interval_seconds": 10,
    "heartbeat_interval_seconds": 30
  },
  "auto_update": true,
  "log_level": "info"
}
```

---

## 12. Worker Lifecycle State Diagram

```
                  ┌─────────────────┐
                  │    Offline      │
                  │   (stopped)     │
                  └────────┬────────┘
                           │ Start daemon
                           ▼
                  ┌─────────────────┐
                  │  Initializing   │
                  │ (checking agent)│
                  └────────┬────────┘
                           │ All checks pass
                           ▼
              ┌────────────────────────┐
         ┌───►│         Idle           │◄──────────────┐
         │    │  (polling for tasks)   │               │
         │    └──────────┬─────────────┘               │
         │               │ Task acquired                │
         │               ▼                             │
         │    ┌────────────────────────┐               │
         │    │         Busy           │               │
         │    │ (executing task)       │               │
         │    └──────────┬─────────────┘               │
         │               │ Execution complete           │
         │               └─────────────────────────────┘
         │
         │ Admin: drain command
         │    ┌────────────────────────┐
         └────│       Draining         │
              │ (finishing current job)│
              └──────────┬─────────────┘
                         │ No active tasks
                         ▼
              ┌────────────────────────┐
              │     Maintenance        │
              │  (awaiting resume)     │
              └──────────┬─────────────┘
                         │ Admin: resume command
                         ▼
                       Idle
```
