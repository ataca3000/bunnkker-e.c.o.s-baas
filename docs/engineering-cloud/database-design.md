# Engineering Cloud — Database Design (ERD)

**Version:** 1.0 | **Status:** Frozen | **Date:** 2026-07-22

---

## 1. Design Standards

| Standard | Rule |
|---|---|
| Primary Keys | UUID (char 36) on every table |
| Tenant Isolation | `company_id` (UUID, NOT NULL, indexed) on every table |
| Soft Deletes | `deleted_at TIMESTAMP NULL` on mutable entities |
| Audit Fields | `created_at`, `updated_at`, `created_by_id` on every entity table |
| Optimistic Locking | `version INTEGER DEFAULT 0` on all mutable entities |
| Table Naming | Plural snake_case |
| Foreign Keys | Explicit named constraints on every reference column |
| Partitioning | Log and event tables partitioned by month on the timestamp column |
| Immutability | Event and audit log tables — no UPDATE, no DELETE, no soft deletes |
| UUID Generation | Generated at the application layer (Laravel `Str::uuid()`) |
| Character Set | UTF-8 everywhere |
| JSONB | Used for dynamic metadata, capabilities, and manifests; never for queryable scalar values |

---

## 2. Schema — Engineering Tasks Module

### Table: `engineering_tasks`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `title` | VARCHAR(500) | NO | — | — | Human-readable task title |
| `description` | TEXT | YES | NULL | — | Full task description |
| `status` | VARCHAR(50) | NO | `'Draft'` | CHECK in canonical list | Current lifecycle state |
| `priority` | SMALLINT | NO | `5` | CHECK (1–10) | Scheduling priority; higher = more urgent |
| `source_type` | VARCHAR(50) | NO | — | — | Origin system (e.g., `github`, `jira`, `manual`) |
| `source_ref` | VARCHAR(255) | YES | NULL | — | External reference ID or URL |
| `assigned_agent_id` | UUID | YES | NULL | FK `engineering_agents.id` | Agent responsible for orchestration |
| `assigned_worker_id` | UUID | YES | NULL | FK `engineering_workers.id` | Worker currently executing the task |
| `workspace_id` | UUID | YES | NULL | FK `workspaces.id` | Workspace provisioned for this task |
| `parent_task_id` | UUID | YES | NULL | FK `engineering_tasks.id` (self) | Parent in a task hierarchy |
| `deadline` | TIMESTAMP | YES | NULL | — | Hard deadline for completion |
| `started_at` | TIMESTAMP | YES | NULL | — | When task first entered Running state |
| `completed_at` | TIMESTAMP | YES | NULL | — | When task reached Completed state |
| `failed_at` | TIMESTAMP | YES | NULL | — | When task reached Failed state |
| `cancelled_at` | TIMESTAMP | YES | NULL | — | When task reached Cancelled state |
| `released_at` | TIMESTAMP | YES | NULL | — | When task reached Released state |
| `failure_reason` | TEXT | YES | NULL | — | Human-readable failure description |
| `retry_count` | SMALLINT | NO | `0` | CHECK (>= 0) | Number of retry attempts so far |
| `max_retries` | SMALLINT | NO | `3` | CHECK (>= 0) | Maximum allowed retries before terminal failure |
| `metadata` | JSONB | YES | NULL | — | Arbitrary extension data per task type |
| `version` | INTEGER | NO | `0` | — | Optimistic lock counter |
| `created_by_id` | UUID | NO | — | FK `users.id` | User or agent that created the task |
| `created_at` | TIMESTAMP | NO | `now()` | — | Record creation timestamp |
| `updated_at` | TIMESTAMP | NO | `now()` | — | Last mutation timestamp |
| `deleted_at` | TIMESTAMP | YES | NULL | — | Soft delete marker |

**Valid `status` values (in lifecycle order):** `Draft`, `Queued`, `Assigned`, `Accepted`, `Running`, `Paused`, `Completed`, `Failed`, `Cancelled`, `Released`, `Archived`

---

### Table: `task_dependencies`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `task_id` | UUID | NO | — | FK `engineering_tasks.id` | The dependent task |
| `depends_on_task_id` | UUID | NO | — | FK `engineering_tasks.id` | The task that must be satisfied first |
| `dependency_type` | VARCHAR(20) | NO | `'blocking'` | CHECK (`blocking`, `soft`) | `blocking` = task cannot start; `soft` = advisory warning only |
| `created_at` | TIMESTAMP | NO | `now()` | — | When the dependency was recorded |

**Constraints:**
- UNIQUE (`task_id`, `depends_on_task_id`)
- A task may not depend on itself — enforced at application level
- Cycle detection enforced at application level before insert

---

### Table: `task_comments`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `task_id` | UUID | NO | — | FK `engineering_tasks.id` | Owning task |
| `author_id` | UUID | NO | — | FK `users.id` | Comment author (human or system user) |
| `body` | TEXT | NO | — | — | Comment content (Markdown supported) |
| `is_system` | BOOLEAN | NO | `false` | — | `true` = generated by the platform, not a human |
| `created_at` | TIMESTAMP | NO | `now()` | — | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | `now()` | — | Last edit timestamp |
| `deleted_at` | TIMESTAMP | YES | NULL | — | Soft delete marker |

