# ADR-AIOP-001: Platform Vision
## Architecture Decision Record

**Status:** Accepted  
**Date:** 2026-07-18  
**Decision Makers:** CTO, Engineering Architecture Team  

---

## Context

ECOS ERP currently manages all business operations domains (Commerce, Operations, Manufacturing, Distribution, Finance). Engineering teams are adopting AI coding agents (Claude Code, Gemini CLI, Codex) on individual developer machines without organizational visibility, governance, or audit capability.

As AI agent adoption accelerates, three organizational risks emerge:
1. AI-generated changes enter codebases without structured review
2. No audit record of which AI produced which change
3. No visibility into AI agent capacity, utilization, or success rates

We need to decide how to formalize AI agent use within the engineering organization.

---

## Decision

We will build an **AI Operations Platform (AIOP)** as a first-class ECOS ERP module.

AIOP will:
- Register and govern AI agents and workers
- Manage engineering task lifecycles from creation to merge
- Orchestrate AI agent execution with human approval gates
- Store all artifacts and maintain an immutable audit trail
- Provide real-time operational visibility on desktop and mobile

AIOP will **not** replace engineers, make autonomous deployment decisions, or operate without human approval at critical lifecycle gates.

---

## Rationale

### Why a first-class module rather than a separate system?

A separate system would require:
- Separate authentication and user management
- Separate notification infrastructure
- Duplicate audit trail capabilities
- Separate deployment and operations overhead

ECOS ERP already provides all of these. AIOP as a module reuses the full platform infrastructure and gives engineering managers a single operational interface.

### Why require human approval at every execution?

The engineering organization's credibility depends on code quality. AI agents, however capable, produce output that requires human judgment about correctness, security, and architectural fit. The approval gate is the organization's quality guarantee.

### Why design for vendor agnosticism now?

The AI landscape is changing rapidly. Committing the platform to Claude Code specifically means a costly redesign when the next superior agent becomes available. The connector abstraction is a 10% additional design investment that prevents a 100% redesign later.

---

## Consequences

### Positive
- Engineering managers gain full visibility into AI-generated work
- Every AI change is auditable, attributable, and reversible
- The organization can adopt new AI providers without platform redesign
- AI execution becomes a managed, measurable organizational capability

### Negative
- Engineering teams must adopt the platform rather than running AI agents directly
- Additional latency in the task lifecycle (queue, poll, review steps)
- Platform requires maintenance as ECOS ERP evolves

### Risks
- Adoption resistance from engineers who prefer direct AI agent use
- Mitigation: Platform must be faster and lower-friction than the alternative

---

## Alternatives Considered

### A: Do nothing — let engineers use AI agents individually
Rejected: No governance, no audit, no visibility. Unacceptable at enterprise scale.

### B: Integrate with an off-the-shelf AI orchestration platform
Rejected: No integration with ECOS data, auth, audit infrastructure. Creates a siloed system.

### C: Build a lightweight task board with manual AI execution reporting
Rejected: Does not capture the execution, does not provide real-time visibility, not scalable.
