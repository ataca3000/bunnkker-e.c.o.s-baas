# REST API Specification
## ECOS AI Operations Platform

**Document ID:** AIOP-API-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## 1. API Design Principles

- All endpoints are prefixed: `/api/aiop/`
- Authentication: Laravel Sanctum for user-facing endpoints; Worker JWT for worker endpoints
- All requests and responses: `Content-Type: application/json`
- Standard HTTP status codes
- Error responses follow ECOS error envelope format
- All UUIDs are lower-case hyphenated strings
- All timestamps: ISO 8601 UTC (`2026-07-18T10:00:00Z`)
- Pagination: `?page=1&per_page=25` with meta in response

---

## 2. Authentication

### User Authentication

All user-facing endpoints require:
```
Authorization: Bearer <sanctum_token>
```

Obtained via the standard ECOS login flow.

### Worker Authentication

All worker-facing endpoints (`/api/aiop/worker/*`) require:
```
Authorization: Bearer <worker_jwt_token>
```

Obtained during worker registration.

---

## 3. Error Response Format

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "The requested task does not exist or you do not have access to it.",
    "details": {}
  }
}
```

### Standard Error Codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body fails validation |
| 401 | `UNAUTHENTICATED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Token valid but insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | State conflict (e.g., task already in progress) |
| 422 | `UNPROCESSABLE` | Business logic rejection |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `SERVER_ERROR` | Internal server error |

---

## 4. User-Facing Endpoints

### 4.1 Workspaces

#### List Workspaces
```
GET /api/aiop/workspaces

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "name": "Backend Team",
      "slug": "backend-team",
      "projects_count": 5,
      "workers_count": 3,
      "active_tasks_count": 2,
      "created_at": "2026-07-01T00:00:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 25, "total": 2, "last_page": 1 }
}
```

#### Create Workspace
```
POST /api/aiop/workspaces

Body:
{
  "name": "Backend Team",
  "slug": "backend-team",
  "owner_user_id": "uuid"
}

Response 201: { "data": { ... workspace ... } }
```

---

### 4.2 Projects

#### List Projects (within workspace)
```
GET /api/aiop/workspaces/{workspace_id}/projects

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "name": "ECOS Backend",
      "repository": { "name": "ecos-erp", "url": "...", "provider": "github" },
      "default_branch": "main",
      "tasks_count": 12,
      "is_active": true
    }
  ]
}
```

#### Create Project
```
POST /api/aiop/workspaces/{workspace_id}/projects

Body:
{
  "name": "ECOS Backend",
  "description": "...",
  "repository_id": "uuid",
  "default_branch": "main",
  "default_agent_id": "uuid"
}

Response 201: { "data": { ... project ... } }
```

---

### 4.3 Tasks

#### List Tasks
```
GET /api/aiop/tasks

Query params:
  workspace_id: uuid     (required or inferred from context)
  project_id:   uuid
  status:       pending|queued|in_progress|pending_review|completed|cancelled
  type:         feature|bug_fix|refactor|test|migration|review
  priority:     critical|high|medium|low
  assigned_to_worker_id: uuid
  page:         integer
  per_page:     integer (max 100)

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "title": "Add order export to CSV",
      "status": "pending_review",
      "type": "feature",
      "priority": "high",
      "project": { "id": "uuid", "name": "ECOS Backend" },
      "created_by": { "id": "uuid", "name": "Osama Fayez" },
      "assigned_worker": { "id": "uuid", "name": "Laptop-Osama" },
      "created_at": "2026-07-18T09:00:00Z",
      "updated_at": "2026-07-18T10:30:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 25, "total": 42, "last_page": 2 }
}
```

