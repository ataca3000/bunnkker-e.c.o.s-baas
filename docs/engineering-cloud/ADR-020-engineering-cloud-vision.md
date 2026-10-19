# ADR-020 — Engineering Cloud Vision

## Status: Approved | Date: 2026-07-22 | Replaces: N/A

---

## 1. Context and Problem Statement

ECOS has grown from a single-team product into a multi-module enterprise platform spanning Operations, Inventory, Distribution, Marketing, Procurement, and Engineering systems. As the platform matures, the cost of managing engineering work manually has become a structural bottleneck. Engineers spend disproportionate time triaging tasks, coordinating handoffs, chasing status updates, and recovering from interrupted or failed work. Tooling exists in silos — pipelines in one place, task tracking in another, release coordination in yet another — with no single platform that understands the full lifecycle of an engineering task from creation to deployment.

At the same time, a new class of participant has entered software development: autonomous developer agents. These agents can accept well-defined tasks, execute implementation steps, produce artifacts, and report outcomes — but existing infrastructure is designed for human developers. Agents have no mechanism to register their capabilities, acquire exclusive workspace locks, receive heartbeat-driven health monitoring, or participate in structured release pipelines. Without a platform purpose-built for both humans and agents, ECOS cannot safely or reliably harness this new capability.

The Engineering Cloud exists to close both gaps simultaneously. It provides the coordination layer that eliminates manual overhead for human engineers while providing the structured execution environment that autonomous agents require. The cost of inaction is continued fragmentation: duplicated effort, untracked work, uncoordinated releases, and an inability to scale development velocity in proportion to the platform's growing scope.

---

## 2. Mission

The ECOS Engineering Cloud is the authoritative platform for the full lifecycle of engineering work — from task inception through autonomous or human execution, workspace provisioning, artifact production, release pipeline integration, and post-release audit — enabling ECOS to operate a coordinated fleet of human engineers and autonomous developer agents at enterprise scale, with complete observability, zero-trust security, and a policy of human override available at every stage.

---

## 3. Strategic Goals

**1. Autonomous Task Execution**
The platform must support end-to-end autonomous execution of EngineeringTasks by registered EngineeringAgents without requiring human intervention at each step. Tasks progress through the canonical state machine — Draft, Queued, Assigned, Accepted, Running, Paused, Completed, Failed, Cancelled, Released, Archived — with agents responsible for state transitions within their assigned scope. The platform guarantees that every transition is audited, reversible where safe, and visible to human overseers at all times.

**2. Developer Agent Fleet Management**
The platform must provide a first-class registration, capability declaration, heartbeat, and lifecycle management system for EngineeringWorkers, whether they represent human engineers or autonomous agents. Worker states — Unregistered, Registering, Idle, Busy, Paused, Draining, Offline, Terminated — are tracked in real time, with automatic eviction of workers that fail to heartbeat within configured thresholds. Fleet operators can inspect, pause, drain, or terminate any worker at any time without data loss.

**3. Parallel Development at Scale**
Concurrent engineering work at scale requires workspace isolation. Each EngineeringTask executes within a dedicated Workspace that passes through Pending, Provisioning, Active, Idle, Archiving, and Archived states. WorkspaceLocks prevent concurrent modification of shared resources. TaskDependency graphs ensure ordering guarantees across parallel workstreams. The platform must support hundreds of concurrently active workspaces without contention, resource leak, or cross-workspace interference.

**4. Release Pipeline Integration**
Every completed EngineeringTask that produces deployable output must flow through a structured release lifecycle. ReleaseCandidates aggregate TaskArtifacts and PipelineArtifacts into a ReleaseBundle, progressing through Draft, UnderReview, Approved, Staged, Released, and RolledBack states. The Engineering Cloud owns the promotion gates between stages and integrates with the existing Pipeline Platform and Release Manager without duplicating their responsibilities. A rollback at any release stage must be executable in under five minutes.

**5. Observability and Audit**
Every action taken by any participant — agent, human, or platform scheduler — must produce an immutable, actor-stamped ExecutionLog entry. PipelineRun histories, WorkerHeartbeat records, ExecutionSession timelines, and TaskComment threads must be queryable without time limits. The platform surfaces real-time metrics through the Engineering OS Dashboard and exposes structured events for downstream analytics. Observability is not a feature to be added later; it is a foundational constraint applied from the first line of the schema.

