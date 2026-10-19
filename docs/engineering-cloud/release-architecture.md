# Engineering Cloud — Release Architecture

**Version:** 1.0 | **Status:** Frozen | **Date:** 2026-07-22

---

## 1. Purpose

This document defines how Engineering Cloud integrates with the existing ECOS platform systems — Release Manager, Pipeline Platform, Analytics (KPI layer), and Notifications — without modifying any of them. Engineering Cloud operates as a **consumer and observer only**. It reads events, calls public APIs, and publishes its own KPI data through extension points already built into the platform. No existing module receives new dependencies on Engineering Cloud, and no existing migration, service, or controller is altered.

The integration boundary is enforced by three architectural rules:

1. Engineering Cloud never writes to a table it does not own.
2. Engineering Cloud never registers listeners inside another module's service provider.
3. All inbound events from external systems pass through an anti-corruption layer before touching Engineering Cloud domain objects.

---

## 2. Existing Systems Inventory

### 2.1 Release Manager

**What it does.** The Release Manager (TASK-ENG-006) is an autonomous release orchestration module. It owns the ReleaseBundle lifecycle (Draft → UnderReview → Approved → Staged → Released → RolledBack), coordinates approvals, manages version tagging on GitHub, and fires domain events when a release transitions state. It exposes an HTTP API for release submission and status polling.

**Why Engineering Cloud cannot modify it.** Release Manager is a frozen deliverable with its own domain boundary. Engineering Cloud adding dependencies into that module would introduce a coupling that breaks the single-responsibility of the Release Manager and would require regression testing of a frozen system on every Engineering Cloud iteration. The Release Manager's internal event bus and state machine are its own concern.

**Integration approach.** Engineering Cloud maintains a thin HTTP bridge (EngineeringReleaseBridge, described in Section 3.1) that translates ReleaseCandidate objects into the Release Manager's submission format and polls for status. When the Release Manager fires events visible to the platform event bus, PipelineEventAdapter (Section 3.2) subscribes and translates them into Engineering Cloud events. Engineering Cloud never registers inside the Release Manager's service provider.

---

### 2.2 Pipeline Platform

**What it does.** The Pipeline Platform (TASK-ENG-007) executes templates (release, hotfix, documentation) as PipelineRun sequences. It emits external pipeline events (ExternalPipelineStarted, ExternalPipelineCompleted, ExternalPipelineFailed) onto the shared platform event bus and exposes artifact storage for build outputs. It owns its own PipelineArtifact records and run state.

**Why Engineering Cloud cannot modify it.** The Pipeline Platform contains RetryPolicy value objects, GitHubCiProvider integrations, and recovery logic (resume, restart, skip) that are self-contained and tested independently. Inserting Engineering Cloud concerns into these flows would blur accountability for failures and make the retry/recovery logic harder to reason about. Pipeline Platform events are already well-defined and stable.

**Integration approach.** PipelineEventAdapter subscribes to the three canonical external pipeline events and translates them into PipelineRun records within the Engineering Cloud schema. All translation logic lives in Engineering Cloud's own infrastructure layer. The Pipeline Platform has no reference to Engineering Cloud.

---

### 2.3 Analytics (KPI Layer)

**What it does.** The Analytics KPI layer, governed by ADR-025 (Dashboard Freeze), operates on a refresh cycle that calls registered KpiService implementations. Each module contributes its own KpiService and registers it through the platform's KpiRegistry. The Analytics engine aggregates results and feeds the Executive Dashboard and InsightEngine. The layer is frozen — no new core analytics code is written; modules extend it additively.

**Why Engineering Cloud cannot modify it.** ADR-025 explicitly prohibits modifications to the Analytics engine and Dashboard API. The freeze exists to prevent regression across all KPI consumers (Orders, Inventory, Manufacturing, Marketing) from changes made by one module. The InsightEngine's threshold logic and health score calculation depend on stable KPI shapes.

