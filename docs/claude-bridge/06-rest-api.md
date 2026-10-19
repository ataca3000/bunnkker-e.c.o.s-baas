# REST API Specification
## ECOS Claude Bridge v1.0

**Document ID:** CB-API-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## Design Rules

- All endpoints: `/api/cb/`
- All requests/responses: `application/json`
- Authentication: Bearer token (UI uses Sanctum session; Worker uses API token)
- Standard HTTP status codes
- Timestamps: ISO 8601 UTC
- Errors: `{ "error": { "code": "STRING", "message": "Human message" } }`

---

## Authentication

**UI requests:** Standard ECOS Sanctum session (no change).  
**Worker requests:** `Authorization: Bearer cb_tok_xxxxxxxxxx`  
Worker token is verified by hashing it and comparing to `cb_workers.token_hash`.

---

## Error Codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `INVALID_TOKEN` | Missing or invalid bearer token |
| 403 | `FORBIDDEN` | Token valid but insufficient permission |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | State conflict (e.g., task already running) |
| 422 | `INVALID_STATE` | Action not valid for current task status |
| 500 | `SERVER_ERROR` | Unexpected error |

---

## UI Endpoints (Sanctum auth)

### Tasks

#### List Tasks
```
GET /api/cb/tasks?status=queued&page=1

Query params:
  status:   pending | queued | running | done | failed | approved |
            changes_requested | merged | cancelled
  priority: low | normal | high
  page:     integer

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "title": "Add CSV export",
      "status": "done",
      "priority": "normal",
      "created_by": { "id": "uuid", "name": "Osama Fayez" },
      "worker": { "id": "uuid", "name": "Osama-PC" },
      "created_at": "2026-07-18T09:00:00Z",
      "updated_at": "2026-07-18T10:30:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 42, "last_page": 3 }
}
```

#### Create Task
```
POST /api/cb/tasks

Body:
{
  "title": "Add CSV export to Orders",
  "description": "Implement a GET /api/orders/export?format=csv endpoint...",
  "repository_path": "C:\\Projects\\ecos-erp",
  "target_branch": "main",
  "priority": "normal"
}

Response 201: { "data": { ... task ... } }
```

#### Get Task
```
GET /api/cb/tasks/{id}

Response 200:
{
  "data": {
    "id": "uuid",
    "title": "...",
    "status": "done",
    "description": "...",
    "repository_path": "...",
    "target_branch": "main",
    "priority": "normal",
    "worker": { "id": "uuid", "name": "Osama-PC" },
    "current_execution": {
      "id": "uuid",
      "attempt_number": 1,
      "started_at": "...",
      "finished_at": "...",
      "duration_seconds": 312,
      "tokens_used": 42000,
      "claude_version": "1.5.7"
    },
    "artifacts": [
      { "id": "uuid", "type": "diff", "filename": "diff.patch", "size_bytes": 4096 },
      { "id": "uuid", "type": "report", "filename": "report.md", "size_bytes": 1200 },
      { "id": "uuid", "type": "log", "filename": "execution.log", "size_bytes": 98000 }
    ],
    "review_comment": null,
    "reviewed_by": null,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

#### Update Task (before queuing)
```
PATCH /api/cb/tasks/{id}

Body: { "title": "...", "description": "...", "priority": "high" }
Valid only when status is draft or pending.

Response 200: { "data": { ... task ... } }
```

#### Queue Task
```
POST /api/cb/tasks/{id}/queue
Valid when status is pending or changes_requested.

Response 200: { "data": { "status": "queued" } }
```

#### Cancel Task
```
POST /api/cb/tasks/{id}/cancel
Not valid when status is merged.

Response 200: { "data": { "status": "cancelled" } }
```

#### Review Task (Approve)
```
POST /api/cb/tasks/{id}/approve

Body: { "comment": "Looks good. Tests pass." }
Valid when status is done.

Response 200: { "data": { "status": "approved" } }
```

#### Review Task (Request Changes)
```
POST /api/cb/tasks/{id}/request-changes

Body: { "comment": "Please also add a test for the empty case." }
Valid when status is done.

Response 200: { "data": { "status": "changes_requested" } }
```

#### Mark as Merged
```
POST /api/cb/tasks/{id}/mark-merged
Valid when status is approved.

