# Worker Architecture
## ECOS Claude Bridge v1.0

**Document ID:** CB-WA-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## What the Worker Is

A Node.js script that runs as a Windows background service via PM2. It is small, focused, and does exactly one thing: take a task description from ECOS and give it to Claude Code.

Estimated size: ~500 lines of JavaScript.

---

## Setup on Windows

```
1. Install Node.js (LTS)
2. Install PM2 globally: npm install -g pm2
3. Download claude-bridge-worker.zip from ECOS settings
4. Extract to C:\claude-bridge\
5. Edit config.json with ECOS URL and API token
6. Run: pm2 start worker.js --name claude-bridge
7. Run: pm2 save && pm2 startup
```

The worker is now running as a Windows background service that survives reboots.

---

## Worker Configuration File

Stored at `C:\claude-bridge\config.json`. AES-256 encrypted (key derived from machine hostname + Windows product ID).

```json
{
  "ecos_url": "https://erp.company.com",
  "api_token": "cb_tok_xxxxxxxxxxxxxxxx",
  "worker_id": "uuid-assigned-at-registration",
  "worker_name": "Osama-PC",
  "poll_interval_seconds": 10,
  "heartbeat_interval_seconds": 30,
  "log_level": "info"
}
```

The `ANTHROPIC_API_KEY` and repository credentials are NOT in this file. They live in the environment (`%APPDATA%\claude-bridge\.env` or system environment variables), accessible to Claude Code at runtime.

---

## Startup Sequence

```
1. Load and decrypt config.json
2. Validate: all required fields present
3. POST /cb/worker/heartbeat → verify token is valid, get 200
4. Check for any tasks that were RUNNING when the worker last died:
   GET /cb/worker/my-running-task
   If found: POST /cb/worker/tasks/{id}/fail with reason "worker_restarted"
5. Start heartbeat loop (every 30 seconds)
6. Start poll loop (every 10 seconds)
7. Log: "Claude Bridge Worker online"
```

---

## Heartbeat Loop

Every 30 seconds:

```
POST /cb/worker/heartbeat
Body: { "status": "idle" | "busy", "active_task_id": null | "uuid" }

Response:
  200 → update last_seen_at, continue
  401 → log error "API token invalid or revoked", stop polling, alert
  403 → log error "Worker deactivated", exit process
```

If 3 consecutive heartbeats fail: pause polling, retry heartbeat with exponential backoff (60s, 120s, 300s). Alert message written to PM2 log.

---

## Poll Loop

Every 10 seconds when idle:

```
GET /cb/worker/tasks/next

Response:
  204 No Content → no tasks; sleep 10s, try again
  200 → task received; begin execution (see below)
  401 / 403 → same as heartbeat error handling
```

When no tasks arrive for 60 seconds: extend poll interval to 30 seconds (saves load on ECOS). Reset to 10 seconds when a task arrives.

---

## Execution Sequence

```
Task received from ECOS
      │
      ▼
[1] POST /cb/worker/tasks/{id}/start
    → Task moves to RUNNING in ECOS
      │
      ▼
[2] Navigate to repository_path
    → cd {task.repository_path}
    → git fetch origin
    → git checkout {task.target_branch}
    → git pull
      │
      ▼
[3] Spawn Claude Code as subprocess:
    claude --print --no-interactive \
      --allowedTools "Bash,Edit,Write,Read,Glob,Grep" \
      -p "{task.description}"
    
    Working directory: task.repository_path
    Environment: inherited from worker process
    (includes ANTHROPIC_API_KEY from system env)
      │
      ▼
[4] Capture stdout + stderr line by line
    Every 20 lines OR every 30 seconds:
      POST /cb/worker/tasks/{id}/log-chunk
      Body: { "lines": [...] }
      │
      ▼
[5] Wait for Claude Code to exit
    (timeout: 30 minutes default)
      │
      ▼
[6] Collect output:
    - git diff HEAD > diff.patch
    - Parse Claude Code's final output for report.md
    - Combine all log lines → execution.log
      │
      ▼
[7] Upload artifacts one by one:
    POST /cb/worker/tasks/{id}/artifact
    (multipart file upload, one request per artifact)
      │
      ▼
[8] POST /cb/worker/tasks/{id}/complete
    Body: { "exit_code": 0, "tokens_used": N, "claude_version": "..." }
    → Task moves to DONE in ECOS
    → ECOS sends notification to reviewer
      │
      ▼
Resume polling
```

---

## Failure Handling

| Failure | Worker Action |
|---|---|
| `git pull` fails | Fail task: `failure_code: repo_sync_failed` |
| Claude Code crashes (non-zero exit) | Fail task: `failure_code: claude_crash` with exit code |
| Claude Code times out (30 min) | Kill process; fail task: `failure_code: timeout` |
| Artifact upload fails | Retry 3× with 5s delay; if all fail, fail task: `artifact_upload_failed` |
| ECOS API unreachable during execution | Keep Claude running; queue results locally; retry upload when connectivity returns |
| Worker process crashes mid-execution | On restart: report failure to ECOS for the orphaned task |

---

## Log Chunk Format

```json
POST /cb/worker/tasks/{id}/log-chunk
{
  "chunk_index": 1,
  "lines": [
    { "ts": "2026-07-18T10:01:22Z", "stream": "stdout", "text": "Reading files..." },
    { "ts": "2026-07-18T10:01:23Z", "stream": "stdout", "text": "Implementing the feature..." }
  ]
}
```

Log chunks are stored as they arrive. Full execution log is assembled from chunks at review time.

---

## Recovery After Restart

The worker registers itself once at first run using the API token from config. The `worker_id` is written back to config and reused on subsequent starts. If the config is lost, re-registration creates a new worker record.

On startup, the worker checks for any task ECOS has in `running` state assigned to this worker. If found, it immediately marks it failed. This prevents a task from being stuck in `running` indefinitely after a crash.

---

## Worker Lifecycle States

```
Stopped
   │ PM2 starts process
   ▼
Starting (validates config, checks connectivity)
   │
   ▼
Idle (polling for tasks every 10s)
   │ task received
   ▼
Busy (executing Claude Code)
   │ execution complete
   ▼
Idle
   │ PM2 stop / machine reboot
   ▼
Stopped
```

---

## PM2 Configuration

```json
// ecosystem.config.js
module.exports = {
  apps: [{
    name: "claude-bridge",
    script: "worker.js",
    cwd: "C:\\claude-bridge",
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    log_file: "C:\\claude-bridge\\logs\\combined.log",
    error_file: "C:\\claude-bridge\\logs\\error.log",
    time: true
  }]
}
```

---

## What the Worker Does Not Do

- Does not clone the repository (Claude Code handles it, or it's already cloned)
- Does not manage secrets (ANTHROPIC_API_KEY is in the system environment)
- Does not containerize execution (Claude Code runs as a normal process)
- Does not serve any HTTP endpoints
- Does not communicate peer-to-peer with other workers
- Does not modify the ECOS database directly