**Integration approach.** Engineering Cloud registers its own KpiService (EngineeringKpiService) through the standard extension point provided by ADR-025. The KpiRegistry calls it on the existing refresh cycle. Engineering Cloud publishes ten KPIs (detailed in Section 4) that are additive to the existing set and do not alter any existing KPI key or calculation.

---

### 2.4 Notifications

**What it does.** The Notifications subsystem delivers messages to users through in-app inbox, email, and push channels. Modules fire events; the Notifications service maps events to templates and routes to recipients based on configuration. It supports priority levels and per-event delivery guarantees.

**Why Engineering Cloud cannot modify it.** The Notifications subsystem owns template definitions, channel routing rules, and delivery retry logic. Embedding Engineering Cloud recipients or templates into that service's internals would require the Notifications team to carry Engineering Cloud domain knowledge.

**Integration approach.** Engineering Cloud fires its own domain events (TaskAssigned, TaskFailed, ReleaseCandidateCreated, etc.). A thin EngineeringNotificationListener inside Engineering Cloud's infrastructure layer subscribes to these events and calls the Notifications service's public API with a pre-built NotificationRequest. Template strings live in Engineering Cloud's own config. The Notifications service treats Engineering Cloud as any other API caller.

---

## 3. Anti-Corruption Layer Design

### 3.1 EngineeringReleaseBridge

EngineeringReleaseBridge is the single integration point between Engineering Cloud and the Release Manager. Its responsibility is to ensure that all coupling between the two systems is absorbed in one place: if the Release Manager changes its API, only this bridge changes. Engineering Cloud domain objects never reference Release Manager types directly.

**Location.** `Modules/Engineering/Cloud/Infrastructure/Bridges/EngineeringReleaseBridge`

**Operations**

| Operation | Input | Output | Description |
|-----------|-------|--------|-------------|
| publishReleaseCandidate | ReleaseCandidate | ReleaseManagerReference | Translates a ReleaseCandidate (Engineering Cloud entity) into the Release Manager's submission payload. Submits via HTTP. Returns an opaque reference token that can be used for subsequent status checks. |
| checkReleaseStatus | ReleaseManagerReference | ReleaseStatusDTO | Polls the Release Manager's status endpoint using the reference token. Translates the external status string into a ReleaseStatusDTO value object that uses Engineering Cloud's Release states vocabulary (Draft, UnderReview, Approved, Staged, Released, RolledBack). |
| cancelRelease | ReleaseManagerReference, reason string | void | Sends a cancellation request to the Release Manager. Logs the reason in the Engineering Cloud audit trail. Does not attempt cancellation if the external status is already Released or RolledBack. |

**Implementation notes.** All HTTP calls are wrapped in a circuit breaker with a half-open probe every 60 seconds. On transient failure, the operation retries up to 3 times with a 30-second exponential backoff. On persistent failure after all retries, the failing operation is written to a dead-letter log and an alert is raised to the EngineeringLead through the Notifications integration. The circuit breaker is open-by-default on test environments to prevent integration tests from calling the live Release Manager.

The ReleaseManagerReference type is an opaque string from Engineering Cloud's perspective. It carries no domain meaning internally — it is stored on the ReleaseCandidate aggregate as an external reference field and never interpreted by Engineering Cloud business logic.

---

### 3.2 PipelineEventAdapter

PipelineEventAdapter listens to the three external pipeline events published by the Pipeline Platform and translates them into Engineering Cloud domain events. It is the entry point for all pipeline-originated state changes inside Engineering Cloud.

**Location.** `Modules/Engineering/Cloud/Infrastructure/Adapters/PipelineEventAdapter`

**Event translations**

