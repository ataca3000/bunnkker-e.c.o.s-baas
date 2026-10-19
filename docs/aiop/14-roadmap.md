# Implementation Roadmap
## ECOS AI Operations Platform

**Document ID:** AIOP-RM-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## 1. Roadmap Overview

```
Phase 1: Foundation           Phase 2: Intelligence        Phase 3: Enterprise
(6–8 weeks)                  (4–6 weeks)                  (6–10 weeks)
─────────────────────────    ───────────────────────────  ──────────────────────
Worker infrastructure     →  Real-time streaming       →  Multi-agent execution
Task lifecycle               Log streaming                Cloud worker autoscaling
Basic review workflow        Retry intelligence            Kubernetes deployment
Agent connector              Review SLA + escalation       Multi-step tasks
Artifact storage             Cost tracking + alerts        CI/CD integration
Dashboard (static)           Dashboard (real-time)         Analytics & reporting
                             Mobile dashboard              Tenant SaaS model
```

---

## 2. Phase 1: Foundation

**Objective:** End-to-end task execution and review workflow. A developer can create a task, a worker picks it up, the AI executes it, and a human reviews and approves the result.

**Duration:** 6–8 weeks

**Dependencies:**
- ECOS ERP platform is running (available)
- Claude Code CLI is installable on developer machines
- S3-compatible storage is available (MinIO for self-hosted)

---

### Phase 1 Milestones

#### Milestone 1.1: Database and Backend Foundation (Weeks 1–2)

**Deliverables:**
- 20 database migrations (all `aiop_*` tables)
- Base models: Workspace, Project, Repository, AiopAgent, AiopWorker, AiopTask, AiopExecution, AiopArtifact, AiopReview, AiopApproval, AiopSecret
- Value objects: ExecutionPolicy, ReviewPolicy, RetryPolicy
- Service provider and module scaffold: `Modules/AIOP/`

**Acceptance Criteria:**
- All migrations run cleanly on a fresh database
- No FK constraint violations
- Models load without errors

**Risks:**
- AiopSecret encryption key management requires KMS decision (fallback: env-variable-based key)

---

#### Milestone 1.2: Worker Registration and Heartbeat (Weeks 2–3)

**Deliverables:**
- `POST /api/aiop/workers/register` endpoint
- Worker JWT issuance and validation middleware
- `POST /api/aiop/worker/heartbeat` endpoint
- `POST /api/aiop/worker/online/offline` endpoints
- HeartbeatMonitorJob (runs every 2 minutes; marks offline; triggers AiopWorkerHeartbeatMissed event)
- Worker daemon: registration CLI command + heartbeat loop

**Acceptance Criteria:**
- Worker can register and receive a valid JWT
- Worker heartbeats are recorded in `aiop_heartbeats`
- Worker status reflects heartbeat state in DB within 90 seconds of heartbeat failure

**Risks:**
- Worker daemon implementation language: PHP CLI (recommended for ECOS consistency) vs Go binary (smaller, easier to deploy cross-platform). Decision required before implementation.

---

#### Milestone 1.3: Task Creation and Queue (Weeks 2–3)

**Deliverables:**
- `POST /api/aiop/tasks` endpoint
- `POST /api/aiop/tasks/{id}/queue` endpoint
- `GET /api/aiop/worker/tasks/next` endpoint (capability matching + locking)
- `PATCH /api/aiop/worker/executions/{id}/start` endpoint
- Task status machine: DRAFT → PENDING → QUEUED → ASSIGNED

**Acceptance Criteria:**
- Creating and queuing a task returns correct status transitions
- A worker with matching capabilities acquires the task
- A worker without matching capabilities does not acquire the task
- Race condition: two workers polling simultaneously: only one acquires the task (tested with pessimistic lock)

**Risks:**
- Capability matching query performance at high task volume (add index on status + capabilities)

---

#### Milestone 1.4: Execution and Artifacts (Weeks 3–5)

