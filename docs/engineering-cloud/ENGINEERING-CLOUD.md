# ECOS Engineering Cloud — Platform Documentation

> **Architecture Status: FROZEN — 2026-07-22**
> This document is the single source of truth for all Engineering Cloud development.

---

## Overview

Engineering Cloud is the internal platform that automates the full lifecycle of engineering work inside ECOS ERP — from task creation and agent assignment through workspace provisioning, parallel execution, artifact management, and governed release. It solves the coordination problem that emerges at scale: engineering tasks multiplied across many agents running concurrently, with conflicting workspace mutations, inconsistent release gates, and no audit trail. Engineering Cloud imposes a structured execution model — every task moves through a deterministic 11-state machine, every agent is registered and heartbeat-monitored, every release requires approval quorum, and every event carries a correlation ID — so platform teams have full observability and control while agents operate autonomously at speed. Within the ECOS ERP monorepo it lives as a dedicated DDD module under `Modules/Engineering/`, communicating with other domains exclusively through domain events and anti-corruption layers.

---

## Architecture Freeze

**The architecture defined in ADR-020 through ADR-029, and the supporting documents listed in the Document Index below, is frozen as of 2026-07-22.**

What frozen means in practice:

- Every implementation task, pull request, and agent behaviour must conform to the contracts defined in ADR-021 through ADR-029.
- No implementation detail may deviate from a frozen decision without a new ADR that is reviewed and approved by the CTO.
- Any ambiguity between an implementation and a frozen document is resolved in favour of the document.
- This file — `ENGINEERING-CLOUD.md` — is the authoritative entry point. All other documents in `docs/engineering-cloud/` derive their authority from this index.

Implementers who believe a frozen decision is wrong must open an ADR proposal and await approval before writing code that contradicts it. There are no informal exceptions.

---

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            ENGINEERS                                    │
│                   (Browser UI  ·  REST API clients)                     │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │  HTTPS / JWT (Sanctum for UI, JWT for agents)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐   │
│  │  TaskService    │  │  WorkerService  │  │  WorkspaceService    │   │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬───────────┘   │
│           │                   │                        │               │
│  ┌────────┴────────────────────┴────────────────────────┴───────────┐  │
│  │               ReleaseCandidateService                            │  │
│  └────────────────────────────────────┬──────────────────────────── ┘  │
└───────────────────────────────────────│─────────────────────────────────┘
                                        │
                     ┌──────────────────▼──────────────────┐
                     │       EngineeringReleaseBridge       │
                     │         (Anti-Corruption Layer)      │
                     └──────────────────┬──────────────────┘
                                        │
                     ┌──────────────────▼──────────────────┐
                     │           Release Manager            │
                     │  (TASK-ENG-006 · ADR-023)           │
                     └──────────────────┬──────────────────┘
                                        │ triggers
                     ┌──────────────────▼──────────────────┐
                     │    Enterprise Pipeline Platform      │
                     │  (TASK-ENG-007 · ADR-022)           │
                     └──────────────────┬──────────────────┘
                                        │ results via
                     ┌──────────────────▼──────────────────┐
                     │         PipelineEventAdapter         │
                     │         (Anti-Corruption Layer)      │
                     └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       ENGINEERING AGENTS                                │
│   (EngineeringAgent instances: Claude, SpecialistAgent, CiAgent …)      │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │  WebSocket (Control Channel)
                            ▼
              ┌─────────────────────────┐
              │   Laravel WebSockets    │
              │   Control Channel Bus   │
              └────────────┬────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌───────────┐     ┌───────────┐     ┌───────────────┐
  │PostgreSQL │     │  Redis    │     │ Object Storage│
  │(UUID PKs) │     │(Queue·WS) │     │(Artifacts)    │
  └───────────┘     └───────────┘     └───────────────┘
