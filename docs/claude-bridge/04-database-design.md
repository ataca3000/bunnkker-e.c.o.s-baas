# Database Design
## ECOS Claude Bridge v1.0

**Document ID:** CB-DB-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## Five Tables

```
cb_workers
cb_tasks
cb_executions
cb_artifacts
cb_audit_log
```

No more. Every table earns its place.

---

## Table Definitions

### cb_workers

```
Table: cb_workers
  id                CHAR(36)        PK
  company_id        CHAR(36)        NOT NULL  FK→companies.id
  name              VARCHAR(100)    NOT NULL
  hostname          VARCHAR(255)    NOT NULL
  token_hash        VARCHAR(255)    NOT NULL        (bcrypt of API token)
  status            ENUM('online','offline')
                                    NOT NULL  DEFAULT 'offline'
  last_seen_at      TIMESTAMP       NULL
  claude_version    VARCHAR(50)     NULL
  registered_at     TIMESTAMP       NOT NULL
  registered_by     CHAR(36)        NOT NULL  FK→users.id
  is_active         BOOLEAN         NOT NULL  DEFAULT TRUE

Indexes:
  IDX_cb_workers_company    (company_id)
  IDX_cb_workers_status     (status)
```

---

### cb_tasks

```
Table: cb_tasks
  id                    CHAR(36)        PK
  company_id            CHAR(36)        NOT NULL  FK→companies.id
  created_by_user_id    CHAR(36)        NOT NULL  FK→users.id
  title                 VARCHAR(500)    NOT NULL
  description           TEXT            NOT NULL
  repository_path       VARCHAR(500)    NOT NULL      (local path on worker machine)
  target_branch         VARCHAR(100)    NOT NULL  DEFAULT 'main'
  status                ENUM(
                          'draft',
                          'pending',
                          'queued',
                          'running',
                          'done',
                          'failed',
                          'approved',
                          'changes_requested',
                          'merged',
                          'cancelled'
                        )               NOT NULL  DEFAULT 'pending'
  priority              ENUM('low','normal','high')
                                        NOT NULL  DEFAULT 'normal'
  worker_id             CHAR(36)        NULL      FK→cb_workers.id
  failure_reason        TEXT            NULL
  review_comment        TEXT            NULL
  reviewed_by           CHAR(36)        NULL      FK→users.id
  reviewed_at           TIMESTAMP       NULL
  cancelled_at          TIMESTAMP       NULL
  created_at            TIMESTAMP
  updated_at            TIMESTAMP

Indexes:
  IDX_cb_tasks_company          (company_id)
  IDX_cb_tasks_status           (status)
  IDX_cb_tasks_created_by       (created_by_user_id)
  IDX_cb_tasks_worker           (worker_id)
  IDX_cb_tasks_created_at       (created_at)
  -- Queue polling:
  IDX_cb_tasks_queue            (status, priority, created_at)
                                WHERE status = 'queued'
```

---

### cb_executions

```
Table: cb_executions
  id                CHAR(36)        PK
  task_id           CHAR(36)        NOT NULL  FK→cb_tasks.id
  worker_id         CHAR(36)        NOT NULL  FK→cb_workers.id
  attempt_number    SMALLINT        NOT NULL  DEFAULT 1
  started_at        TIMESTAMP       NOT NULL
  finished_at       TIMESTAMP       NULL
  exit_code         SMALLINT        NULL
  tokens_used       INT             NULL
  claude_version    VARCHAR(50)     NULL
  failure_code      VARCHAR(50)     NULL
  failure_message   TEXT            NULL
  duration_seconds  INT             NULL

Indexes:
  IDX_cb_executions_task        (task_id)
  IDX_cb_executions_worker      (worker_id)
```

---

### cb_artifacts

```
Table: cb_artifacts
  id                CHAR(36)        PK
  task_id           CHAR(36)        NOT NULL  FK→cb_tasks.id
  execution_id      CHAR(36)        NOT NULL  FK→cb_executions.id
  type              ENUM('diff','report','log')
                                    NOT NULL
  filename          VARCHAR(255)    NOT NULL
  storage_path      VARCHAR(500)    NOT NULL      (Laravel Storage path)
  size_bytes        INT             NOT NULL
  checksum_sha256   CHAR(64)        NOT NULL
  created_at        TIMESTAMP

Indexes:
  IDX_cb_artifacts_task         (task_id)
  IDX_cb_artifacts_execution    (execution_id)
  IDX_cb_artifacts_type         (type)
```

---

### cb_audit_log

```
Table: cb_audit_log
  id            BIGINT          PK  AUTO_INCREMENT
  company_id    CHAR(36)        NOT NULL
  actor_type    ENUM('user','worker','system')  NOT NULL
  actor_id      CHAR(36)        NOT NULL
  actor_name    VARCHAR(255)    NOT NULL        (denormalized)
  action        VARCHAR(100)    NOT NULL
  task_id       CHAR(36)        NULL
  description   TEXT            NOT NULL
  occurred_at   TIMESTAMP       NOT NULL

Constraints:
  Application-layer: no DELETE, no UPDATE
  DB user does not have DELETE or UPDATE permissions on this table

Indexes:
  IDX_cb_audit_company          (company_id)
  IDX_cb_audit_task             (task_id)
  IDX_cb_audit_occurred         (occurred_at)
```

---

## Actions Audited

| Action | Description |
|---|---|
| `worker.registered` | Worker was registered |
| `worker.deactivated` | Worker was deactivated |
| `task.created` | Task was created |
| `task.queued` | Task was queued for execution |
| `task.started` | Worker began execution |
| `task.done` | Execution completed successfully |
| `task.failed` | Execution failed |
| `task.approved` | Reviewer approved |
| `task.changes_requested` | Reviewer requested changes |
| `task.rejected` | Reviewer rejected (cancelled) |
| `task.merged` | Marked as merged |
| `task.cancelled` | Task cancelled |

---

## Retention

| Table | Keep For | Archive Strategy |
|---|---|---|
| `cb_workers` | Forever | Soft-delete via `is_active` |
| `cb_tasks` | 1 year active; 5 years archive | Archive to JSON export |
| `cb_executions` | 1 year | Delete with parent task |
| `cb_artifacts` | 90 days hot; delete after | Delete file + record together |
| `cb_audit_log` | 2 years | Archive to CSV, then delete rows |

---

## What This Database Does Not Contain

- No policy tables (no execution policies, review policies, retry policies)
- No workspace tables (company_id is the only scope)
- No agent tables (Claude Code only; no registry needed)
- No secret tables (ANTHROPIC_API_KEY lives on the worker machine, never in ECOS)
- No notification tables (ECOS platform handles notifications)
- No worker session tables (heartbeat timestamp on the worker record is sufficient)
- No heartbeat tables (last_seen_at on cb_workers is enough for Phase 1)