---

### Table: `task_attachments`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `task_id` | UUID | NO | — | FK `engineering_tasks.id` | Owning task |
| `filename` | VARCHAR(500) | NO | — | — | Original filename as uploaded |
| `content_type` | VARCHAR(100) | NO | — | — | MIME type |
| `size_bytes` | BIGINT | NO | — | CHECK (> 0) | File size |
| `storage_path` | TEXT | NO | — | — | Internal object storage path |
| `checksum` | VARCHAR(128) | NO | — | — | SHA-256 hex digest for integrity verification |
| `uploaded_by_id` | UUID | NO | — | FK `users.id` | Uploader identity |
| `created_at` | TIMESTAMP | NO | `now()` | — | Upload timestamp |

---

### Table: `task_artifacts`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `task_id` | UUID | NO | — | FK `engineering_tasks.id` | Owning task |
| `session_id` | UUID | NO | — | FK `execution_sessions.id` | Session that produced this artifact |
| `artifact_type` | VARCHAR(100) | NO | — | — | Classification (e.g., `test_report`, `build_output`, `coverage`) |
| `filename` | VARCHAR(500) | NO | — | — | Artifact filename |
| `content_type` | VARCHAR(100) | NO | — | — | MIME type |
| `size_bytes` | BIGINT | NO | — | CHECK (> 0) | File size |
| `storage_path` | TEXT | NO | — | — | Object storage path |
| `checksum` | VARCHAR(128) | NO | — | — | SHA-256 hex digest |
| `metadata` | JSONB | YES | NULL | — | Artifact-type-specific extension fields |
| `created_at` | TIMESTAMP | NO | `now()` | — | Creation timestamp |

---

### Table: `task_locks`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `task_id` | UUID | NO | — | FK `engineering_tasks.id` UNIQUE | Locked task (one lock per task at a time) |
| `session_id` | UUID | NO | — | FK `execution_sessions.id` | Session holding the lock |
| `acquired_at` | TIMESTAMP | NO | — | — | When the lock was granted |
| `ttl_seconds` | INTEGER | NO | — | CHECK (> 0) | Lock time-to-live in seconds |
| `extended_at` | TIMESTAMP | YES | NULL | — | Most recent heartbeat extension timestamp |
| `released_at` | TIMESTAMP | YES | NULL | — | When the lock was explicitly released; NULL = still held |

---

### Table: `task_state_transitions`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `task_id` | UUID | NO | — | FK `engineering_tasks.id` | Task that transitioned |
| `from_status` | VARCHAR(50) | YES | NULL | — | Previous state; NULL on initial creation |
| `to_status` | VARCHAR(50) | NO | — | — | New state after transition |
| `actor_id` | UUID | NO | — | — | ID of the actor that triggered the transition |
| `actor_type` | VARCHAR(20) | NO | — | CHECK (`user`, `agent`, `system`) | Actor classification |
| `reason` | TEXT | YES | NULL | — | Optional human-readable reason for the transition |
| `metadata` | JSONB | YES | NULL | — | Additional context (e.g., retry number, error code) |
| `occurred_at` | TIMESTAMP | NO | `now()` | — | Exact time of the transition |

---

## 3. Schema — Engineering Agents Module

### Table: `engineering_agents`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `name` | VARCHAR(200) | NO | — | — | Human-readable agent name |
| `agent_type` | VARCHAR(50) | NO | — | CHECK (`standard`, `specialist`, `orchestrator`) | Agent classification |
| `api_key_hash` | VARCHAR(255) | NO | — | UNIQUE | Bcrypt hash of the registration API key |
| `status` | VARCHAR(50) | NO | `'Unregistered'` | CHECK in canonical list | Current agent lifecycle state |
| `last_seen_at` | TIMESTAMP | YES | NULL | — | Timestamp of the most recent authenticated request |
| `registered_at` | TIMESTAMP | YES | NULL | — | When the agent completed registration |
| `deregistered_at` | TIMESTAMP | YES | NULL | — | When the agent was deregistered |
| `ip_address` | VARCHAR(45) | YES | NULL | — | Last known IP address (IPv4 or IPv6) |
| `version` | VARCHAR(20) | YES | NULL | — | Agent software version string |
| `metadata` | JSONB | YES | NULL | — | Arbitrary agent-type-specific metadata |
| `created_at` | TIMESTAMP | NO | `now()` | — | Record creation timestamp |
| `updated_at` | TIMESTAMP | NO | `now()` | — | Last mutation timestamp |
| `deleted_at` | TIMESTAMP | YES | NULL | — | Soft delete marker |

**Valid `status` values:** `Unregistered`, `Registering`, `Idle`, `Busy`, `Paused`, `Draining`, `Offline`, `Terminated`

---