**onPipelineStarted(ExternalPipelineStarted)**
Receives the external event containing the pipeline template identifier, initiating agent reference, and start timestamp. Creates a new PipelineRun record in Engineering Cloud's schema with state Initializing, associates it with the relevant EngineeringTask via the task identifier embedded in the external event's metadata field, and publishes a PipelineRunStarted event to the Engineering Cloud internal event bus. If no matching EngineeringTask is found, the PipelineRun is recorded as an orphan with a warning log — it is not discarded, because the task may arrive out of order.

**onPipelineCompleted(ExternalPipelineCompleted)**
Receives the external event containing the pipeline run identifier, final artifact references, and completion timestamp. Looks up the PipelineRun by external run identifier. Transitions the PipelineRun to Completed state. Associates any PipelineArtifact references with the run record. If the completed pipeline was the final stage gate for a ReleaseCandidate, triggers the release completion flow: calls EngineeringReleaseBridge.checkReleaseStatus and transitions the ReleaseCandidate to the appropriate Release state. Publishes PipelineRunCompleted.

**onPipelineFailed(ExternalPipelineFailed)**
Receives the external event containing the pipeline run identifier, failure reason, and the stage at which failure occurred. Looks up the PipelineRun. Transitions the PipelineRun to Failed state. If the pipeline failure is associated with a ReleaseCandidate in Staged state, triggers the rollback flow: calls EngineeringReleaseBridge.cancelRelease with the failure reason, transitions the ReleaseCandidate to RolledBack, and publishes ReleaseCandidateRolledBack. Publishes PipelineRunFailed regardless of whether a release rollback was triggered.

**Idempotency.** All three handlers are idempotent on re-delivery. If a PipelineRun already exists for a given external run identifier, the handler updates it rather than creating a duplicate. The state machine enforces valid transitions only — an already-Completed run receiving a second onPipelineCompleted signal is a no-op with a debug log.

---

## 4. Analytics Integration

Engineering Cloud registers EngineeringKpiService through the KpiRegistry extension point established by ADR-025. The Analytics engine calls it on its standard refresh cycle (every 15 minutes). No modification to Analytics code is required.

EngineeringKpiService queries only Engineering Cloud's own tables. It returns a KpiResult collection keyed by the KPI keys listed below. The Analytics engine merges this with other module KPI results and presents them in the Executive Dashboard under the Engineering domain group.

| KPI Key | Description | Calculation | Granularity | Source Entity |
|---------|-------------|-------------|-------------|---------------|
| `engineering.tasks.created` | Number of new tasks created in the period | COUNT of EngineeringTask records with created_at within window | Hourly, Daily | EngineeringTask |
| `engineering.tasks.completed` | Number of tasks reaching Completed state in the period | COUNT of EngineeringTask records transitioning to Completed within window | Hourly, Daily | EngineeringTask |
| `engineering.tasks.failed` | Number of tasks reaching Failed state in the period | COUNT of EngineeringTask records transitioning to Failed within window | Hourly, Daily | EngineeringTask |
| `engineering.tasks.avg_duration_seconds` | Average elapsed time from Assigned to Completed across all tasks in the period | AVG of (completed_at minus assigned_at) in seconds for tasks completed within window | Daily | EngineeringTask |
| `engineering.releases.created` | Number of ReleaseCandidates created in the period | COUNT of ReleaseCandidate records with created_at within window | Daily | ReleaseCandidate |
| `engineering.releases.success_rate` | Percentage of releases reaching Released state (versus RolledBack) | COUNT(Released) / COUNT(Released + RolledBack) within window, as a decimal 0–1 | Daily, Weekly | ReleaseCandidate |
| `engineering.workers.utilization` | Fraction of registered workers in Busy state at time of calculation | COUNT(Busy workers) / COUNT(non-Terminated workers) at snapshot time | Real-time, per refresh | WorkerHeartbeat |
| `engineering.queue.avg_wait_seconds` | Average time tasks spend in Queued state before transitioning to Assigned | AVG of (assigned_at minus queued_at) in seconds for tasks assigned within window | Hourly, Daily | EngineeringTask |
| `engineering.workers.active_count` | Total workers in Idle or Busy state at time of calculation | COUNT of EngineeringWorker records with state in (Idle, Busy) at snapshot time | Real-time, per refresh | EngineeringWorker |
| `engineering.releases.rollback_rate` | Percentage of releases that were rolled back | COUNT(RolledBack) / COUNT(Released + RolledBack) within window, as a decimal 0–1 | Daily, Weekly | ReleaseCandidate |