Response 200: { "data": { "status": "merged" } }
```

#### Get Execution Log
```
GET /api/cb/tasks/{id}/log?page=1

Response 200:
{
  "data": {
    "execution_id": "uuid",
    "status": "done",
    "lines": [
      { "index": 1, "ts": "...", "stream": "stdout", "text": "Reading files..." },
      ...
    ],
    "total_lines": 842,
    "has_more": true
  }
}
```

#### Download Artifact
```
GET /api/cb/artifacts/{id}/download

Returns the file directly (Content-Disposition: attachment).
```

---

### Workers

#### List Workers
```
GET /api/cb/workers

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "name": "Osama-PC",
      "status": "online",
      "last_seen_at": "2026-07-18T10:28:45Z",
      "claude_version": "1.5.7"
    }
  ]
}
```

#### Register Worker (called from ECOS Settings UI, not from the Worker itself)
```
POST /api/cb/workers

Body: { "name": "Osama-PC" }

Response 201:
{
  "data": {
    "worker_id": "uuid",
    "api_token": "cb_tok_xxxxxxxxxx"   // shown ONCE; not stored in plaintext
  }
}
```

#### Deactivate Worker
```
DELETE /api/cb/workers/{id}

Response 204 No Content
```

---

### Dashboard

```
GET /api/cb/dashboard

Response 200:
{
  "data": {
    "worker": {
      "status": "online",
      "name": "Osama-PC",
      "last_seen_at": "..."
    },
    "counts": {
      "queued": 2,
      "running": 1,
      "awaiting_review": 3,
      "approved_today": 5
    },
    "active_task": {
      "id": "uuid",
      "title": "Add CSV export",
      "started_at": "...",
      "elapsed_seconds": 120
    },
    "recent_tasks": [ ... ]
  }
}
```

---

## Worker Endpoints (API token auth)

All at `/api/cb/worker/*`.

#### Heartbeat
```
POST /api/cb/worker/heartbeat

Body: { "status": "idle" | "busy", "active_task_id": null | "uuid" }

Response 200: { "ok": true }
Response 401: token invalid
Response 403: worker deactivated
```

#### Get Next Task
```
GET /api/cb/worker/tasks/next

Response 200 (task available):
{
  "task": {
    "id": "uuid",
    "title": "...",
    "description": "...",
    "repository_path": "C:\\Projects\\ecos-erp",
    "target_branch": "main"
  }
}
Response 204: no tasks in queue
```

#### Start Task
```
POST /api/cb/worker/tasks/{id}/start

Body: { "claude_version": "1.5.7" }

Response 200: { "ok": true }
Response 409: task already assigned to another worker (race condition)
```

#### Upload Log Chunk
```
POST /api/cb/worker/tasks/{id}/log-chunk

Body:
{
  "chunk_index": 1,
  "lines": [
    { "ts": "2026-07-18T10:01:22Z", "stream": "stdout", "text": "..." }
  ]
}

Response 200: { "ok": true }
```

#### Upload Artifact
```
POST /api/cb/worker/tasks/{id}/artifact

Multipart form:
  type:     diff | report | log
  file:     (binary file)
  checksum: sha256 hex string

Response 201: { "artifact_id": "uuid" }
```

#### Complete Task
```
POST /api/cb/worker/tasks/{id}/complete

Body:
{
  "exit_code": 0,
  "tokens_used": 42000,
  "claude_version": "1.5.7",
  "duration_seconds": 312
}

Response 200: { "ok": true }
```

#### Fail Task
```
POST /api/cb/worker/tasks/{id}/fail

Body:
{
  "failure_code": "timeout" | "claude_crash" | "repo_sync_failed" | "artifact_upload_failed" | "worker_restarted",
  "failure_message": "Process exited with code 1",
  "exit_code": 1
}

Response 200: { "ok": true }
```

#### Get My Running Task (for crash recovery)
```
GET /api/cb/worker/my-running-task

Response 200: { "task": { "id": "uuid", ... } } or { "task": null }
```

---

## Total Endpoint Count

| Group | Count |
|---|---|
| Task CRUD + actions | 10 |
| Workers | 3 |
| Dashboard | 1 |
| Worker-facing endpoints | 7 |
| **Total** | **21** |