### Table: `engineering_workers`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `agent_id` | UUID | NO | — | FK `engineering_agents.id` | Owning agent |
| `tier` | VARCHAR(20) | NO | — | CHECK (`standard`, `premium`, `isolated`) | Worker resource tier |
| `status` | VARCHAR(50) | NO | `'Idle'` | CHECK in canonical list | Current worker state |
| `current_session_id` | UUID | YES | NULL | FK `execution_sessions.id` | Active session if status = Busy |
| `cpu_cores_allocated` | SMALLINT | NO | — | CHECK (> 0) | CPU cores reserved for this worker |
| `memory_mb_allocated` | INTEGER | NO | — | CHECK (> 0) | Memory (MB) reserved |
| `disk_gb_allocated` | SMALLINT | NO | — | CHECK (> 0) | Disk (GB) reserved |
| `cpu_percent_used` | DECIMAL(5,2) | YES | NULL | CHECK (0–100) | Live CPU utilisation percentage |
| `memory_mb_used` | INTEGER | YES | NULL | CHECK (>= 0) | Live memory consumption (MB) |
| `started_at` | TIMESTAMP | YES | NULL | — | When the worker process started |
| `last_heartbeat_at` | TIMESTAMP | YES | NULL | — | Most recent heartbeat received |
| `created_at` | TIMESTAMP | NO | `now()` | — | Record creation timestamp |
| `updated_at` | TIMESTAMP | NO | `now()` | — | Last mutation timestamp |

---

### Table: `worker_capabilities`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `worker_id` | UUID | NO | — | FK `engineering_workers.id` | Owning worker |
| `capability_key` | VARCHAR(100) | NO | — | — | Capability identifier (e.g., `php8.3`, `node20`, `docker`) |
| `capability_version` | VARCHAR(20) | YES | NULL | — | Specific version of the capability if applicable |
| `proficiency` | SMALLINT | NO | — | CHECK (1–5) | Proficiency score; 5 = expert |
| `created_at` | TIMESTAMP | NO | `now()` | — | When the capability was recorded |

**Constraints:**
- UNIQUE (`worker_id`, `capability_key`)

---

### Table: `worker_heartbeats`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `worker_id` | UUID | NO | — | FK `engineering_workers.id` | Reporting worker |
| `agent_id` | UUID | NO | — | FK `engineering_agents.id` | Agent the worker belongs to |
| `status` | VARCHAR(50) | NO | — | — | Worker status at heartbeat time |
| `cpu_percent` | DECIMAL(5,2) | NO | — | CHECK (0–100) | CPU utilisation at heartbeat |
| `memory_mb_used` | INTEGER | NO | — | CHECK (>= 0) | Memory consumed at heartbeat |
| `disk_free_gb` | DECIMAL(8,2) | NO | — | CHECK (>= 0) | Free disk space at heartbeat |
| `current_task_id` | UUID | YES | NULL | — | Task being executed at heartbeat time; NULL if idle |
| `recorded_at` | TIMESTAMP | NO | `now()` | — | Heartbeat timestamp |

---

### Table: `agent_jwt_blocklist`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `jti` | VARCHAR(36) | NO | — | UNIQUE INDEX | JWT ID claim from the revoked token |
| `agent_id` | UUID | NO | — | FK `engineering_agents.id` | Agent whose token was revoked |
| `expires_at` | TIMESTAMP | NO | — | — | Original JWT expiry; used for blocklist pruning |
| `revoked_at` | TIMESTAMP | NO | `now()` | — | Time of revocation |
| `revoke_reason` | VARCHAR(200) | YES | NULL | — | Reason for revocation (e.g., `logout`, `key_rotation`) |

---

## 4. Schema — Execution Module

### Table: `execution_sessions`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `task_id` | UUID | NO | — | FK `engineering_tasks.id` UNIQUE | One active session per task at a time |
| `worker_id` | UUID | NO | — | FK `engineering_workers.id` | Worker executing this session |
| `workspace_id` | UUID | NO | — | FK `workspaces.id` | Workspace allocated to this session |
| `status` | VARCHAR(50) | NO | `'Initializing'` | CHECK in canonical list | Current session lifecycle state |
| `started_at` | TIMESTAMP | YES | NULL | — | When execution began |
| `paused_at` | TIMESTAMP | YES | NULL | — | When execution was paused |
| `resumed_at` | TIMESTAMP | YES | NULL | — | When execution was last resumed |
| `completed_at` | TIMESTAMP | YES | NULL | — | When session reached Completed state |
| `failed_at` | TIMESTAMP | YES | NULL | — | When session reached Failed state |
| `aborted_at` | TIMESTAMP | YES | NULL | — | When session was Aborted |
| `failure_reason` | TEXT | YES | NULL | — | Human-readable failure description |
| `cpu_seconds_used` | INTEGER | YES | NULL | CHECK (>= 0) | Cumulative CPU seconds consumed |
| `memory_mb_peak` | INTEGER | YES | NULL | CHECK (>= 0) | Peak memory usage (MB) |
| `disk_gb_peak` | DECIMAL(8,2) | YES | NULL | CHECK (>= 0) | Peak disk usage (GB) |
| `created_at` | TIMESTAMP | NO | `now()` | — | Record creation timestamp |
| `updated_at` | TIMESTAMP | NO | `now()` | — | Last mutation timestamp |