**6. Platform Extensibility**
The Engineering Cloud is a platform, not a product. It must expose stable, versioned contracts — event schemas, API shapes, and capability interfaces — that allow new agent types, new pipeline providers, new workspace backends, and new analytics consumers to integrate without modifying core platform code. WorkerCapability declarations, the ProviderRegistry pattern, and backwards-compatible schema evolution are the mechanisms by which extensibility is achieved. No integration should require a core platform change to ship.

---

## 4. Design Principles

**Agent-First Design**
Every interface, API contract, and data model in the Engineering Cloud is designed for machine consumption first and human consumption second. This does not mean human experience is deprioritized — it means that APIs are precise, deterministic, and stateless by default, so that both agents and the UIs built on top of them behave identically under the same inputs. Agent-first design eliminates the category of bugs that arise when a UI assumes state that the API does not guarantee.

**Event-Driven Everything**
State changes within the Engineering Cloud are communicated exclusively through named, versioned, immutable domain events following the PascalCase past-tense convention — TaskCreated, WorkerRegistered, WorkspaceProvisioned, and so forth. No component polls another component for state. Consumers subscribe to events and maintain their own projections. This architecture decouples producers from consumers, enables replay-based recovery, and provides a complete audit trail as a natural byproduct of normal operation rather than as an afterthought.

**Zero-Trust Security**
No component within the Engineering Cloud is trusted by virtue of its network location or identity claim alone. EngineeringAgents authenticate using API Keys at registration and JWT tokens for session operations. Human operators authenticate through Laravel Sanctum. Every request is verified against the authenticated identity's declared permissions. Workspace access is scoped to the assigned worker and task. Cross-workspace reads are forbidden at the infrastructure level, not merely by convention.

**Workspace Isolation by Default**
Every EngineeringTask executes within a Workspace that is isolated from all other Workspaces by default. Shared state is only permitted through explicit, audited, lock-protected mechanisms. A failure within one Workspace — whether caused by a buggy agent, a malformed artifact, or an external service outage — must not propagate to any other Workspace or affect the state of any other EngineeringTask. Isolation is enforced at provisioning time and validated at every state transition.

**Idempotent Operations**
Every mutation exposed by the Engineering Cloud — task assignment, workspace provisioning, artifact upload, heartbeat registration — is idempotent. Agents may safely retry any operation after a network failure without risk of duplicate state, double-counted resources, or phantom records. Idempotency keys are accepted on all write operations and enforced at the database layer. This principle eliminates an entire class of failure modes that otherwise require complex compensation logic.

**Fail-Fast with Recovery**
When a component of the Engineering Cloud detects an inconsistency — a missing heartbeat, an artifact checksum mismatch, a failed pipeline stage — it fails loudly and immediately rather than silently degrading. Failure is surfaced through events, metrics, and operator alerts within seconds. Alongside fast failure, the platform provides structured recovery paths: tasks can be retried from a checkpoint, workers can be drained and replaced, and workspaces can be restored from the last committed artifact snapshot. Failing fast without recovery is alarm fatigue; recovery without fast failure is silent corruption.

**Human Override Always Available**
Autonomous agents operate with significant authority within the Engineering Cloud, but no agent decision is irrevocable without a human confirmation gate. At any point in any ExecutionSession, a human operator can pause, inspect, redirect, or terminate the session. ReleaseCandidates require human approval before promotion to Staged or Released. Rollbacks can be initiated by any operator with appropriate permissions regardless of how the release was initiated. The platform is designed to make human override the lowest-friction action available, not an emergency escape hatch.

**Observability as a First-Class Citizen**
Metrics, traces, and logs are not instrumented on top of the Engineering Cloud after the fact — they are part of the domain model. ExecutionLog, WorkerHeartbeat, PipelineRun, and ExecutionSession entities exist as domain objects with full lifecycle semantics, not as side-effect outputs of other operations. Every dashboard, alert, and audit query is answered from these first-class domain entities. Observability is therefore as reliable and as tested as any other part of the platform.

**Backwards-Compatible Evolution**
The Engineering Cloud's external contracts — event schemas, REST API shapes, webhook payloads, and worker registration protocols — evolve exclusively through additive changes. Fields are never removed; they are deprecated with a documented sunset timeline. New event versions are published alongside old versions during a transition period. Agents built against a given contract version continue to function correctly when the platform is upgraded. This principle allows the platform to evolve rapidly without forcing coordinated upgrades across the agent fleet.

