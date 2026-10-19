# Engineering Cloud — REST API Contracts

**Version:** v1
**Status:** Frozen (Design Only)
**Date:** 2026-07-22
**Author:** Engineering Architecture Team

---

## Table of Contents

1. [API Design Standards](#1-api-design-standards)
2. [Task Management API](#2-task-management-api)
3. [Agent Management API](#3-agent-management-api)
4. [Worker API (Agent-Facing)](#4-worker-api-agent-facing)
5. [Artifact Upload API](#5-artifact-upload-api)
6. [Release Management API](#6-release-management-api)
7. [WebSocket Connection API](#7-websocket-connection-api)
8. [Dashboard and Reporting API](#8-dashboard-and-reporting-api)
9. [Error Code Reference](#9-error-code-reference)
10. [Response Envelope](#10-response-envelope)

---

## 1. API Design Standards

### Base URL

```
/api/v1/engineering
```

All paths below are relative to this base. The full URL for any endpoint is:

```
https://{host}/api/v1/engineering/{resource}
```

### Authentication

| Consumer | Mechanism | Header |
|----------|-----------|--------|
| UI (human operators, leads) | Laravel Sanctum session token | `Authorization: Bearer {sanctum_token}` |
| Agents (automated workers) | JWT signed with agent private key | `Authorization: Bearer {jwt}` |
| Agent registration only | API Key issued at provisioning time | `X-Agent-Key: {api_key}` |

JWT claims must include: `agent_id`, `company_id`, `iat`, `exp` (max 1 hour TTL). Tokens are verified against the `engineering_agents` table; revoked agents are rejected immediately regardless of JWT validity.

### Content Negotiation

```
Content-Type: application/json
Accept: application/json
```

All request bodies must be valid JSON. Multipart form data is only accepted on artifact upload initiation (see Section 5).

### Error Response Format

All error responses use this envelope:

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "The requested task does not exist or you do not have access to it.",
    "details": {
      "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b"
    }
  }
}
```

- `code` — machine-readable string from the Error Code Reference (Section 9)
- `message` — human-readable explanation
- `details` — optional object with field-level or context-specific information; always present but may be `{}`

### Pagination

All list endpoints use cursor-based pagination. Clients must not assume offset behavior.

Query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | null | Opaque cursor from previous response `meta.next_cursor` |
| `per_page` | integer | 25 | Items per page; max 100 |

Pagination meta in every list response:

```json
{
  "meta": {
    "per_page": 25,
    "next_cursor": "eyJpZCI6IjAxOGYifQ==",
    "prev_cursor": null,
    "has_more": true,
    "total_estimate": 142
  }
}
```

`total_estimate` is a non-blocking approximate count. It must not be used for precise pagination calculations.

### Rate Limiting Headers

Every response carries:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

Default limits: UI consumers — 300 req/min. Agent consumers — 600 req/min. Upload endpoints — 60 req/min per agent.

### Idempotency

Mutation endpoints (POST, PATCH) accept an optional `Idempotency-Key` header (UUID v4). If the same key is submitted twice within 24 hours, the second request returns the original response without re-executing the operation.

### Soft Deletes

No resource is hard-deleted through this API. Cancellation and termination set state; records remain queryable by authorized leads.

---

## 2. Task Management API

### 2.1 Create Task

**Purpose:** Create a new EngineeringTask in Draft state. The task is not queued until explicitly promoted.

**Method + URL:** `POST /tasks`

**Auth:** Sanctum (UI users with `engineering.tasks.create` permission)

**Request Body:**

```json
{
  "title": "Refactor OrderRepository to use query objects",
  "description": "Replace ad-hoc Eloquent chains with dedicated QueryObject classes per ADR-024.",
  "priority": "high",
  "type": "refactor",
  "module": "Orders",
  "estimated_minutes": 120,
  "context": {
    "related_adr": "ADR-024",
    "affected_files": [
      "backend/Modules/Orders/Infrastructure/Repositories/OrderRepository.php"
    ],
    "acceptance_criteria": [
      "All existing tests pass",
      "No raw Eloquent chains outside query objects"
    ]
  },
  "dependencies": [
    "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b"
  ],
  "tags": ["refactor", "orders", "Q3-2026"],
  "assigned_agent_id": null
}
```

**Field Rules:**

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `title` | Yes | string | 5–255 characters |
| `description` | Yes | string | 20–10000 characters |
| `priority` | Yes | enum | `critical`, `high`, `medium`, `low` |
| `type` | Yes | enum | `feature`, `bug`, `refactor`, `test`, `docs`, `infra`, `security` |
| `module` | No | string | Max 100 characters; must match a known module slug if provided |
| `estimated_minutes` | No | integer | 1–14400 (max 10 days) |
| `context` | No | object | Free-form JSON; max 64 KB serialized |
| `dependencies` | No | array of UUID | Each must reference an existing task in the same company |
| `tags` | No | array of string | Max 10 tags; each max 50 characters |
| `assigned_agent_id` | No | UUID | Must reference an active agent; if null, assignment is deferred |

**Success Response — 201 Created:**

```json
{
  "data": {
    "id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "title": "Refactor OrderRepository to use query objects",
    "description": "Replace ad-hoc Eloquent chains...",
    "status": "Draft",
    "priority": "high",
    "type": "refactor",
    "module": "Orders",
    "estimated_minutes": 120,
    "context": { "related_adr": "ADR-024", "affected_files": [...], "acceptance_criteria": [...] },
    "dependencies": [],
    "tags": ["refactor", "orders", "Q3-2026"],
    "assigned_agent_id": null,
    "created_by": "usr_01abc",
    "company_id": "cmp_01xyz",
    "created_at": "2026-07-22T09:00:00Z",
    "updated_at": "2026-07-22T09:00:00Z"
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 422 | `VALIDATION_FAILED` | Any field fails validation; `details` contains field-keyed errors |
| 409 | `CIRCULAR_DEPENDENCY` | Adding this dependency would create a cycle in the TaskDependency graph |
| 403 | `INSUFFICIENT_PERMISSION` | Caller lacks `engineering.tasks.create` |

---

### 2.2 List Tasks

**Purpose:** List EngineeringTasks with filtering, sorting, and cursor pagination.

**Method + URL:** `GET /tasks`

**Auth:** Sanctum or JWT

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | enum or comma-separated | Filter by one or more task states |
| `priority` | enum or comma-separated | Filter by priority |
| `type` | enum or comma-separated | Filter by task type |
| `assigned_agent_id` | UUID | Filter by assigned agent; use `unassigned` for null |
| `module` | string | Filter by module slug |
| `tags` | comma-separated string | Filter tasks that contain ALL listed tags |
| `created_after` | ISO 8601 datetime | Lower bound on `created_at` |
| `created_before` | ISO 8601 datetime | Upper bound on `created_at` |
| `search` | string | Full-text search on title and description; min 3 characters |
| `sort` | string | Field and direction: `created_at:desc`, `priority:asc`, `estimated_minutes:desc` |
| `cursor` | string | Opaque pagination cursor |
| `per_page` | integer | 1–100; default 25 |

**Success Response — 200 OK:**

```json
{
  "data": [
    {
      "id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
      "title": "Refactor OrderRepository to use query objects",
      "status": "Queued",
      "priority": "high",
      "type": "refactor",
      "module": "Orders",
      "estimated_minutes": 120,
      "assigned_agent_id": "agt_01abc",
      "tags": ["refactor", "orders"],
      "created_at": "2026-07-22T09:00:00Z",
      "updated_at": "2026-07-22T09:05:00Z"
    }
  ],
  "meta": {
    "per_page": 25,
    "next_cursor": "eyJpZCI6IjAxOGYifQ==",
    "prev_cursor": null,
    "has_more": true,
    "total_estimate": 58
  }
}
```

**Notes:** The list response omits `context`, `dependencies`, and `description` for performance. Use the single-task endpoint to retrieve full detail.

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 422 | `VALIDATION_FAILED` | Invalid filter value or sort field |
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot list tasks |

---

### 2.3 Get Single Task

**Purpose:** Retrieve a single EngineeringTask with full relations.

**Method + URL:** `GET /tasks/{id}`

**Auth:** Sanctum or JWT

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Task identifier |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | comma-separated | Optionally include: `comments`, `artifacts`, `dependencies`, `session`, `agent` |

**Success Response — 200 OK:**

```json
{
  "data": {
    "id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "title": "Refactor OrderRepository to use query objects",
    "description": "Replace ad-hoc Eloquent chains with dedicated QueryObject classes per ADR-024.",
    "status": "Running",
    "priority": "high",
    "type": "refactor",
    "module": "Orders",
    "estimated_minutes": 120,
    "context": {
      "related_adr": "ADR-024",
      "affected_files": ["..."],
      "acceptance_criteria": ["..."]
    },
    "tags": ["refactor", "orders", "Q3-2026"],
    "assigned_agent_id": "agt_01abc",
    "created_by": "usr_01abc",
    "company_id": "cmp_01xyz",
    "queued_at": "2026-07-22T09:10:00Z",
    "accepted_at": "2026-07-22T09:11:00Z",
    "started_at": "2026-07-22T09:11:30Z",
    "completed_at": null,
    "created_at": "2026-07-22T09:00:00Z",
    "updated_at": "2026-07-22T09:11:30Z",
    "agent": {
      "id": "agt_01abc",
      "name": "Refactor Agent v2",
      "status": "Busy"
    },
    "session": {
      "id": "ses_01xyz",
      "status": "Running",
      "progress_percent": 35,
      "progress_message": "Extracting query logic from controller",
      "current_step": "extract_queries"
    },
    "dependencies": [
      {
        "id": "dep_01abc",
        "depends_on_task_id": "018f0000-0000-0000-0000-000000000001",
        "depends_on_task_title": "Add query object base class",
        "depends_on_task_status": "Completed"
      }
    ],
    "artifacts": [],
    "comments": []
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `TASK_NOT_FOUND` | Task ID does not exist or belongs to a different company |
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot view this task |

---

### 2.4 Update Task Metadata

**Purpose:** Update mutable metadata on a task. Not permitted once the task is in Running, Completed, or Released state.

**Method + URL:** `PATCH /tasks/{id}`

**Auth:** Sanctum

**Request Body (all fields optional — send only what changes):**

```json
{
  "title": "Updated title",
  "description": "Updated description with more detail.",
  "priority": "critical",
  "module": "Orders",
  "estimated_minutes": 180,
  "context": {
    "related_adr": "ADR-024",
    "acceptance_criteria": ["All tests pass", "Zero raw Eloquent chains"]
  },
  "tags": ["refactor", "orders", "urgent"],
  "assigned_agent_id": "agt_01def"
}
```

**Validation Rules:**

Same constraints as Create Task apply to each supplied field. Fields omitted from the body are not modified.

**Success Response — 200 OK:**

Returns the full updated task object (same shape as Get Single Task, without `include` relations unless explicitly requested).

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `TASK_NOT_FOUND` | Task does not exist |
| 409 | `TASK_STATE_CONFLICT` | Task is in a state that does not allow metadata updates (Running, Completed, Released, Archived) |
| 422 | `VALIDATION_FAILED` | Field constraint violated |
| 403 | `INSUFFICIENT_PERMISSION` | Caller does not own or manage this task |

---

### 2.5 Queue Task

**Purpose:** Move a Draft task to Queued state, making it eligible for agent pickup.

**Method + URL:** `POST /tasks/{id}/queue`

**Auth:** Sanctum

**Request Body:**

```json
{
  "note": "All dependencies confirmed complete. Ready for execution."
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `note` | No | string | Max 500 characters |

**Success Response — 200 OK:**

```json
{
  "data": {
    "id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "status": "Queued",
    "queued_at": "2026-07-22T09:10:00Z",
    "queue_position": 3
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `TASK_NOT_FOUND` | Task does not exist |
| 409 | `TASK_NOT_DRAFT` | Task is not in Draft state |
| 409 | `UNRESOLVED_DEPENDENCIES` | One or more dependency tasks are not in Completed or Released state |
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot queue tasks |

---

### 2.6 Cancel Task

**Purpose:** Cancel a task that has not yet reached Completed or Released state.

**Method + URL:** `POST /tasks/{id}/cancel`

**Auth:** Sanctum

**Request Body:**

```json
{
  "reason": "Requirements changed. This approach is no longer needed.",
  "notify_agent": true
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `reason` | Yes | string | 10–1000 characters |
| `notify_agent` | No | boolean | Default true; sends a cancellation signal to the assigned agent if Running |

**Success Response — 200 OK:**

```json
{
  "data": {
    "id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "status": "Cancelled",
    "cancelled_at": "2026-07-22T10:00:00Z",
    "cancel_reason": "Requirements changed. This approach is no longer needed."
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `TASK_NOT_FOUND` | Task does not exist |
| 409 | `TASK_ALREADY_TERMINAL` | Task is already Completed, Released, or Archived |
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot cancel tasks |

---

### 2.7 Retry Failed Task

**Purpose:** Reset a Failed task back to Queued state for re-execution.

**Method + URL:** `POST /tasks/{id}/retry`

**Auth:** Sanctum

**Request Body:**

```json
{
  "reset_context": false,
  "priority_override": "critical",
  "note": "Retrying after fixing the environment issue."
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `reset_context` | No | boolean | Default false; if true, clears `context.runtime_errors` from previous run |
| `priority_override` | No | enum | Temporarily elevate priority for this retry only |
| `note` | No | string | Max 500 characters; appended as a TaskComment |

**Success Response — 200 OK:**

```json
{
  "data": {
    "id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "status": "Queued",
    "retry_count": 1,
    "queued_at": "2026-07-22T11:00:00Z",
    "queue_position": 1
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `TASK_NOT_FOUND` | Task does not exist |
| 409 | `TASK_NOT_FAILED` | Task is not in Failed state |
| 409 | `MAX_RETRIES_EXCEEDED` | Task has exceeded the maximum retry limit (default 5) |
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot retry tasks |

---

### 2.8 Stream Execution Logs

**Purpose:** Retrieve execution logs for a task's most recent ExecutionSession. Supports filtering by level and time window.

**Method + URL:** `GET /tasks/{id}/logs`

**Auth:** Sanctum or JWT

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `level` | enum | Filter: `debug`, `info`, `warning`, `error`; default returns all levels |
| `since` | ISO 8601 datetime | Return only logs after this timestamp |
| `limit` | integer | Max entries returned; default 500, max 5000 |
| `session_id` | UUID | Target a specific ExecutionSession; defaults to latest |
| `stream` | boolean | If true and task is Running, uses chunked transfer encoding for live streaming |

**Success Response — 200 OK (non-stream):**

```json
{
  "data": {
    "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "session_id": "ses_01xyz",
    "logs": [
      {
        "id": "log_01aaa",
        "level": "info",
        "message": "Session initialized. Workspace provisioned.",
        "context": {},
        "logged_at": "2026-07-22T09:11:30Z"
      },
      {
        "id": "log_01bbb",
        "level": "info",
        "message": "Cloned repository. Checking out branch feature/order-query-objects.",
        "context": { "branch": "feature/order-query-objects" },
        "logged_at": "2026-07-22T09:11:45Z"
      },
      {
        "id": "log_01ccc",
        "level": "warning",
        "message": "Test suite reported 2 skipped tests. Review recommended.",
        "context": { "skipped_tests": 2 },
        "logged_at": "2026-07-22T09:18:00Z"
      }
    ],
    "total_returned": 3,
    "has_more": false
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `TASK_NOT_FOUND` | Task does not exist |
| 404 | `SESSION_NOT_FOUND` | Specified `session_id` does not belong to this task |
| 409 | `TASK_HAS_NO_SESSION` | Task has never been executed (Draft or Queued state) |
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot view task logs |

---

### 2.9 List Task Artifacts

**Purpose:** List all TaskArtifacts attached to a task with download URLs.

**Method + URL:** `GET /tasks/{id}/artifacts`

**Auth:** Sanctum or JWT

**Success Response — 200 OK:**

```json
{
  "data": [
    {
      "id": "art_01aaa",
      "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
      "name": "refactor-diff.patch",
      "type": "patch",
      "mime_type": "text/x-diff",
      "size_bytes": 14302,
      "download_url": "https://storage.ecos.internal/artifacts/art_01aaa?sig=abc123&expires=1753282800",
      "download_url_expires_at": "2026-07-22T12:00:00Z",
      "uploaded_by_agent_id": "agt_01abc",
      "created_at": "2026-07-22T09:45:00Z"
    }
  ],
  "meta": {
    "per_page": 25,
    "next_cursor": null,
    "prev_cursor": null,
    "has_more": false,
    "total_estimate": 1
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `TASK_NOT_FOUND` | Task does not exist |
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot view artifacts |

---

### 2.10 Add Comment

**Purpose:** Add a TaskComment to a task. Visible to all authorized viewers.

**Method + URL:** `POST /tasks/{id}/comments`

**Auth:** Sanctum

**Request Body:**

```json
{
  "body": "Reviewed the patch. The OrderQueryObject interface looks correct. Proceed to test phase.",
  "visibility": "internal",
  "mentions": ["usr_01def", "agt_01abc"]
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `body` | Yes | string | 1–5000 characters; Markdown supported |
| `visibility` | No | enum | `internal` (default), `agent` (visible to assigned agent only) |
| `mentions` | No | array of user/agent IDs | Max 10; each must belong to the same company |

**Success Response — 201 Created:**

```json
{
  "data": {
    "id": "cmt_01aaa",
    "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "body": "Reviewed the patch. The OrderQueryObject interface looks correct. Proceed to test phase.",
    "visibility": "internal",
    "mentions": ["usr_01def"],
    "author_id": "usr_01abc",
    "author_type": "user",
    "created_at": "2026-07-22T10:30:00Z"
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `TASK_NOT_FOUND` | Task does not exist |
| 422 | `VALIDATION_FAILED` | Body is empty or exceeds limit |
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot comment on tasks |

---

## 3. Agent Management API

### 3.1 Register Agent

**Purpose:** Register a new EngineeringAgent. Called during agent provisioning with an API Key. Returns a JWT for subsequent requests.

**Method + URL:** `POST /agents/register`

**Auth:** `X-Agent-Key: {api_key}` (no Bearer token; this endpoint issues the token)

**Request Body:**

```json
{
  "name": "Refactor Agent v2",
  "version": "2.4.1",
  "capabilities": [
    "refactor",
    "test",
    "docs"
  ],
  "resources": {
    "cpu_cores": 4,
    "memory_mb": 8192,
    "max_concurrent_tasks": 2
  },
  "metadata": {
    "host": "agent-node-07.internal",
    "region": "eu-central-1",
    "build_sha": "a1b2c3d4"
  }
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `name` | Yes | string | 3–100 characters |
| `version` | Yes | string | Semver format (e.g., `2.4.1`) |
| `capabilities` | Yes | array of enum | At least one; valid values: `feature`, `bug`, `refactor`, `test`, `docs`, `infra`, `security` |
| `resources.cpu_cores` | No | integer | 1–256 |
| `resources.memory_mb` | No | integer | 512–524288 |
| `resources.max_concurrent_tasks` | No | integer | 1–10; default 1 |
| `metadata` | No | object | Free-form; max 4 KB |

**Success Response — 201 Created:**

```json
{
  "data": {
    "agent_id": "agt_01abc",
    "name": "Refactor Agent v2",
    "status": "Idle",
    "jwt": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "jwt_expires_at": "2026-07-22T10:00:00Z",
    "heartbeat_interval_seconds": 30,
    "task_poll_interval_seconds": 10
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 401 | `INVALID_API_KEY` | API key is unrecognized, expired, or already consumed |
| 409 | `AGENT_ALREADY_REGISTERED` | An active agent with this key already exists |
| 422 | `VALIDATION_FAILED` | Required fields missing or invalid |

---

### 3.2 List Agents

**Purpose:** List all EngineeringAgents registered to this company. Restricted to users with `EngineeringLead` role.

**Method + URL:** `GET /agents`

**Auth:** Sanctum (EngineeringLead only)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | enum | Filter by WorkerState: `Idle`, `Busy`, `Paused`, `Draining`, `Offline`, `Terminated` |
| `capability` | string | Filter agents that have this capability |
| `cursor` | string | Pagination cursor |
| `per_page` | integer | Default 25; max 100 |

**Success Response — 200 OK:**

```json
{
  "data": [
    {
      "id": "agt_01abc",
      "name": "Refactor Agent v2",
      "version": "2.4.1",
      "status": "Busy",
      "capabilities": ["refactor", "test"],
      "current_task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
      "last_heartbeat_at": "2026-07-22T09:55:00Z",
      "registered_at": "2026-07-21T08:00:00Z"
    }
  ],
  "meta": {
    "per_page": 25,
    "next_cursor": null,
    "prev_cursor": null,
    "has_more": false,
    "total_estimate": 4
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 403 | `ROLE_REQUIRED` | Caller does not have the EngineeringLead role |

---

### 3.3 Get Agent Detail

**Purpose:** Retrieve a single EngineeringAgent with its current WorkerResource state, active ExecutionSession, and recent WorkerHeartbeats.

**Method + URL:** `GET /agents/{id}`

**Auth:** Sanctum (EngineeringLead) or JWT (the agent itself)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | comma-separated | Optionally include: `session`, `heartbeats`, `resources`, `capabilities` |

**Success Response — 200 OK:**

```json
{
  "data": {
    "id": "agt_01abc",
    "name": "Refactor Agent v2",
    "version": "2.4.1",
    "status": "Busy",
    "capabilities": ["refactor", "test", "docs"],
    "metadata": {
      "host": "agent-node-07.internal",
      "region": "eu-central-1",
      "build_sha": "a1b2c3d4"
    },
    "current_task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "last_heartbeat_at": "2026-07-22T09:55:30Z",
    "registered_at": "2026-07-21T08:00:00Z",
    "resources": {
      "cpu_cores": 4,
      "memory_mb": 8192,
      "max_concurrent_tasks": 2,
      "active_task_count": 1
    },
    "session": {
      "id": "ses_01xyz",
      "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
      "status": "Running",
      "progress_percent": 35,
      "started_at": "2026-07-22T09:11:30Z"
    },
    "heartbeats": [
      {
        "id": "hbt_01aaa",
        "status": "Busy",
        "cpu_usage_percent": 42.5,
        "memory_used_mb": 3200,
        "recorded_at": "2026-07-22T09:55:30Z"
      }
    ]
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `AGENT_NOT_FOUND` | Agent does not exist or belongs to a different company |
| 403 | `INSUFFICIENT_PERMISSION` | Caller is neither a lead nor the agent itself |

---

### 3.4 Terminate Agent

**Purpose:** Force-terminate an agent, transitioning it to Terminated state and aborting any active session.

**Method + URL:** `POST /agents/{id}/terminate`

**Auth:** Sanctum (EngineeringLead only)

**Request Body:**

```json
{
  "reason": "Agent stuck in unresponsive state for 10 minutes.",
  "fail_active_task": true
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `reason` | Yes | string | 10–500 characters |
| `fail_active_task` | No | boolean | Default true; if false, active task is returned to Queued state for reassignment |

**Success Response — 200 OK:**

```json
{
  "data": {
    "agent_id": "agt_01abc",
    "status": "Terminated",
    "terminated_at": "2026-07-22T10:05:00Z",
    "active_task_disposition": "failed",
    "active_task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b"
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `AGENT_NOT_FOUND` | Agent does not exist |
| 409 | `AGENT_ALREADY_TERMINATED` | Agent is already in Terminated state |
| 403 | `ROLE_REQUIRED` | Caller does not have EngineeringLead role |

---

### 3.5 Get Agent Heartbeat History

**Purpose:** Retrieve the WorkerHeartbeat history for an agent for diagnostics.

**Method + URL:** `GET /agents/{id}/heartbeats`

**Auth:** Sanctum (EngineeringLead)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `since` | ISO 8601 datetime | Lower bound; defaults to 1 hour ago |
| `until` | ISO 8601 datetime | Upper bound; defaults to now |
| `cursor` | string | Pagination cursor |
| `per_page` | integer | Default 100; max 500 |

**Success Response — 200 OK:**

```json
{
  "data": [
    {
      "id": "hbt_01aaa",
      "agent_id": "agt_01abc",
      "status": "Busy",
      "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
      "cpu_usage_percent": 42.5,
      "memory_used_mb": 3200,
      "active_session_id": "ses_01xyz",
      "recorded_at": "2026-07-22T09:55:30Z"
    }
  ],
  "meta": {
    "per_page": 100,
    "next_cursor": null,
    "prev_cursor": null,
    "has_more": false,
    "total_estimate": 120
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `AGENT_NOT_FOUND` | Agent does not exist |
| 403 | `ROLE_REQUIRED` | Caller does not have EngineeringLead role |

---

## 4. Worker API (Agent-Facing)

All endpoints in this section require JWT authentication. They are designed for high-frequency polling and must complete within 200 ms at p99.

### 4.1 Poll Next Task

**Purpose:** Retrieve the next available task from the ExecutionQueue that matches the calling agent's capabilities.

**Method + URL:** `GET /workers/tasks/next`

**Auth:** JWT (agent)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `accept_types` | comma-separated enum | Override the agent's registered capabilities for this poll; subset only |
| `max_priority` | enum | Limit: only return tasks at or above this priority |

**Success Response — 200 OK (task available):**

```json
{
  "data": {
    "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "title": "Refactor OrderRepository to use query objects",
    "type": "refactor",
    "priority": "high",
    "estimated_minutes": 120,
    "context": {
      "related_adr": "ADR-024",
      "acceptance_criteria": ["All tests pass"]
    },
    "reservation_token": "rsv_eyJhbGciOiJIUzI1NiJ9...",
    "reservation_expires_at": "2026-07-22T09:15:00Z"
  }
}
```

**Success Response — 200 OK (no task available):**

```json
{
  "data": null,
  "meta": {
    "queue_depth": 0,
    "suggested_backoff_seconds": 10
  }
}
```

The `reservation_token` is a short-lived token (5-minute TTL) that the agent must include when calling `/accept`. If the agent does not accept within the TTL, the task is returned to the queue and offered to the next eligible agent.

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 403 | `AGENT_NOT_ACTIVE` | Calling agent is not in Idle or Busy state |
| 429 | `POLL_RATE_EXCEEDED` | Agent is polling faster than the allowed rate |

---

### 4.2 Accept Task

**Purpose:** Accept a reserved task. Returns ExecutionSession details and Workspace access credentials.

**Method + URL:** `POST /workers/tasks/{task_id}/accept`

**Auth:** JWT (agent)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `task_id` | UUID | The task being accepted |

**Request Body:**

```json
{
  "reservation_token": "rsv_eyJhbGciOiJIUzI1NiJ9...",
  "estimated_completion_at": "2026-07-22T11:30:00Z"
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `reservation_token` | Yes | string | Token from poll response; must not be expired |
| `estimated_completion_at` | No | ISO 8601 datetime | Agent's estimated finish time; used for SLA monitoring |

**Success Response — 200 OK:**

```json
{
  "data": {
    "session_id": "ses_01xyz",
    "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "session_status": "Initializing",
    "workspace": {
      "id": "wsp_01aaa",
      "status": "Active",
      "git_remote": "https://git.ecos.internal/engineering/workspace-wsp01aaa.git",
      "git_branch": "agent/agt_01abc/task-018f1a2b",
      "base_branch": "main",
      "ssh_key": "-----BEGIN OPENSSH PRIVATE KEY-----\n...",
      "working_directory": "/workspace/task-018f1a2b"
    },
    "lock": {
      "id": "lck_01aaa",
      "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
      "locked_by_agent_id": "agt_01abc",
      "expires_at": "2026-07-22T11:30:00Z"
    }
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `TASK_NOT_FOUND` | Task does not exist |
| 409 | `RESERVATION_EXPIRED` | The `reservation_token` TTL has passed |
| 409 | `TASK_ALREADY_ACCEPTED` | Another agent accepted this task between poll and accept |
| 409 | `AGENT_CAPACITY_FULL` | Agent has reached its `max_concurrent_tasks` limit |
| 403 | `AGENT_NOT_ACTIVE` | Calling agent is not in an active state |

---

### 4.3 Reject Task

**Purpose:** Explicitly reject a reserved task. The task is returned to the queue with a rejection record, which influences future routing.

**Method + URL:** `POST /workers/tasks/{task_id}/reject`

**Auth:** JWT (agent)

**Request Body:**

```json
{
  "reservation_token": "rsv_eyJhbGciOiJIUzI1NiJ9...",
  "reason_code": "CAPABILITY_MISMATCH",
  "reason": "This task requires direct database access which this agent instance does not have."
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `reservation_token` | Yes | string | Token from poll response |
| `reason_code` | Yes | enum | `CAPABILITY_MISMATCH`, `RESOURCE_INSUFFICIENT`, `CONTEXT_INCOMPLETE`, `AGENT_OVERLOADED`, `OTHER` |
| `reason` | No | string | Max 500 characters |

**Success Response — 200 OK:**

```json
{
  "data": {
    "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "disposition": "returned_to_queue",
    "queue_position": 2
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `TASK_NOT_FOUND` | Task does not exist |
| 409 | `RESERVATION_EXPIRED` | The `reservation_token` TTL has passed |

---

### 4.4 Update Progress

**Purpose:** Report execution progress during a running session. Called periodically by the agent; also serves as a heartbeat for the session.

**Method + URL:** `PATCH /workers/sessions/{session_id}/progress`

**Auth:** JWT (agent)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `session_id` | UUID | The active session identifier |

**Request Body:**

```json
{
  "progress_percent": 65,
  "message": "Running full test suite. 148 of 228 tests passing.",
  "current_step": "run_tests",
  "logs": [
    {
      "level": "info",
      "message": "Test suite started.",
      "context": { "total_tests": 228 },
      "logged_at": "2026-07-22T09:30:00Z"
    }
  ]
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `progress_percent` | Yes | integer | 0–100 |
| `message` | Yes | string | 1–500 characters |
| `current_step` | No | string | Max 100 characters; machine-readable step identifier |
| `logs` | No | array | Batch of ExecutionLog entries; max 100 per call |
| `logs[].level` | Yes if logs | enum | `debug`, `info`, `warning`, `error` |
| `logs[].message` | Yes if logs | string | 1–5000 characters |
| `logs[].context` | No | object | Max 4 KB |
| `logs[].logged_at` | Yes if logs | ISO 8601 datetime | Must be within the last 5 minutes |

**Success Response — 200 OK:**

```json
{
  "data": {
    "session_id": "ses_01xyz",
    "acknowledged": true,
    "lock_expires_at": "2026-07-22T11:30:00Z",
    "directive": null
  }
}
```

The `directive` field may carry out-of-band instructions: `"PAUSE"`, `"ABORT"`, or `null`. Agents must check this field on every progress response and act accordingly.

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `SESSION_NOT_FOUND` | Session does not exist or belongs to another agent |
| 409 | `SESSION_NOT_RUNNING` | Session is not in Running state |
| 422 | `VALIDATION_FAILED` | Invalid progress values |

---

### 4.5 Complete Session

**Purpose:** Mark an ExecutionSession and its associated task as Completed.

**Method + URL:** `POST /workers/sessions/{session_id}/complete`

**Auth:** JWT (agent)

**Request Body:**

```json
{
  "summary": "Refactored OrderRepository into 4 query objects. All 228 tests pass. Coverage unchanged at 87%.",
  "artifact_ids": ["art_01aaa", "art_01bbb"],
  "output": {
    "files_modified": 7,
    "tests_passed": 228,
    "tests_failed": 0,
    "coverage_percent": 87.3,
    "commit_sha": "f1e2d3c4b5a69788"
  },
  "logs": [
    {
      "level": "info",
      "message": "Session completed successfully.",
      "context": {},
      "logged_at": "2026-07-22T10:45:00Z"
    }
  ]
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `summary` | Yes | string | 10–5000 characters |
| `artifact_ids` | No | array of UUID | Must reference artifacts uploaded via Section 5 |
| `output` | No | object | Free-form structured output; max 64 KB |
| `logs` | No | array | Final batch of ExecutionLog entries; max 100 |

**Success Response — 200 OK:**

```json
{
  "data": {
    "session_id": "ses_01xyz",
    "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "session_status": "Completed",
    "task_status": "Completed",
    "completed_at": "2026-07-22T10:45:00Z",
    "workspace_archiving": true
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `SESSION_NOT_FOUND` | Session does not exist |
| 409 | `SESSION_NOT_RUNNING` | Session is not in Running state |
| 409 | `ARTIFACT_NOT_CONFIRMED` | One or more `artifact_ids` were not confirmed via the upload API |

---

### 4.6 Fail Session

**Purpose:** Mark an ExecutionSession and its associated task as Failed, reporting the error details.

**Method + URL:** `POST /workers/sessions/{session_id}/fail`

**Auth:** JWT (agent)

**Request Body:**

```json
{
  "error_code": "TEST_SUITE_FAILURE",
  "error_message": "Test suite failed with 12 failing tests after refactor.",
  "error_details": {
    "failed_tests": [
      "OrderRepositoryTest::test_find_by_status_returns_correct_count",
      "OrderQueryObjectTest::test_cursor_pagination_boundary"
    ],
    "last_successful_step": "extract_queries",
    "stack_trace": "..."
  },
  "recoverable": true,
  "logs": [
    {
      "level": "error",
      "message": "Test suite failure. Aborting session.",
      "context": { "failing_count": 12 },
      "logged_at": "2026-07-22T10:30:00Z"
    }
  ]
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `error_code` | Yes | string | Machine-readable error code; max 100 characters |
| `error_message` | Yes | string | 10–2000 characters |
| `error_details` | No | object | Structured diagnostics; max 64 KB |
| `recoverable` | No | boolean | Agent's assessment of whether retry is viable; default false |
| `logs` | No | array | Final batch of log entries; max 100 |

**Success Response — 200 OK:**

```json
{
  "data": {
    "session_id": "ses_01xyz",
    "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "session_status": "Failed",
    "task_status": "Failed",
    "failed_at": "2026-07-22T10:30:00Z",
    "retry_eligible": true,
    "retry_count_so_far": 0,
    "max_retries": 5
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `SESSION_NOT_FOUND` | Session does not exist |
| 409 | `SESSION_NOT_RUNNING` | Session is not in Running state |
| 422 | `VALIDATION_FAILED` | Required failure fields missing |

---

## 5. Artifact Upload API

Artifact uploads use a two-phase commit: the agent first initializes the upload and receives a presigned URL, then uploads the file directly to object storage, then confirms completion. The artifact record is not usable until it is confirmed.

### 5.1 Initialize Upload

**Purpose:** Create a PipelineArtifact record and obtain a presigned upload URL.

**Method + URL:** `POST /artifacts/upload/init`

**Auth:** JWT (agent)

**Request Body:**

```json
{
  "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
  "session_id": "ses_01xyz",
  "name": "refactor-diff.patch",
  "type": "patch",
  "mime_type": "text/x-diff",
  "size_bytes": 14302,
  "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `task_id` | Yes | UUID | Must be the task currently assigned to this agent |
| `session_id` | Yes | UUID | Must be the active session |
| `name` | Yes | string | 1–255 characters; must be a safe filename (no path traversal) |
| `type` | Yes | enum | `patch`, `log`, `report`, `binary`, `archive`, `test_results`, `coverage`, `other` |
| `mime_type` | Yes | string | Valid MIME type; max 100 characters |
| `size_bytes` | Yes | integer | 1 byte to 5 GB (5,368,709,120 bytes) |
| `checksum_sha256` | Yes | string | SHA-256 hex digest of the file content; verified on completion |

**Success Response — 200 OK:**

```json
{
  "data": {
    "upload_id": "upl_01aaa",
    "artifact_id": "art_01aaa",
    "upload_url": "https://storage.ecos.internal/upload/upl_01aaa?sig=xyz&expires=1753279200",
    "upload_url_expires_at": "2026-07-22T11:00:00Z",
    "upload_method": "PUT",
    "required_headers": {
      "Content-Type": "text/x-diff",
      "x-amz-checksum-sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `TASK_NOT_FOUND` | Task does not exist or is not assigned to this agent |
| 409 | `SESSION_NOT_ACTIVE` | Session is not in Running state |
| 422 | `FILE_TOO_LARGE` | `size_bytes` exceeds the 5 GB limit |
| 422 | `INVALID_FILENAME` | Filename contains path traversal characters or reserved names |
| 422 | `VALIDATION_FAILED` | Other field constraint violated |

---

### 5.2 Confirm Upload

**Purpose:** Confirm that the file has been successfully uploaded to object storage. Transitions the artifact to a usable state.

**Method + URL:** `POST /artifacts/upload/{upload_id}/complete`

**Auth:** JWT (agent)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `upload_id` | string | The `upload_id` returned from initiation |

**Request Body:**

```json
{
  "etag": "\"d8e8fca2dc0f896fd7cb4cb0031ba249\"",
  "final_size_bytes": 14302
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `etag` | Yes | string | ETag returned by the object storage PUT response |
| `final_size_bytes` | Yes | integer | Must match `size_bytes` declared at initialization |

**Success Response — 200 OK:**

```json
{
  "data": {
    "artifact_id": "art_01aaa",
    "name": "refactor-diff.patch",
    "type": "patch",
    "status": "confirmed",
    "size_bytes": 14302,
    "download_url": "https://storage.ecos.internal/artifacts/art_01aaa?sig=abc123&expires=1753282800",
    "download_url_expires_at": "2026-07-22T12:00:00Z",
    "confirmed_at": "2026-07-22T09:50:00Z"
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `UPLOAD_NOT_FOUND` | Upload ID does not exist or belongs to another agent |
| 409 | `UPLOAD_ALREADY_CONFIRMED` | This upload was already confirmed |
| 409 | `CHECKSUM_MISMATCH` | The stored checksum does not match the declared `checksum_sha256` |
| 409 | `SIZE_MISMATCH` | `final_size_bytes` does not match `size_bytes` from initialization |
| 410 | `UPLOAD_EXPIRED` | The upload URL TTL has passed; re-initialize |

---

## 6. Release Management API

### 6.1 List Release Candidates

**Purpose:** List all ReleaseCandidates. Supports filtering by state.

**Method + URL:** `GET /releases`

**Auth:** Sanctum

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | enum or comma-separated | Filter by release state: `Draft`, `UnderReview`, `Approved`, `Staged`, `Released`, `RolledBack` |
| `cursor` | string | Pagination cursor |
| `per_page` | integer | Default 25; max 100 |

**Success Response — 200 OK:**

```json
{
  "data": [
    {
      "id": "rel_01aaa",
      "name": "Release 2026-07-22 — Orders Refactor",
      "version": "1.14.0",
      "status": "UnderReview",
      "task_count": 8,
      "created_by": "usr_01abc",
      "review_started_at": "2026-07-22T08:00:00Z",
      "created_at": "2026-07-21T18:00:00Z"
    }
  ],
  "meta": {
    "per_page": 25,
    "next_cursor": null,
    "prev_cursor": null,
    "has_more": false,
    "total_estimate": 12
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot list releases |

---

### 6.2 Get Release Candidate Detail

**Purpose:** Retrieve a single ReleaseCandidate with its bundled tasks and approval history.

**Method + URL:** `GET /releases/{id}`

**Auth:** Sanctum

**Success Response — 200 OK:**

```json
{
  "data": {
    "id": "rel_01aaa",
    "name": "Release 2026-07-22 — Orders Refactor",
    "version": "1.14.0",
    "status": "UnderReview",
    "description": "Includes OrderRepository refactor, 3 bug fixes, and updated API contracts.",
    "bundle": {
      "id": "bnd_01aaa",
      "tasks": [
        {
          "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
          "title": "Refactor OrderRepository to use query objects",
          "status": "Completed",
          "type": "refactor"
        }
      ],
      "artifact_count": 5
    },
    "approvals": [
      {
        "id": "apv_01aaa",
        "reviewer_id": "usr_02abc",
        "decision": "approved",
        "comment": "All tests green. Approved.",
        "decided_at": "2026-07-22T09:00:00Z"
      }
    ],
    "created_by": "usr_01abc",
    "review_started_at": "2026-07-22T08:00:00Z",
    "approved_at": null,
    "released_at": null,
    "created_at": "2026-07-21T18:00:00Z",
    "updated_at": "2026-07-22T09:00:00Z"
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `RELEASE_NOT_FOUND` | Release candidate does not exist |
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot view releases |

---

### 6.3 Approve Release Candidate

**Purpose:** Approve a ReleaseCandidate that is in UnderReview state.

**Method + URL:** `POST /releases/{id}/approve`

**Auth:** Sanctum (EngineeringLead only)

**Request Body:**

```json
{
  "comment": "Code review complete. All acceptance criteria met. Approved for staging."
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `comment` | No | string | Max 2000 characters |

**Success Response — 200 OK:**

```json
{
  "data": {
    "release_id": "rel_01aaa",
    "status": "Approved",
    "approved_by": "usr_02abc",
    "approved_at": "2026-07-22T09:30:00Z"
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `RELEASE_NOT_FOUND` | Release candidate does not exist |
| 409 | `RELEASE_NOT_UNDER_REVIEW` | Release is not in UnderReview state |
| 409 | `SELF_APPROVAL_FORBIDDEN` | The approver is the same user who created the release |
| 403 | `ROLE_REQUIRED` | Caller does not have the EngineeringLead role |

---

### 6.4 Reject Release Candidate

**Purpose:** Reject a ReleaseCandidate and return it to Draft state for rework.

**Method + URL:** `POST /releases/{id}/reject`

**Auth:** Sanctum (EngineeringLead only)

**Request Body:**

```json
{
  "reason": "Test coverage dropped below threshold. Requires additional test cases before re-review.",
  "required_actions": [
    "Add tests for cursor pagination boundary conditions",
    "Verify FIFO ordering in query object results"
  ]
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `reason` | Yes | string | 10–2000 characters |
| `required_actions` | No | array of string | Max 20 items; each max 500 characters |

**Success Response — 200 OK:**

```json
{
  "data": {
    "release_id": "rel_01aaa",
    "status": "Draft",
    "rejected_by": "usr_02abc",
    "rejected_at": "2026-07-22T09:30:00Z",
    "required_actions": [
      "Add tests for cursor pagination boundary conditions",
      "Verify FIFO ordering in query object results"
    ]
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 404 | `RELEASE_NOT_FOUND` | Release candidate does not exist |
| 409 | `RELEASE_NOT_UNDER_REVIEW` | Release is not in UnderReview state |
| 422 | `VALIDATION_FAILED` | Reason is missing or too short |
| 403 | `ROLE_REQUIRED` | Caller does not have the EngineeringLead role |

---

## 7. WebSocket Connection API

### 7.1 Get WebSocket Token

**Purpose:** Obtain a short-lived `ws_token` for use when authenticating the WebSocket connection. The token is separate from the API Bearer token to avoid exposing long-lived credentials in WebSocket handshake URLs.

**Method + URL:** `GET /ws/token`

**Auth:** Sanctum or JWT

**Request Body:** None

**Success Response — 200 OK:**

```json
{
  "data": {
    "ws_token": "wst_a1b2c3d4e5f6...",
    "ws_url": "wss://ws.ecos.internal/engineering",
    "expires_at": "2026-07-22T09:02:00Z",
    "ttl_seconds": 60,
    "channels": {
      "tasks": "engineering.tasks",
      "agents": "engineering.agents",
      "releases": "engineering.releases",
      "personal": "engineering.user.usr_01abc"
    }
  }
}
```

**WebSocket Connection:** The client connects to `ws_url` and includes the token in the initial handshake:

```
GET wss://ws.ecos.internal/engineering
Authorization: Bearer {ws_token}
```

The `ws_token` is single-use and expires 60 seconds after issuance. A refreshed token must be fetched before the connection drops. Channels follow Laravel WebSockets channel naming conventions.

**Event Payload (example — TaskStatusChanged):**

```json
{
  "event": "TaskStatusChanged",
  "channel": "engineering.tasks",
  "data": {
    "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",
    "previous_status": "Assigned",
    "current_status": "Running",
    "agent_id": "agt_01abc",
    "occurred_at": "2026-07-22T09:11:30Z"
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 401 | `UNAUTHENTICATED` | No valid Bearer token provided |
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot access the WebSocket service |

---

## 8. Dashboard and Reporting API

### 8.1 Engineering Dashboard

**Purpose:** Retrieve a snapshot of key operational metrics for the Engineering Cloud dashboard. Results are cached with a 30-second TTL.

**Method + URL:** `GET /dashboard`

**Auth:** Sanctum

**Query Parameters:** None

**Success Response — 200 OK:**

```json
{
  "data": {
    "tasks": {
      "active": 5,
      "queued": 12,
      "completed_today": 34,
      "failed_today": 2,
      "cancelled_today": 1,
      "total_by_status": {
        "Draft": 8,
        "Queued": 12,
        "Assigned": 2,
        "Accepted": 1,
        "Running": 5,
        "Paused": 0,
        "Completed": 34,
        "Failed": 2,
        "Cancelled": 1,
        "Released": 29,
        "Archived": 142
      }
    },
    "workers": {
      "active": 4,
      "idle": 2,
      "busy": 4,
      "offline": 1,
      "total_registered": 7
    },
    "success_rate": {
      "last_24h_percent": 94.4,
      "last_7d_percent": 91.2,
      "last_30d_percent": 89.8
    },
    "throughput": {
      "tasks_completed_last_1h": 6,
      "tasks_completed_last_24h": 34,
      "avg_completion_minutes_last_7d": 87.4
    },
    "recent_releases": [
      {
        "id": "rel_01aaa",
        "name": "Release 2026-07-22 — Orders Refactor",
        "version": "1.14.0",
        "status": "Approved",
        "task_count": 8,
        "created_at": "2026-07-21T18:00:00Z"
      }
    ],
    "queue_health": {
      "oldest_queued_task_age_minutes": 4,
      "avg_time_to_assign_minutes": 1.2,
      "estimated_drain_minutes": 42
    }
  },
  "meta": {
    "cached_at": "2026-07-22T09:55:30Z",
    "cache_ttl_seconds": 30
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 403 | `INSUFFICIENT_PERMISSION` | Caller cannot access dashboard data |

---

### 8.2 Time-Series Metrics

**Purpose:** Retrieve time-series metrics for charting and trend analysis.

**Method + URL:** `GET /metrics`

**Auth:** Sanctum (EngineeringLead only)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | ISO 8601 datetime | Yes | Start of the time range |
| `to` | ISO 8601 datetime | Yes | End of the time range |
| `granularity` | enum | Yes | `minute`, `hour`, `day`, `week` |
| `metrics` | comma-separated | No | Specific metrics to return; defaults to all |

Available metric names: `tasks_completed`, `tasks_failed`, `tasks_queued`, `avg_completion_minutes`, `agent_utilization_percent`, `queue_depth`, `success_rate_percent`

**Validation Rules:**

- `from` must be before `to`
- Maximum range: 90 days
- `granularity: minute` is only permitted for ranges up to 24 hours
- `granularity: hour` is only permitted for ranges up to 30 days

**Success Response — 200 OK:**

```json
{
  "data": {
    "from": "2026-07-15T00:00:00Z",
    "to": "2026-07-22T00:00:00Z",
    "granularity": "day",
    "series": {
      "tasks_completed": [
        { "timestamp": "2026-07-15T00:00:00Z", "value": 28 },
        { "timestamp": "2026-07-16T00:00:00Z", "value": 34 },
        { "timestamp": "2026-07-17T00:00:00Z", "value": 22 },
        { "timestamp": "2026-07-18T00:00:00Z", "value": 41 },
        { "timestamp": "2026-07-19T00:00:00Z", "value": 0 },
        { "timestamp": "2026-07-20T00:00:00Z", "value": 0 },
        { "timestamp": "2026-07-21T00:00:00Z", "value": 39 }
      ],
      "tasks_failed": [
        { "timestamp": "2026-07-15T00:00:00Z", "value": 2 },
        { "timestamp": "2026-07-16T00:00:00Z", "value": 1 }
      ],
      "success_rate_percent": [
        { "timestamp": "2026-07-15T00:00:00Z", "value": 93.3 },
        { "timestamp": "2026-07-16T00:00:00Z", "value": 97.1 }
      ]
    }
  },
  "meta": {
    "data_points_per_series": 7
  }
}
```

**Error Responses:**

| HTTP | Error Code | Condition |
|------|------------|-----------|
| 422 | `INVALID_DATE_RANGE` | `from` is after `to`, or range exceeds 90 days |
| 422 | `GRANULARITY_RANGE_CONFLICT` | Requested granularity is too fine for the given range |
| 422 | `UNKNOWN_METRIC` | A requested metric name is not recognized |
| 403 | `ROLE_REQUIRED` | Caller does not have EngineeringLead role |

---

## 9. Error Code Reference

The following table lists all domain-specific error codes used across the Engineering Cloud API. All codes are returned in the `error.code` field of the standard error envelope.

| HTTP Status | Error Code | Meaning | Resolution Hint |
|-------------|------------|---------|-----------------|
| 400 | `MALFORMED_JSON` | Request body is not valid JSON | Check Content-Type and JSON syntax |
| 400 | `MISSING_CONTENT_TYPE` | Content-Type header is absent or incorrect | Set `Content-Type: application/json` |
| 401 | `UNAUTHENTICATED` | No valid authentication credential provided | Include a valid Bearer token |
| 401 | `TOKEN_EXPIRED` | JWT or Sanctum token has expired | Re-authenticate to obtain a fresh token |
| 401 | `INVALID_API_KEY` | API key is unrecognized, revoked, or already used | Contact an EngineeringLead to issue a new key |
| 401 | `JWT_SIGNATURE_INVALID` | JWT signature verification failed | Re-register the agent to obtain a fresh JWT |
| 403 | `INSUFFICIENT_PERMISSION` | Caller has valid credentials but lacks the required permission | Request the correct permission from an EngineeringLead |
| 403 | `ROLE_REQUIRED` | The action requires a specific role (e.g., EngineeringLead) | Elevation of role is required |
| 403 | `COMPANY_ISOLATION_VIOLATION` | Requested resource belongs to a different company | Verify the resource ID |
| 403 | `AGENT_NOT_ACTIVE` | Calling agent is in a state that does not permit this action | Check agent state; it may be Paused, Draining, or Terminated |
| 404 | `TASK_NOT_FOUND` | EngineeringTask does not exist or is not visible to caller | Verify the task ID and company context |
| 404 | `AGENT_NOT_FOUND` | EngineeringAgent does not exist or is not visible to caller | Verify the agent ID |
| 404 | `SESSION_NOT_FOUND` | ExecutionSession does not exist or does not belong to calling agent | Verify session ID against the currently accepted task |
| 404 | `RELEASE_NOT_FOUND` | ReleaseCandidate does not exist | Verify the release ID |
| 404 | `UPLOAD_NOT_FOUND` | Upload record does not exist or belongs to another agent | Re-initialize the upload |
| 409 | `TASK_STATE_CONFLICT` | Task is in a state that does not permit the requested transition | Check current task state and valid transitions |
| 409 | `TASK_NOT_DRAFT` | Task must be in Draft state to queue | Move task back to Draft if needed |
| 409 | `TASK_NOT_FAILED` | Task must be in Failed state to retry | Verify task state before retrying |
| 409 | `TASK_ALREADY_TERMINAL` | Task has reached a terminal state (Completed, Released, Archived) | No further transitions are possible |
| 409 | `CIRCULAR_DEPENDENCY` | Adding this dependency would create a cycle in the TaskDependency graph | Revise the dependency chain |
| 409 | `UNRESOLVED_DEPENDENCIES` | One or more dependencies are not Completed or Released | Resolve blocking tasks first |
| 409 | `MAX_RETRIES_EXCEEDED` | Task has reached its maximum retry limit | Review failure history; escalate to EngineeringLead |
| 409 | `RESERVATION_EXPIRED` | The task reservation token has expired | Re-poll for the next available task |
| 409 | `TASK_ALREADY_ACCEPTED` | Another agent claimed this task before acceptance completed | Re-poll for the next available task |
| 409 | `AGENT_CAPACITY_FULL` | Agent has reached its maximum concurrent task limit | Complete or fail an active task before accepting a new one |
| 409 | `SESSION_NOT_RUNNING` | Session must be in Running state for this operation | Check session state |
| 409 | `SESSION_NOT_ACTIVE` | Session must be active for artifact operations | Re-verify session state |
| 409 | `ARTIFACT_NOT_CONFIRMED` | Artifact upload was initiated but not confirmed | Complete the upload confirmation step |
| 409 | `UPLOAD_ALREADY_CONFIRMED` | This upload has already been confirmed | Do not re-confirm; artifact is already usable |
| 409 | `CHECKSUM_MISMATCH` | Uploaded file checksum does not match declared checksum | Re-upload the file with correct checksum |
| 409 | `SIZE_MISMATCH` | Uploaded file size does not match declared size | Re-initialize with the correct `size_bytes` |
| 409 | `RELEASE_NOT_UNDER_REVIEW` | Release must be in UnderReview state for approval or rejection | Check release state |
| 409 | `SELF_APPROVAL_FORBIDDEN` | The release creator cannot approve their own release | A different EngineeringLead must approve |
| 409 | `AGENT_ALREADY_REGISTERED` | An active agent registration already exists for this API key | Terminate the existing agent before re-registering |
| 410 | `UPLOAD_EXPIRED` | The presigned upload URL has expired | Re-initialize the artifact upload |
| 422 | `VALIDATION_FAILED` | One or more fields failed validation; see `details` for field-level errors | Correct the indicated fields and resubmit |
| 422 | `INVALID_DATE_RANGE` | The provided date range is invalid or exceeds the maximum allowed window | Adjust `from`/`to` parameters |
| 422 | `GRANULARITY_RANGE_CONFLICT` | The selected granularity is too fine for the given date range | Use a coarser granularity or reduce the date range |
| 422 | `UNKNOWN_METRIC` | A requested metric name is not recognized | Use only valid metric names from the reference list |
| 422 | `FILE_TOO_LARGE` | Uploaded file exceeds the 5 GB size limit | Split the artifact or use a different delivery mechanism |
| 422 | `INVALID_FILENAME` | Filename contains disallowed characters or patterns | Use a safe alphanumeric filename |
| 429 | `RATE_LIMIT_EXCEEDED` | Caller has exceeded the rate limit for this endpoint | Wait for the window reset indicated by `X-RateLimit-Reset` |
| 429 | `POLL_RATE_EXCEEDED` | Agent is polling the task queue faster than the allowed rate | Respect the `suggested_backoff_seconds` from poll responses |
| 500 | `INTERNAL_ERROR` | An unexpected server error occurred | Retry with exponential backoff; report if persistent |
| 503 | `SERVICE_UNAVAILABLE` | The Engineering Cloud service is temporarily unavailable | Retry after the period indicated in the `Retry-After` header |

---

## 10. Response Envelope

### Standard Envelope

All responses from the Engineering Cloud API use a consistent envelope structure.

**Single Resource Response:**

```json
{
  "data": {
    "id": "...",
    "..."
  }
}
```

The `data` key contains the resource object directly. No wrapper or extra nesting is added.

**List Response:**

```json
{
  "data": [
    { "id": "...", "..." },
    { "id": "...", "..." }
  ],
  "meta": {
    "per_page": 25,
    "next_cursor": "eyJpZCI6IjAxOGYifQ==",
    "prev_cursor": null,
    "has_more": true,
    "total_estimate": 142
  }
}
```

The `meta` key is always present on list responses. It is absent on single-resource responses.

**Error Response:**

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "The requested task does not exist or you do not have access to it.",
    "details": {
      "task_id": "018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b"
    }
  }
}
```

Error responses never include a `data` key.

**Dashboard / Reporting Response (cached):**

Responses from `/dashboard` and `/metrics` include a `meta` block even though they are not paginated, to expose cache state:

```json
{
  "data": { "..." },
  "meta": {
    "cached_at": "2026-07-22T09:55:30Z",
    "cache_ttl_seconds": 30
  }
}
```

### Timestamps

All timestamps are in ISO 8601 format with UTC timezone and second precision:

```
2026-07-22T09:55:30Z
```

Nanosecond or millisecond precision is not used.

### UUIDs

All primary and foreign key identifiers are UUID v7 (time-ordered). They are represented as lowercase hyphenated strings:

```
018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b
```

### Null vs. Absent Fields

- A field is `null` when the data exists but has no value (e.g., `completed_at: null` for an in-progress task).
- A field is absent from the response when it is not applicable to the current resource state (e.g., `workspace` is not included in list responses for performance reasons).
- Clients must treat missing fields and `null` fields as distinct cases.

### Backward Compatibility

This API is versioned at `/api/v1/`. Additive changes (new fields, new error codes, new query parameters) do not constitute a breaking change and may be introduced without a version increment. Removals and field renames require a major version increment. Clients must ignore unknown fields to remain forward-compatible.

---

*End of Document — Engineering Cloud API Contracts v1*
*Status: Frozen (Design Only) | 2026-07-22*