#### Create Task
```
POST /api/aiop/tasks

Body:
{
  "project_id": "uuid",
  "title": "Add order export to CSV",
  "description": "Implement a CSV export feature for the Orders list...",
  "type": "feature",
  "priority": "high",
  "required_capabilities": ["code_generation", "test_writing"],
  "preferred_agent_id": "uuid",
  "target_branch": "main",
  "labels": ["orders", "export"],
  "due_at": "2026-07-20T17:00:00Z",
  "max_cost_budget": 2.00,
  "context": {
    "related_files": ["backend/Modules/Commerce/Orders/..."],
    "acceptance_criteria": "..."
  }
}

Response 201:
{
  "data": {
    "id": "uuid",
    "status": "pending",
    ... full task ...
  }
}
```

#### Get Task
```
GET /api/aiop/tasks/{task_id}

Response 200:
{
  "data": {
    "id": "uuid",
    "title": "...",
    "status": "pending_review",
    "type": "feature",
    "priority": "high",
    "description": "...",
    "project": { ... },
    "current_execution": {
      "id": "uuid",
      "status": "complete",
      "started_at": "...",
      "completed_at": "...",
      "duration_seconds": 347,
      "tokens_used": 42000,
      "report": { ... }
    },
    "executions_count": 1,
    "reviews": [ { ... } ],
    "artifacts": [ { ... } ],
    "created_at": "...",
    "updated_at": "..."
  }
}
```

#### Queue Task
```
POST /api/aiop/tasks/{task_id}/queue

Response 200: { "data": { "status": "queued" } }
Errors: 409 if task is not in PENDING or CHANGES_REQUESTED status
```

#### Cancel Task
```
POST /api/aiop/tasks/{task_id}/cancel

Body: { "reason": "Requirements changed" }

Response 200: { "data": { "status": "cancelled" } }
Errors: 422 if task is in MERGING or COMPLETED status (too late to cancel)
```

---

### 4.4 Reviews

#### Get Review
```
GET /api/aiop/reviews/{review_id}

Response 200:
{
  "data": {
    "id": "uuid",
    "task": { "id": "uuid", "title": "..." },
    "stage": "technical",
    "status": "pending",
    "reviewer": { "id": "uuid", "name": "..." },
    "report": {
      "summary": "...",
      "files_changed": 5,
      "lines_added": 120,
      "lines_removed": 30,
      "tests_passed": 14,
      "tests_failed": 0,
      "identified_risks": [...],
      "suggested_review_focus": [...]
    },
    "artifacts": [
      { "id": "uuid", "type": "code_diff", "name": "diff.patch", "url": "presigned-url" }
    ],
    "sla_deadline": "...",
    "created_at": "..."
  }
}
```

#### Submit Review Decision
```
POST /api/aiop/reviews/{review_id}/decision

Body:
{
  "decision": "approved" | "changes_requested" | "rejected",
  "comment": "Looks good. Tests pass. One minor suggestion..."
}

Response 200: { "data": { "status": "approved" } }
Errors: 422 if comment is empty when decision is changes_requested or rejected
```

#### List My Pending Reviews
```
GET /api/aiop/reviews/pending

Response 200: { "data": [ ... reviews ... ] }
```

---

### 4.5 Workers (Admin)

#### Register Worker
```
POST /api/aiop/workers/register

Body:
{
  "workspace_token": "...",
  "name": "Laptop-Osama",
  "hostname": "Osama-MacBook",
  "agent": "claude-code",
  "agent_version": "1.5.7",
  "os_type": "macos",
  "docker_available": true,
  "max_concurrent": 1
}

Response 201:
{
  "data": {
    "worker_id": "uuid",
    "worker_token": "jwt-token"
  }
}
```

#### List Workers
```
GET /api/aiop/workers?workspace_id=uuid

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "name": "Laptop-Osama",
      "status": "idle",
      "agent": "claude-code",
      "agent_version": "1.5.7",
      "last_heartbeat_at": "2026-07-18T10:28:00Z",
      "active_execution_id": null
    }
  ]
}
```

#### Deregister Worker
```
DELETE /api/aiop/workers/{worker_id}

Response 204 No Content
Errors: 409 if worker has an active execution (must drain first)
```

---

### 4.6 Artifacts

