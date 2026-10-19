# Database Design
## ECOS AI Operations Platform

**Document ID:** AIOP-DB-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## 1. Table Inventory

| Table | Primary Key | Rows (Estimate) | Notes |
|---|---|---|---|
| `aiop_workspaces` | UUID | < 100 | Low volume |
| `aiop_projects` | UUID | < 1,000 | Low volume |
| `aiop_repositories` | UUID | < 1,000 | Low volume |
| `aiop_agents` | UUID | < 20 | Static registry |
| `aiop_workers` | UUID | < 500 | Moderate |
| `aiop_worker_sessions` | UUID | < 10,000 | Moderate |
| `aiop_heartbeats` | BigInt | ~1M (partitioned) | High volume |
| `aiop_tasks` | UUID | < 100,000 | Moderate |
| `aiop_task_steps` | UUID | < 500,000 | Moderate |
| `aiop_executions` | UUID | < 200,000 | Moderate |
| `aiop_execution_logs` | — | NOT in DB (S3) | Ref only |
| `aiop_artifacts` | UUID | < 1,000,000 | High volume |
| `aiop_reports` | UUID | < 200,000 | Moderate |
| `aiop_reviews` | UUID | < 200,000 | Moderate |
| `aiop_approvals` | UUID | < 100,000 | Moderate |
| `aiop_notifications` | UUID | < 1,000,000 | High volume |
| `aiop_execution_policies` | UUID | < 1,000 | Low volume |
| `aiop_review_policies` | UUID | < 1,000 | Low volume |
| `aiop_retry_policies` | UUID | < 1,000 | Low volume |
| `aiop_secrets` | UUID | < 10,000 | Moderate |
| `aiop_audit_log` | BigInt | Unbounded | Append-only |

---

## 2. Table Definitions

### aiop_workspaces

```sql
-- No SQL, schema description only --

Table: aiop_workspaces
  id                        CHAR(36)        PK
  company_id                CHAR(36)        NOT NULL  FK→companies.id
  name                      VARCHAR(255)    NOT NULL
  slug                      VARCHAR(100)    NOT NULL  UNIQUE
  owner_user_id             CHAR(36)        NOT NULL  FK→users.id
  execution_policy_id       CHAR(36)        FK→aiop_execution_policies.id
  review_policy_id          CHAR(36)        FK→aiop_review_policies.id
  retry_policy_id           CHAR(36)        FK→aiop_retry_policies.id
  is_active                 TINYINT(1)      NOT NULL  DEFAULT 1
  settings                  JSON            DEFAULT '{}'
  created_at                TIMESTAMP
  updated_at                TIMESTAMP
  deleted_at                TIMESTAMP       NULL (soft delete)

Indexes:
  UK_aiop_workspaces_slug         (slug)
  IDX_aiop_workspaces_company     (company_id)
  IDX_aiop_workspaces_owner       (owner_user_id)
```

### aiop_projects

```sql
Table: aiop_projects
  id                        CHAR(36)        PK
  workspace_id              CHAR(36)        NOT NULL  FK→aiop_workspaces.id
  name                      VARCHAR(255)    NOT NULL
  description               TEXT            NULL
  repository_id             CHAR(36)        NOT NULL  FK→aiop_repositories.id
  default_branch            VARCHAR(100)    NOT NULL  DEFAULT 'main'
  default_agent_id          CHAR(36)        NULL      FK→aiop_agents.id
  execution_policy_id       CHAR(36)        NULL      FK→aiop_execution_policies.id (override)
  review_policy_id          CHAR(36)        NULL      FK→aiop_review_policies.id (override)
  is_active                 TINYINT(1)      NOT NULL  DEFAULT 1
  created_at                TIMESTAMP
  updated_at                TIMESTAMP

Indexes:
  IDX_aiop_projects_workspace     (workspace_id)
  IDX_aiop_projects_repository    (repository_id)
```

### aiop_repositories

