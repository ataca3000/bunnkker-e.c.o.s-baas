# ADR-AIOP-003: Task Lifecycle
## Architecture Decision Record

**Status:** Accepted  
**Date:** 2026-07-18  

---

## Context

A Task in AIOP represents a unit of work assigned to an AI agent. Tasks have complex lifecycles involving creation, queuing, assignment, execution, review, and completion. We must define the canonical state machine to ensure consistent behavior across all components.

---

## Decision

### Task Status State Machine

```
                    ┌────────────┐
                    │  DRAFT     │  (optional — complex tasks)
                    └─────┬──────┘
                          │ Submit
                    ┌─────▼──────┐
                    │  PENDING   │  Created, not yet queued
                    └─────┬──────┘
                          │ Queue
                    ┌─────▼──────┐
                    │  QUEUED    │  In the task queue
                    └─────┬──────┘
                          │ Worker Acquires
                    ┌─────▼──────┐
              ┌────►│  ASSIGNED  │  Worker acknowledged receipt
              │     └─────┬──────┘
              │           │ Worker Starts Execution
              │     ┌─────▼──────┐
              │     │ IN_PROGRESS│  AI agent actively running
              │     └─────┬──────┘
              │           │
              │    ┌──────┴───────────┐
              │    │                  │
              │ ┌──▼──────────┐  ┌────▼────────┐
              │ │ EXECUTION_  │  │  EXECUTION_ │
              │ │  COMPLETE   │  │   FAILED    │
              │ └──┬──────────┘  └────┬────────┘
              │    │                  │
              │    │ Auto-trigger     │ Retry?
              │    │ Review           │ (if retries remain)
              └────┼──────────────────┘
                   │
              ┌────▼──────────┐
              │ PENDING_REVIEW│  Awaiting human review
              └────┬──────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼─────┐       ┌─────▼──────┐
    │ CHANGES_ │       │  APPROVED  │
    │ REQUESTED│       │            │
    └────┬─────┘       └─────┬──────┘
         │                   │ if requires CTO approval
         │             ┌─────▼──────┐
         │             │ AWAITING_  │
         │             │ CTO_APPROVAL│
         │             └─────┬──────┘
         │                   │
         │             ┌─────▼──────┐
         │             │  MERGING   │
         │             └─────┬──────┘
         │                   │
         │             ┌─────▼──────┐
         └────────────►│ COMPLETED  │
                        └────────────┘

     Any state → CANCELLED (by manager, with reason)
```

### Status Definitions

| Status | Description | Actor |
|---|---|---|
| `DRAFT` | Task being composed, not yet submitted | Manager |
| `PENDING` | Task created, queued for assignment | System |
| `QUEUED` | Task placed in worker queue | System |
| `ASSIGNED` | Worker acknowledged task | Worker |
| `IN_PROGRESS` | AI agent actively executing | Worker |
| `EXECUTION_COMPLETE` | AI agent finished, artifacts uploaded | Worker |
| `EXECUTION_FAILED` | AI agent failed; may retry | Worker |
| `PENDING_REVIEW` | Awaiting human code review | System |
| `CHANGES_REQUESTED` | Reviewer requested changes; re-queued | Reviewer |
| `APPROVED` | Review passed; awaiting merge | Reviewer |
| `AWAITING_CTO_APPROVAL` | Policy requires CTO sign-off | System |
| `MERGING` | Automated merge in progress | System |
| `COMPLETED` | Merged to target branch | System |
| `CANCELLED` | Explicitly cancelled | Manager |

---

## Task Retry Policy

When `EXECUTION_FAILED`, the system evaluates the task's `RetryPolicy`:
- `max_retries`: Maximum retry attempts (default: 2)
- `retry_delay_minutes`: Wait before re-queuing (default: 5)
- `retry_on_same_worker`: Whether to prefer/avoid the same worker (default: false)

If retries are exhausted, the task moves to a terminal `EXECUTION_FAILED` state and the manager is notified.

---

## Execution Substates

While a task is `IN_PROGRESS`, the current execution tracks finer granularity:

```
EXECUTION_PREPARING  →  EXECUTION_CLONING  →  EXECUTION_RUNNING
→  EXECUTION_TESTING  →  EXECUTION_PACKAGING  →  EXECUTION_UPLOADING
→  EXECUTION_DONE
```

These substates are reported via progress updates and visible in the real-time task log.

---

## Consequences

### Positive
- Complete lifecycle visible to managers at all times
- Clear entry and exit conditions for each state prevent ambiguity
- Retry logic built into the state machine prevents silent failures

### Negative
- Some tasks may be long-lived in `CHANGES_REQUESTED` state if re-work is significant
- The `AWAITING_CTO_APPROVAL` state adds latency for high-stakes changes
