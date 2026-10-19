# ADR-AIOP-006: Review & Approval Workflow
## Architecture Decision Record

**Status:** Accepted  
**Date:** 2026-07-18  

---

## Context

AI-generated code must pass through a structured human review before merging. The review workflow must be:
- Structured (reviewers see the same information every time)
- Enforced (bypass is not possible without platform-level override)
- Traceable (every decision is recorded with actor and rationale)
- Policy-driven (different task types require different approval levels)

---

## Decision

### Two-Stage Review Model: Technical Review + Governance Approval

```
Execution Complete
      │
      ▼
┌─────────────────┐
│  REVIEW STAGE 1 │  Technical Review
│                 │  Who: Assigned Senior Engineer
│  - Code diff    │  SLA: 4 hours (configurable)
│  - Test results │
│  - AI report    │
│  - Logs         │
└───────┬─────────┘
        │
  ┌─────┴────────────────────┐
  │                          │
  ▼                          ▼
Changes                  Approved
Requested               (Technical)
  │                          │
  │                          ▼
  │                   ┌─────────────────┐
  │                   │  REVIEW STAGE 2 │  Governance Approval
  │                   │                 │  (only if policy requires)
  │                   │  - Architecture │
  │                   │  - Security     │
  │                   │  - Cost impact  │
  │                   └───────┬─────────┘
  │                           │
  │                     ┌─────┴────────┐
  │                     │              │
  │                    CTO          Rejected
  │                  Approved           │
  │                     │              │
  └─────────────────────┼──────────────┘
                        │
                        ▼
                   MERGING / COMPLETED
```

### Review Policies

Review policies are defined at the Workspace level and overridable per-project:

```
ReviewPolicy {
  requires_technical_review: true         // Always required
  technical_reviewer_role: 'senior'       // Minimum role for technical review
  requires_cto_approval: bool             // Triggered by task type or risk score
  cto_approval_threshold: 'architecture'  // Which task types trigger CTO review
  auto_approve_if_tests_pass: false       // Safety: never auto-approve by default
  sla_hours: 4                            // Escalate if no review in N hours
  require_reviewer_comment: true          // Reviewer must provide rationale
}
```

### Review Interface Contents

The review UI presents (in order):
1. **Task Summary** — what the AI was asked to do
2. **Execution Report** — structured report from the AI agent (what it did, why, risks)
3. **Code Diff** — syntax-highlighted, split view, file-by-file
4. **Test Results** — pass/fail summary if tests were run
5. **Execution Logs** — searchable, filterable raw log stream
6. **Previous Executions** — if this is a retry or re-work, diff from previous attempt
7. **AI Confidence Score** — if the AI reported low confidence, flagged prominently

### Review Actions

| Action | Effect | Requires |
|---|---|---|
| **Approve** | Advances to Stage 2 or MERGING | Reviewer comment |
| **Request Changes** | Re-queues task with change notes | Reviewer comment (mandatory) |
| **Reject** | Terminates task with reason | Reviewer comment (mandatory) |
| **Escalate** | Routes to CTO regardless of policy | Reviewer comment |
| **Defer** | Pauses review SLA timer | Reason |

### Approval Chain Configuration

```
Organization-level default:
  Technical Review → Merge

Project override (e.g., core infrastructure):
  Technical Review → Architecture Review → CTO Approval → Merge

Task-type override (e.g., database migrations):
  Technical Review → Database Admin Review → CTO Approval → Merge
```

---

## Anti-Bypass Controls

The following controls prevent review bypass:
1. `MERGING` state is only entered from `APPROVED` or `AWAITING_CTO_APPROVAL` (approved)
2. The merge API endpoint validates task status before triggering merge
3. Audit log records every state transition with the actor identity
4. The deploy key used for merging is issued by the control plane only after approval

---

## Consequences

### Positive
- Every AI-generated change has a documented human reviewer
- Policy-based escalation ensures high-risk changes get appropriate scrutiny
- Review SLA ensures changes don't languish without attention

### Negative
- Two-stage review adds latency for high-risk tasks
- Reviewer assignment requires role-based availability; if no reviewers available, tasks queue