```sql
Table: aiop_repositories
  id                        CHAR(36)        PK
  workspace_id              CHAR(36)        NOT NULL  FK→aiop_workspaces.id
  name                      VARCHAR(255)    NOT NULL
  url                       VARCHAR(500)    NOT NULL
  provider                  ENUM('github','gitlab','bitbucket','self_hosted')  NOT NULL
  default_branch            VARCHAR(100)    NOT NULL  DEFAULT 'main'
  deploy_key_secret_id      CHAR(36)        NULL      FK→aiop_secrets.id
  webhook_secret_id         CHAR(36)        NULL      FK→aiop_secrets.id
  is_active                 TINYINT(1)      NOT NULL  DEFAULT 1
  created_at                TIMESTAMP
  updated_at                TIMESTAMP

Indexes:
  IDX_aiop_repos_workspace        (workspace_id)
  IDX_aiop_repos_url              (url)
```

### aiop_agents

```sql
Table: aiop_agents
  id                        CHAR(36)        PK
  name                      VARCHAR(255)    NOT NULL
  slug                      VARCHAR(100)    NOT NULL  UNIQUE
  connector_class           VARCHAR(255)    NOT NULL
  capabilities              JSON            NOT NULL  DEFAULT '[]'
  version_command           VARCHAR(500)    NULL
  default_timeout_seconds   INT             NOT NULL  DEFAULT 1800
  default_model             VARCHAR(100)    NULL
  cost_per_1k_tokens        DECIMAL(10,6)   NULL
  is_active                 TINYINT(1)      NOT NULL  DEFAULT 1
  configuration_schema      JSON            NULL
  created_at                TIMESTAMP
  updated_at                TIMESTAMP

Indexes:
  UK_aiop_agents_slug             (slug)
```

### aiop_workers

```sql
Table: aiop_workers
  id                        CHAR(36)        PK
  workspace_id              CHAR(36)        NOT NULL  FK→aiop_workspaces.id
  agent_id                  CHAR(36)        NOT NULL  FK→aiop_agents.id
  name                      VARCHAR(255)    NOT NULL
  hostname                  VARCHAR(255)    NOT NULL
  ip_address                VARCHAR(45)     NULL
  token_hash                VARCHAR(255)    NOT NULL  (bcrypt of API token)
  status                    ENUM('online','offline','busy','maintenance','deregistered')
                                            NOT NULL  DEFAULT 'offline'
  agent_version             VARCHAR(50)     NULL
  os_type                   VARCHAR(50)     NULL
  docker_available          TINYINT(1)      NOT NULL  DEFAULT 0
  max_concurrent_executions INT             NOT NULL  DEFAULT 1
  last_heartbeat_at         TIMESTAMP       NULL
  registered_at             TIMESTAMP       NOT NULL
  registered_by_user_id     CHAR(36)        NOT NULL  FK→users.id
  deregistered_at           TIMESTAMP       NULL
  metadata                  JSON            NULL

Indexes:
  IDX_aiop_workers_workspace      (workspace_id)
  IDX_aiop_workers_agent          (agent_id)
  IDX_aiop_workers_status         (status)
  IDX_aiop_workers_heartbeat      (last_heartbeat_at)
```

### aiop_tasks

