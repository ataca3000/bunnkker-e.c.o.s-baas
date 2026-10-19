# Engineering Cloud — Runtime Verification Checklist

**Version:** 1.0
**Date:** 2026-07-22
**Purpose:** Verify any Engineering Cloud implementation is architecturally compliant before deployment

---

> **How to use this checklist**
> Complete every section before promoting any Engineering Cloud implementation to production. Items marked **[BLOCKING]** must pass before deployment proceeds. Items marked **[ADVISORY]** represent best-practice gates; non-compliance must be formally documented with a waiver and remediation date. All checklist results must be committed to the repository under `docs/engineering-cloud/verification-results/` alongside the implementation PR.

---

## 1. Architecture Validation

_12 items — verify the module's structural and domain-model compliance._

- [ ] **DDD Module Structure** — Confirm the Engineering Cloud module resides under `backend/Modules/Engineering/Cloud/` following the project's established DDD layout: `Domain/` (Entities, Events, Services, ValueObjects), `Application/` (Commands, Queries, Handlers), `Infrastructure/` (Repositories, Database, Http). No logic may live outside this hierarchy. **[BLOCKING]**

- [ ] **No Unauthorized Cross-Module Dependencies** — Run a static import scan across all PHP namespaces in the module. Confirm the only permitted outbound references are to `Modules/Core/`, `Modules/Admin/`, and the explicitly approved integration bridges (`EngineeringReleaseBridge`, `PipelineEventAdapter`). Any direct import of another domain module's internals is a blocker. **[BLOCKING]**

- [ ] **All 20 Canonical Entities Present** — Verify the domain model defines exactly these entities and no others: `EngineeringTask`, `EngineeringAgent`, `EngineeringWorker`, `ExecutionSession`, `ExecutionQueue`, `Workspace`, `WorkspaceLock`, `ReleaseCandidate`, `ReleaseBundle`, `TaskDependency`, `TaskComment`, `TaskAttachment`, `ExecutionLog`, `PipelineRun`, `PipelineArtifact`, `WorkerCapability`, `WorkerResource`, `WorkerHeartbeat`, `TaskArtifact`, `TaskLock`. Missing or renamed entities are a blocker. **[BLOCKING]**

- [ ] **State Transitions Match Frozen State Machines** — For each of the four state machines, verify every permitted transition is implemented and no unlisted transitions are reachable in code: Task states (`Draft → Queued → Assigned → Accepted → Running → Paused → Completed → Failed → Cancelled → Released → Archived`), Worker states (`Unregistered → Registering → Idle → Busy → Paused → Draining → Offline → Terminated`), Workspace states (`Pending → Provisioning → Active → Idle → Archiving → Archived → Failed`), ExecutionSession states (`Initializing → Running → Paused → Completing → Completed → Failed → Aborted`). **[BLOCKING]**

- [ ] **Aggregate Boundaries Respected** — Confirm that no aggregate root accesses the internal state of another aggregate root directly. Cross-aggregate references must use identity references (UUID) only. Verify that `EngineeringTask`, `EngineeringAgent`, `Workspace`, and `ExecutionSession` each constitute distinct aggregate roots with no shared mutable state. **[BLOCKING]**

- [ ] **Events Match ADR-028 Catalog** — Compare every domain event class in the module against the official ADR-028 event catalog. Confirm all event names are PascalCase past tense. Confirm no events are published that are absent from the catalog, and no cataloged events are missing from the implementation. Any discrepancy requires an ADR-028 amendment before deployment. **[BLOCKING]**