All KPI values are scoped by company_id to maintain tenant isolation consistent with the platform's multi-tenant PostgreSQL architecture.

---

## 5. Notifications Integration

Engineering Cloud fires domain events that are handled by EngineeringNotificationListener. The listener constructs NotificationRequest objects and calls the Notifications service public API. Template strings are defined in Engineering Cloud's own configuration and do not depend on any template stored in the Notifications system.

| Event | Recipient | Channel | Message Template | Priority | Delivery Guarantee |
|-------|-----------|---------|-----------------|----------|--------------------|
| TaskAssigned | Agent owner (EngineeringAgent.user_id) | In-app inbox | "Task [task.title] has been assigned to you. Due: [task.due_at]. Priority: [task.priority]." | Normal | At-least-once |
| TaskFailed | EngineeringLead (role lookup) | In-app inbox + Email | "Task [task.title] failed during [task.current_stage]. Reason: [task.failure_reason]. Review required." | High | Guaranteed with acknowledgement |
| TaskCompleted | Task requester (task.created_by) | In-app inbox | "Task [task.title] has been completed by [agent.name]. Duration: [task.duration]." | Normal | At-least-once |
| ReleaseCandidateCreated | EngineeringLead (role lookup) | In-app inbox | "Release candidate [candidate.version] is pending review. Submitted by [agent.name]. Pipeline: [candidate.pipeline_id]." | High | Guaranteed with acknowledgement |
| ReleaseApproved | All stakeholders (release.stakeholder_ids) | In-app inbox + Email | "Release [candidate.version] has been approved and is staged for deployment. Scheduled at: [release.staged_at]." | Normal | At-least-once |
| ReleaseRolledBack | EngineeringLead + on-call engineer (on_call_id) | In-app inbox + Email + Push | "ROLLBACK: Release [candidate.version] was rolled back. Reason: [release.rollback_reason]. Immediate review required." | Critical | Guaranteed with retry up to 5 attempts |
| WorkerDisconnected | EngineeringLead (role lookup) | In-app inbox + Push | "Worker [worker.name] (ID: [worker.id]) has disconnected. Last heartbeat: [worker.last_heartbeat_at]. Tasks may need requeue." | High | Guaranteed with acknowledgement |
| QueueDepthAlert | EngineeringLead (role lookup) | In-app inbox + Push | "Execution queue depth has exceeded threshold: [queue.depth] tasks waiting. Oldest wait: [queue.oldest_wait_seconds]s." | High | At-least-once |
| SecurityAuditAlert | CTO (role lookup) | In-app inbox + Email | "Security audit event detected in Engineering Cloud: [event.summary]. Actor: [event.actor_id]. Review audit log for details." | Critical | Guaranteed with retry up to 5 attempts |

**Throttling.** QueueDepthAlert is throttled to one notification per 10 minutes per company_id to prevent alert storms during sustained queue buildup. All other events are fired on each occurrence without throttling.

**Role resolution.** EngineeringLead and CTO recipients are resolved at notification-send time via the platform's role-lookup service, not cached at event-fire time. This ensures that if the role is reassigned between event creation and delivery, the correct current holder is notified.

---

## 6. Data Flow Diagram (ASCII)