```

---

## Key Architectural Decisions

| Decision | ADR | Summary |
|---|---|---|
| Agent protocol is WebSocket + REST hybrid | ADR-027 | Agents receive real-time control messages over a persistent WebSocket Control Channel and submit results via REST. Removes polling latency while keeping REST idempotency for writes. |
| State machine has 11 states | ADR-024 | EngineeringTask follows: Draft → Queued → Assigned → Accepted → Running → Paused → Completed / Failed / Cancelled → Released → Archived. No skipping; every transition is logged. |
| Zero-trust security model | ADR-026 | Every principal — human or agent — is authenticated on every request. No implicit trust between services or agents. JWTs carry minimal claims; capabilities are verified server-side. |
| Workspace isolation per task | ADR-025 | Each EngineeringTask that requires file system access receives a dedicated Workspace. WorkspaceLock enforces single-writer access. Cross-task reads require explicit share grants. |
| Event-driven architecture throughout | ADR-028 | All state transitions emit a domain event. Events are immutable, carry correlation_id and actor_id, and are stored before the response is returned. Consumers are always eventual. |
| Anti-corruption layers for all external integrations | ADR-020 | Release Manager, Pipeline Platform, Notifications, and Analytics are all wrapped by adapter types. The Engineering Cloud domain model never imports external types directly. |
| PostgreSQL with UUID PKs and company_id isolation | ADR-021 | All tables use UUID primary keys. Every row is scoped to company_id. Soft deletes are standard. Row-level policies are enforced at the application layer. |
| Redis for scheduling and WebSocket state | ADR-022 | ExecutionQueue priority scoring, delayed retry scheduling, and WebSocket channel membership are all Redis-backed. Redis is ephemeral state; PostgreSQL is the source of truth. |
| Parallel execution with conflict detection | ADR-029 | Multiple agents may execute simultaneously. Before acquiring a WorkspaceLock, the engine checks for conflicting resource claims and rejects or queues if a conflict exists. |
| Approval quorum for releases | ADR-023 | A ReleaseCandidate may not advance to Staged without a configurable quorum of approver signatures. Quorum requirements are stored per release type. |
| TaskLock prevents concurrent state mutation | ADR-024 | Before any state transition, the service acquires a distributed TaskLock in Redis. Lock TTL is 30 seconds. Failure to acquire blocks the caller; there is no silent skip. |
| Heartbeat every 30 s with 3-miss timeout | ADR-021 | EngineeringWorker emits WorkerHeartbeat every 30 seconds. Three consecutive missed heartbeats move the worker to Offline and trigger task reassignment. |
| JWT with 24 h TTL and jti replay protection | ADR-026 | Agent JWTs expire after 24 hours. Each JWT carries a unique jti claim stored in Redis. A reused jti is rejected immediately, preventing replay attacks. |
| Priority scoring with starvation prevention | ADR-022 | ExecutionQueue score = base priority + urgency boost + wait-time bonus (linear). A task that waits beyond a configurable threshold receives a guaranteed promotion to the front. |
| Warm pool for workspace provisioning | ADR-025 | A configurable number of blank Workspaces are pre-provisioned and held Idle. Assignment pulls from the pool and replenishes asynchronously, keeping assignment latency sub-second. |
| Presigned URLs for artifact uploads | ADR-025 | Agents never upload artifacts through the API server. The WorkspaceService issues a time-limited presigned URL directly to Object Storage. The server records the artifact reference after upload completes. |
| Agent types are extensible via capability model | ADR-021 | WorkerCapability records declare what task types and resource constraints each agent supports. The scheduler matches tasks to workers by capability intersection, not by agent type hardcoding. |
| All events carry correlation_id for tracing | ADR-028 | Every domain event in Engineering Cloud includes correlation_id (propagated from the originating request), actor_id, and occurred_at. This enables full distributed trace reconstruction without an external APM dependency. |

---

## Document Index

| # | Document | File | Status | One-Line Summary |
|---|---|---|---|---|
| 1 | Engineering Cloud Vision | `ADR-020-engineering-cloud-vision.md` | Frozen | Defines the platform mission, scope boundaries, and the three founding principles: determinism, observability, and agent autonomy. |
| 2 | Developer Agent Architecture | `ADR-021-developer-agent-architecture.md` | Frozen | Specifies EngineeringAgent identity, registration via API key, JWT issuance, WorkerCapability model, and heartbeat contract. |
| 3 | Execution Cluster | `ADR-022-execution-cluster.md` | Frozen | Defines ExecutionQueue priority algorithm, parallel slot management, starvation prevention, and Redis scheduling topology. |
| 4 | Release Workflow | `ADR-023-release-workflow.md` | Frozen | Covers ReleaseCandidate lifecycle, approval quorum rules, staging gates, rollback procedure, and EngineeringReleaseBridge contract. |
| 5 | Task Lifecycle | `ADR-024-task-lifecycle.md` | Frozen | Specifies the 11-state EngineeringTask machine, valid transitions, TaskLock semantics, and terminal state handling. |
| 6 | Workspace Strategy | `ADR-025-workspace-strategy.md` | Frozen | Defines Workspace provisioning (warm pool), WorkspaceLock exclusivity, presigned artifact upload, and archival policy. |
| 7 | Security Architecture | `ADR-026-security-architecture.md` | Frozen | Specifies zero-trust model, JWT structure and jti replay protection, scoped permissions, and audit event requirements. |
| 8 | Agent Communication Protocol | `ADR-027-agent-communication-protocol.md` | Frozen | Defines the WebSocket Control Channel wire format, message types, reconnection policy, and REST submission contract. |
| 9 | Engineering Events | `ADR-028-engineering-events.md` | Frozen | Full catalog of all domain events, their schemas, correlation_id propagation rules, and consumer ordering guarantees. |
| 10 | Parallel Execution | `ADR-029-parallel-execution.md` | Frozen | Defines conflict detection algorithm, resource claim types, lock acquisition order, and deadlock prevention strategy. |
| 11 | Domain Model | `domain-model.md` | Frozen | Canonical definitions of all entities and value objects with their fields, invariants, and aggregate boundaries. |
| 12 | Database Design | `database-design.md` | Frozen | Full table schemas, indexes, foreign keys, and migration ordering for the Engineering Cloud module. |
| 13 | State Machines | `state-machines.md` | Frozen | Visual and textual specification of all state machines: EngineeringTask, EngineeringWorker, Workspace, ReleaseCandidate, and ExecutionSession. |
| 14 | API Contracts | `api-contracts.md` | Frozen | Complete REST API surface: endpoints, request/response schemas, error codes, and versioning policy. |
| 15 | WebSocket Protocol | `websocket-protocol.md` | Frozen | Frame-level specification of the Control Channel: envelope schema, message type registry, flow control, and heartbeat frames. |
| 16 | Release Architecture | `release-architecture.md` | Frozen | End-to-end release flow from ReleaseCandidate creation through pipeline execution to production deployment and rollback. |
| 17 | Sequence Diagrams | `sequence-diagrams.md` | Frozen | Key interaction sequences: task assignment, workspace provisioning, parallel conflict resolution, and release approval flow. |
| 18 | Deployment Architecture | `deployment-architecture.md` | Frozen | Infrastructure topology, container layout, network policies, and environment-specific configuration requirements. |
| 19 | Verification Checklist | `verification-checklist.md` | Frozen | Checklist every implementation PR must pass before merge: state machine coverage, event completeness, security controls, and performance gates. |
| 20 | Engineering Cloud Index | `ENGINEERING-CLOUD.md` | Frozen | This document. Entry point, architecture freeze declaration, diagram, decision table, and document index. |

---

## Recommended Reading Order (for Implementers)

1. **Start here** — `ENGINEERING-CLOUD.md` (this document). Read the Overview, Architecture Freeze declaration, ASCII diagram, and decision table before touching any other file. These give you the mental model everything else builds on.

2. **Read the vision** — `ADR-020-engineering-cloud-vision.md`. Understand *why* Engineering Cloud exists and what it deliberately does not do. This prevents the most common category of implementation error: building features that are explicitly out of scope.

3. **Understand the task lifecycle** — `ADR-024-task-lifecycle.md` and `state-machines.md` together. The 11-state EngineeringTask machine is the spine of the entire platform. Every other component — agents, workers, workspaces, releases — exists to serve this machine. Read these before writing any service code.

4. **Read the domain model** — `domain-model.md`. Learn every canonical entity name, its invariants, and its aggregate boundary. After this document, there should be no ambiguity about what an EngineeringTask, EngineeringWorker, or WorkspaceLock is.

5. **Read the agent architecture** — `ADR-021-developer-agent-architecture.md`. Understand how agents register, authenticate, advertise capabilities, and maintain their heartbeat. This is prerequisite reading before any agent integration work.

6. **Read security** — `ADR-026-security-architecture.md`. Security is not a layer added at the end. JWT structure, jti replay protection, and zero-trust scope rules affect every endpoint and every agent message. Read this before writing any controller or WebSocket handler.

7. **Read agent communication** — `ADR-027-agent-communication-protocol.md` and `websocket-protocol.md` together. Understand the wire format, message types, and reconnection semantics before implementing any WebSocket server or client code.

8. **Read the database design** — `database-design.md`. Understand the physical schema, index strategy, and migration ordering before running any migrations or writing any query.

9. **Read the API contracts** — `api-contracts.md`. Understand every endpoint, its request/response schema, and its error surface before writing any controller or any frontend integration.

10. **Read the execution cluster** — `ADR-022-execution-cluster.md`. Understand queue priority scoring and starvation prevention before implementing or modifying the scheduler.

11. **Read the workspace strategy** — `ADR-025-workspace-strategy.md`. Understand warm pool provisioning, WorkspaceLock semantics, and presigned artifact upload before any workspace service work.

12. **Read parallel execution** — `ADR-029-parallel-execution.md`. Understand conflict detection and lock acquisition order before writing any code that touches concurrent task execution.

13. **Read the events catalog** — `ADR-028-engineering-events.md`. Every state transition must emit the correct event. Read this before wiring any listener or event publisher.

14. **Read the sequence diagrams** — `sequence-diagrams.md`. These diagrams are the authoritative specification of how components interact at runtime. Use them to verify your implementation matches the design.

15. **Read the release workflow** — `ADR-023-release-workflow.md` and `release-architecture.md` together. Understand the approval quorum, bridge pattern, and pipeline trigger before any release service work.

16. **Read the deployment architecture** — `deployment-architecture.md`. Understand the infrastructure topology and environment configuration before any DevOps or Docker work.

17. **Finish with the checklist** — `verification-checklist.md`. Before submitting any PR, run through this checklist. It encodes every architecture constraint as a verifiable gate.

---

## Technology Stack Summary

| Layer | Technology | Notes | ADR Reference |
|---|---|---|---|
| Backend framework | Laravel PHP (DDD module architecture) | Engineering Cloud lives in `Modules/Engineering/`. Follows the same DDD conventions as all ECOS modules. | ADR-020 |
| Frontend | React + TypeScript | Engineering OS Dashboard (TASK-ENG-005) and Pipeline UI (TASK-ENG-007) are the primary surfaces. | ADR-020 |
| Primary datastore | PostgreSQL | UUID primary keys on every table. company_id on every row. Soft deletes standard. Row-level isolation enforced at application layer. | ADR-021 |
| Cache and queue | Redis | ExecutionQueue priority scoring, distributed TaskLock, heartbeat expiry TTLs, WebSocket channel membership. Ephemeral — PostgreSQL is source of truth. | ADR-022 |
| Real-time messaging | Laravel WebSockets | Control Channel for agent↔platform communication. Agents connect via WebSocket; submit results via REST. | ADR-027 |
| Object storage | S3-compatible | TaskArtifact and PipelineArtifact storage. Agents receive presigned URLs; never upload through the API server. | ADR-025 |
| Agent authentication | JWT (24 h TTL, jti replay protection) | Issued at registration. Agents present JWT on every REST call. WebSocket handshake also validates JWT before upgrading. | ADR-026 |
| UI authentication | Laravel Sanctum | Human engineers authenticate through the standard ECOS Sanctum session. No separate token issuance. | ADR-026 |
| Agent registration | API Keys | One-time registration credential. After registration, the agent receives a JWT and discards the API key. | ADR-021 |
| Version control integration | GitHub | GitHubCiProvider (TASK-ENG-007) wraps the GitHub API behind the PipelineProvider interface. All GitHub types are confined to the adapter. | ADR-023 |
| Event bus | ECOS EnterpriseEventBus | Engineering Cloud domain events are published through the same bus used by all ECOS modules. | ADR-028 |

---

## Integration Map

| External System | Integration Type | Who Owns | Anti-Corruption Layer | Reference Document |
|---|---|---|---|---|
| Release Manager | EngineeringReleaseBridge (adapter + translator) | Platform Engineering | `EngineeringReleaseBridge` — translates ReleaseCandidate domain objects into Release Manager API calls; inbound release events are translated back to Engineering Cloud events before crossing the boundary. | `ADR-023-release-workflow.md`, `release-architecture.md` |
| Pipeline Platform | PipelineEventAdapter (event subscriber) | Platform Engineering | `PipelineEventAdapter` — subscribes to Pipeline domain events and translates them into `PipelineRunCompleted` / `PipelineRunFailed` Engineering Cloud events. The domain model never imports Pipeline types. | `ADR-022-execution-cluster.md`, `release-architecture.md` |
| Analytics | AnalyticsAdapter (fire-and-forget publisher) | Platform Engineering | `EngAnalyticsAdapter` — translates Engineering Cloud events into the Analytics platform's ingestion schema. Engineering Cloud never reads from Analytics. | `ADR-028-engineering-events.md` |
| Notifications | NotificationAdapter (outbound only) | Platform Engineering | `EngineeringNotificationAdapter` — maps domain events to notification payloads. Engineering Cloud never reads notification state. | `ADR-028-engineering-events.md` |
| Core Auth (Sanctum / Identity) | Direct dependency (UI session) | Core Platform | No ACL required — Sanctum session is the ECOS standard. Engineering Cloud reads `auth()->user()` and resolves company_id from the authenticated principal. No translation layer needed for the authenticated identity contract. | `ADR-026-security-architecture.md` |

---

## Non-Goals

Engineering Cloud explicitly does NOT do the following. Any feature request in these areas should be rejected at the ADR proposal stage or redirected to the responsible domain:

- **Source code storage or version control.** Engineering Cloud does not host git repositories. It integrates with GitHub via an adapter but does not own or replicate repository data.
- **Business domain task management.** Engineering Cloud manages engineering execution tasks. It is not a replacement for business-facing project management, CRM tasks, or order workflows. Those belong to their respective ECOS modules.
- **Agent training or model fine-tuning.** Engineering Cloud schedules and monitors agents. It does not train, evaluate, or modify the models that power agents.
- **Real-time collaboration between human engineers.** There is no whiteboard, live document editing, or pair-programming surface. The platform manages automated execution, not human collaboration sessions.
- **Billing or cost allocation.** Engineering Cloud does not track agent compute costs or chargeback usage to business units. Cost observability is an external concern.
- **Business analytics or KPI reporting.** Engineering Cloud emits events to the Analytics platform but does not own dashboards, KPI definitions, or business metrics. That responsibility belongs to the Dashboard KPI Layer (ADR-025 Dashboard Freeze).
- **Infrastructure provisioning.** Engineering Cloud manages logical Workspaces. It does not provision virtual machines, Kubernetes nodes, or cloud resources. Infrastructure is owned by the DevOps layer and consumed through the deployment architecture.
- **Data migration or ETL pipelines.** Engineering Cloud pipelines execute engineering workflows (CI, release, docs). They are not a general-purpose ETL or data pipeline platform.
- **Multi-tenant agent marketplaces.** Agents are registered within a single company_id scope. There is no mechanism for sharing or publishing agents across tenants.
- **Audit log archival or compliance reporting.** Engineering Cloud writes audit events but does not own long-term archival, compliance report generation, or GDPR erasure workflows. Those are platform-level concerns.

---

## Glossary

**anti-corruption layer** — An adapter type that sits at the boundary between Engineering Cloud and an external system. It translates external types and events into Engineering Cloud domain types, preventing external concepts from leaking into the core domain model.

**EngineeringAgent** — An autonomous software agent (such as a Claude instance or a CI agent) that registers with Engineering Cloud, receives tasks over the Control Channel, executes them in a Workspace, and submits results via REST.

**EngineeringTask** — The fundamental unit of work in Engineering Cloud. It carries a type, a priority, input parameters, and a reference to its assigned EngineeringWorker and Workspace. It moves through 11 states from Draft to Archived.

**EngineeringWorker** — The registration record for an agent's compute capacity. An EngineeringWorker advertises WorkerCapabilities, emits heartbeats, and transitions through 8 states from Unregistered to Terminated.

**ExecutionQueue** — The Redis-backed priority queue that holds Queued tasks awaiting assignment. Score is computed from base priority, urgency boost, and wait-time bonus. Starvation prevention promotes long-waiting tasks.

**ExecutionSession** — A single execution attempt of an EngineeringTask by an assigned EngineeringWorker. A task may have multiple ExecutionSessions if it is retried after failure. States: Initializing, Running, Paused, Completing, Completed, Failed, Aborted.

**Express Lane** — A dedicated high-priority queue slot reserved for tasks flagged as urgent by a platform operator. Express Lane tasks bypass normal priority scoring and are assigned to the next available capable worker.

**heartbeat** — A `WorkerHeartbeat` message emitted by an EngineeringWorker every 30 seconds over the WebSocket Control Channel. Three consecutive missed heartbeats move the worker to Offline and trigger task reassignment.

**PipelineRun** — A single execution of a pipeline template triggered by a ReleaseCandidate or a direct API call. It carries stage results, logs, and a terminal status (Completed or Failed) that is published back to Engineering Cloud via `PipelineEventAdapter`.

**priority score** — The numeric value assigned to a task in the ExecutionQueue. Computed as: base priority (set at task creation) + urgency boost (operator-applied) + wait-time bonus (linear, applied after a configurable threshold).

**ReleaseBundle** — The immutable set of TaskArtifacts and PipelineArtifacts assembled at release time and attached to a Released ReleaseCandidate. A ReleaseBundle is never modified after creation.

**ReleaseCandidate** — A proposal to release a body of completed engineering work. It moves through Draft → UnderReview → Approved → Staged → Released → RolledBack. Advancement past UnderReview requires a configurable approval quorum.

**TaskAttachment** — A file or URI associated with an EngineeringTask for reference purposes (design docs, specifications, screenshots). Unlike TaskArtifacts, attachments are inputs, not outputs.

**TaskComment** — A structured comment record on an EngineeringTask, authored by a human engineer or an agent. Comments are append-only and carry author_id, body, and created_at.

**TaskDependency** — A directed dependency edge between two EngineeringTasks. A task with unresolved dependencies may not advance beyond Queued until all upstream tasks reach Completed.

**TaskLock** — A distributed lock in Redis acquired before any EngineeringTask state transition. TTL is 30 seconds. Prevents concurrent state mutations on the same task. Failure to acquire returns a 409 to the caller.

**warm pool** — A set of pre-provisioned Idle Workspaces held ready for immediate assignment. When a task is assigned, a Workspace is pulled from the pool rather than provisioned on demand, keeping assignment latency sub-second.

**Workspace** — An isolated execution environment (file system namespace, environment variables, and resource limits) assigned to a single EngineeringTask. Protected by a WorkspaceLock. States: Pending, Provisioning, Active, Idle, Archiving, Archived, Failed.

**WorkspaceLock** — A record asserting that a specific EngineeringWorker holds exclusive write access to a Workspace. No second worker may acquire the lock while it is held. Cleared on task completion, failure, or expiry.

**WorkerCapability** — A record declaring that an EngineeringWorker can execute a specific task type within stated resource constraints (memory, CPU, GPU, timeout). The scheduler uses capability intersection to match tasks to workers.

**WorkerHeartbeat** — See *heartbeat*.

**WorkerResource** — A resource claim attached to an EngineeringWorker or a running ExecutionSession. Tracked by the parallel execution engine to detect resource conflicts before lock acquisition.

---

## Contact and Ownership

**Owner:** Platform Engineering team.

**Architecture questions** — Any deviation from a frozen ADR or a proposal for a new ADR must go through the CTO review process. Open a proposal document in `docs/adr/` following the standard ADR template and submit it for review before writing any implementation code that depends on the proposed change.

**Implementation questions** — Use the standard ECOS engineering task workflow. Create an EngineeringTask in the Engineering Cloud module, attach the relevant ADR references, and assign it through the normal queue process.

**Security incidents** — Follow the ECOS security incident response runbook. Engineering Cloud's zero-trust model means a compromised agent JWT must be revoked immediately by invalidating the jti in Redis and rotating the agent's API key.

---

## Version History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0 | 2026-07-22 | Platform Engineering | Initial architecture freeze. All 20 documents published. ADR-020 through ADR-029 frozen. No deviations permitted without approved ADR. |
