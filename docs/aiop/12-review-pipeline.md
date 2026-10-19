# Review Pipeline
## ECOS AI Operations Platform

**Document ID:** AIOP-RP-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## 1. Overview

The review pipeline is the complete engineering workflow from idea to merged production code. It governs how a task moves from human intent through AI execution to reviewed, approved, and integrated output.

The pipeline has five phases:

```
IDEA → SPECIFICATION → EXECUTION → REVIEW → INTEGRATION
```

Each phase has defined entry criteria, exit criteria, and actors.

---

## 2. Phase 1: Idea

**Actor:** Any team member (operator role or above)

**Activities:**
- Identify a task suitable for AI execution
- Check if the task has clear acceptance criteria
- Confirm the task does not require human judgment, creativity, or stakeholder negotiation

**Suitability Checklist:**

| Question | If Yes | If No |
|---|---|---|
| Can the task be fully described in text? | Continue | Not suitable |
| Does it have clear acceptance criteria (tests pass, output matches spec)? | Continue | Define criteria first |
| Is it within the AI agent's declared capabilities? | Continue | Route to human |
| Does it require external system access not available in the sandbox? | May need egress policy | Check policy |
| Does it touch auth, payments, or security-critical paths? | Flag for CTO-stage review | Proceed normally |

**Exit criteria:** Task is considered for AI execution and moved to Specification.

---

## 3. Phase 2: Specification

**Actor:** Operator (task creator)

**Activities:**
1. Open Task Create form
2. Select project (determines repository and branch)
3. Write a clear title (max 500 characters)
4. Write a detailed description:
   - What to implement (not how)
   - Files and modules involved (if known)
   - Acceptance criteria ("tests must pass", "endpoint must return X")
   - Out-of-scope items ("do not modify the frontend")
   - Reference files or examples ("see existing implementation at path/to/file.php")
5. Set task type, priority, required capabilities
6. Optionally set a cost budget and due date
7. Save as Draft (to iterate on description) or Queue immediately

**Description Quality Guidelines:**

Good description:
> "Add a CSV export endpoint to the Orders module. The endpoint should be GET /api/orders/export?format=csv and return all orders within the current user's company, paginated by date range using the from and to query parameters. Include columns: order number, customer name, products total, shipping amount, grand total, status, created at. Use the existing OrderResource field names as column sources. Write a feature test that verifies the endpoint returns valid CSV with correct headers and at least one row."

Poor description:
> "Add CSV export to orders"

**Exit criteria:** Task description is complete and detailed enough for the AI agent to execute without ambiguity.

---

## 4. Phase 3: Execution

**Actor:** AI Worker (automated)

**Trigger:** Task status moves to QUEUED

### 4.1 Dispatch

1. Control plane polls available workers every 10 seconds
2. Matches task's `required_capabilities` to available worker capabilities
3. Assigns task to the most idle matching worker
4. Creates Execution record (attempt_number = 1)
5. Delivers task + secrets bundle to worker

### 4.2 Execution Steps (Worker Side)

See Worker Architecture document (06) for the full step sequence. Summary:
1. Clone repository at target branch
2. Start Docker container (isolated sandbox)
3. AI agent runs inside container
4. Agent reads task description, analyzes codebase, implements changes
5. Tests run inside container
6. Git diff is computed
7. Artifacts uploaded to S3

### 4.3 Failure and Retry

| Outcome | Next Action |
|---|---|
| Execution complete, tests pass | Move to Review Phase |
| Execution complete, tests fail (agent flagged) | Move to Review Phase with `test_failure` note |
| Execution failed (agent crash, timeout) | Check retry policy |
| Retry attempt: n ≤ max_retries | Re-queue with incremented attempt_number |
| Retry attempt: n > max_retries | Move to EXECUTION_FAILED; notify creator |

### 4.4 Execution SLA

- Default execution timeout: 30 minutes (configurable per execution policy)
- If execution exceeds timeout: container killed, execution marked failed with `failure_code: timeout`
- Retry delay after timeout: 5 minutes (per retry policy)

**Exit criteria:** Execution produces artifacts (at minimum: a code diff) and an agent report. Task moves to PENDING_REVIEW.

---

## 5. Phase 4: Review

**Actor:** Human reviewer (reviewer role or above)

**Trigger:** Task moves to PENDING_REVIEW; Review record created; reviewer notified

### 5.1 Review Assignment

Reviews are assigned based on the workspace's review policy:
- A designated reviewer is assigned from the `technical_reviewer_role` group
- Assignment is round-robin among eligible reviewers to distribute load
- If no eligible reviewer is available, the task waits and the admin is notified

### 5.2 Technical Review (Stage 1 — Always Required)

**SLA:** Default 4 hours from assignment

**Reviewer reads:**
1. Agent execution report (summary, files changed, risks identified)
2. Code diff (full diff, syntax-highlighted)
3. Test results (pass/fail summary)
4. Execution logs (if needed for context)

**Reviewer decisions:**

#### Approve
- Task advances to Stage 2 (if policy requires) or directly to MERGING
- Reviewer comment is stored but not required for approval
- If tests failed but reviewer overrides: comment explaining override is required