**Valid `status` values:** `Initializing`, `Running`, `Paused`, `Completing`, `Completed`, `Failed`, `Aborted`

---

### Table: `execution_queue`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `task_id` | UUID | NO | — | FK `engineering_tasks.id` UNIQUE | One queue entry per task |
| `priority` | SMALLINT | NO | `5` | CHECK (1–10) | Base priority from the task |
| `priority_score` | DECIMAL(10,2) | NO | — | — | Computed score (priority + age boost + deadline urgency) |
| `tier_required` | VARCHAR(20) | NO | — | CHECK (`standard`, `premium`, `isolated`) | Minimum worker tier needed |
| `capabilities_required` | JSONB | NO | `'[]'` | — | Array of required capability keys |
| `status` | VARCHAR(50) | NO | `'Queued'` | CHECK (`Queued`, `Reserved`, `Assigned`, `Cancelled`) | Queue item state |
| `enqueued_at` | TIMESTAMP | NO | `now()` | — | When the task entered the queue |
| `reserved_at` | TIMESTAMP | YES | NULL | — | When a worker reserved this entry |
| `assigned_at` | TIMESTAMP | YES | NULL | — | When the task was assigned to a session |
| `deadline` | TIMESTAMP | YES | NULL | — | Hard deadline carried from the task |
| `attempts` | SMALLINT | NO | `0` | CHECK (>= 0) | Number of dispatch attempts |
| `last_attempt_at` | TIMESTAMP | YES | NULL | — | Timestamp of the most recent attempt |
| `failure_reason` | VARCHAR(500) | YES | NULL | — | Why the most recent attempt failed |

---

### Table: `execution_logs`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | BIGINT SERIAL | NO | — | PK | Monotonically increasing integer for log ordering |
| `session_id` | UUID | NO | — | FK `execution_sessions.id` | Session that produced this log line |
| `company_id` | UUID | NO | — | — | Tenant scope (denormalized for partition filtering) |
| `level` | VARCHAR(10) | NO | — | CHECK (`DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`) | Log severity |
| `message` | TEXT | NO | — | — | Log message body |
| `context` | JSONB | YES | NULL | — | Structured key-value context |
| `logged_at` | TIMESTAMP | NO | `now()` | — | Partition key — when the log line was emitted |
| `sequence_number` | BIGINT | NO | — | — | Per-session monotonic sequence for strict ordering |

**Partitioning:** Range partitioned by `logged_at` on a monthly boundary.
Retention policy: 90 days active; older partitions archived to cold storage.

---

## 5. Schema — Workspace Module

### Table: `workspaces`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `workspace_type` | VARCHAR(20) | NO | — | CHECK (`git`, `container`, `hybrid`) | Infrastructure type |
| `status` | VARCHAR(50) | NO | `'Pending'` | CHECK in canonical list | Current lifecycle state |
| `isolation_level` | VARCHAR(20) | NO | — | CHECK (`shared`, `dedicated`, `airgapped`) | Security/isolation tier |
| `base_branch` | VARCHAR(255) | NO | — | — | Git branch used as the environment baseline |
| `task_branch` | VARCHAR(255) | YES | NULL | — | Task-specific branch created from `base_branch` |
| `repository_path` | TEXT | YES | NULL | — | Filesystem path to the cloned repository on the worker |
| `toolchain_version` | VARCHAR(50) | YES | NULL | — | Pinned toolchain version identifier |
| `provisioned_at` | TIMESTAMP | YES | NULL | — | When provisioning completed |
| `activated_at` | TIMESTAMP | YES | NULL | — | When the workspace became Active |
| `archived_at` | TIMESTAMP | YES | NULL | — | When archiving completed |
| `failed_at` | TIMESTAMP | YES | NULL | — | When the workspace entered Failed state |
| `failure_reason` | TEXT | YES | NULL | — | Human-readable failure description |
| `cache_hit` | BOOLEAN | NO | `false` | — | Whether a cached workspace image was reused |
| `provisioning_duration_ms` | INTEGER | YES | NULL | CHECK (>= 0) | Time taken to provision in milliseconds |
| `created_at` | TIMESTAMP | NO | `now()` | — | Record creation timestamp |
| `updated_at` | TIMESTAMP | NO | `now()` | — | Last mutation timestamp |

**Valid `status` values:** `Pending`, `Provisioning`, `Active`, `Idle`, `Archiving`, `Archived`, `Failed`

---

### Table: `workspace_locks`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `workspace_id` | UUID | NO | — | FK `workspaces.id` UNIQUE | Locked workspace (one lock at a time) |
| `session_id` | UUID | NO | — | FK `execution_sessions.id` | Session holding the lock |
| `acquired_at` | TIMESTAMP | NO | — | — | When the lock was granted |
| `ttl_seconds` | INTEGER | NO | `14400` | CHECK (> 0) | Lock TTL in seconds (default 4 hours) |
| `extended_at` | TIMESTAMP | YES | NULL | — | Most recent heartbeat extension timestamp |
| `released_at` | TIMESTAMP | YES | NULL | — | When explicitly released; NULL = currently held |
| `version` | INTEGER | NO | `0` | — | Optimistic lock counter for extension races |