#### Get Artifact Download URL
```
GET /api/aiop/artifacts/{artifact_id}/download

Response 200:
{
  "data": {
    "url": "https://s3.amazonaws.com/.../diff.patch?presigned=...",
    "expires_at": "2026-07-18T11:30:00Z",
    "checksum_sha256": "abc123..."
  }
}
```

---

### 4.7 Execution Logs

#### Stream Execution Logs
```
GET /api/aiop/executions/{execution_id}/logs

Query params:
  from_sequence: integer  (for pagination / tail)

Response 200:
{
  "data": {
    "execution_id": "uuid",
    "status": "running",
    "lines": [
      { "sequence": 1, "level": "info", "source": "agent", "message": "...", "logged_at": "..." },
      { "sequence": 2, ... }
    ],
    "has_more": true
  }
}
```

---

### 4.8 Queue Status

#### Get Queue Status
```
GET /api/aiop/queue

Response 200:
{
  "data": {
    "queued_count": 3,
    "in_progress_count": 1,
    "available_workers": 2,
    "busy_workers": 1,
    "estimated_wait_minutes": 15,
    "tasks_by_priority": {
      "critical": 0,
      "high": 2,
      "medium": 1,
      "low": 0
    }
  }
}
```

---

## 5. Worker-Facing Endpoints

All at `/api/aiop/worker/*`. Worker JWT required.

### 5.1 Worker Lifecycle

```
POST /api/aiop/worker/online            — Mark worker online at startup
POST /api/aiop/worker/offline           — Graceful shutdown signal
POST /api/aiop/worker/heartbeat         — Heartbeat (see Worker Architecture doc)
POST /api/aiop/worker/self/rotate-token — Request a new JWT token
```

### 5.2 Task Acquisition

```
GET /api/aiop/worker/tasks/next
  — Acquire next available task
  — Returns 200 with task + execution_id, or 204 if queue empty

PATCH /api/aiop/worker/executions/{id}/start
  — Confirm task acquisition (lock it)
  — Returns 200 or 409 if already taken by another worker
```

### 5.3 Execution Reporting

```
POST /api/aiop/worker/executions/{id}/log
  Body: { "lines": [ { "sequence": 1, "level": "info", "message": "...", "logged_at": "..." } ] }
  — Stream log chunks during execution (100-line batches)

POST /api/aiop/worker/executions/{id}/progress
  Body: { "substatus": "testing", "message": "Running tests...", "percent_complete": 65 }
  — Optional progress updates for UI display

POST /api/aiop/worker/executions/{id}/complete
  Body: { "status": "complete" | "failed", "exit_code": 0, "tokens_used": 42000, ... }
  — Final execution result

POST /api/aiop/worker/executions/{id}/crashed
  Body: { "reason": "Worker restarted unexpectedly" }
  — Notify that this execution was orphaned during a crash
```

### 5.4 Artifact Upload

```
POST /api/aiop/worker/artifacts/presign
  Body: { "execution_id": "uuid", "artifacts": [ { "name": "diff.patch", "type": "code_diff", "size_bytes": 4096, "mime_type": "text/plain", "checksum_sha256": "abc..." } ] }
  Response: { "data": [ { "artifact_id": "uuid", "upload_url": "presigned-s3-url", "expires_at": "..." } ] }

POST /api/aiop/worker/artifacts/confirm
  Body: { "confirmations": [ { "artifact_id": "uuid", "uploaded": true } ] }
  Response: 200 OK
```

---

## 6. Rate Limits

| Endpoint Group | Limit |
|---|---|
| User task creation | 60 per hour per user |
| Worker heartbeat | 10 per minute per worker |
| Worker task acquisition | 20 per minute per worker |
| Worker log streaming | 120 per minute per execution |
| Artifact presign | 30 per minute per worker |
| General user API | 300 per minute per user |

---

## 7. Versioning

The API is versioned via URL prefix. Current version: v1 (implicit in `/api/aiop/`).

When breaking changes are required:
- New prefix: `/api/aiop/v2/`
- Old prefix maintained for 6 months with deprecation headers:
  `Deprecation: true`
  `Sunset: Sat, 01 Jan 2028 00:00:00 GMT`