The diagram below shows the direction, synchronicity, and isolation boundaries of all integration flows between Engineering Cloud and external systems.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ENGINEERING CLOUD BOUNDARY                            │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                    ANTI-CORRUPTION LAYER                                 │  │
│  │                                                                          │  │
│  │   ┌───────────────────────────┐   ┌──────────────────────────────────┐  │  │
│  │   │  EngineeringReleaseBridge │   │     PipelineEventAdapter         │  │  │
│  │   │                           │   │                                  │  │  │
│  │   │  publishReleaseCandidate  │   │  onPipelineStarted()    ←── ─── │──│──│─────────────────────────┐
│  │   │  checkReleaseStatus       │   │  onPipelineCompleted()  ←── ─── │──│──│──────────────────────┐  │
│  │   │  cancelRelease            │   │  onPipelineFailed()     ←── ─── │──│──│───────────────────┐  │  │
│  │   └─────────────┬─────────────┘   └──────────────┬───────────────┘  │  │  │                   │  │  │
│  │                 │ circuit                         │ translates        │  │  │                   │  │  │
│  │                 │ breaker +                       │ to EC events      │  │  │                   │  │  │
│  │                 │ retry                           │                   │  │  │                   │  │  │
│  └─────────────────│─────────────────────────────────│───────────────────┘  │  │                   │  │  │
│                    │                                 │                       │  │                   │  │  │
│  ┌─────────────────│─────────────────────────────────│───────────────────┐  │  │                   │  │  │
│  │                 │  ENGINEERING CLOUD DOMAIN        │                   │  │  │                   │  │  │
│  │                 ▼                                 ▼                   │  │  │                   │  │  │
│  │     ┌─────────────────────┐        ┌───────────────────────────┐     │  │  │                   │  │  │
│  │     │  ReleaseCandidate   │        │  PipelineRun              │     │  │  │                   │  │  │
│  │     │  (aggregate)        │        │  PipelineArtifact         │     │  │  │                   │  │  │
│  │     └─────────────────────┘        └───────────────────────────┘     │  │  │                   │  │  │
│  │                                                                       │  │  │                   │  │  │
│  │     ┌──────────────────────────────────────────────────────────┐     │  │  │                   │  │  │
│  │     │  EngineeringKpiService      EngineeringNotificationLstnr │     │  │  │                   │  │  │
│  │     │         │                              │                  │     │  │  │                   │  │  │
│  │     └─────────│──────────────────────────────│──────────────────┘     │  │  │                   │  │  │
│  │               │ reads own                    │ calls public API        │  │  │                   │  │  │
│  │               │ tables only                  │                         │  │  │                   │  │  │
│  └───────────────│──────────────────────────────│─────────────────────────┘  │  │                   │  │  │
│                  │                              │                             │  │                   │  │  │
└──────────────────│──────────────────────────────│─────────────────────────────│──┘                   │  │  │
                   │                              │                             │                      │  │  │
                   │                              │                             │                      │  │  │
   EXTERNAL SYSTEMS│                              │                             │                      │  │  │
                   │                              │                             │                      │  │  │
   ┌───────────────▼────────┐  ┌──────────────────▼──┐  ┌──────────────────────▼──┐  ┌───────────────▼──▼──▼──┐
   │   RELEASE MANAGER      │  │  ANALYTICS / KPI    │  │   NOTIFICATIONS         │  │   PIPELINE PLATFORM    │
   │                        │  │                     │  │                         │  │                        │
   │  POST /releases    ◄───│  │  KpiRegistry.pull() │  │  POST /notifications ◄──│  │  ExternalPipelineEvts  │
   │  (sync HTTP)           │  │  (sync, pull-based) │  │  (sync HTTP)            │  │  (async, event bus)    │
   │                        │  │                     │  │                         │  │                        │
   │  GET /releases/{ref}   │  │  Refresh cycle      │  │  at-least-once          │  │  ──────────────────►   │
   │  (sync HTTP polling)   │  │  every 15 min       │  │  delivery               │  │  PipelineStarted       │
   │                        │  │                     │  │                         │  │  PipelineCompleted     │
   │  DELETE /releases/{ref}│  │  EC provides data;  │  │  EC owns templates;     │  │  PipelineFailed        │
   │  (sync HTTP)           │  │  Analytics owns     │  │  Notifications owns     │  │                        │
   │                        │  │  aggregation        │  │  routing + delivery     │  │  ──────────────────►   │
   │  [circuit breaker +    │  │                     │  │                         │  │  to platform event bus │
   │   retry wraps all      │  │  ◄── KpiResult[] ──►│  │                         │  │                        │
   │   HTTP calls]          │  │                     │  │                         │  │                        │
   │                        │  │  [additive — no     │  │  [no template stored    │  │  [EC subscribes;       │
   │  [dead-letter on        │  │   existing KPI      │  │   inside Notifications] │  │   Pipeline Platform    │
   │   persistent failure]  │  │   modified]         │  │                         │  │   has no EC reference] │
   └────────────────────────┘  └─────────────────────┘  └─────────────────────────┘  └────────────────────────┘

   ─── ─── = Asynchronous (event subscription)
   ───────  = Synchronous (HTTP API call or pull)
   ◄──────  = Inbound to Engineering Cloud or external system being called
   ──────►  = Outbound from source

   FAILURE ISOLATION BOUNDARIES:
   [Release Manager] down → circuit breaker opens; ReleaseCandidate stays in current state;
                            dead-letter written; EngineeringLead alerted. No cascade.
   [Analytics] unreachable → KpiRegistry skips EC on that cycle; stale KPIs shown.
                              No impact on Engineering Cloud operations.
   [Notifications] unreachable → EngineeringNotificationListener retries per event priority.
                                  Critical events retry up to 5x. Non-delivery logged.
   [Pipeline Platform] events lost → PipelineRun stays in prior state. Reconciliation job
                                      polls Pipeline Platform API every 5 min for runs
                                      older than 10 min with no state change.
