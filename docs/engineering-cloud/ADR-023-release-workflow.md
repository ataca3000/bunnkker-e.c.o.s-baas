# ADR-023 — Release Workflow

**Status:** Approved
**Date:** 2026-07-22
**Author:** Engineering Platform Team
**Reviewers:** CTO, Engineering Lead

---

## 1. Context

Engineering tasks in the ECOS-ERP Engineering Cloud complete inside isolated workspaces and produce artifacts. Without a defined workflow, the path from a completed EngineeringTask to deployed production code is ambiguous, error-prone, and lacks accountability.

This ADR defines the canonical, end-to-end release workflow from task completion through production deployment. It integrates with the existing Release Manager (TASK-ENG-006) and Enterprise Pipeline Platform (TASK-ENG-007) as external systems — reading their state and writing through anti-corruption bridge layers — without modifying their internal logic.

### Constraints

- The Release Manager is a frozen system; no direct schema or code modifications are permitted.
- The Enterprise Pipeline Platform is a frozen system; integration is read-only event subscription only.
- All entities use UUID primary keys and are scoped by `company_id`.
- Actor identity is always recorded; anonymous transitions are rejected.
- PostgreSQL is the single source of truth; Redis is used for ephemeral state only.

### Goals

1. Provide a single, auditable path from `EngineeringTask.status = Completed` to production.
2. Enforce approval gates calibrated to release risk level.
3. Notify the right parties at the right stage through the right channel.
4. Support rollback at every stage with a clear procedure.
5. Produce an immutable audit trail across all six stages.

---

## 2. Workflow Overview

The release workflow consists of six sequential stages. Each stage has defined entry criteria, responsible parties, and exit criteria. No stage may be skipped except under an approved emergency override (see Section 5).

```
Stage 1           Stage 2             Stage 3               Stage 4                  Stage 5           Stage 6
EngineeringTask   Engineering Inbox   ReleaseCandidate       Release Manager           Pipeline          Production
(Completed)  -->  (Review Queue)  --> (Approval Gates)  --> (Integration via Bridge) --> (Monitoring) --> (Deployed)
```

### Stage Summary

| Stage | Name | Owner | Key Action |
|-------|------|-------|------------|
| 1 | Task Completion | EngineeringAgent / EngineeringWorker | Artifact packaging, ReleaseCandidate creation |
| 2 | Engineering Inbox | EngineeringLead | Code review, quality gate |
| 3 | Release Candidate | Engineering Team + Approvers | Approval gate, bundle preparation |
| 4 | Release Manager Integration | EngineeringReleaseBridge | Anti-corruption write to Release Manager |
| 5 | Pipeline Integration | PipelineRun subscriber | Event subscription, monitoring only |
| 6 | Production | Engineering Lead + Ops | Deployment confirmation, archival, notification |

---

## 3. Stage Detail Sections

---

### Stage 1 — Task Completion

#### Entry Criteria

- `EngineeringTask.status` transitions to `Completed`.
- At least one `TaskArtifact` record is associated with the task and in a valid (non-expired) state.
- The `ExecutionSession` that ran the task is in `Completed` state.
- The `WorkspaceLock` held during execution has been released.
- All `TaskDependency` records for this task show their upstream tasks as `Completed` or `Released`.

#### Responsible Parties

- **EngineeringAgent** — triggers the post-completion hook automatically on status transition.
- **EngineeringWorker** — supplies the final `ExecutionLog` and artifact manifest.
- **Engineering Platform** — orchestrates the transition; no human action required at this stage.

#### Actions Performed

1. The `EngineeringAgent` finalises the `ExecutionSession`, setting it to `Completed` and recording the terminal `ExecutionLog` entry.
2. All `TaskArtifact` records produced during the session are sealed (hash computed, size recorded, storage path confirmed).
3. A `ReleaseCandidate` record is created in `Draft` state, linked to the `EngineeringTask` via `engineering_task_id`.
4. The `ReleaseCandidate` is populated with: task metadata, artifact list, originating workspace reference, originating worker reference, and the computed release type (hotfix / patch / minor / major) derived from branch naming conventions.
5. A `TaskLock` is placed on the `EngineeringTask` preventing re-execution until the release workflow concludes.
6. A `TaskCreated`-pattern domain event `ReleaseCandidateCreated` is dispatched to notify the Engineering Inbox.
7. The `Workspace` transitions to `Idle` pending archival decision.

#### Output Produced