---

## 6. Schema — Release Module

### Table: `release_candidates`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `task_id` | UUID | NO | — | FK `engineering_tasks.id` | Task this candidate was produced by |
| `status` | VARCHAR(50) | NO | `'Draft'` | CHECK in canonical list | Current release lifecycle state |
| `version_tag` | VARCHAR(50) | YES | NULL | — | Semantic version tag (e.g., `v1.4.2`) applied at release |
| `created_by_id` | UUID | NO | — | FK `users.id` | Who initiated the release candidate |
| `review_started_at` | TIMESTAMP | YES | NULL | — | When formal review began |
| `approved_at` | TIMESTAMP | YES | NULL | — | When the candidate received final approval |
| `rejected_at` | TIMESTAMP | YES | NULL | — | When the candidate was rejected |
| `staged_at` | TIMESTAMP | YES | NULL | — | When the candidate was deployed to staging |
| `released_at` | TIMESTAMP | YES | NULL | — | When the candidate was promoted to production |
| `rolled_back_at` | TIMESTAMP | YES | NULL | — | When a rollback was executed |
| `rejection_reason` | TEXT | YES | NULL | — | Reason provided by the reviewer who rejected |
| `metadata` | JSONB | YES | NULL | — | Arbitrary release metadata (changelogs, flags, etc.) |
| `created_at` | TIMESTAMP | NO | `now()` | — | Record creation timestamp |
| `updated_at` | TIMESTAMP | NO | `now()` | — | Last mutation timestamp |

**Valid `status` values:** `Draft`, `UnderReview`, `Approved`, `Staged`, `Released`, `RolledBack`

---

### Table: `release_bundles`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `release_candidate_id` | UUID | NO | — | FK `release_candidates.id` | Owning release candidate |
| `bundle_type` | VARCHAR(50) | NO | — | — | Bundle classification (e.g., `source`, `binary`, `migration`, `docs`) |
| `storage_path` | TEXT | NO | — | — | Object storage path to the bundle archive |
| `checksum` | VARCHAR(128) | NO | — | — | SHA-256 hex digest for integrity verification |
| `size_bytes` | BIGINT | NO | — | CHECK (> 0) | Bundle size |
| `manifest` | JSONB | NO | — | — | Structured list of files and their checksums in the bundle |
| `created_at` | TIMESTAMP | NO | `now()` | — | Creation timestamp |

---

### Table: `release_approvals`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `release_candidate_id` | UUID | NO | — | FK `release_candidates.id` | Candidate being reviewed |
| `approver_id` | UUID | NO | — | FK `users.id` | Reviewer identity |
| `decision` | VARCHAR(20) | NO | — | CHECK (`approved`, `rejected`) | Reviewer decision |
| `comment` | TEXT | YES | NULL | — | Optional reviewer comment |
| `decided_at` | TIMESTAMP | NO | `now()` | — | When the decision was recorded |

---

### Table: `pipeline_runs`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `company_id` | UUID | NO | — | FK `companies.id` | Tenant scope |
| `release_candidate_id` | UUID | NO | — | FK `release_candidates.id` | Associated release candidate |
| `external_pipeline_id` | VARCHAR(255) | YES | NULL | — | ID in the external CI system (e.g., GitHub Actions run ID) |
| `status` | VARCHAR(50) | NO | — | — | Pipeline run outcome (e.g., `pending`, `running`, `success`, `failed`) |
| `started_at` | TIMESTAMP | YES | NULL | — | When the pipeline run began |
| `completed_at` | TIMESTAMP | YES | NULL | — | When the pipeline run finished |
| `failed_at` | TIMESTAMP | YES | NULL | — | When the pipeline run failed |
| `duration_seconds` | INTEGER | YES | NULL | CHECK (>= 0) | Total run duration |
| `metadata` | JSONB | YES | NULL | — | Provider-specific metadata (e.g., run URL, trigger ref) |
| `created_at` | TIMESTAMP | NO | `now()` | — | Record creation timestamp |
| `updated_at` | TIMESTAMP | NO | `now()` | — | Last mutation timestamp |

---

### Table: `pipeline_artifacts`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Primary identifier |
| `pipeline_run_id` | UUID | NO | — | FK `pipeline_runs.id` | Owning pipeline run |
| `artifact_name` | VARCHAR(500) | NO | — | — | Artifact name as reported by the CI provider |
| `artifact_type` | VARCHAR(100) | NO | — | — | Classification (e.g., `test_results`, `coverage`, `docker_image`) |
| `storage_path` | TEXT | NO | — | — | Object storage path |
| `size_bytes` | BIGINT | NO | — | CHECK (> 0) | Artifact size |
| `checksum` | VARCHAR(128) | NO | — | — | SHA-256 hex digest |
| `created_at` | TIMESTAMP | NO | `now()` | — | Creation timestamp |