**Minimal Blast Radius**
Changes to the Engineering Cloud are scoped to the smallest possible unit of impact. A new agent capability does not require a platform-wide deployment. A schema migration is run against a single table, not a global rebuild. A pipeline provider integration failure affects only the tasks routed to that provider, not the entire execution queue. The platform is decomposed into units — task management, worker lifecycle, workspace provisioning, release pipeline, analytics — that can fail, be upgraded, or be scaled independently. Minimizing blast radius is an architectural constraint enforced at design time, not a deployment-time mitigation.

---

## 5. Platform Scope

### In Scope

The Engineering Cloud owns the following capabilities in their entirety:

1. **EngineeringTask lifecycle management** — creation, state machine transitions, dependency resolution, and archival of all engineering tasks.
2. **EngineeringWorker registration and fleet management** — API Key issuance, JWT session management, capability declaration, heartbeat monitoring, and eviction of human and agent workers.
3. **ExecutionSession management** — session initialization, state tracking (Initializing, Running, Paused, Completing, Completed, Failed, Aborted), and session-level audit trails.
4. **ExecutionQueue management** — priority-ordered task queuing, assignment to eligible workers based on WorkerCapability matching, and queue depth observability.
5. **Workspace provisioning and lifecycle** — Workspace creation, state management (Pending through Archived), WorkspaceLock acquisition and release, and workspace restoration from artifact snapshots.
6. **TaskArtifact and PipelineArtifact management** — artifact upload, checksum validation, storage, versioning, and association with tasks, sessions, and pipeline runs.
7. **TaskDependency graph management** — declaration, validation, and enforcement of dependency ordering across concurrent tasks.
8. **TaskComment and TaskAttachment management** — structured commentary and file attachment associated with task records, queryable as part of the task audit trail.
9. **ReleaseCandidate and ReleaseBundle lifecycle** — aggregation of task artifacts into release candidates, promotion gates through the release state machine, and rollback execution.
10. **PipelineRun tracking** — association of pipeline executions with tasks and releases, run status propagation, and failure event publication.
11. **ExecutionLog persistence and query** — immutable, actor-stamped log entries for every platform action, retained without time limit and queryable through the Engineering OS API.
12. **WorkerResource and WorkerCapability declaration** — structured declaration of the resources a worker can consume and the task categories it can accept, used for eligibility matching at assignment time.
13. **WorkerHeartbeat ingestion and liveness enforcement** — periodic heartbeat receipt, configurable lapse thresholds, and automatic worker state transitions on heartbeat failure.
14. **TaskLock management** — advisory and exclusive locking primitives that prevent concurrent modification of shared task resources across parallel workstreams.
15. **Engineering Cloud event publication** — all domain events emitted by the platform are published to the ECOS event bus for downstream consumption by analytics, notifications, and external integrations.

### Out of Scope

The Engineering Cloud deliberately does not own the following:

1. **Source code hosting or version control** — the platform integrates with GitHub through the GitHubCiProvider but does not host, store, or manage repositories or branches.
2. **CI/CD execution infrastructure** — build runners, container orchestration, and test execution environments are provided by external CI systems; the platform tracks their output through PipelineRun records but does not execute builds itself.
3. **Business domain logic for any ECOS module** — the Engineering Cloud has no knowledge of Orders, Inventory, Distribution, or any other business domain. It is a horizontal platform layer.
4. **User identity and authentication** — the Engineering Cloud consumes identity from Laravel Sanctum and the ECOS JWT infrastructure but does not manage user accounts, passwords, or organization membership.
5. **Business analytics and KPI reporting** — the Engineering OS Dashboard and analytics pages are consumers of Engineering Cloud events; the business intelligence layer lives in the Analytics module and is not owned by this platform.
6. **Infrastructure provisioning and cloud resource management** — the Engineering Cloud does not create or manage cloud infrastructure, virtual machines, Kubernetes clusters, or database instances. It operates on top of existing infrastructure.

---

## 6. Long-Term Roadmap

### Phase 1 — Foundation (Months 0–6)

