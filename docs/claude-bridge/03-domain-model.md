# Domain Model
## ECOS Claude Bridge v1.0

**Document ID:** CB-DM-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## Domain Overview

Five entities. No aggregates within aggregates. Each entity is simple and has a clear owner.

```
 Worker
   │
   │ executes
   ▼
 Task ──────────── Execution ──────────── Artifact
   │                                         (diff, report, log)
   │ logged in
   ▼
 AuditLog
```

---

## Entities

### Task

The central entity. Represents one unit of work to be performed by Claude Code.

```
Task {
  id:                 UUID
  company_id:         UUID          // ECOS tenant
  created_by_user_id: UUID          // Who created it
  title:              string        // Short label
  description:        text          // Full prompt for Claude Code
  repository_path:    string        // Local path on the worker machine
  target_branch:      string        // e.g. "main"
  status:             enum          // See state machine below
  priority:           enum          // low | normal | high
  worker_id:          UUID | null   // Which worker is/was assigned
  failure_reason:     text | null   // If execution failed
  review_comment:     text | null   // Reviewer's feedback (approve/reject/changes)
  reviewed_by:        UUID | null   // Who reviewed
  reviewed_at:        timestamp | null
  created_at:         timestamp
  updated_at:         timestamp
}
```

---

### Task Status Machine

```
         DRAFT ──────► PENDING
                          │
                          │ (queue)
                          ▼
                       QUEUED ◄──────────────────────┐
                          │                          │
                          │ (worker picks up)        │ (re-queue after changes)
                          ▼                          │
                       RUNNING                       │
                          │                          │
               ┌──────────┴──────────┐               │
               │                     │               │
               ▼                     ▼               │
          DONE (success)         FAILED ─► retry? ───┘
               │
               │ (review required)
               │
      ┌────────┼────────────┐
      │                     │
      ▼                     ▼
  APPROVED          CHANGES_REQUESTED
      │
      ▼
  MERGED (optional; set manually by developer)

  Any state → CANCELLED
```

**Status Definitions:**

| Status | Meaning | Next States |
|---|---|---|
| `draft` | Being written, not ready | pending |
| `pending` | Ready; waiting for user to queue it | queued, cancelled |
| `queued` | In the queue; waiting for worker | running, cancelled |
| `running` | Worker is executing Claude Code | done, failed |
| `done` | Claude Code finished; awaiting review | approved, changes_requested, cancelled |
| `failed` | Claude Code or Worker encountered an error | queued (retry), cancelled |
| `approved` | Reviewer approved the output | merged |
| `changes_requested` | Reviewer wants re-work | queued (after user updates description) |
| `merged` | Developer confirmed the code was merged | — |
| `cancelled` | Terminated; no further action | — |

---

### Execution

Records one attempt to run Claude Code for a task. A task may have multiple executions if it fails and is retried.

```
Execution {
  id:                UUID
  task_id:           UUID
  worker_id:         UUID
  attempt_number:    integer       // 1 for first attempt
  started_at:        timestamp
  finished_at:       timestamp | null
  exit_code:         integer | null
  tokens_used:       integer | null
  claude_version:    string | null
  failure_code:      string | null  // timeout | agent_crash | clone_failed | etc.
  failure_message:   text | null
  duration_seconds:  integer | null
}
```

---

### Artifact

A file produced by an execution. Stored in ECOS file storage. Referenced by the review UI.

```
Artifact {
  id:              UUID
  task_id:         UUID
  execution_id:    UUID
  type:            enum          // diff | report | log
  filename:        string        // e.g. "diff.patch", "report.md", "execution.log"
  storage_path:    string        // Laravel Storage path
  size_bytes:      integer
  checksum_sha256: string
  created_at:      timestamp
}
```

Artifacts for a task:
- `diff` — unified diff of all changes made by Claude Code (required)
- `report` — short markdown report written by Claude Code summarizing what it did (required)
- `log` — full execution output (stdout + stderr) from Claude Code (required)

---

### Worker

Represents the registered Claude Worker service on the developer's machine.

```
Worker {
  id:               UUID
  company_id:       UUID
  name:             string        // e.g. "Osama-PC"
  hostname:         string
  token_hash:       string        // Bcrypt hash of API token
  status:           enum          // online | offline
  last_seen_at:     timestamp | null
  claude_version:   string | null // Last reported Claude Code version
  registered_at:    timestamp
  registered_by:    UUID          // User who registered it
  is_active:        boolean
}
```

Phase 1: one Worker per ECOS instance. The Worker concept exists so the UI can show connection status and last-seen time.

---

### AuditLog

Append-only record of every significant action. Used for accountability and debugging.

```
AuditLog {
  id:            bigint (auto)
  company_id:    UUID
  actor_type:    enum          // user | worker | system
  actor_id:      UUID
  actor_name:    string        // Denormalized; persists even if user deleted
  action:        string        // "task.created", "task.approved", "worker.registered", etc.
  task_id:       UUID | null
  description:   text
  occurred_at:   timestamp
}
```

No UPDATE or DELETE permitted on this table.

---

## What Is Not a Domain Entity

| Concept | How It's Handled |
|---|---|
| Settings / config | `company_settings` JSON or ECOS existing config model |
| Notifications | ECOS existing notification system |
| User roles / permissions | ECOS existing RBAC |
| Repository connection | `repository_path` is a string on Task; worker knows the local path |
| Secrets (ANTHROPIC_API_KEY) | Stored in Worker's local `.env` file; never in ECOS |