---

## 7. Schema — Audit and Events

### Table: `engineering_event_log`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Unique event identifier |
| `event_type` | VARCHAR(100) | NO | — | — | PascalCase past-tense event name (e.g., `TaskCreated`) |
| `schema_version` | SMALLINT | NO | `1` | CHECK (>= 1) | Event schema version for forward compatibility |
| `company_id` | UUID | NO | — | — | Tenant scope (denormalized) |
| `actor_id` | UUID | NO | — | — | Identity of the actor who caused the event |
| `actor_type` | VARCHAR(20) | NO | — | CHECK (`user`, `agent`, `system`) | Actor classification |
| `resource_type` | VARCHAR(50) | NO | — | — | Entity type the event concerns (e.g., `EngineeringTask`) |
| `resource_id` | UUID | YES | NULL | — | ID of the entity; NULL for system-scope events |
| `correlation_id` | UUID | YES | NULL | — | Traces a chain of related events across services |
| `payload` | JSONB | NO | — | — | Full event payload including before/after state |
| `occurred_at` | TIMESTAMP | NO | `now()` | — | Partition key — immutable event timestamp |

**Partitioning:** Range partitioned by `occurred_at` on a monthly boundary.
**Immutability rule:** No UPDATE or DELETE permitted. No `deleted_at` column. Enforced via PostgreSQL row security policy and application layer.

---

### Table: `security_audit_log`

| Column Name | Data Type | Nullable | Default | Constraint | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | — | PK | Unique audit entry identifier |
| `event_type` | VARCHAR(100) | NO | — | — | Security event class (e.g., `AgentAuthFailed`, `JwtRevoked`) |
| `actor_id` | UUID | YES | NULL | — | Authenticated actor if known; NULL for anonymous attempts |
| `actor_type` | VARCHAR(20) | YES | NULL | — | Actor classification if known |
| `company_id` | UUID | YES | NULL | — | Tenant scope if determinable; NULL for unauthenticated |
| `ip_address` | INET | YES | NULL | — | Source IP address |
| `user_agent` | TEXT | YES | NULL | — | HTTP User-Agent header |
| `resource_type` | VARCHAR(50) | YES | NULL | — | Resource type involved in the event |
| `resource_id` | UUID | YES | NULL | — | Resource ID if applicable |
| `outcome` | VARCHAR(20) | NO | — | CHECK (`success`, `failure`, `blocked`) | Result of the attempted action |
| `metadata` | JSONB | YES | NULL | — | Additional context (request path, headers, etc.) |
| `occurred_at` | TIMESTAMP | NO | `now()` | — | When the event occurred |

**Retention:** 1 year. **Immutability rule:** No UPDATE or DELETE. Enforced via PostgreSQL row security policy.

---

## 8. Index Strategy

### `engineering_tasks`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_engineering_tasks_company_status` | `(company_id, status)` | BTREE | Primary list filter |
| `idx_engineering_tasks_assigned_agent_id` | `(assigned_agent_id)` | BTREE | FK + agent workload queries |
| `idx_engineering_tasks_assigned_worker_id` | `(assigned_worker_id)` | BTREE | FK + worker workload queries |
| `idx_engineering_tasks_workspace_id` | `(workspace_id)` | BTREE | FK navigation |
| `idx_engineering_tasks_parent_task_id` | `(parent_task_id)` | BTREE | Hierarchy traversal |
| `idx_engineering_tasks_deadline` | `(deadline)` | BTREE | Deadline scheduler scans |
| `idx_engineering_tasks_created_at` | `(created_at)` | BTREE | Chronological listing |
| `idx_engineering_tasks_created_by_id` | `(created_by_id)` | BTREE | FK navigation |

### `task_dependencies`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_task_dependencies_task_id` | `(task_id)` | BTREE | Outgoing dependency lookup |
| `idx_task_dependencies_depends_on_task_id` | `(depends_on_task_id)` | BTREE | Blocking task reverse lookup |
| `uq_task_dependencies_pair` | `(task_id, depends_on_task_id)` | UNIQUE | Prevent duplicate edges |

### `task_comments`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_task_comments_task_id` | `(task_id)` | BTREE | Comment thread load |
| `idx_task_comments_author_id` | `(author_id)` | BTREE | FK navigation |

### `task_attachments` / `task_artifacts`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_task_attachments_task_id` | `(task_id)` | BTREE | Attachment load |
| `idx_task_artifacts_task_id` | `(task_id)` | BTREE | Artifact load |
| `idx_task_artifacts_session_id` | `(session_id)` | BTREE | Session artifact lookup |

### `task_state_transitions`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_task_state_transitions_task_id` | `(task_id, occurred_at)` | BTREE | Ordered history retrieval |

### `engineering_agents`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_engineering_agents_company_status` | `(company_id, status)` | BTREE | Active agent queries |
| `uq_engineering_agents_api_key_hash` | `(api_key_hash)` | UNIQUE | Authentication lookup |