**Deliverables:**
- Worker execution lifecycle: clone → start container → run agent → collect artifacts
- ClaudeCodeConnector implementation
- StubConnector for testing
- `POST /api/aiop/worker/executions/{id}/log` (chunk logging)
- `POST /api/aiop/worker/executions/{id}/complete/failed`
- `POST /api/aiop/worker/artifacts/presign` + S3 presigned URL generation
- `POST /api/aiop/worker/artifacts/confirm`
- ArtifactVerificationJob (checksum check)
- Execution status machine: preparing → cloning → running → uploading → complete/failed

**Acceptance Criteria:**
- End-to-end test: create task → queue → worker executes with StubConnector → artifacts uploaded → execution marked complete
- Checksum verification catches a corrupted artifact
- Timeout is enforced (container killed at limit)

**Risks:**
- Docker not available on Windows developer machines (implement Tier 2 fallback before Phase 1 complete)
- S3 presigned URL timing: worker must upload within 15 minutes; long-running agents may need renewed URLs

---

#### Milestone 1.5: Review Workflow (Weeks 5–6)

**Deliverables:**
- Review record creation (triggered by ExecutionCompleted event)
- `POST /api/aiop/reviews/{id}/decision` endpoint
- Review assignment (round-robin among eligible reviewers)
- SLAMonitorJob (check every 15 minutes; fire AiopReviewSlaBreached if overdue)
- Merge action: apply diff artifact to target branch via deploy key
- Task status machine: PENDING_REVIEW → approved/changes_requested → MERGING → COMPLETED / QUEUED

**Acceptance Criteria:**
- Reviewer receives in-app notification when review is assigned
- Approve decision → task moves to MERGING → merge commit created on target branch
- Request changes → task moves to CHANGES_REQUESTED → creator can re-queue
- SLA breach notification fires after deadline

**Risks:**
- Git merge implementation: applying a diff artifact via `git apply` can fail on whitespace/encoding differences. Use `git apply --whitespace=fix` and test with realistic diffs.
- Deploy key scope: GitHub/GitLab deploy keys that allow write access should be provisioned with minimum scope (write to one branch only if possible)

---

#### Milestone 1.6: Frontend — Core UI (Weeks 6–8)

**Deliverables:**
- Module registration in ECOS sidebar navigation
- Task List page
- Task Create form
- Task Detail page (tabs: Details, Executions, Logs, Artifacts)
- Review Interface page (Summary, Code Diff, Test Results, Logs tabs)
- Worker List page (admin)
- Queue Monitor page (admin)
- Basic Dashboard (static counts, no real-time)

**Acceptance Criteria:**
- Full end-to-end workflow completable through the UI
- No TypeScript errors
- Mobile responsive (tablet minimum; mobile read-only)

**Risks:**
- Code diff viewer component: evaluate Monaco Editor vs CodeMirror for bundle size impact on existing ECOS build

---

#### Phase 1 Exit Criteria

- [ ] Worker can register, heartbeat, and pick up tasks
- [ ] Claude Code agent executes a test task against a real repository
- [ ] Artifacts are uploaded to S3 and verified
- [ ] Human reviewer can approve via UI and trigger a merge
- [ ] Merged commit appears on the target branch in GitHub
- [ ] Audit log has a complete trail for the full lifecycle
- [ ] Zero known security vulnerabilities in execution isolation

---

## 3. Phase 2: Intelligence

**Objective:** Add real-time visibility, smart retry, escalation automation, cost tracking, and mobile access.

**Duration:** 4–6 weeks

**Dependencies:** Phase 1 complete and stable

---

### Phase 2 Deliverables

| Feature | Description |
|---|---|
| Real-time log streaming | WebSocket (Laravel Reverb) push of log chunks to browser |
| Execution progress UI | Animated progress bar in Task Detail; substatus display |
| Smart retry | Retry with modified context if previous attempt failed; pass failure reason to agent |
| Review SLA escalation | Auto-reassign after SLA breach if `auto_escalate: true` |
| Cost tracking | Token usage per execution; cost estimate per task; workspace budget dashboard |
| Cost alerts | Notify admin when workspace monthly spend > threshold |
| GeminiCliConnector | Second connector implementation; capability routing tested |
| Mobile dashboard | Read-only dashboard optimized for mobile |
| Email notifications | NotificationService integration with ECOS email provider |
| Slack notifications | Webhook-based Slack notification for review assignments |
| Worker self-update | Control plane signals worker to update; worker downloads and restarts |
| Review timeline | Task Detail Timeline tab showing all actors and timestamps |