- Deploy core domain models: EngineeringTask, EngineeringAgent, EngineeringWorker, ExecutionSession, ExecutionQueue, and Workspace with full state machine enforcement and UUID primary keys under company_id isolation.
- Implement worker registration protocol: API Key issuance, JWT session authentication, WorkerCapability declaration, and heartbeat ingestion with configurable eviction thresholds.
- Deliver the Engineering OS Dashboard with real-time task queue depth, worker fleet status, active session count, and system health indicators with thirty-second auto-refresh.
- Implement the base release pipeline: ReleaseCandidate creation, artifact aggregation into ReleaseBundles, and the Draft → UnderReview → Approved → Staged → Released state machine with human approval gates.
- Establish the ExecutionLog schema and persistence layer with actor-stamped, immutable entries covering all task, worker, workspace, and release state transitions.

### Phase 2 — Scale (Months 6–12)

- Implement the full TaskDependency graph engine with cycle detection, topological ordering, and runtime enforcement of dependency preconditions before task assignment.
- Deploy WorkspaceLock infrastructure supporting advisory and exclusive locks with deadlock detection, configurable timeout, and automatic release on worker eviction.
- Build the ExecutionQueue priority engine with weighted scoring across task urgency, worker capability match quality, workspace readiness, and dependency chain depth.
- Deliver PipelineRun tracking with bidirectional association to tasks, sessions, and release candidates, plus failure event propagation and retry policy enforcement through the RetryPolicy value object.
- Launch the WorkerResource management system enabling workers to declare memory, CPU, and concurrency constraints, and enabling the queue assignment engine to respect declared resource budgets.

### Phase 3 — Intelligence (Months 12–18)

- Deploy the Engineering Analytics Engine: historical task throughput, worker utilization, mean time to completion by task category, and failure rate trending, all queryable through the Engineering OS API.
- Implement predictive queue routing: use historical WorkerCapability-to-task-outcome data to score worker-task assignment candidates and prefer assignments with higher predicted success probability.
- Build the Workspace Snapshot and Restore system: periodic artifact checkpoints within active workspaces enabling mid-task recovery without full re-execution from the initial state.
- Deliver intelligent release risk scoring: aggregate task failure rates, artifact anomaly signals, and pipeline run histories into a per-release risk score surfaced in the ReleaseCandidate review interface.
- Launch the Engineering Insight Engine: automated detection of queue starvation, worker fleet imbalance, dependency bottlenecks, and release cycle regressions, published as structured insight events consumed by the Engineering OS Dashboard.

### Phase 4 — Ecosystem (Months 18–24)

- Publish the Engineering Cloud Agent SDK: a versioned, documented SDK for building EngineeringWorker-compatible agents in any language, with reference implementations covering task acceptance, heartbeat, artifact upload, and session management.
- Implement the Plugin Provider Registry: a structured extension point allowing third-party CI providers, artifact stores, and notification channels to integrate with the Engineering Cloud through a declared capability interface without modifying platform code.
- Deliver cross-organization Engineering Cloud federation: allow multiple ECOS company tenants to share a worker pool under explicit cross-company authorization, with full company_id isolation preserved at the data layer.
- Launch the Engineering Cloud Marketplace: a curated registry of published EngineeringWorker capability profiles that platform operators can install, configure, and assign to their execution queues without custom development.
- Complete the Engineering Cloud API versioning infrastructure: full v1 contract freeze with documented deprecation timelines, parallel v2 schema publication, and automated compatibility test suites that run on every platform release.

---

## 7. Engineering Philosophy

**How Tradeoffs Are Made**

The Engineering Cloud makes tradeoffs by applying a single consistent priority ordering: correctness before consistency, consistency before performance, performance before convenience. A platform that produces wrong results quickly is worse than one that produces correct results slowly. A platform that is eventually consistent without surfacing its inconsistency windows is worse than one that is slower but predictably serialized. Performance optimizations are welcome and actively pursued, but never at the cost of the two properties above. When a proposed change improves performance while introducing even a small risk of correctness regression, the change is rejected unless it can be made safe through idempotency keys, transactional boundaries, or compensating events. Convenience — simpler APIs, shorter workflows, fewer configuration options — is valued, but it is always the last item on the priority list, never the first.

**Automation vs. Human Judgment**

The Engineering Cloud does not pursue full automation as an end in itself. Automation is applied where it produces reliable, auditable, recoverable outcomes — task queuing, worker assignment, heartbeat enforcement, artifact validation — and deliberately withheld where the cost of an automated error exceeds the cost of human latency. Release promotion to production is always a human decision. Rollback authorization requires a human actor. Resolution of worker conflicts that cannot be resolved by the locking protocol surfaces to a human operator rather than being resolved by a tie-breaking heuristic. This boundary between automated and human-gated decisions is documented, tested, and enforced at the API layer. It is not a philosophical preference but a structural guarantee that the platform provides to every operator who relies on it.