### `engineering_workers`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_engineering_workers_agent_id` | `(agent_id)` | BTREE | FK + agent roster |
| `idx_engineering_workers_company_status` | `(company_id, status)` | BTREE | Available worker queries |
| `idx_engineering_workers_current_session_id` | `(current_session_id)` | BTREE | Session-to-worker reverse lookup |

### `worker_capabilities`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_worker_capabilities_worker_id` | `(worker_id)` | BTREE | Worker capability load |
| `uq_worker_capabilities_worker_key` | `(worker_id, capability_key)` | UNIQUE | No duplicate capabilities |

### `worker_heartbeats`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_worker_heartbeats_worker_recorded` | `(worker_id, recorded_at)` | BTREE | Recent heartbeat queries |
| `idx_worker_heartbeats_agent_id` | `(agent_id)` | BTREE | FK navigation |

### `agent_jwt_blocklist`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `uq_agent_jwt_blocklist_jti` | `(jti)` | UNIQUE | O(1) token revocation check |
| `idx_agent_jwt_blocklist_expires_at` | `(expires_at)` | BTREE | Expired entry pruning job |

### `execution_sessions`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_execution_sessions_task_id` | `(task_id)` | BTREE (UNIQUE) | One-to-one task→session |
| `idx_execution_sessions_worker_id` | `(worker_id)` | BTREE | Worker session history |
| `idx_execution_sessions_workspace_id` | `(workspace_id)` | BTREE | Workspace session history |
| `idx_execution_sessions_company_status` | `(company_id, status)` | BTREE | Active session dashboard |

### `execution_queue`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_execution_queue_task_id` | `(task_id)` | BTREE (UNIQUE) | One entry per task |
| `idx_execution_queue_scoring` | `(company_id, status, priority_score DESC)` | BTREE | Dispatcher dequeue order |
| `idx_execution_queue_deadline` | `(deadline)` | BTREE | Deadline urgency scans |

### `execution_logs`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_execution_logs_session_sequence` | `(session_id, sequence_number)` | BTREE | Ordered log streaming |
| `idx_execution_logs_logged_at` | `(logged_at)` | BTREE | Partition pruning support |

### `workspaces`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_workspaces_company_status` | `(company_id, status)` | BTREE | Available workspace queries |

### `release_candidates`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_release_candidates_task_id` | `(task_id)` | BTREE | Task→release navigation |
| `idx_release_candidates_company_status` | `(company_id, status)` | BTREE | Release pipeline dashboard |
| `idx_release_candidates_created_by_id` | `(created_by_id)` | BTREE | FK navigation |

### `pipeline_runs`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_pipeline_runs_release_candidate_id` | `(release_candidate_id)` | BTREE | Release→runs navigation |
| `idx_pipeline_runs_company_status` | `(company_id, status)` | BTREE | Active pipeline dashboard |

### `engineering_event_log`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_engineering_event_log_company_type_time` | `(company_id, event_type, occurred_at)` | BTREE | Event stream queries |
| `idx_engineering_event_log_correlation_id` | `(correlation_id)` | BTREE | Trace correlation lookup |
| `idx_engineering_event_log_resource` | `(resource_type, resource_id)` | BTREE | Entity event history |

### `security_audit_log`

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `idx_security_audit_log_actor` | `(actor_id, occurred_at)` | BTREE | Actor audit trail |
| `idx_security_audit_log_ip` | `(ip_address, occurred_at)` | BTREE | IP-based investigation |
| `idx_security_audit_log_outcome` | `(outcome, occurred_at)` | BTREE | Failure rate monitoring |

---

## 9. Entity Relationship Diagram (ASCII)