```

---

## 7. Integration Contracts

| Integration Point | Contract Type | Stability | Change Protocol | Failure Mode | Fallback |
|-------------------|--------------|-----------|-----------------|--------------|----------|
| EngineeringReleaseBridge → Release Manager HTTP API | REST over HTTP, JSON payloads; contract owned by Release Manager | Stable (frozen module) | Release Manager publishes changelog; EngineeringReleaseBridge updated in Engineering Cloud only | Circuit breaker opens; ReleaseCandidate enters degraded pending state; EngineeringLead alerted via dead-letter | Manual release submission documented in runbook; operator can complete via Release Manager UI directly |
| PipelineEventAdapter ← Pipeline Platform events | Event bus subscription; event schema owned by Pipeline Platform | Stable (frozen module) | Pipeline Platform version-tags events; adapter handles both versions for one release cycle | Missed events detected by reconciliation job (5-min polling); PipelineRun auto-corrects state | Reconciliation job ensures eventual consistency within 10 minutes |
| EngineeringKpiService → KpiRegistry | Interface contract defined by ADR-025; KpiResult shape owned by Analytics | Frozen (ADR-025) | Any change to KpiResult shape requires Analytics team ADR amendment; EC follows | Analytics skips EC service if it throws; stale dashboard values shown for EC domain | None required — dashboard shows last-known values with staleness indicator |
| EngineeringNotificationListener → Notifications API | HTTP JSON; NotificationRequest shape owned by Notifications service | Stable | Notifications team announces schema changes with 2-sprint notice; EC listener updated | Retry per priority level (Normal: 3 attempts; High: 3 attempts; Critical: 5 attempts); failures logged | Critical notifications fall back to direct email via platform SMTP if Notifications API unreachable for 5+ minutes |
| WorkerHeartbeat → EC schema | Internal to Engineering Cloud; no external dependency | Engineering Cloud owns | No external approval needed | N/A | N/A |

---

## 8. Integration Testing Strategy

The integration testing strategy ensures Engineering Cloud's integration points are verified without calling live external systems and without modifying those systems to accommodate tests.

### 8.1 Guiding Principles

- Every test that touches an integration boundary uses a mock or contract stub, never the live system.
- Contract tests verify that Engineering Cloud's expectations match the external system's actual API shape, without modifying the external system.
- Reconciliation and retry paths are tested with injected failures, not production conditions.

### 8.2 Mock Strategy by Integration Point

**Release Manager (EngineeringReleaseBridge)**

A ReleaseManagerFakeServer is implemented as an in-process HTTP server using Laravel's test HTTP client mocking. It implements the same three endpoints (submit, status, cancel) with configurable response scenarios: success, transient failure (503), persistent failure, and invalid payload rejection.

Tests cover: successful round-trip from ReleaseCandidate to ReleaseManagerReference; circuit breaker opening after three consecutive failures; dead-letter creation on persistent failure; correct translation of each external Release Manager status string to an Engineering Cloud Release state; ReleaseStatusDTO field mapping.

The ReleaseManagerFakeServer is instantiated only in the test environment and shares no code with the Release Manager module.

**Pipeline Platform (PipelineEventAdapter)**

The adapter is tested by dispatching ExternalPipelineStarted, ExternalPipelineCompleted, and ExternalPipelineFailed event objects directly to the adapter's handler methods in unit tests. No event bus is involved. Integration tests dispatch via a test event bus to confirm the adapter is subscribed and responding.

Tests cover: PipelineRun creation on ExternalPipelineStarted; idempotency (second dispatch with same run identifier does not create a duplicate); state transition to Completed with artifact association; state transition to Failed with rollback trigger; orphan run handling (no matching EngineeringTask); release completion flow triggered on final stage gate completion; rollback flow triggered on pipeline failure with active ReleaseCandidate.

**Analytics KpiService**

EngineeringKpiService is tested in isolation by seeding the Engineering Cloud test database with known task, release, and worker records and asserting that KpiResult values match expected calculations. No Analytics or Dashboard code is loaded.

A contract test verifies that the KpiResult object returned by EngineeringKpiService satisfies the KpiResult interface expected by the KpiRegistry. This test imports only the KpiResult interface definition from the Analytics module — it does not call the Analytics engine.

**Notifications**

EngineeringNotificationListener is tested with a FakeNotificationsClient that records all NotificationRequest objects submitted to it. Tests assert the correct recipient, channel, template content, and priority for each event type.

A contract test verifies that the NotificationRequest shape produced by the listener matches the Notifications service's documented API schema (maintained as a JSON Schema fixture in the Engineering Cloud test fixtures directory). The fixture is updated manually when the Notifications team announces schema changes.

### 8.3 Contract Test Maintenance

Each integration point has a corresponding contract fixture file stored at `Modules/Engineering/Cloud/Tests/Contracts/`. Files are named by integration point: `release-manager-api.json`, `pipeline-events.json`, `kpi-result-interface.json`, `notification-request.json`.

When an external system announces a breaking change, the Engineering Cloud team updates the relevant fixture before the change lands in production. Contract tests fail in CI if the fixture does not match the adapter's output, providing early warning before integration is broken in a live environment.

### 8.4 End-to-End Smoke Test (Staging Only)

A single end-to-end smoke test runs in the staging environment against real external systems. It creates a minimal ReleaseCandidate, submits it through EngineeringReleaseBridge to the staging Release Manager, waits for a PipelineRunStarted event via the staging event bus, and asserts that a PipelineRun record was created in Engineering Cloud's schema. It does not assert on the Release Manager's internal state and does not modify any external system data beyond the submitted release candidate.

This test is tagged `@staging-only` and excluded from CI. It runs manually before each production deployment of Engineering Cloud.

---

*Document maintained by Engineering Cloud team. Changes to this document require Engineering Lead approval. Version history tracked in git.*