- `ReleaseCandidate` record (status: `Draft`)
- `ReleaseCandidateCreated` event (dispatched to event bus)
- Sealed `TaskArtifact` records
- `TaskLock` on the parent `EngineeringTask`
- `ExecutionLog` final entry

#### Exit Criteria

- `ReleaseCandidate` record persisted with status `Draft`.
- `ReleaseCandidateCreated` event confirmed dispatched.
- `EngineeringTask` carries an active `TaskLock`.

#### SLA

- Target duration: **≤ 5 minutes** (automated; no human action).
- Alert threshold: > 10 minutes without a `ReleaseCandidate` record created.

#### Failure Handling

- If artifact sealing fails (hash mismatch, missing file), the `EngineeringTask` is moved to `Failed` and a `TaskFailed` event is dispatched. The Engineering Lead is notified immediately. No `ReleaseCandidate` is created.
- If the `ReleaseCandidate` record cannot be persisted (database error), the system retries with exponential backoff (3 attempts, 30 s ceiling). On final failure, the task remains `Completed` and an alert is raised to the Engineering Platform team.
- If dependency tasks are not in the expected terminal state, the workflow is paused and the Engineering Lead is notified to resolve the dependency conflict manually.

---

### Stage 2 — Engineering Inbox

#### Entry Criteria

- `ReleaseCandidate.status = Draft`.
- `ReleaseCandidateCreated` event received by the Inbox subscriber.
- At least one `EngineeringLead` is available (not `Offline` or `Terminated`).

#### Responsible Parties

- **EngineeringLead** — primary reviewer; must be a human actor with the `engineering_lead` role.
- **Engineering Platform** — surfaces the Inbox UI; records all review actions as `TaskComment` and `ExecutionLog` entries.

#### Actions Performed

1. The `ReleaseCandidate` appears in the Engineering Inbox review queue, ordered by creation timestamp ascending (oldest first) within the same `company_id`.
2. The EngineeringLead opens the candidate and reviews against four criteria:

   - **Code Quality** — adherence to ECOS-ERP coding standards; no dead code; no debug artifacts; naming conventions followed.
   - **Test Coverage** — all changed modules have associated test evidence in `TaskArtifact`; coverage threshold met per release type.
   - **Architectural Compliance** — DDD module boundaries respected; no cross-module direct imports; event naming follows PascalCase past-tense convention; no modifications to frozen systems.
   - **Security** — no hardcoded secrets; no raw SQL without parameterisation; no disabled authentication middleware; no exposed internal APIs.

3. The EngineeringLead selects one of three dispositions:

   - **Approve** — candidate advances to Stage 3. A `TaskComment` records the rationale.
   - **Reject** — candidate is returned to the originating `EngineeringAgent` with structured feedback. The `ReleaseCandidate` is set to a terminal `Rejected` sub-state (outside the canonical six states). The `EngineeringTask` is moved back to `Draft` and the `TaskLock` is lifted. The agent must address feedback and re-complete the task, restarting from Stage 1.
   - **Defer** — candidate is removed from the active queue and timestamped for re-review at a specified future date. The `EngineeringTask` retains its `TaskLock`. A reminder is scheduled via the notification system.

4. All three dispositions are recorded as immutable audit entries (see Section 7).

#### Output Produced

- `ReleaseCandidate.status` updated to `UnderReview` (on open) and then to `Approved` (on approval) or annotated as Rejected/Deferred.
- `TaskComment` recording the review decision and rationale.
- Audit entry: `InboxReviewCompleted`.
- Notification to originating `EngineeringAgent` and `EngineeringWorker` of the decision.

#### Exit Criteria

- Disposition is recorded and persisted.
- If Approved: `ReleaseCandidate.status = UnderReview` transitioning toward `Approved` at Stage 3 gate.
- If Rejected: `EngineeringTask.status = Draft`; `TaskLock` lifted.
- If Deferred: re-review timestamp set; notification scheduled.

#### SLA

- Target duration: **≤ 4 business hours** from Inbox arrival to disposition.
- Alert threshold: > 8 business hours without disposition.
- Escalation: Engineering Manager notified at 8-hour threshold; automatic escalation to CTO at 24 hours.

#### Failure Handling

- If no EngineeringLead is available within 2 business hours, the Engineering Manager receives an escalation notification and may either assign a temporary reviewer or approve a bypass with documented justification (recorded in audit trail).
- If the Inbox UI fails to render the candidate, the EngineeringLead may submit a disposition via the Engineering API directly; all actions are API-first.

---

### Stage 3 — Release Candidate

#### Entry Criteria