```
┌─────────────────────────┐         ┌──────────────────────────┐
│    engineering_agents   │  1 ──── N│   engineering_workers    │
│─────────────────────────│         │──────────────────────────│
│ id (PK)                 │         │ id (PK)                  │
│ company_id              │         │ agent_id (FK)            │
│ name                    │         │ tier                     │
│ agent_type              │         │ status                   │
│ api_key_hash            │         │ current_session_id (FK)  │
│ status                  │         └──────────┬───────────────┘
└─────────────────────────┘                    │ 1
                                               │
                                               │ N
                                    ┌──────────▼───────────────┐
                                    │   execution_sessions     │
                                    │──────────────────────────│
                                    │ id (PK)                  │
                                    │ task_id (FK, UNIQUE)     │
                                    │ worker_id (FK)           │
                                    │ workspace_id (FK)        │
                                    │ status                   │
                                    └──────────┬───────────────┘
                                               │ 1
                                               │
                              ┌────────────────┤
                              │                │ N
                              │     ┌──────────▼───────────────┐
                              │     │     execution_logs       │
                              │     │──────────────────────────│
                              │     │ id (BIGINT, partitioned) │
                              │     │ session_id (FK)          │
                              │     │ level                    │
                              │     │ message                  │
                              │     └──────────────────────────┘
                              │
                     1 ◄──────┘ (task_id UNIQUE)
                              │
┌─────────────────────────────▼──────────────────────────────────────────┐
│                        engineering_tasks                                │
│────────────────────────────────────────────────────────────────────────│
│ id (PK)                                                                 │
│ company_id                                                              │
│ title / description / status / priority                                 │
│ assigned_agent_id (FK) / assigned_worker_id (FK) / workspace_id (FK)   │
│ parent_task_id (FK → self)                                              │
│ deadline / started_at / completed_at / failed_at / cancelled_at        │
│ retry_count / max_retries / metadata / version                          │
└──┬──────┬───────┬──────────┬────────────────────────────────────────────┘
   │      │       │          │
   │ 1    │ 1     │ 1        │ 1
   │      │       │          │
   │ N    │ N     │ N        │ N (self-referential: parent_task_id)
   │      │       │          │
   │  ┌───▼──┐ ┌──▼────┐ ┌──▼────────────┐   ┌──────────────────────┐
   │  │task_ │ │task_  │ │task_          │   │  task_dependencies   │
   │  │comments│ │attach-│ │artifacts     │   │──────────────────────│
   │  │      │ │ments  │ │              │   │ task_id (FK)         │
   │  └──────┘ └───────┘ └──────────────┘   │ depends_on_task_id   │
   │                                         └──────────────────────┘
   │ 1
   │
   │ 1 ──────────────────────────────────── task_locks (UNIQUE on task_id)
   │
   │ 1
   │
   ▼
┌──────────────────────────┐
│   release_candidates     │
│──────────────────────────│
│ id (PK)                  │
│ task_id (FK)             │
│ status                   │
│ version_tag              │
└──┬───────────────────────┘
   │ 1
   │
   ├──── 1 ──── release_bundles
   │
   ├──── N ──── release_approvals
   │
   └──── N ──┐
             │
    ┌─────────▼──────────────┐
    │     pipeline_runs      │
    │────────────────────────│
    │ id (PK)                │
    │ release_candidate_id   │
    │ external_pipeline_id   │
    │ status                 │
    └─────────┬──────────────┘
              │ 1
              │
              │ N
    ┌─────────▼──────────────┐
    │   pipeline_artifacts   │
    │────────────────────────│
    │ id (PK)                │
    │ pipeline_run_id (FK)   │
    │ artifact_name          │
    └────────────────────────┘


┌──────────────────────────┐    1 ──── 1    ┌──────────────────────────┐
│       workspaces         │                │     workspace_locks      │
│──────────────────────────│                │──────────────────────────│
│ id (PK)                  │                │ workspace_id (FK, UNIQUE) │
│ company_id               │                │ session_id (FK)          │
│ workspace_type           │                │ acquired_at              │
│ status                   │                │ ttl_seconds              │
│ isolation_level          │                │ released_at              │
└──────────────────────────┘                └──────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                     Audit / Event Tables                             │
│──────────────────────────────────────────────────────────────────────│
│ engineering_event_log  — immutable, partitioned by occurred_at month │
│ security_audit_log     — immutable, 1-year retention                 │
│ agent_jwt_blocklist    — revoked JWT JTIs                            │
│ worker_heartbeats      — time-series telemetry                       │
│ task_state_transitions — full state machine history per task         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 10. Relationship Summary

| Parent Entity | Child Entity | Cardinality | Join Column |
|---|---|---|---|
| `engineering_agents` | `engineering_workers` | 1 : N | `engineering_workers.agent_id` |
| `engineering_workers` | `execution_sessions` | 1 : N | `execution_sessions.worker_id` |
| `engineering_tasks` | `execution_sessions` | 1 : 1 | `execution_sessions.task_id` (UNIQUE) |
| `engineering_tasks` | `task_artifacts` | 1 : N | `task_artifacts.task_id` |
| `engineering_tasks` | `task_comments` | 1 : N | `task_comments.task_id` |
| `engineering_tasks` | `task_attachments` | 1 : N | `task_attachments.task_id` |
| `engineering_tasks` | `task_dependencies` | 1 : N (self) | `task_dependencies.task_id` / `depends_on_task_id` |
| `engineering_tasks` | `task_locks` | 1 : 1 | `task_locks.task_id` (UNIQUE) |
| `engineering_tasks` | `task_state_transitions` | 1 : N | `task_state_transitions.task_id` |
| `engineering_tasks` | `release_candidates` | 1 : 1 | `release_candidates.task_id` |
| `release_candidates` | `release_bundles` | 1 : 1 | `release_bundles.release_candidate_id` |
| `release_candidates` | `release_approvals` | 1 : N | `release_approvals.release_candidate_id` |
| `release_candidates` | `pipeline_runs` | 1 : N | `pipeline_runs.release_candidate_id` |
| `pipeline_runs` | `pipeline_artifacts` | 1 : N | `pipeline_artifacts.pipeline_run_id` |
| `execution_sessions` | `execution_logs` | 1 : N | `execution_logs.session_id` |
| `execution_sessions` | `task_artifacts` | 1 : N | `task_artifacts.session_id` |
| `workspaces` | `workspace_locks` | 1 : 1 | `workspace_locks.workspace_id` (UNIQUE) |

---

*Document frozen. All schema changes require a new ADR and version bump.*