**Commitment to Architectural Integrity**

Architectural integrity in the Engineering Cloud is maintained through three commitments. First, the canonical vocabulary defined in this document and enforced across ADR-021 through ADR-029 is the single source of truth for naming. Any code, document, or migration that uses a synonym for a canonical entity name is incorrect and must be corrected before merge. Second, the ADR series is a living, numbered record of every significant decision made about the platform. Decisions are not made in pull request comments, Slack threads, or informal reviews — they are made in ADRs, reviewed by the platform team, and frozen upon approval. Third, the platform evolves through addition, not modification. Approved contracts are not changed retroactively. When a decision turns out to be wrong, a new ADR supersedes the old one, and the supersession is documented explicitly. This discipline is what allows a growing team, a growing agent fleet, and a growing integrator ecosystem to operate on the same platform without coordination overhead proportional to the number of participants.

---

## 8. Relationship to Existing ECOS Systems

The Engineering Cloud integrates with the following existing ECOS systems as a consumer of their contracts, never as a modifier of their internals:

**Release Manager (TASK-ENG-006)**: The Engineering Cloud's ReleaseCandidate and ReleaseBundle lifecycle is informed by and feeds into the Release Manager's release tracking, but does not duplicate its responsibilities. The Release Manager owns the human-facing release workflow and approval UI. The Engineering Cloud owns the automated state machine that prepares a release for human review. Events flow from the Engineering Cloud to the Release Manager; the Release Manager does not write back to Engineering Cloud domain entities.

**Pipeline Platform (TASK-ENG-007)**: The Enterprise Pipeline Platform owns pipeline template management, PipelineRun execution coordination, retry policy application, and GitHub CI integration through the GitHubCiProvider. The Engineering Cloud consumes PipelineRun outcome events to update task and release states. The Engineering Cloud does not execute pipelines, manage pipeline templates, or configure CI providers. The two platforms communicate exclusively through named domain events.

**Engineering OS Analytics (TASK-ENG-005)**: The Engineering OS Dashboard and its associated analytics pages are consumers of Engineering Cloud events and API endpoints. The Engineering Cloud publishes events and exposes read endpoints. The analytics layer queries and visualizes; it does not write back to Engineering Cloud state. New analytics requirements are satisfied by adding new event types or new read endpoints, not by coupling the analytics layer to internal Engineering Cloud writes.

**Notifications**: The ECOS notification infrastructure subscribes to Engineering Cloud events — TaskCreated, WorkerRegistered, ExecutionSession state changes, ReleaseCandidate promotions — and delivers notifications through configured channels. The Engineering Cloud does not own notification delivery, channel configuration, or subscriber management. It publishes events; the notification system decides who receives them and how.

**Operations OS**: The Operations OS — encompassing Wave management, Fulfillment, Distribution, and Loading — is a separate bounded context. The Engineering Cloud has no knowledge of operations domain entities and does not share database tables, services, or event handlers with the Operations OS. The relationship is one of organizational context only: both platforms run within the same ECOS multi-tenant infrastructure, under the same company_id isolation model, but their domain boundaries are non-overlapping and their codebases do not import from each other.

---

## 9. Architecture Freeze Policy

Upon approval of this document on 2026-07-22, the Engineering Cloud architecture enters a freeze on all contracts defined in or referenced by ADR-021 through ADR-029. The freeze applies to:

- The canonical vocabulary defined in this document — entity names, state machine states, and event naming conventions.
- The domain event schemas published by the Engineering Cloud.
- The REST API contract shapes exposed by the Engineering Cloud to workers, agents, and UI consumers.
- The worker registration and heartbeat protocol, including the API Key and JWT authentication flow.
- The Workspace provisioning and locking protocol.
- The ReleaseCandidate and ReleaseBundle lifecycle state machine.

Any deviation from a frozen contract — whether a rename, a field removal, a state addition, a new authentication requirement, or a breaking change to an event schema — requires a new ADR approved by the platform architecture team before the change is implemented. The new ADR must explicitly identify which frozen contract it supersedes, document the migration path for existing integrators, and specify a deprecation timeline for the superseded contract version.

Pull requests that modify a frozen contract without a corresponding approved ADR will not be merged. This policy is enforced through code review, not automation, and platform architects are accountable for its application. The freeze date is **2026-07-22**.
