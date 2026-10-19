# ECOS AI Operations Platform (AIOP)
## Architecture Documentation Index

**Status:** Architecture Review Phase — No implementation has begun.  
**Date Completed:** 2026-07-18  

---

## Document Index

### Core Vision and Architecture

| # | Document | Description |
|---|---|---|
| 01 | [Vision Document](01-vision.md) | Purpose, business value, design philosophy, guiding principles |
| 02 | [Enterprise Architecture](02-enterprise-architecture.md) | 3-tier architecture, module decomposition, deployment diagrams, sequence diagrams |

### Architecture Decision Records

| ADR | Document | Decision |
|---|---|---|
| ADR-AIOP-001 | [Platform Vision](adrs/ADR-AIOP-001-platform-vision.md) | Build AIOP as a first-class ECOS ERP module |
| ADR-AIOP-002 | [Worker Communication](adrs/ADR-AIOP-002-worker-communication.md) | HTTP polling (10s) + HTTP POST for updates |
| ADR-AIOP-003 | [Task Lifecycle](adrs/ADR-AIOP-003-task-lifecycle.md) | 14-state task machine |
| ADR-AIOP-004 | [Security Model](adrs/ADR-AIOP-004-security-model.md) | 7 defense layers, threat model |
| ADR-AIOP-005 | [Multi-Agent Strategy](adrs/ADR-AIOP-005-multi-agent-strategy.md) | AgentConnector abstraction, capability-based routing |
| ADR-AIOP-006 | [Review & Approval Workflow](adrs/ADR-AIOP-006-review-approval-workflow.md) | Two-stage review (Technical + Governance) |
| ADR-AIOP-007 | [Artifact Storage](adrs/ADR-AIOP-007-artifact-storage.md) | S3-compatible object storage + metadata in DB |
| ADR-AIOP-008 | [Execution Isolation](adrs/ADR-AIOP-008-execution-isolation.md) | Docker-first (Tier 1), filesystem fallback (Tier 2) |

### Domain and Data

| # | Document | Description |
|---|---|---|
| 04 | [Domain Model](04-domain-model.md) | 19 domain entities with relationships and lifecycle |
| 05 | [Database Design](05-database-design.md) | All tables, columns, constraints, indexes, retention strategy |

### Technical Architecture

| # | Document | Description |
|---|---|---|
| 06 | [Worker Architecture](06-worker-architecture.md) | Registration, heartbeat, polling, execution lifecycle, crash recovery |
| 07 | [Agent Connector Architecture](07-agent-connector-architecture.md) | Connector interface, ClaudeCode/Gemini/Stub implementations, capability routing |
| 08 | [REST API Specification](08-rest-api-specification.md) | All endpoints with request/response/auth/error specs |
| 09 | [Event Architecture](09-event-architecture.md) | Full domain event catalog with payloads, publishers, subscribers |
| 10 | [Security Architecture](10-security-architecture.md) | Identity, authorization, secrets, sandbox, audit trail, threat model |

### Product and Delivery

| # | Document | Description |
|---|---|---|
| 11 | [UX Architecture](11-ux-architecture.md) | Navigation, screen inventory, wireframes, responsive behavior, notifications |
| 12 | [Review Pipeline](12-review-pipeline.md) | End-to-end engineering workflow from Idea to Merge |
| 13 | [Scalability Strategy](13-scalability-strategy.md) | Worker scaling, cloud/K8s deployment, distributed execution |
| 14 | [Roadmap](14-roadmap.md) | 3 phases with milestones, acceptance criteria, risks, and decision log |

---

## Key Decisions Summary

| Topic | Decision |
|---|---|
| Module structure | `Modules/AIOP/Domain|Application|Infrastructure|Presentation` |
| Worker communication | HTTP polling every 10s + HTTP POST for updates |
| Task states | 14 states (DRAFT → PENDING → QUEUED → ASSIGNED → IN_PROGRESS → ...) |
| Execution isolation | Docker container per execution; `--network none`, `--cap-drop ALL`, non-root |
| Artifact storage | S3-compatible; metadata in DB; presigned URLs; SHA-256 verification |
| Secret handling | AES-256-GCM encrypted at rest; decrypted in worker memory only; injected as env vars |
| Review model | Technical Review (always) + Governance/CTO Approval (policy-driven) |
| Agent abstraction | `AgentConnector` interface; Phase 1: Claude Code + Gemini CLI + Stub |
| Capability routing | Task declares required capabilities; control plane matches to available workers |
| Audit trail | Append-only `aiop_audit_log`; 7-year retention; no DELETE/UPDATE |

---

## Stop Condition

This repository contains architecture documents only. No implementation has begun.

**Before any implementation starts:**
- [ ] Architectural review complete
- [ ] All required decisions resolved (see Section 6 of Roadmap)
- [ ] Phase 1 scope confirmed
- [ ] CTO approval obtained

> IMPORTANT: Do not create migrations, models, controllers, routes, or frontend components until architectural review is complete and implementation is explicitly approved.