```sql
Table: aiop_tasks
  id                        CHAR(36)        PK
  workspace_id              CHAR(36)        NOT NULL  FK→aiop_workspaces.id
  project_id                CHAR(36)        NOT NULL  FK→aiop_projects.id
  title                     VARCHAR(500)    NOT NULL
  description               LONGTEXT        NOT NULL
  status                    ENUM(...)       NOT NULL  DEFAULT 'pending'
                            -- Values: draft, pending, queued, assigned, in_progress,
                            --         execution_complete, execution_failed,
                            --         pending_review, changes_requested,
                            --         approved, awaiting_cto_approval, merging,
                            --         completed, cancelled
  type                      ENUM('feature','bug_fix','refactor','test','migration','docs','security_audit','review')
                                            NOT NULL
  priority                  ENUM('critical','high','medium','low')
                                            NOT NULL  DEFAULT 'medium'
  required_capabilities     JSON            NOT NULL  DEFAULT '[]'
  preferred_agent_id        CHAR(36)        NULL      FK→aiop_agents.id
  target_branch             VARCHAR(100)    NOT NULL  DEFAULT 'main'
  source_branch             VARCHAR(100)    NULL
  created_by_user_id        CHAR(36)        NOT NULL  FK→users.id
  assigned_worker_id        CHAR(36)        NULL      FK→aiop_workers.id
  assigned_at               TIMESTAMP       NULL
  current_execution_id      CHAR(36)        NULL      FK→aiop_executions.id
  execution_policy_id       CHAR(36)        NOT NULL  FK→aiop_execution_policies.id
  review_policy_id          CHAR(36)        NOT NULL  FK→aiop_review_policies.id
  retry_policy_id           CHAR(36)        NOT NULL  FK→aiop_retry_policies.id
  attempt_count             INT             NOT NULL  DEFAULT 0
  max_cost_budget           DECIMAL(10,2)   NULL
  actual_tokens_used        INT             NULL
  context                   JSON            NULL
  labels                    JSON            NOT NULL  DEFAULT '[]'
  due_at                    TIMESTAMP       NULL
  completed_at              TIMESTAMP       NULL
  cancelled_at              TIMESTAMP       NULL
  cancellation_reason       TEXT            NULL
  metadata                  JSON            NULL
  created_at                TIMESTAMP
  updated_at                TIMESTAMP

Indexes:
  IDX_aiop_tasks_workspace        (workspace_id)
  IDX_aiop_tasks_project          (project_id)
  IDX_aiop_tasks_status           (status)
  IDX_aiop_tasks_type             (type)
  IDX_aiop_tasks_priority         (priority)
  IDX_aiop_tasks_worker           (assigned_worker_id)
  IDX_aiop_tasks_created_by       (created_by_user_id)
  IDX_aiop_tasks_created_at       (created_at)
  IDX_aiop_tasks_due_at           (due_at)
  -- Composite for queue polling:
  IDX_aiop_tasks_queue            (status, priority, created_at)
                                  WHERE status = 'queued'
```

### aiop_executions

```sql
Table: aiop_executions
  id                        CHAR(36)        PK
  task_id                   CHAR(36)        NOT NULL  FK→aiop_tasks.id
  worker_id                 CHAR(36)        NOT NULL  FK→aiop_workers.id
  agent_id                  CHAR(36)        NOT NULL  FK→aiop_agents.id
  attempt_number            INT             NOT NULL  DEFAULT 1
  status                    ENUM('preparing','cloning','running','testing',
                                 'uploading','complete','failed')
                                            NOT NULL  DEFAULT 'preparing'
  started_at                TIMESTAMP       NOT NULL
  completed_at              TIMESTAMP       NULL
  duration_seconds          INT             NULL
  agent_version             VARCHAR(50)     NULL
  model_version             VARCHAR(100)    NULL
  tokens_used               INT             NULL
  cost_estimate             DECIMAL(10,4)   NULL
  failure_reason            TEXT            NULL
  failure_code              VARCHAR(50)     NULL
  exit_code                 INT             NULL
  log_storage_key           VARCHAR(500)    NULL  (S3 key for full log)
  metadata                  JSON            NULL
  created_at                TIMESTAMP
  updated_at                TIMESTAMP

Indexes:
  IDX_aiop_executions_task        (task_id)
  IDX_aiop_executions_worker      (worker_id)
  IDX_aiop_executions_status      (status)
  IDX_aiop_executions_started     (started_at)
```

### aiop_artifacts

