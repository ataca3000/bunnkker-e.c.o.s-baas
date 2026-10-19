# ADR-032: AI Repair Platform

**Status:** Accepted  
**Date:** 2026-07-23  
**Deciders:** Engineering OS Team  
**Context:** ECOS Engineering Cloud V2 - Repair Orchestration Layer (TASK-ENG-V2-001)

---

## Problem Statement

Engineering Cloud V1 (ENG-005 through ENG-009) established detection: pipeline failures are recorded, validation failures are surfaced, and the AI Engineering Supervisor produces findings and release recommendations. But repair is fully manual -- when something breaks, an engineer must reconstruct the failure context by hand, decide on a repair approach, write a prompt for Claude Code from scratch, and track the outcome nowhere.

There is no system of record for repair attempts, no structured failure analysis, no retry governance, and no audit trail connecting a failure to the fix that resolved it. V2 opens with a repair orchestration layer that closes this gap without crossing the safety boundary established in ADR-031.

---

## Decision

Implement an AI Repair Platform -- a human-in-the-loop repair orchestration layer that manages the full lifecycle of a repair attempt: failure intake, deterministic root cause analysis, versioned prompt engineering, response capture, patch tracking, and append-only audit.

### 1. Repair Session Lifecycle

Every repair attempt is a repair session with an enforced 10-state lifecycle:

pending, analyzing, generating_prompt, awaiting_response, applying, completed, failed, cancelled, retrying, timeout

The transition matrix is enforced in the RepairSessionStatus enum. Every state declares its legal successor states; any attempt to move a session through an illegal transition throws -- there is no silent coercion and no bypass path. Terminal states (completed, cancelled) accept no further transitions; failed and timeout may only proceed to retrying under the retry policy.

### 2. Human-in-the-Loop Boundary

The platform NEVER modifies production code and NEVER invokes Claude autonomously. This is the non-negotiable safety constraint, inherited from ADR-031 and extended to the repair domain.

The platform's role ends at preparation and record-keeping:

- It prepares prompt packages via ClaudeCodeIntegration.prepareClaudePackage.
- A human copies the prompt into Claude Code.
- The human pastes Claude's response back into the platform.
- The human reviews the proposed patches and explicitly applies them.

Patch application inside the platform only flags is_applied and writes an audit record. The actual file changes remain a human/Claude Code action performed outside the platform. There is no code path in the platform that writes to a repository, invokes an LLM API, or executes generated code.

### 3. Root Cause Classification

Root cause analysis is performed by RootCauseClassifier, a keyword-pattern classifier over the failure context. It covers 5 failure families:

build, test, validation, security, architecture

The classifier is deterministic -- no LLM inference is involved. The same failure context always yields the same classification, which makes every analysis reproducible and auditable.

Each classification carries a confidence score derived from evidence richness: a base of 50 plus bonuses for each piece of corroborating evidence found in the failure context, capped at 100. Sparse contexts produce low-confidence classifications that fall through to a general category rather than guessing.

### 4. Prompt Engineering Pipeline

RepairPromptBuilder produces versioned repair prompts. Each prompt contains:

- System context describing the platform, module, and failure
- Markdown repair instructions derived from the root cause analysis
- 6 standing constraints (the safety and scope rules every repair must respect)
- Approach-specific success criteria
- A context file list pointing the human at the relevant source files
- A token estimate for the assembled package

Only one prompt per session may be active at a time. Retries do not mutate the existing prompt -- they generate a new version, preserving the full prompt history for audit.

### 5. Retry and Timeout Governance

RetryPolicyEngine governs how many times a session may re-enter the repair loop. Per-failure-type defaults:

- build, test, pipeline: 3 attempts
- security, architecture: 1 attempt
- all others: 2 attempts

Companies may override defaults with RepairRetryPolicy rows, which also carry a backoff multiplier applied between attempts.

Every session carries a timeout_at timestamp (default 300 seconds from activation). RepairSessionManager.enforceTimeout transitions overdue sessions to the timeout state, ensuring no session waits indefinitely in awaiting_response or applying.

### 6. Auditability

Every state change, prompt generation, response capture, and patch application is recorded in engineering_repair_history, which is append-only -- there is no UPDATE path. Aggregate repair performance is recorded in engineering_repair_metrics for trend analysis and future consumption by the Self-Healing Pipeline.

---

## Database (8 tables)

| Table | Purpose |
|-------|---------|
| engineering_repair_sessions | The repair session aggregate: state, failure context, timeout, retry count |
| engineering_repair_analyses | Root cause classifications with confidence scores and evidence |
| engineering_repair_prompts | Versioned prompt packages; one active per session |
| engineering_repair_responses | Claude responses pasted back by the human |
| engineering_repair_patches | Proposed patches with is_applied flag and review metadata |
| engineering_repair_history | Append-only audit log of every session event |
| engineering_repair_retry_policies | Per-company retry overrides with backoff multipliers |
| engineering_repair_metrics | Append-only repair performance timeseries |

Conventions:
- Sessions: UUID PK + company_id (tenant isolation) + SoftDeletes
- Responses, history, metrics: append-only bigIncrements, no update path

---

## API (21 routes)

All routes live under /api/system/engineering/repair and are protected by auth:sanctum + throttle:60,1.

- Dashboard: aggregate repair status and metrics
- Sessions CRUD: list, create, show, update, delete
- Session actions: analyze, generate-prompt, prompt-package, response, patches-apply, complete, fail, cancel, retry, history
- Subresources: prompts, responses, patches per session

---

## Alternatives Considered

1. Fully autonomous repair agent -- rejected. It violates the standing safety constraint that no system modifies production code without human review. The entire Engineering Cloud is built on analysis-and-recommendation; an agent that writes and applies its own fixes would break that contract.
2. LLM-based root cause analysis -- rejected for V2-001. LLM inference is non-deterministic, adds cost and latency to every failure, and produces classifications that cannot be replayed or audited. The keyword classifier is deterministic and auditable; LLM-assisted analysis may be revisited in a later ADR.
3. Storing patches as applied file mutations -- rejected. The platform records intent and audit only. Persisting actual file mutations would make the platform a code-modification system, which crosses the human-in-the-loop boundary.

---

## Consequences

Positive:
- Full auditability -- every repair attempt, prompt, response, and patch decision is on the record
- Human control -- no code changes happen without explicit human review and action
- Deterministic analysis -- root cause classification is reproducible and explainable
- Foundation for TASK-ENG-V2-002 Self-Healing Pipeline -- patch verification will consume RepairPatch records produced here

Negative:
- The manual copy/paste loop between the platform and Claude Code adds friction to every repair
- The keyword classifier has limited coverage of novel failure modes (mitigated by the _general fallback category)

---

## Boundaries

Explicitly out of scope for this ADR, each owned by its own future ADR:

- Self-Healing Pipeline validation (TASK-ENG-V2-002)
- Autonomous Guardian (TASK-ENG-V2-003+)
- Engineering Intelligence

---

## Related ADRs

- ADR-030: Release Orchestrator
- ADR-031: AI Engineering Supervisor (detection layer whose findings feed repair sessions; source of the human-in-the-loop safety constraint)