- EngineeringLead has approved in Stage 2.
- `ReleaseCandidate.status` is `UnderReview` (set when the approval gate process begins).
- Approval quorum configuration is loaded for the candidate's `company_id` and `release_type`.

#### Responsible Parties

- **Approvers** — humans with the `release_approver` role, quantity determined by release type.
- **EngineeringLead** — may be one of the approvers depending on configuration.
- **Engineering Platform** — tracks approvals, enforces quorum, manages bundle preparation.

#### Release Candidate States

The `ReleaseCandidate` entity follows this state machine:

```
Draft --> UnderReview --> Approved --> Staged --> Released
                     \                        \
                      --> Rejected (terminal)   --> RolledBack (terminal)
```

| State | Description |
|-------|-------------|
| `Draft` | Automatically created at Stage 1; awaiting Inbox review. |
| `UnderReview` | Inbox approved; approval gate is open and collecting approvals. |
| `Approved` | Quorum of approvers reached; bundle preparation begins. |
| `Staged` | `ReleaseBundle` prepared; handed to Release Manager (Stage 4). |
| `Released` | Pipeline confirmed successful deployment (Stage 6). |
| `RolledBack` | Production rollback executed; candidate is terminal. |

#### Approval Gate

Approval quorum is configured per `company_id` and `release_type`:

| Release Type | Required Approvers | Notes |
|---|---|---|
| Hotfix | 1 | Speed-optimised; single senior approver sufficient. |
| Patch | 2 | Standard gate; two independent approvers. |
| Minor | 2 | Standard gate; architectural compliance check mandatory. |
| Major | 2 | Standard gate + mandatory CTO sign-off recorded as a third approval. |
| Staging (non-production) | 0 | Auto-approved; no human gate. Audit entry still written. |

- Approvals are recorded individually with actor identity, timestamp, and optional comment.
- Approvals from the same actor count once regardless of how many times submitted.
- An approver who was the originating `EngineeringAgent` (i.e., authored the task) is ineligible to approve their own candidate.
- Emergency override (any gate, any release type) requires explicit CTO approval recorded in the audit trail. See Section 5.

#### Bundle Preparation

Once quorum is reached, `ReleaseCandidate.status` transitions to `Approved` and bundle preparation begins:

1. A `ReleaseBundle` record is created, linked to the `ReleaseCandidate`.
2. All `TaskArtifact` records associated with the `EngineeringTask` are included in the bundle manifest.
3. Additional metadata is attached: changelog entries derived from `TaskComment` records, migration file list, configuration delta, and rollback instructions.
4. The `ReleaseBundle` is assigned a monotonically increasing bundle version number within `company_id`.
5. A bundle integrity hash is computed across all included artifacts.
6. `ReleaseCandidate.status` transitions to `Staged` upon successful bundle creation.

#### Output Produced

- Approval records (one per approver).
- `ReleaseCandidate.status = Staged`.
- `ReleaseBundle` record with full artifact manifest and integrity hash.
- `ReleaseCandidateApproved` and `ReleaseBundlePrepared` domain events.

#### Exit Criteria

- `ReleaseCandidate.status = Staged`.
- `ReleaseBundle` integrity hash verified.
- `ReleaseBundlePrepared` event dispatched.

#### SLA

- Time to quorum: **≤ 2 business hours** for Hotfix; **≤ 8 business hours** for all other types.
- Bundle preparation: **≤ 15 minutes** (automated).
- Alert threshold: quorum not reached within half the SLA period.

#### Failure Handling

- If bundle preparation fails (artifact missing or hash mismatch), the `ReleaseCandidate` returns to `Approved` state and the Engineering Lead is notified. The system retries once automatically after 5 minutes.
- If quorum is not reached within the SLA, the Engineering Manager is notified and may grant a time extension or escalate to emergency override.
- If an approver is found ineligible after submission (e.g., discovered to be the task author), their approval is voided and the remaining approvers are notified to re-evaluate quorum.

---

### Stage 4 — Release Manager Integration

#### Entry Criteria

- `ReleaseCandidate.status = Staged`.
- `ReleaseBundle` integrity verified.
- `ReleaseBundlePrepared` event received by the `EngineeringReleaseBridge`.

#### Responsible Parties

- **EngineeringReleaseBridge** — anti-corruption layer; the sole component authorised to write to the Release Manager. No other component may call Release Manager internals directly.
- **Release Manager** (existing system) — receives the bundle and manages its internal scheduling logic without modification.

#### Integration Method

The `EngineeringReleaseBridge` is a dedicated service class that:

1. Subscribes to `ReleaseBundlePrepared` events from the Engineering Cloud event bus.
2. Translates the `ReleaseBundle` into the Release Manager's expected input contract. This translation is the sole responsibility of the bridge; if the Release Manager's contract changes, only the bridge is updated.
3. Writes to the Release Manager through its published API interface (not via direct database access or internal service calls).
4. Records the Release Manager's response (reference ID, scheduled timestamp, assigned release coordinator) back into the Engineering Cloud's own `PipelineArtifact` table for traceability.
5. Updates `ReleaseCandidate` metadata with the Release Manager's reference ID.
6. Dispatches a `ReleaseManagerHandoffCompleted` domain event.

The bridge enforces a strict one-way write: Engineering Cloud → Release Manager. The Release Manager does not call back into the Engineering Cloud directly; status updates flow through event subscription in Stage 5.

#### Output Produced

- Release Manager entry created (reference ID recorded).
- `PipelineArtifact` record linking the `ReleaseCandidate` to the Release Manager reference.
- `ReleaseManagerHandoffCompleted` event dispatched.
- `ReleaseCandidate` metadata updated with Release Manager reference ID.

#### Exit Criteria

- Release Manager confirms receipt (HTTP 2xx or equivalent acknowledgement).
- `ReleaseManagerHandoffCompleted` event dispatched.
- `PipelineArtifact` persisted with the Release Manager reference ID.

#### SLA

- Target duration: **≤ 10 minutes** (automated; synchronous call with retry).
- Alert threshold: > 20 minutes without confirmed handoff.

#### Failure Handling

- If the Release Manager API is unavailable, the bridge retries with exponential backoff: 3 attempts at 1 min, 5 min, 15 min intervals.
- On final retry failure, the Engineering Lead and Engineering Manager are notified. The `ReleaseCandidate` remains in `Staged` state. Manual intervention is required to retry or roll back.
- If the Release Manager rejects the bundle (validation failure on its side), the `EngineeringReleaseBridge` captures the rejection reason and raises a `ReleaseBundleRejectedByReleaseManager` event. The Engineering Lead is notified with the rejection detail. The `ReleaseCandidate` returns to `Approved` state for re-bundling.

---

### Stage 5 — Pipeline Integration

#### Entry Criteria

- `ReleaseManagerHandoffCompleted` event confirmed.
- The Release Manager has scheduled the release and triggered the Enterprise Pipeline Platform.
- A `PipelineRun` event is emitted by the existing Pipeline Platform.

#### Responsible Parties

- **Engineering Platform** (read-only subscriber) — listens to Pipeline events; creates internal `PipelineRun` tracking records.
- **Pipeline Platform** (existing system) — executes the pipeline without modification. The Engineering Cloud does not call Pipeline internals.
- **EngineeringLead** — monitors pipeline progress; may intervene through the Pipeline Platform's own interface.

#### Integration Method

The Engineering Cloud subscribes to events published by the Enterprise Pipeline Platform on the shared event bus. The Engineering Cloud never calls Pipeline internals directly.

Subscribed events include:

- `PipelineRunStarted` — creates a local `PipelineRun` record linked to the `ReleaseCandidate`; records the pipeline run ID.
- `PipelineRunStageCompleted` — appends a `PipelineArtifact` entry for each completed stage with its output.
- `PipelineRunFailed` — triggers rollback evaluation (see Section 4.2).
- `PipelineRunCompleted` — advances workflow to Stage 6.

The local `PipelineRun` record serves as the Engineering Cloud's own ledger of pipeline progress and does not modify the Pipeline Platform's data.

#### Output Produced

- `PipelineRun` record (linked to `ReleaseCandidate` and Release Manager reference ID).
- `PipelineArtifact` records for each pipeline stage output.
- `ExecutionLog` entries recording pipeline events with timestamps.
- Real-time status visible in the Engineering OS Dashboard (existing TASK-ENG-005 system).

#### Exit Criteria

- `PipelineRunCompleted` event received.
- `PipelineRun` record updated to terminal `Completed` state.
- All expected `PipelineArtifact` records present.

#### SLA