```sql
Table: aiop_artifacts
  id                        CHAR(36)        PK
  task_id                   CHAR(36)        NOT NULL  FK→aiop_tasks.id
  execution_id              CHAR(36)        NOT NULL  FK→aiop_executions.id
  type                      ENUM('code_diff','modified_files','report',
                                 'test_results','log','screenshot')
                                            NOT NULL
  name                      VARCHAR(500)    NOT NULL
  storage_key               VARCHAR(1000)   NOT NULL  (S3 object key)
  size_bytes                BIGINT          NOT NULL
  mime_type                 VARCHAR(200)    NOT NULL
  checksum_sha256           CHAR(64)        NOT NULL
  is_primary                TINYINT(1)      NOT NULL  DEFAULT 0
  uploaded_at               TIMESTAMP       NOT NULL
  verified_at               TIMESTAMP       NULL
  verification_status       ENUM('pending','verified','failed')
                                            NOT NULL  DEFAULT 'pending'
  metadata                  JSON            NULL

Indexes:
  IDX_aiop_artifacts_task         (task_id)
  IDX_aiop_artifacts_execution    (execution_id)
  IDX_aiop_artifacts_type         (type)
```

### aiop_reports

```sql
Table: aiop_reports
  id                        CHAR(36)        PK
  task_id                   CHAR(36)        NOT NULL  FK→aiop_tasks.id
  execution_id              CHAR(36)        NOT NULL  FK→aiop_executions.id
  artifact_id               CHAR(36)        NOT NULL  FK→aiop_artifacts.id
  summary                   TEXT            NOT NULL
  files_changed             INT             NOT NULL  DEFAULT 0
  lines_added               INT             NOT NULL  DEFAULT 0
  lines_removed             INT             NOT NULL  DEFAULT 0
  tests_added               INT             NULL
  tests_passed              INT             NULL
  tests_failed              INT             NULL
  confidence_score          DECIMAL(3,2)    NULL  (0.00–1.00)
  identified_risks          JSON            NOT NULL  DEFAULT '[]'
  suggested_review_focus    JSON            NOT NULL  DEFAULT '[]'
  generated_at              TIMESTAMP       NOT NULL
  created_at                TIMESTAMP

Indexes:
  IDX_aiop_reports_task           (task_id)
  IDX_aiop_reports_execution      (execution_id)
```

### aiop_reviews

```sql
Table: aiop_reviews
  id                        CHAR(36)        PK
  task_id                   CHAR(36)        NOT NULL  FK→aiop_tasks.id
  execution_id              CHAR(36)        NOT NULL  FK→aiop_executions.id
  reviewer_user_id          CHAR(36)        NOT NULL  FK→users.id
  stage                     ENUM('technical','architecture','cto')
                                            NOT NULL  DEFAULT 'technical'
  status                    ENUM('pending','in_progress','approved',
                                 'changes_requested','rejected')
                                            NOT NULL  DEFAULT 'pending'
  comment                   TEXT            NULL
  started_at                TIMESTAMP       NULL
  completed_at              TIMESTAMP       NULL
  sla_deadline              TIMESTAMP       NOT NULL
  sla_breached              TINYINT(1)      NOT NULL  DEFAULT 0
  created_at                TIMESTAMP
  updated_at                TIMESTAMP

Indexes:
  IDX_aiop_reviews_task           (task_id)
  IDX_aiop_reviews_reviewer       (reviewer_user_id)
  IDX_aiop_reviews_status         (status)
  IDX_aiop_reviews_sla            (sla_deadline, sla_breached)
```

### aiop_approvals

```sql
Table: aiop_approvals
  id                        CHAR(36)        PK
  task_id                   CHAR(36)        NOT NULL  FK→aiop_tasks.id
  review_id                 CHAR(36)        NOT NULL  FK→aiop_reviews.id
  approver_user_id          CHAR(36)        NOT NULL  FK→users.id
  decision                  ENUM('approved','rejected')  NOT NULL
  comment                   TEXT            NULL
  approved_at               TIMESTAMP       NOT NULL
  merge_initiated_at        TIMESTAMP       NULL
  merge_completed_at        TIMESTAMP       NULL
  merge_commit_sha          VARCHAR(40)     NULL
  created_at                TIMESTAMP

Indexes:
  IDX_aiop_approvals_task         (task_id)
  IDX_aiop_approvals_approver     (approver_user_id)
```