#### Request Changes
- Task moves back to CHANGES_REQUESTED
- Reviewer's comment is delivered to task creator
- Task creator can modify the task description and re-queue
- On re-queue: new execution attempt (attempt_number increments)
- Changes requested comment is shown to the AI agent in the next execution as additional context

#### Reject
- Task moves to CANCELLED (terminal state)
- Reason stored in `cancellation_reason`
- No further execution attempts

### 5.3 Governance Review (Stage 2 — Policy-Driven)

Triggered when review policy specifies `requires_cto_approval: true` for the task type or when the reviewer manually escalates.

**Common triggers:**
- Task type: `migration`, `security_audit`
- Risk score above threshold (configurable)
- Manual escalation by technical reviewer

**Governance reviewer (CTO or designated architecture lead) checks:**
- Architecture alignment: does this change fit the existing module structure?
- Security: does the change introduce a vulnerability?
- Cost: does the change introduce technical debt, performance regression, or excess complexity?
- Policy compliance: does the change respect the company's engineering standards?

### 5.4 SLA Escalation

If a reviewer does not act within the SLA deadline:
1. `AiopReviewSlaBreached` event is fired
2. Notification sent to reviewer (urgent) and their manager
3. If `auto_escalate_after_sla: true` in policy: review is re-assigned to the manager
4. Audit log records the SLA breach

**Exit criteria:** All required review stages have been approved.

---

## 6. Phase 5: Integration (Merge)

**Actor:** System (automated), authorized by human approval chain

**Trigger:** Final review stage approval received

### 6.1 Merge Process

```
1. Control plane verifies task is in APPROVED state
2. Control plane generates a short-lived deploy key (15-minute TTL)
   with write access to the target repository
3. Control plane checks for merge conflicts with current target branch
4. If no conflicts: merge the diff artifact to target branch
   - Method: apply patch from artifact, commit with message "AI: {task title} [AIOP-{task_id}]"
   - Authored by: AIOP bot user, co-authored-by: reviewer
5. Control plane records merge_commit_sha in the Approval record
6. Deploy key is immediately revoked
7. Task status moves to COMPLETED
8. AiopTaskCompleted event is fired
```

### 6.2 Merge Conflict Handling

If a merge conflict is detected:
- Task moves to CHANGES_REQUESTED with reason "Merge conflict on target branch"
- Creator is notified: resolve conflict manually or update task and re-queue
- The previous AI execution's diff is preserved as a reference artifact
- The creator may manually resolve and push, or re-queue for a new AI execution with the current branch state

### 6.3 Post-Merge

After successful merge:
- CI/CD pipeline on the target repository is triggered by the merge commit (external, not managed by AIOP)
- AIOP records the merge commit SHA for traceability
- The task is marked COMPLETED with a link to the commit
- Workspace administrators can see the completed task in the dashboard and on the task list

---

## 7. Full State Transition Summary

```
                          ┌─────────────┐
                          │    DRAFT    │ (Spec in progress)
                          └──────┬──────┘
                                 │ User queues
                                 ▼
┌──────────────────────────────────────────────────────────┐
│                    QUEUED                                │
│  Waiting for an available matching worker                │
└──────────────────────┬───────────────────────────────────┘
                       │ Worker picks up
                       ▼
              ┌──────────────┐
              │   ASSIGNED   │ Worker locked task
              └──────┬───────┘
                     │ Execution starts
                     ▼
              ┌──────────────┐
              │ IN_PROGRESS  │ AI executing
              └──────┬───────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
  EXECUTION_COMPLETE      EXECUTION_FAILED
          │                     │
          │               Retry policy?
          │              Yes  /   \ No
          │              /         \
          │      QUEUED (retry)  CANCELLED
          │
          ▼
   PENDING_REVIEW ──── Review SLA breach ──► Alert
          │
          │ Technical review decision:
     ┌────┴────────────────┐
     │                     │
     ▼                     ▼
CHANGES_REQUESTED      APPROVED (Tech)
     │                     │
 Re-queue            CTO required?
                    Yes /    \ No
                   /           \
        AWAITING_CTO         MERGING
        APPROVAL                │
             │                  │
             ▼                  ▼
           APPROVED           COMPLETED
           (CTO)
             │
             ▼
           MERGING
             │
             ▼
           COMPLETED
```

---

## 8. Audit Trail per Task

Every task accumulates a complete audit trail:

| Event | Recorded |
|---|---|
| Task created | ✓ |
| Task description edited | ✓ |
| Task queued | ✓ |
| Worker assignment | ✓ |
| Execution start | ✓ |
| Execution progress (major steps) | ✓ |
| Execution complete or failed | ✓ |
| Artifact uploaded | ✓ |
| Review assigned | ✓ |
| Review decision | ✓ (with full comment) |
| SLA breach | ✓ |
| Merge initiated | ✓ |
| Merge completed | ✓ (with commit SHA) |
| Task cancelled | ✓ (with reason) |

The audit trail is visible in the Task Detail → Timeline tab.