---

### Phase 2 Exit Criteria

- [ ] Log lines stream to browser within 2 seconds of worker sending them
- [ ] Reviewer can read full execution log in the UI without downloading from S3
- [ ] Cost tracking shows accurate token usage per execution
- [ ] Failed execution with retry policy re-queues automatically
- [ ] SLA breach auto-escalation fires and reassigns within 1 minute of breach
- [ ] Email notification received by reviewer within 60 seconds of review assignment

---

## 4. Phase 3: Enterprise

**Objective:** Cloud workers, multi-step tasks, Kubernetes deployment, and full analytics.

**Duration:** 6–10 weeks

**Dependencies:** Phase 2 complete; decision on cloud provider

---

### Phase 3 Deliverables

| Feature | Description |
|---|---|
| Cloud ephemeral workers | CloudWorkerOrchestrator; AWS Lambda / GCP Cloud Run runners |
| GitHub Actions integration | `aiop-worker run-once` mode; sample workflow file |
| Kubernetes manifest | Deployment + HPA (custom metric: queue_depth) |
| Multi-step task execution | TaskStep sequencing; artifact passing between steps |
| Multi-agent review step | Agent A implements → Agent B reviews → Agent A refines |
| Full analytics dashboard | Completion rates, failure rates, average duration, cost trends, reviewer SLA compliance |
| Template library | Save task templates for common task types (add migration, add test suite, refactor to DDD) |
| Workspace-level reporting | Monthly report: tasks completed, cost, agent efficiency metrics |
| Bulk task import | CSV import for batch task creation |
| API webhooks | Outbound webhooks on task completed / failed for CI/CD integration |
| Audit export | Export `aiop_audit_log` to CSV or PDF for compliance review |

---

### Phase 3 Exit Criteria

- [ ] Ephemeral cloud worker completes a task end-to-end with no pre-running workers
- [ ] Kubernetes deployment with HPA scales from 0 to 5 workers based on queue depth
- [ ] Multi-step task: agent A → agent B review → agent A refinement completes successfully
- [ ] Monthly report PDF generated and emailed to CTO on the 1st of each month
- [ ] Outbound webhook fires within 30 seconds of task completion

---

## 5. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| AI agent produces incorrect code that passes tests | High | Medium | Human review is mandatory; tests are necessary but not sufficient |
| Secret leakage via logs | Medium | Critical | Log sanitization in Phase 1; end-to-end test with mock secrets |
| Worker not available when task queues | Medium | Low | Queue visibility in UI; Slack notification; cloud worker Phase 3 option |
| Git merge conflict after approval | Medium | Medium | Conflict detection before merge; creator notified; re-queue option |
| Reviewer SLA culture gap (reviewers not acting) | High | Medium | SLA visibility in dashboard; auto-escalation in Phase 2 |
| Docker not available on developer Windows machines | High | Medium | Tier 2 filesystem isolation in Phase 1 fallback |
| Cost overrun on AI API tokens | Medium | Medium | Per-task budget cap; workspace budget alerts in Phase 2 |
| Control plane becomes bottleneck at scale | Low | High | Dedicated Redis + queue pool in Phase 2; horizontal scaling in Phase 3 |

---

## 6. Decision Log (Required Before Phase 1 Begins)

| Decision | Options | Owner | Deadline |
|---|---|---|---|
| Worker daemon language | PHP CLI vs Go binary | CTO | Before Milestone 1.2 |
| KMS solution | Env variable key vs HashiCorp Vault vs AWS KMS | CTO | Before Milestone 1.1 |
| S3 storage | MinIO self-hosted vs AWS S3 vs Cloudflare R2 | Ops | Before Milestone 1.4 |
| Code diff viewer | Monaco Editor vs CodeMirror | Frontend Lead | Before Milestone 1.6 |
| Review role assignment | Round-robin vs weighted vs manual | Team | Before Milestone 1.5 |
| GitHub app vs deploy key | GitHub App (more secure, complex) vs SSH deploy key (simpler) | CTO | Before Milestone 1.5 |