### aiop_audit_log

```sql
Table: aiop_audit_log
  id                        BIGINT          PK  AUTO_INCREMENT
  event_type                VARCHAR(100)    NOT NULL
  actor_type                ENUM('user','worker','system')  NOT NULL
  actor_id                  CHAR(36)        NOT NULL
  actor_name                VARCHAR(255)    NOT NULL  (denormalized for audit permanence)
  task_id                   CHAR(36)        NULL
  execution_id              CHAR(36)        NULL
  workspace_id              CHAR(36)        NOT NULL
  description               TEXT            NOT NULL
  before_state              JSON            NULL
  after_state               JSON            NULL
  ip_address                VARCHAR(45)     NULL
  user_agent                VARCHAR(500)    NULL
  occurred_at               TIMESTAMP       NOT NULL

Constraints:
  NO DELETE permitted (enforced by application layer + DB user permissions)
  NO UPDATE permitted

Indexes:
  IDX_aiop_audit_task             (task_id)
  IDX_aiop_audit_actor            (actor_id)
  IDX_aiop_audit_workspace        (workspace_id)
  IDX_aiop_audit_event_type       (event_type)
  IDX_aiop_audit_occurred         (occurred_at)
  -- Partition by month for archival
```

### aiop_secrets

```sql
Table: aiop_secrets
  id                        CHAR(36)        PK
  workspace_id              CHAR(36)        NOT NULL  FK→aiop_workspaces.id
  project_id                CHAR(36)        NULL      FK→aiop_projects.id
  name                      VARCHAR(255)    NOT NULL
  type                      ENUM('deploy_key','api_key','env_var','certificate','webhook_secret')
                                            NOT NULL
  encrypted_value           TEXT            NOT NULL  (AES-256-GCM ciphertext)
  encryption_key_id         VARCHAR(255)    NOT NULL  (KMS key reference)
  is_active                 TINYINT(1)      NOT NULL  DEFAULT 1
  last_rotated_at           TIMESTAMP       NULL
  created_by_user_id        CHAR(36)        NOT NULL
  created_at                TIMESTAMP
  updated_at                TIMESTAMP

Indexes:
  UK_aiop_secrets_name            (workspace_id, project_id, name)
  IDX_aiop_secrets_workspace      (workspace_id)
```

---

## 3. Constraints Summary

| Constraint | Tables | Description |
|---|---|---|
| UUID primary keys | All except log/heartbeat | Prevents enumeration attacks |
| NOT NULL on critical columns | All | Data integrity |
| ENUM for status fields | All status columns | Prevents invalid state values |
| FK to companies, users | workspaces, tasks, etc. | Tenant isolation via company_id |
| No DELETE on audit_log | aiop_audit_log | Immutable audit trail |
| BIGINT for high-volume PKs | audit_log, heartbeats | Performance on large tables |
| JSON for flexible schema | capabilities, labels, context | Extensibility without migration |

---

## 4. Retention Strategy

| Table | Hot (Days) | Warm (Days) | Archive (Years) | Delete After |
|---|---|---|---|---|
| aiop_tasks | Forever | — | — | Never (soft delete) |
| aiop_executions | Forever | — | — | 5 years |
| aiop_artifacts | 90 | 365 | 5 | After archive period |
| aiop_audit_log | 365 | — | 7 | Never (legal hold) |
| aiop_heartbeats | 1 | 30 | — | 30 days |
| aiop_notifications | 30 | — | — | 90 days |
| aiop_execution_logs (S3) | 90 | 365 | 2 | After archive period |

---

## 5. Archiving Strategy

**Hot → Warm:** Move to compressed S3-IA or read replica after hot period.  
**Warm → Archive:** Move to S3 Glacier Deep Archive after warm period.  
**Deletion:** Automated lifecycle policy on S3; database records moved to `aiop_archive_*` tables with compressed JSON snapshot.

**Trigger:** Nightly Laravel job evaluates retention rules and triggers moves in batches of 10,000 records.