- [ ] **No Executable Code in docs/** — Scan `docs/engineering-cloud/` recursively for any `.php`, `.ts`, `.js`, `.py`, `.sh`, or `.sql` files. The documentation directory must contain Markdown files only. Scripts, seeds, and migration stubs placed in docs are a blocker regardless of intent. **[BLOCKING]**

- [ ] **No ERP Modules Modified** — Run `git diff --name-only origin/main` and confirm zero files under `backend/Modules/` outside of `Modules/Engineering/Cloud/` were modified. Any modification to existing ERP modules (Inventory, Orders, Procurement, etc.) requires a separate PR and architecture review. **[BLOCKING]**

- [ ] **No Release Manager Modified** — Confirm zero changes to `backend/Modules/Engineering/ReleaseManager/` or any file under `Modules/Engineering/ReleaseManager`. The Release Manager is a frozen upstream system; all integration is inbound-only through `EngineeringReleaseBridge`. **[BLOCKING]**

- [ ] **No Pipeline Modified** — Confirm zero changes to `backend/Modules/Engineering/Pipeline/` or any file under `Modules/Engineering/Pipeline`. The Pipeline platform is frozen; integration is inbound-only through `PipelineEventAdapter`. **[BLOCKING]**

- [ ] **API Contracts Match Specification** — For every endpoint defined in `docs/engineering-cloud/api-contracts.md`, verify the implemented route, HTTP method, request schema, response schema, and error codes match the specification exactly. Use a contract test or schema assertion tool. Any field name or type mismatch is a blocker. **[BLOCKING]**

- [ ] **WebSocket Protocol Matches Specification** — For every message type defined in `docs/engineering-cloud/websocket-protocol.md`, verify the implemented message envelope structure, channel naming convention, event name, and payload schema match the specification. Verify the protocol version field is present in all messages. **[BLOCKING]**

---

## 2. Security Validation

_12 items — verify the platform's authentication, authorization, and data-protection posture._

- [ ] **All Endpoints Require Authentication** — Using a REST client with no credentials, send a request to every documented API endpoint. Confirm every endpoint returns HTTP 401 without a valid credential. No endpoint may be publicly accessible without explicit documented justification and a security sign-off. **[BLOCKING]**

- [ ] **JWT Validated on Every WebSocket Message** — Trace the WebSocket message dispatch path and confirm that JWT signature, issuer, audience, and expiry are validated on every inbound message, not only on initial connection handshake. A connected-but-expired token must result in a `4001 Unauthorized` close frame, not continued processing. **[BLOCKING]**

- [ ] **API Keys Stored as Bcrypt Hash Only** — Query the `agent_api_keys` table and confirm the `key_hash` column contains bcrypt hashes (prefix `$2y$`). Confirm the raw key is never stored in any table, log, or cache entry. The plaintext key must only be returned once at registration time and never persisted. **[BLOCKING]**

- [ ] **Replay Protection Active** — Verify every agent-to-server WebSocket message includes a `nonce` (UUID v4) and `sent_at` timestamp. Confirm the server rejects any message whose `sent_at` is older than 300 seconds. Confirm the server maintains a nonce cache and rejects duplicate nonces within the window. **[BLOCKING]**

- [ ] **TLS Enforced Everywhere** — Confirm all HTTP endpoints redirect HTTP to HTTPS with a 301. Confirm the WebSocket server only accepts `wss://` connections. Confirm all outbound calls from the platform (webhook deliveries, GitHub API, artifact storage) use TLS and validate server certificates. **[BLOCKING]**

- [ ] **Rate Limiting Active on All Agent Endpoints** — Verify that agent registration, heartbeat, task result submission, and artifact upload endpoints each have a rate limit configured in the middleware stack. Confirm exceeding the limit returns HTTP 429 with a `Retry-After` header. Confirm rate limits are keyed per agent ID, not per IP alone. **[BLOCKING]**

- [ ] **Security Audit Log Immutable** — Confirm the `security_audit_log` table has no `UPDATE` or `DELETE` grants for the application database user. Confirm there is no soft-delete mechanism on this table. Attempt an UPDATE via the application and verify it fails at the database level, not only at the application level. **[BLOCKING]**

- [ ] **company_id Enforced on Every DB Query** — Review every Eloquent model in the module and confirm a global scope applies `WHERE company_id = :current_company_id` to all queries. Verify there is no code path that bypasses this scope (e.g., `withoutGlobalScopes()`). Perform a cross-tenant data access test with two company fixtures. **[BLOCKING]**

- [ ] **Workspace Network Isolation Verified** — For each provisioned Workspace, verify that the workspace cannot initiate outbound network connections to other workspaces within the same company or to internal ERP services beyond the permitted API gateway. Test by attempting a connection from inside a workspace container to another workspace's private address. **[BLOCKING]**

- [ ] **Secrets Never Logged** — Search all log output (Laravel log, Laravel Telescope if enabled, queue worker output) for patterns matching JWT token format, bcrypt hash prefix, and API key format. Confirm no secret material appears in any log channel at any verbosity level. Search application code for log statements in authentication and key-handling code paths. **[BLOCKING]**

- [ ] **JWT Expiry Enforced** — Issue a JWT with a known expiry, wait for it to expire, then attempt an API call and a WebSocket message using the expired token. Confirm both return `401 Unauthorized` and that no action was performed. Confirm the expiry is checked server-side and cannot be bypassed by a client-modified `exp` claim. **[BLOCKING]**

- [ ] **Agent Cannot Access Another Agent's Data** — Register two agents under the same company. Using Agent A's credentials, attempt to fetch Agent B's tasks, sessions, heartbeat records, and artifacts via the API. Confirm every attempt returns HTTP 403 or 404. Confirm the isolation holds even when both agents are assigned tasks in the same Workspace. **[BLOCKING]**

---

## 3. Agent Protocol Validation

_10 items — verify the agent communication contract is implemented correctly on both sides._

- [ ] **agent.register Required Within 10 Seconds** — Connect a test agent via WebSocket without sending `agent.register`. Confirm the server sends a `4002 Registration Timeout` close frame after exactly 10 seconds (±500ms). Confirm the connection is closed and no resources are allocated for the unregistered agent. **[BLOCKING]**

- [ ] **Heartbeat Every 30 Seconds** — Connect a registered agent and confirm the server sends a `ping` frame every 30 seconds. Confirm that if the agent does not respond with a `pong` within 10 seconds, the server marks the worker as `Offline` and closes the connection with `4003 Heartbeat Timeout`. Verify the worker state transition is persisted. **[BLOCKING]**

- [ ] **Reconnection Uses Exponential Backoff** — Simulate a server-side disconnection and observe the agent's reconnection behavior. Confirm the agent waits 1 second before the first retry, 2 seconds before the second, 4 before the third, and so on, up to a maximum of 60 seconds. Confirm the agent does not flood the server with rapid reconnection attempts. **[BLOCKING]**

- [ ] **Offline Mode Buffers Locally** — Disconnect the agent from the network while it holds a running task. Confirm the agent continues executing the task and buffers all outbound messages (heartbeats, log lines, partial results) to local storage. Reconnect the network and confirm all buffered messages are flushed to the server in order within 30 seconds of reconnection. **[BLOCKING]**

- [ ] **Compression for Messages Over 1 KB** — Send a test message with a payload exceeding 1,024 bytes from a test agent. Capture the raw WebSocket frame and confirm the `permessage-deflate` extension is active and the frame is compressed. Confirm the server decompresses and processes the message correctly. **[ADVISORY]**

- [ ] **Message Envelope Has All Required Fields** — For every inbound and outbound WebSocket message type defined in the protocol specification, verify the implementation populates all required envelope fields: `id` (UUID v4), `type` (string), `version` (protocol version), `sent_at` (ISO 8601), `nonce` (UUID v4), and `payload` (object). Any missing field on any message type is a blocker. **[BLOCKING]**

- [ ] **All 4xxx Error Codes Handled** — Review the agent SDK or agent implementation and confirm it has explicit handling for every `4xxx` close code defined in the protocol: `4000 Server Error`, `4001 Unauthorized`, `4002 Registration Timeout`, `4003 Heartbeat Timeout`, `4004 Protocol Violation`, `4005 Rate Limited`. Confirm each code triggers a documented agent behavior (reconnect, halt, log, etc.). **[BLOCKING]**

- [ ] **session.reconnect Handled Correctly** — Interrupt an active ExecutionSession mid-task and reconnect. Confirm the server sends a `session.reconnect` message with the correct `session_id` and `resume_cursor`. Confirm the agent resumes execution from the cursor position and does not re-execute already-completed steps. Confirm the session transitions back to `Running` from `Paused`. **[BLOCKING]**

- [ ] **task.reject Returns Task to Queued** — Have a registered agent receive a task assignment and send a `task.reject` message with a valid reason code. Confirm the `EngineeringTask` transitions back to `Queued` state within 5 seconds. Confirm the `TaskLock` is released. Confirm the task is reassigned to the next eligible agent in the queue. **[BLOCKING]**

- [ ] **Graceful Shutdown Completes Before Force-Close** — Send a `SIGTERM` to a running agent process. Confirm the agent sends a `agent.draining` message to the server, completes any in-flight step (not the full task), sends a `agent.offline` message, and closes the WebSocket with code `1000 Normal Closure`. Confirm the server transitions the worker to `Draining` then `Offline` and reassigns the task. The entire sequence must complete within 30 seconds. **[BLOCKING]**

---

## 4. Workflow Validation

_10 items — verify business logic correctness across the task lifecycle._

- [ ] **Tasks Cannot Skip States** — Attempt to transition an `EngineeringTask` directly from `Draft` to `Running`, from `Queued` to `Completed`, and from `Assigned` to `Released` via the API. Confirm each attempt returns HTTP 422 with a `invalid_state_transition` error code. Confirm no state change is persisted and no event is published. **[BLOCKING]**

- [ ] **TaskLock Acquired Before State Mutation** — Review the implementation of every service method that mutates task state. Confirm each method acquires the `TaskLock` (with a TTL of at least 30 seconds) before any read-modify-write cycle. Confirm that a concurrent attempt to acquire the same lock is rejected with HTTP 409. Confirm the lock is released on success and on exception. **[BLOCKING]**

- [ ] **Events Published After DB Commit, Not Inside Transaction** — Search the codebase for all `dispatch()` or `event()` calls within the Engineering Cloud module. Confirm every domain event is dispatched using `afterCommit()` semantics (either Laravel's `dispatch()->afterCommit()` or within a `DB::afterCommit()` callback). No event may be published inside an open database transaction. **[BLOCKING]**

- [ ] **ReleaseCandidate Created Automatically on TaskCompleted** — Complete a task that has `release_eligible: true` configured. Confirm that a `ReleaseCandidate` record is created automatically in `Draft` state within the same request cycle (post-commit). Confirm the `ReleaseCandidateCreated` event is published. Confirm a `ReleaseBundle` is associated when all tasks in the bundle are completed. **[BLOCKING]**

- [ ] **Approval Quorum Enforced** — Configure a `ReleaseCandidate` requiring quorum of 2 approvals. Submit 1 approval and confirm the candidate remains in `UnderReview` state. Submit a second approval from a different approver and confirm the candidate transitions to `Approved`. Attempt to approve with the same approver twice and confirm the second approval is rejected. **[BLOCKING]**

- [ ] **Rollback Procedure Tested** — Promote a `ReleaseCandidate` to `Released` state. Trigger a rollback via the rollback API. Confirm the release transitions to `RolledBack`. Confirm the rollback event is published. Confirm the rollback procedure documented in the runbook produces the expected system state in a staging environment. **[BLOCKING]**

- [ ] **Pipeline Events Via Anti-Corruption Listener Only** — Search the module for all references to Pipeline domain classes. Confirm that the Engineering Cloud module never directly instantiates or calls Pipeline services. Confirm all pipeline-originated events are received exclusively through `PipelineEventAdapter` and translated into Engineering Cloud domain events before being processed. **[BLOCKING]**

- [ ] **Task Archived After Retention Period** — Confirm a scheduled job exists that transitions `Completed` and `Failed` tasks to `Archived` state after the configured retention period (default 90 days). Run the archival command against a test fixture and confirm the task state changes to `Archived`, the `task_state_transitions` record is written, and the task no longer appears in the default task list query. **[ADVISORY]**

- [ ] **Retry Count Enforced** — Configure a task with `max_retries: 3`. Cause the task to fail four times. Confirm the task is retried exactly 3 times (for a total of 4 attempts) and then transitions to `Failed` permanently after the fourth failure. Confirm no further retry is attempted. Confirm the `retry_count` field is correctly incremented in the `EngineeringTask` record. **[BLOCKING]**

- [ ] **Cancellation from Any Non-Terminal State Works** — Attempt to cancel a task in each of the following states: `Draft`, `Queued`, `Assigned`, `Accepted`, `Running`, `Paused`. Confirm each attempt succeeds and the task transitions to `Cancelled`. Confirm that attempting to cancel a task in `Completed`, `Failed`, `Cancelled`, `Released`, or `Archived` state returns HTTP 422. Confirm the assigned agent is notified of cancellation via WebSocket. **[BLOCKING]**

---

## 5. Data Integrity Validation

_10 items — verify the database schema and runtime data guarantees._

- [ ] **company_id Present and Indexed on All Tables** — Run `\d` or equivalent introspection on every table created by Engineering Cloud migrations. Confirm `company_id UUID NOT NULL` is present on every table. Confirm a B-tree index on `company_id` exists on every table. Any table missing the column or index is a blocker regardless of whether a global scope exists at the application layer. **[BLOCKING]**

- [ ] **Soft Deletes on All Main Entities** — Confirm that `deleted_at TIMESTAMP NULL` is present on the tables backing these entities: `EngineeringTask`, `EngineeringAgent`, `EngineeringWorker`, `ExecutionSession`, `Workspace`, `ReleaseCandidate`, `ReleaseBundle`. Confirm all Eloquent models use `SoftDeletes`. Confirm a `DELETE` request does not permanently destroy the record. **[BLOCKING]**

- [ ] **Audit Fields on All Tables** — Confirm `created_at`, `updated_at`, `created_by` (UUID, nullable), and `updated_by` (UUID, nullable) columns are present on every main entity table. Confirm the application populates `created_by` and `updated_by` from the authenticated actor on every write. **[BLOCKING]**

- [ ] **Optimistic Locking Incremented on Every Mutation** — Confirm a `lock_version INTEGER NOT NULL DEFAULT 0` column exists on `EngineeringTask`, `Workspace`, and `ReleaseCandidate`. Confirm every update increments `lock_version` and includes `WHERE lock_version = :expected_version` in the UPDATE statement. Confirm a stale-version update returns HTTP 409 Conflict with a `version_conflict` error code. **[BLOCKING]**

- [ ] **WorkspaceLock TTL Enforced** — Create a `WorkspaceLock` with a known TTL. Confirm that after the TTL expires, the lock is automatically released by the scheduled lock-reaper job. Confirm the reaper runs at least every 60 seconds. Confirm a worker that holds a lock and stops sending heartbeats has its lock released within TTL + 10 seconds. **[BLOCKING]**

- [ ] **Foreign Key Constraints Active** — Confirm PostgreSQL foreign key constraints are defined and active (not deferred) between all related tables. Specifically verify: `engineering_tasks.workspace_id → workspaces.id`, `execution_sessions.task_id → engineering_tasks.id`, `execution_sessions.worker_id → engineering_workers.id`, `task_locks.task_id → engineering_tasks.id`, `release_candidates.bundle_id → release_bundles.id`. Attempt to insert an orphaned record and confirm the database rejects it. **[BLOCKING]**

- [ ] **Partition Tables Created for event_log and execution_logs** — Confirm that `engineering_event_log` and `engineering_execution_logs` are partitioned tables (range partitioning by month on `created_at`). Confirm at least 3 future partitions exist at deployment time. Confirm a partition maintenance job is scheduled to create new partitions monthly. **[BLOCKING]**

- [ ] **All UUID Primary Keys** — Confirm that every table in the Engineering Cloud schema uses UUID primary keys (PostgreSQL `uuid` type, not auto-increment integer). Confirm UUID generation is handled at the application layer using UUID v4 and not delegated to `uuid_generate_v4()` in PostgreSQL, consistent with the project convention. **[BLOCKING]**

- [ ] **task_state_transitions Records Every State Change** — Trigger a task through its complete lifecycle from `Draft` to `Archived`. Query `task_state_transitions` and confirm a row exists for every state change, with correct `from_state`, `to_state`, `transitioned_at`, `transitioned_by` (actor UUID), and `reason` fields. Confirm no state change occurs in the application without a corresponding `task_state_transitions` row. **[BLOCKING]**

- [ ] **No Orphaned Records After Cascade Operations** — Delete (soft-delete) a `Workspace` and confirm all associated `WorkspaceLock`, `ExecutionSession`, and `ExecutionLog` records are either soft-deleted or have their foreign key set to NULL per the defined cascade policy. Delete an `EngineeringTask` and confirm `TaskDependency`, `TaskComment`, `TaskAttachment`, `TaskArtifact`, and `TaskLock` records follow the same policy. Run the orphan-detection query from the runbook and confirm zero orphans. **[BLOCKING]**

---

## 6. Integration Validation

_10 items — verify all cross-system integrations are correctly bounded and isolated._

- [ ] **Release Manager Integration Via EngineeringReleaseBridge Only** — Search the Engineering Cloud module codebase for any direct instantiation of or dependency on Release Manager service classes or repositories. Confirm zero direct references exist. Confirm all interactions with the Release Manager flow through `EngineeringReleaseBridge` as the sole integration point. **[BLOCKING]**

- [ ] **Pipeline Events Via PipelineEventAdapter Only** — Search the Engineering Cloud module for any direct imports from the Pipeline module's namespace. Confirm zero direct references exist. Confirm all pipeline-originated events are consumed through `PipelineEventAdapter`, which translates them into Engineering Cloud domain events. **[BLOCKING]**

- [ ] **Analytics Via KpiService Pattern** — Confirm that Engineering Cloud exposes analytics data by implementing the `KpiService` interface and registering the service with the `KpiBusinessRules` registry. Confirm the Engineering Cloud module does not directly query the Analytics module's tables or call the Analytics module's services. **[BLOCKING]**

- [ ] **Notifications Via Existing NotificationService** — Confirm that all user-facing notifications (task assigned, task failed, release approved, etc.) are dispatched through the existing project `NotificationService` and not through a custom notification channel created by the Engineering Cloud module. **[ADVISORY]**

- [ ] **Zero Modifications to Release Manager Source** — Run `git diff --name-only origin/main -- backend/Modules/Engineering/ReleaseManager/`. Confirm the output is empty. If any files appear, the PR must be rejected and the changes extracted into a separate Release Manager PR with independent architecture review. **[BLOCKING]**

- [ ] **Zero Modifications to Pipeline Source** — Run `git diff --name-only origin/main -- backend/Modules/Engineering/Pipeline/`. Confirm the output is empty. If any files appear, the PR must be rejected and changes extracted into a separate Pipeline PR with independent architecture review. **[BLOCKING]**

- [ ] **Zero Modifications to Analytics Source** — Run `git diff --name-only origin/main -- backend/Modules/Engineering/Analytics/`. Confirm the output is empty. Any analytics changes required by Engineering Cloud must be proposed as additive extensions through the `KpiService` pattern and reviewed separately. **[BLOCKING]**

- [ ] **company_id Passed in All Integration Calls** — Review every call to `EngineeringReleaseBridge`, `PipelineEventAdapter`, `KpiService`, and `NotificationService` made from within the Engineering Cloud module. Confirm `company_id` is passed as an explicit parameter in every call and is never inferred from global state inside the integration layer. **[BLOCKING]**

- [ ] **Integration Failures Handled Gracefully** — Simulate a failure (timeout, exception) from each of the four integration points: Release Manager bridge, Pipeline adapter, KpiService, and NotificationService. Confirm the Engineering Cloud module catches each failure, logs it with structured context, and returns a meaningful error to the caller without leaking internal stack traces. Confirm the primary operation either rolls back cleanly or succeeds with a degraded-mode flag. **[BLOCKING]**

- [ ] **Circuit Breaker or Fallback in Place** — Confirm a circuit breaker (or documented fallback behavior) is implemented for the Release Manager bridge and Pipeline adapter integrations. Confirm the circuit opens after 5 consecutive failures within 60 seconds and returns a cached or degraded response. Confirm the circuit closes automatically after 30 seconds and tests the upstream service with a single probe request. **[ADVISORY]**

---

## 7. Performance Validation

_10 items — verify the platform meets its latency and throughput SLOs under realistic load._

- [ ] **WebSocket Message Processing P95 Under 50ms** — Using a load test with at least 100 concurrent agents sending messages at their normal rate, measure the time from message receipt to acknowledgment dispatch. Confirm the P95 latency is below 50ms. Use a tool such as k6 or Artillery targeting the WebSocket endpoint. Record results and attach to the deployment record. **[BLOCKING]**

- [ ] **Task Assignment Latency P95 Under 100ms** — Measure the time from when a task enters `Queued` state to when the assigned agent receives the `task.assigned` WebSocket message, under a load of 50 concurrent tasks. Confirm P95 is below 100ms. Confirm the scheduler cycle is the primary contributor and does not introduce unnecessary delay. **[BLOCKING]**

- [ ] **Workspace Provisioning from Warm Pool Under 10 Seconds** — With a warm workspace pool pre-populated with at least 5 ready instances, request a new workspace allocation and measure the time from API request receipt to the workspace reaching `Active` state. Confirm P95 is below 10 seconds across 20 successive allocations. **[BLOCKING]**

- [ ] **Workspace Cold Start Under 60 Seconds** — With the warm pool exhausted, request a new workspace and measure the time from API request receipt to the workspace reaching `Active` state including full provisioning. Confirm P95 is below 60 seconds across 5 successive cold starts. **[ADVISORY]**

- [ ] **API Endpoint P95 Under 200ms** — Run a load test against the 10 most frequently called API endpoints (task list, task detail, worker status, session detail, artifact list, queue depth, release candidate list, workspace list, health, metrics) with at least 50 concurrent users. Confirm P95 response time is below 200ms for each endpoint. **[BLOCKING]**

- [ ] **Scheduler Cycle Under 3 Seconds** — Observe the task scheduler loop under a load of 500 queued tasks across 20 workers. Measure the time from the start of one scheduling cycle to the start of the next. Confirm every cycle completes in under 3 seconds. Confirm no locking contention is observed in the database during the cycle. **[BLOCKING]**

- [ ] **Heartbeat ACK Within 5 Seconds** — With 200 concurrent connected agents each sending heartbeats, measure the time from heartbeat send to ACK receipt at the agent. Confirm P95 is below 5 seconds. Confirm no heartbeats are dropped or delayed beyond 5 seconds during normal operation. **[BLOCKING]**

- [ ] **Artifact Upload Presigned URL Under 500ms** — Request a presigned upload URL for an artifact from the API under normal load. Measure the time from API request to response. Confirm P95 is below 500ms. Confirm the presigned URL is valid for the configured duration (minimum 15 minutes) and points to the correct storage bucket for the company. **[ADVISORY]**

- [ ] **Dashboard Query P95 Under 500ms** — Run the Engineering Cloud dashboard API endpoint (aggregate task counts, worker status summary, queue depth, recent events) under a load of 20 concurrent dashboard viewers. Confirm P95 is below 500ms. Confirm Redis caching is active and cache hit rate is above 80% in steady state. **[BLOCKING]**

- [ ] **Event Publication Under 100ms** — Measure the time from the application calling the event dispatch (post-commit) to the event appearing in the event log table and being delivered to the first registered listener. Confirm P95 is below 100ms under normal load. Confirm the event bus does not introduce synchronous blocking in the request lifecycle. **[BLOCKING]**

---

## 8. Documentation Validation

_10 items — verify the documentation suite is complete, consistent, and accurate._

- [ ] **ADR-020 Through ADR-029 All Present and Marked Approved** — List all files in `docs/engineering-cloud/` matching the pattern `ADR-0[2][0-9]-*.md`. Confirm all 10 ADRs (ADR-020 through ADR-029) exist. Confirm each document's status header reads `Status: Approved`. Confirm each has a version, date, and named decision-maker. Any missing or non-Approved ADR is a blocker. **[BLOCKING]**

- [ ] **Domain Model Covers All 20 Entities** — Open `docs/engineering-cloud/domain-model.md`. Confirm the document describes all 20 canonical entities with their attributes, aggregate root status, relationships, and invariants. Confirm no entity from the canonical vocabulary is absent. Confirm no entity appears in the implementation that is absent from the domain model. **[BLOCKING]**

- [ ] **Database Design Matches Actual Schema** — Compare `docs/engineering-cloud/database-design.md` against the actual PostgreSQL schema produced by running all migrations in a clean environment. Confirm every table, column, type, constraint, and index documented matches the actual schema. Any discrepancy is a blocker. **[BLOCKING]**

- [ ] **State Machines Match Implementation** — Open `docs/engineering-cloud/state-machines.md`. For each of the four state machines (Task, Worker, Workspace, ExecutionSession), confirm every documented state and transition matches the implementation's state transition guard logic. Confirm no undocumented transitions exist in the implementation. **[BLOCKING]**

- [ ] **API Contracts Match Implemented Endpoints** — Open `docs/engineering-cloud/api-contracts.md`. For every documented endpoint, confirm the route, method, authentication requirement, request body schema, response body schema, and error codes match what the implemented controller produces. Use automated contract testing where possible. **[BLOCKING]**

- [ ] **WebSocket Protocol Matches Implementation** — Open `docs/engineering-cloud/websocket-protocol.md`. For every message type (inbound and outbound), confirm the documented message envelope, field names, field types, and behavioral description match the implemented WebSocket handler. **[BLOCKING]**

- [ ] **Sequence Diagrams Reviewed and Accurate** — Review each sequence diagram in `docs/engineering-cloud/` against the actual call sequence observable in integration tests or tracing. Confirm actor names, message names, and ordering are accurate. Diagrams showing incorrect sequences must be corrected before deployment, as they will be used as runbook references. **[ADVISORY]**

- [ ] **ENGINEERING-CLOUD.md Is Entry Point with Working Links** — Open `docs/engineering-cloud/ENGINEERING-CLOUD.md`. Confirm it exists and provides a structured index to all other documents in the suite. Confirm every internal link resolves to an existing file. Confirm the document describes the purpose of the platform, the scope, and the intended audience. **[BLOCKING]**

- [ ] **All Documents Have Version and Date** — Open each `.md` file in `docs/engineering-cloud/`. Confirm every document has a `Version:` field and a `Date:` field in its header. Confirm the date reflects the last substantive change. Documents without version and date metadata cannot be treated as authoritative during incident response. **[ADVISORY]**

- [ ] **No Contradictions Between Documents** — Cross-reference the following pairs for consistency: domain model vs. database design (entity/table alignment), state machines vs. API contracts (state values in request/response), ADR-028 event catalog vs. domain model (event list completeness), WebSocket protocol vs. sequence diagrams (message names and order). Any factual contradiction between documents is a blocker. **[BLOCKING]**

---

## 9. Operational Readiness

_10 items — verify the platform can be operated, monitored, and recovered in production._

- [ ] **Health Endpoints on All Components** — Confirm a `GET /engineering-cloud/health` endpoint exists and returns HTTP 200 with a structured JSON body reporting status of all dependencies: database connectivity, Redis connectivity, WebSocket server, queue worker, scheduler, and storage. Confirm the endpoint is accessible from the infrastructure monitoring system without authentication. **[BLOCKING]**

- [ ] **All Critical Alerts Configured** — Confirm the following alerts are configured in the monitoring system with documented thresholds and notification channels: task queue depth exceeds 500 for more than 5 minutes, worker offline count exceeds 20% of registered workers, WebSocket connection error rate exceeds 5%, API error rate (5xx) exceeds 1%, heartbeat miss rate exceeds 10%, workspace provisioning failure rate exceeds 20%. **[BLOCKING]**

- [ ] **Runbooks Exist for All Failure Scenarios** — Confirm runbooks exist in `docs/engineering-cloud/runbooks/` for each of the following scenarios: task stuck in `Assigned` state, worker unresponsive (missed heartbeats), workspace provisioning failure, WebSocket server restart, database failover during active sessions, queue backlog clearance, release rollback, agent key revocation. Each runbook must include prerequisites, step-by-step procedure, and expected outcome. **[BLOCKING]**

- [ ] **Log Format Is JSON with Required Fields** — Tail the application log during a test run and confirm every log line is valid JSON containing at minimum: `timestamp` (ISO 8601), `level`, `message`, `module` (`engineering-cloud`), `company_id` (when request-scoped), `trace_id`, and `span_id`. Confirm no plaintext log lines are emitted by the Engineering Cloud module. **[BLOCKING]**

- [ ] **Prometheus Metrics Endpoint Exposed** — Confirm a `GET /metrics` endpoint (or equivalent scrape target) exposes Prometheus-formatted metrics for: active WebSocket connections, task queue depth by state, worker count by state, workspace count by state, API request duration histogram, event publication rate, and scheduler cycle duration. Confirm the metrics are scraped successfully by the monitoring system. **[ADVISORY]**

- [ ] **Graceful Shutdown Implemented on All Processes** — Send `SIGTERM` to the WebSocket server process, the queue worker process, and the scheduler process individually. Confirm each: stops accepting new work, completes in-flight operations (within a 30-second window), flushes buffered state, and exits with code 0. Confirm no tasks are lost or left in an inconsistent state after a clean shutdown. **[BLOCKING]**

- [ ] **Backup Restore Procedure Tested** — Execute the documented backup restore procedure against a staging environment using a recent backup of the Engineering Cloud tables. Confirm the restored environment passes the data integrity checks in Section 5. Confirm the restoration completes within the documented RTO. Document the test result with timestamp and restorer identity. **[BLOCKING]**

- [ ] **RTO Under 15 Minutes Achievable** — Using the documented recovery procedure (runbook reference required), demonstrate in a staging environment that the Engineering Cloud platform can be restored from a complete failure (database corruption or infrastructure loss) to a fully operational state within 15 minutes. Record the actual recovery time and attach to the deployment record. **[BLOCKING]**

- [ ] **On-Call Escalation Path Documented** — Confirm `docs/engineering-cloud/on-call.md` exists and defines: primary on-call role, secondary escalation contact, escalation triggers (time thresholds, severity criteria), communication channels (Slack channel, paging tool), and bridge/war-room procedure. Confirm the document has been reviewed and acknowledged by the named contacts. **[BLOCKING]**

- [ ] **Zero-Downtime Deployment Procedure Tested** — Deploy a minor version update to the Engineering Cloud module in a staging environment while 10 simulated agents are actively connected and processing tasks. Confirm no WebSocket connections are dropped during the deployment. Confirm no tasks transition to `Failed` due to the deployment. Confirm all agents resume normal operation within 60 seconds of deployment completion. **[BLOCKING]**

---

## 10. Future Readiness

_10 items — verify the platform is extensible and does not encode assumptions that will become technical debt._

- [ ] **Protocol Version Field in All WebSocket Messages** — Confirm every WebSocket message envelope (inbound and outbound) includes a `version` field set to the current protocol version string (e.g., `"1.0"`). Confirm the server validates the `version` field and returns a `4004 Protocol Violation` close frame for unsupported versions. Confirm the version negotiation path is tested. **[BLOCKING]**

- [ ] **API Version in URL** — Confirm all Engineering Cloud API routes are prefixed with a version segment (e.g., `/api/v1/engineering-cloud/`). Confirm no unversioned routes exist for public-facing endpoints. Confirm the routing layer can support a `/api/v2/` prefix in the future without modifying existing v1 routes. **[BLOCKING]**

- [ ] **Event schema_version Present** — Confirm every domain event class includes a `schema_version` property (e.g., `public string $schemaVersion = '1.0'`). Confirm the event envelope stored in `engineering_event_log` includes the `schema_version` value. Confirm event consumers check `schema_version` and have a documented upgrade path for handling future schema changes. **[BLOCKING]**

- [ ] **No Hardcoded Company IDs** — Search the entire Engineering Cloud module codebase for UUID literals that match any known company ID in the system. Confirm zero hardcoded company UUIDs exist in any service, repository, factory, seeder, or test fixture used in production code paths. All company scoping must derive from the authenticated request context. **[BLOCKING]**

- [ ] **No Hardcoded Agent Type Logic (Capability-Driven)** — Search the scheduler, assignment engine, and task routing logic for any conditional branches that check a literal agent type string (e.g., `if ($agent->type === 'ci-runner')`). Confirm zero such branches exist. All routing decisions must be driven by `WorkerCapability` records, allowing new agent types to be added without modifying core scheduling logic. **[BLOCKING]**

- [ ] **Workspace Isolation Level Configurable** — Confirm the workspace isolation level (e.g., container, VM, namespace) is defined in a configuration file or environment variable, not hardcoded in the provisioning service. Confirm changing the isolation level in configuration changes the provisioning behavior without requiring code changes. **[ADVISORY]**

- [ ] **Queue Tiers Configurable** — Confirm the number of queue tiers, their names, and their priority weights are defined in a configuration file. Confirm adding a new queue tier requires only a configuration change and a migration, not changes to the scheduler or dispatcher logic. **[ADVISORY]**

- [ ] **Timeouts in Config Files** — Search the Engineering Cloud module for hardcoded numeric literals representing time durations (registration timeout, heartbeat interval, lock TTL, backoff limits, JWT expiry, presigned URL duration, scheduler cycle interval). Confirm each is referenced from a named configuration key (e.g., `config('engineering-cloud.agent.registration_timeout_seconds')`). Confirm the configuration file provides documented defaults for every timeout. **[BLOCKING]**

- [ ] **Agent Types Extensible Without Core Changes** — Document the procedure for adding a new agent type. Confirm the procedure requires only: registering new `WorkerCapability` entries, creating a task template with matching capability requirements, and optionally creating a new agent implementation that registers with the existing `agent.register` protocol. Confirm no changes to the scheduler, dispatcher, session manager, or WebSocket handler are required. **[ADVISORY]**

- [ ] **New Event Types Addable Without Breaking Existing Consumers** — Add a new domain event to the Engineering Cloud module in a test branch without modifying any existing event class or event handler. Confirm the new event publishes successfully. Confirm all existing event consumers continue to function without modification. Confirm the event is recorded in `engineering_event_log` with its `schema_version`. This validates the open/closed principle for the event bus. **[BLOCKING]**

---

## Checklist Summary Table

| Category | Total Items | Blocking Items | Advisory Items | Responsible Team |
|---|---|---|---|---|
| 1. Architecture Validation | 12 | 12 | 0 | Engineering Architecture |
| 2. Security Validation | 12 | 12 | 0 | Security Engineering |
| 3. Agent Protocol Validation | 10 | 9 | 1 | Platform Engineering |
| 4. Workflow Validation | 10 | 9 | 1 | Backend Engineering |
| 5. Data Integrity Validation | 10 | 10 | 0 | Database Engineering |
| 6. Integration Validation | 10 | 8 | 2 | Integration Engineering |
| 7. Performance Validation | 10 | 7 | 3 | Performance Engineering |
| 8. Documentation Validation | 10 | 8 | 2 | Engineering Leads |
| 9. Operational Readiness | 10 | 9 | 1 | SRE / DevOps |
| 10. Future Readiness | 10 | 6 | 4 | Engineering Architecture |
| **TOTAL** | **104** | **90** | **14** | |

---

> **Sign-off requirement:** All 90 BLOCKING items must be checked and verified by named individuals before a deployment approval is issued. Advisory items may be deferred with a written waiver specifying the responsible owner and remediation date. The completed checklist must be committed to `docs/engineering-cloud/verification-results/YYYY-MM-DD-vX.Y.md` and linked in the deployment PR description.