- Target duration: **pipeline-type dependent** (defined in the Pipeline Platform's own SLA configuration).
- Alert threshold: `PipelineRunStageCompleted` not received within 2x the stage's historical average.
- Escalation: Engineering Lead notified on alert; Engineering Manager notified if no progress within 1 hour.

#### Failure Handling

- If `PipelineRunFailed` is received, automated rollback evaluation is triggered (see Section 4.2).
- If the Engineering Cloud loses event bus connectivity during pipeline execution, it falls back to polling the Pipeline Platform's status API at 60-second intervals. This is a degraded mode; the Engineering Lead is notified.
- If no pipeline event is received within 30 minutes of `ReleaseManagerHandoffCompleted`, the Engineering Lead is alerted to investigate whether the Pipeline Platform has accepted the run.

---

### Stage 6 — Production

#### Entry Criteria

- `PipelineRunCompleted` event received.
- Pipeline Platform confirms successful deployment (no error exit code).
- All post-deploy health checks defined in the `ReleaseBundle` pass.

#### Responsible Parties

- **Engineering Lead** — confirms production health; authorises final state transition.
- **Engineering Platform** — executes automated post-deploy actions.
- **Stakeholders** — notified of successful release.

#### Actions Performed

1. The `EngineeringTask.status` transitions from `Completed` to `Released`.
2. The `ReleaseCandidate.status` transitions to `Released`.
3. The `TaskLock` on the `EngineeringTask` is permanently released and marked as resolved (not deleted; audit trail preserved).
4. All `TaskArtifact` records associated with the `EngineeringTask` are archived: their storage tier is downgraded, retention policy is applied, and an `ArtifactArchived` event is dispatched.
5. The `Workspace` that hosted the task is transitioned to `Archiving` and then `Archived` according to the workspace lifecycle policy.
6. A final immutable audit entry is written for the complete release workflow: `ReleaseWorkflowCompleted` (see Section 7).
7. Stakeholders are notified per the notification table (see Section 6).
8. Release notes are generated from the bundle's changelog and attached as a `TaskAttachment` to the `EngineeringTask` for historical reference.

#### Output Produced

- `EngineeringTask.status = Released`.
- `ReleaseCandidate.status = Released`.
- `TaskLock` resolved.
- `TaskArtifact` records archived.
- `Workspace.status = Archived`.
- `ReleaseWorkflowCompleted` audit entry.
- Release notes `TaskAttachment`.
- Stakeholder notifications dispatched.

#### Exit Criteria

- `EngineeringTask.status = Released` persisted.
- `ReleaseCandidate.status = Released` persisted.
- All archival actions confirmed.
- `ReleaseWorkflowCompleted` audit entry written.

#### SLA

- Target duration: **≤ 15 minutes** for automated post-deploy actions after pipeline completion.
- Alert threshold: archival or notification incomplete > 30 minutes after `PipelineRunCompleted`.

#### Failure Handling

- If post-deploy health checks fail, automated rollback is triggered immediately (see Section 4.3).
- If archival fails, the `EngineeringTask` and `ReleaseCandidate` are marked `Released` (deployment succeeded), but an archival failure alert is raised separately. Archival is non-blocking for the release outcome.
- If stakeholder notification delivery fails, the Engineering Platform retries 3 times and logs the delivery failure. The release outcome is not affected.

---

## 4. Rollback Procedures

Rollback is always a deliberate action; the system provides triggers and procedures but does not auto-rollback without evaluation except in the automated triggers defined in Section 4.3.

---

### 4.1 Pre-Pipeline Rollback (Release Candidate Rejection)

A pre-pipeline rollback occurs when a `ReleaseCandidate` is rejected at Stage 2 (Inbox review) or Stage 3 (approval gate), or when the Release Manager rejects the bundle at Stage 4.

**Procedure:**

1. The `ReleaseCandidate` is set to terminal `Rejected` state (recorded but not in the canonical six workflow states).
2. The `ReleaseBundle` (if created) is voided: its integrity hash is invalidated and it is marked as superseded.
3. The `TaskLock` on the `EngineeringTask` is lifted.
4. The `EngineeringTask.status` transitions back to `Draft`.
5. The originating `EngineeringAgent` receives a structured rejection report containing:
   - The stage at which rejection occurred.
   - The actor who triggered the rejection.
   - The recorded rationale (from `TaskComment`).
   - Specific remediation guidance where available.
6. An audit entry `ReleaseCandidateRejected` is written with full context.
7. The `Workspace` associated with the task is returned to `Idle` state pending re-execution.

**No production system is affected by a pre-pipeline rollback.**

---

### 4.2 Post-Pipeline Rollback (Production Issue)

A post-pipeline rollback occurs when a production issue is detected after successful pipeline completion, or when the pipeline itself fails (`PipelineRunFailed` event received).

**Procedure:**

1. The Engineering Lead initiates rollback through the Engineering OS Dashboard or the Engineering API. Rollback cannot be triggered automatically except via Section 4.3 triggers.
2. The `ReleaseCandidate.status` transitions to `RolledBack`.
3. The `EngineeringTask.status` transitions from `Released` back to `Completed` (preserving completed work; not reverting to Draft).
4. The `EngineeringReleaseBridge` dispatches a `RollbackRequested` event to the Release Manager, which executes the rollback using its own rollback mechanism. The Engineering Cloud does not orchestrate the rollback directly.
5. The Pipeline Platform receives the rollback trigger from the Release Manager and executes the revert pipeline. The Engineering Cloud subscribes to `PipelineRunCompleted` (rollback variant) for confirmation.
6. A new `PipelineRun` record is created linked to the original `ReleaseCandidate` with `run_type = rollback`.
7. On confirmed rollback completion:
   - The `ReleaseCandidate.status` remains `RolledBack` (terminal).
   - A `RollbackCompleted` audit entry is written.
   - Stakeholders are notified of the rollback outcome.
   - The originating `EngineeringAgent` is notified and a post-mortem `TaskAttachment` is required within 48 hours.

**Impact Assessment:**

The Engineering Lead must record in the `ReleaseCandidate` metadata:
- The production issue observed.
- The customer or system impact scope.
- The estimated time to recovery.

---

### 4.3 Automated Rollback Triggers

The following conditions trigger an automated rollback evaluation. In each case, the system **raises an alert and pauses** rather than executing the rollback silently; the Engineering Lead confirms within the defined response window or the system escalates.

| Trigger | Condition | Auto-Action | Response Window |
|---------|-----------|-------------|-----------------|
| Pipeline failure | `PipelineRunFailed` event received | Alert Engineering Lead; mark candidate for rollback review | 15 minutes |
| Health check failure | Post-deploy health check returns non-healthy | Alert Engineering Lead; recommend immediate rollback | 10 minutes |
| Error rate spike | Error rate in production exceeds 5x baseline within 10 minutes of deployment | Alert Engineering Lead and Engineering Manager | 10 minutes |
| Deployment timeout | No `PipelineRunCompleted` event within 2x expected pipeline duration | Alert Engineering Lead | 30 minutes |

If the Engineering Lead does not respond within the response window, the Engineering Manager is notified. If the Engineering Manager does not respond within a further 15 minutes, the CTO is notified.

Automated execution of rollback (without human confirmation) is not performed. The system provides the trigger; the human authorises the action.

---

## 5. Approval Gate Configuration

Approval gates are configurable per `company_id` and `release_type` and are stored in the Engineering Cloud configuration store. All gate changes are themselves audit-logged.

### Standard Configuration

| Release Type | Required Approvers | Eligible Approver Roles | Self-Approval |
|---|---|---|---|
| Hotfix | 1 | `release_approver`, `engineering_lead`, `engineering_manager` | Prohibited |
| Patch | 2 | `release_approver`, `engineering_lead` | Prohibited |
| Minor | 2 | `release_approver`, `engineering_lead` | Prohibited |
| Major | 2 + CTO sign-off | `release_approver`, `engineering_lead` | Prohibited; CTO sign-off is a separate required action |
| Staging | 0 | N/A | N/A — auto-approved |

### Configuration Parameters

Each configuration entry contains:

- `company_id` — the owning company.
- `release_type` — one of: hotfix, patch, minor, major, staging.
- `required_approver_count` — integer; minimum approvals required.
- `eligible_roles` — list of roles whose holders may approve.
- `enforce_cto_signoff` — boolean; if true, a CTO-role approval is required in addition to the base quorum.
- `allow_self_approval` — always `false`; present for explicit documentation in the configuration record.
- `emergency_override_enabled` — boolean; if true, emergency override is available for this type.

### Emergency Override

An emergency override bypasses the approval quorum for a single `ReleaseCandidate`. It requires:

1. Written justification submitted by an `engineering_manager` or higher role actor.
2. Explicit approval by a `cto`-role actor recorded in the audit trail.
3. The override is itself a two-person action: the initiator and the CTO approver must be different individuals.
4. The override is flagged permanently on the `ReleaseCandidate` record and the audit entry; it cannot be retroactively removed.
5. A post-mortem review is mandatory within 72 hours; the `EngineeringTask` is flagged with a `post_mortem_required` attribute until the review `TaskAttachment` is submitted.

---

## 6. Notification Table

All notifications are dispatched by the Engineering Platform's notification service. Delivery channels are ordered by urgency; channels are attempted in order and fallback to the next if the primary is unavailable.

| Stage | Event | Notified Parties | Channel | Content |
|-------|-------|-----------------|---------|---------|
| 1 | `ReleaseCandidateCreated` | Engineering Lead (inbox owner) | In-app + Email | Task name, release type, artifact count, creation timestamp, direct link to Inbox item |
| 2 | Inbox Approved | Originating EngineeringAgent, EngineeringWorker | In-app | Candidate approved; advancing to approval gate |
| 2 | Inbox Rejected | Originating EngineeringAgent, EngineeringWorker, Engineering Lead | In-app + Email | Rejection stage, actor, rationale, remediation guidance, task returned to Draft |
| 2 | Inbox Deferred | Originating EngineeringAgent, Engineering Lead | In-app | Deferred until date, reason |
| 3 | Approval gate opened | All eligible approvers for this `company_id` and `release_type` | In-app + Email | Candidate summary, release type, required approver count, link to approval UI |
| 3 | Quorum reached — `Approved` | Engineering Lead, Engineering Manager | In-app | Candidate name, approvers, bundle preparation initiated |
| 3 | Approval timeout warning | Engineering Manager | In-app + Email | Time elapsed, approvals received vs. required, escalation notice |
| 4 | `ReleaseManagerHandoffCompleted` | Engineering Lead | In-app | Release Manager reference ID, scheduled release timestamp |
| 4 | Release Manager rejection | Engineering Lead, Engineering Manager | In-app + Email | Rejection reason from Release Manager, candidate returned to `Approved` |
| 5 | `PipelineRunStarted` | Engineering Lead | In-app | Pipeline run ID, estimated duration |
| 5 | Pipeline stage completed | Engineering Lead | In-app | Stage name, duration, output summary |
| 5 | `PipelineRunFailed` | Engineering Lead, Engineering Manager | In-app + Email + SMS (if configured) | Failure stage, error summary, rollback evaluation triggered |
| 5 | Pipeline alert (no progress) | Engineering Lead, Engineering Manager | In-app + Email | Time since last event, instructions to investigate |
| 6 | `ReleaseWorkflowCompleted` | Engineering Lead, Engineering Manager, Product Owner, Stakeholders (configured list) | In-app + Email | Task name, release type, deployed version, deployment timestamp, release notes link |
| 6 | Rollback initiated | Engineering Lead, Engineering Manager, CTO, Stakeholders | In-app + Email + SMS (if configured) | Candidate name, rollback reason, estimated recovery time |
| 6 | `RollbackCompleted` | Engineering Lead, Engineering Manager, CTO, Stakeholders | In-app + Email | Rollback confirmed, system state, post-mortem requirement |
| Any | Emergency override used | CTO, Engineering Manager, Audit Log | In-app + Email | Override initiator, justification, candidate, timestamp |

---

## 7. Audit Trail

Every stage transition and significant action in the release workflow is recorded immutably. Audit entries are append-only; no update or delete operation is permitted on the audit table.

### Audit Entry Schema

Each audit entry contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier for this audit entry. |
| `company_id` | UUID | Tenant isolation key. |
| `release_candidate_id` | UUID | The `ReleaseCandidate` this entry belongs to. |
| `engineering_task_id` | UUID | The originating `EngineeringTask`. |
| `event_name` | string | PascalCase past-tense event name (e.g., `ReleaseCandidateApproved`). |
| `from_stage` | string | The workflow stage before this transition (Stage 1–6 or named sub-state). |
| `to_stage` | string | The workflow stage after this transition. |
| `from_status` | string | The entity status before the transition (using canonical status vocabulary). |
| `to_status` | string | The entity status after the transition. |
| `actor_id` | UUID | Identity of the human or system actor who triggered the transition. Null is not permitted; system actions use a dedicated system actor UUID. |
| `actor_role` | string | The role of the actor at the time of the action. |
| `timestamp` | timestamptz | UTC timestamp of the action; recorded at the moment of database write. |
| `reason` | string | Human-readable rationale provided by the actor (required for rejection, override, and rollback events; optional elsewhere). |
| `metadata` | jsonb | Structured additional context: approver list, artifact hashes, pipeline run IDs, Release Manager reference IDs, health check results, etc. |

### Canonical Audit Events

| Event Name | Trigger |
|---|---|
| `ReleaseCandidateCreated` | Stage 1: `ReleaseCandidate` record created from completed task. |
| `InboxReviewOpened` | Stage 2: Engineering Lead opens the candidate in the Inbox. |
| `InboxApproved` | Stage 2: Engineering Lead approves. |
| `InboxRejected` | Stage 2: Engineering Lead rejects with rationale. |
| `InboxDeferred` | Stage 2: Engineering Lead defers with re-review date. |
| `ApprovalSubmitted` | Stage 3: An approver submits their approval. |
| `ApprovalVoided` | Stage 3: An approval is voided (e.g., ineligible approver discovered). |
| `ReleaseCandidateApproved` | Stage 3: Quorum reached. |
| `ReleaseBundlePrepared` | Stage 3: `ReleaseBundle` integrity hash verified. |
| `ReleaseManagerHandoffCompleted` | Stage 4: Release Manager confirmed receipt. |
| `ReleaseBundleRejectedByReleaseManager` | Stage 4: Release Manager returned a rejection. |
| `PipelineRunTracked` | Stage 5: Local `PipelineRun` record created. |
| `PipelineRunCompleted` | Stage 5: Pipeline Platform confirmed success. |
| `PipelineRunFailed` | Stage 5: Pipeline Platform reported failure. |
| `ReleaseWorkflowCompleted` | Stage 6: Task moved to `Released`; all post-deploy actions confirmed. |
| `RollbackInitiated` | 4.2/4.3: Engineering Lead authorises rollback. |
| `RollbackCompleted` | 4.2: Pipeline Platform confirmed rollback deployment. |
| `EmergencyOverrideUsed` | Section 5: Emergency override executed. |

### Audit Integrity

- Audit entries are written within the same database transaction as the state transition they record. If the state transition fails, no orphaned audit entry is created.
- Audit entries are replicated to an append-only audit log store (separate from the primary OLTP database) within 60 seconds of writing.
- The audit table has no `updated_at` column; the schema enforces immutability.
- Audit queries are available to `engineering_lead`, `engineering_manager`, and `cto` roles. Audit entries for other companies are never exposed regardless of role.

---

## 8. SLA Summary Table

| Stage | Name | Owner | Target Duration | Alert Threshold | Escalation Path |
|-------|------|-------|----------------|-----------------|-----------------|
| 1 | Task Completion | Engineering Platform (automated) | ≤ 5 minutes | > 10 minutes | Engineering Lead → Engineering Manager |
| 2 | Engineering Inbox | Engineering Lead | ≤ 4 business hours | > 8 business hours | Engineering Manager at 8 h; CTO at 24 h |
| 3 (quorum) | Approval Gate | Designated Approvers | ≤ 2 h (Hotfix); ≤ 8 h (all others) | 50% of SLA elapsed without quorum | Engineering Manager; then CTO |
| 3 (bundle) | Bundle Preparation | Engineering Platform (automated) | ≤ 15 minutes | > 30 minutes | Engineering Lead |
| 4 | Release Manager Integration | EngineeringReleaseBridge (automated) | ≤ 10 minutes | > 20 minutes | Engineering Lead → Engineering Manager |
| 5 | Pipeline Execution | Pipeline Platform | Pipeline-type dependent | 2x historical stage average | Engineering Lead → Engineering Manager at 1 h |
| 6 | Post-Deploy Actions | Engineering Platform (automated) | ≤ 15 minutes | > 30 minutes | Engineering Lead |
| 4.2 | Rollback (post-pipeline) | Engineering Lead + Release Manager | ≤ 30 minutes to initiate | > 30 minutes without initiation | Engineering Manager → CTO |
| Emergency Override | Gate bypass | CTO + Engineering Manager | Same-session confirmation | N/A | N/A (human-driven) |

---

## Appendix A — Entity Relationships Referenced

- `EngineeringTask` 1:1 `ReleaseCandidate` (one candidate per task per release cycle)
- `ReleaseCandidate` 1:1 `ReleaseBundle`
- `ReleaseBundle` 1:N `TaskArtifact`
- `ReleaseCandidate` 1:N approval records
- `ReleaseCandidate` 1:N audit entries
- `ReleaseCandidate` 1:N `PipelineRun` (one for the release run; one for rollback run if applicable)
- `PipelineRun` 1:N `PipelineArtifact`
- `EngineeringTask` 1:N `TaskComment`, `TaskAttachment`, `TaskLock`

---

## Appendix B — Related Documents

- TASK-ENG-006 — Engineering AI Release Manager
- TASK-ENG-007 — Enterprise Pipeline Platform
- ADR-011 — Event-Driven Architecture (event schema and naming conventions)
- ADR-024 — Single Source of Truth (cache invalidation and canonical keys)
- Engineering OS Dashboard (TASK-ENG-005)
