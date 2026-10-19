# Scalability Strategy
## ECOS AI Operations Platform

**Document ID:** AIOP-SC-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## 1. Current Scale Target (Phase 1)

AIOP is designed to serve a single engineering organization with:
- 1–5 workspaces
- 5–20 projects
- 1–10 concurrent workers
- 100–1,000 tasks per month
- 1–3 concurrent executions at any time

Phase 1 is single-server (the existing ECOS ERP Docker host). No dedicated infrastructure is required.

---

## 2. Scaling Dimensions

### 2.1 Worker Scaling

Workers are the primary horizontal scale unit. More workers = higher throughput. Workers are independent processes and require no coordination with each other.

**Adding Workers:**
1. Install agent on a new machine
2. Run `aiop-worker register --workspace <slug>`
3. Worker is online and pulling tasks within 30 seconds
4. No restart of the control plane required

**Worker Capacity Planning:**

Each worker processes one task at a time (default `max_concurrent: 1`). At median task duration of 20 minutes:
- 1 worker = 3 tasks/hour = 72 tasks/day
- 3 workers = 9 tasks/hour = 216 tasks/day
- 10 workers = 30 tasks/hour = 720 tasks/day

If a worker has `max_concurrent: 2` (for machines with sufficient resources), throughput doubles per machine. However, concurrent executions on the same machine compete for Docker resources; test carefully before increasing this.

**Worker Types:**
- **Developer Laptops:** Flexible, available during working hours. Good for non-urgent tasks.
- **Dedicated CI Servers:** Always available. Good for critical and high-priority tasks.
- **Cloud Ephemeral Workers:** Spun up on demand, terminated after use. See Section 4.

---

### 2.2 Control Plane Scaling

The AIOP control plane is part of the ECOS ERP Laravel application. It shares the same database, cache, and queue infrastructure.

**Scaling bottlenecks to watch:**
- **Database:** Task table queries are indexed; heartbeat table is partitioned. Monitor slow queries at > 1,000 tasks.
- **Queue processing:** AIOP event listeners run on the standard Laravel queue workers. If throughput increases, add queue workers (`php artisan queue:work`).
- **Realtime log streaming:** Redis pub/sub handles log chunk events. Monitor Redis memory usage; log buffer TTL is 24 hours.

At > 50 concurrent workers, consider:
- Dedicated Redis instance for AIOP
- Dedicated queue worker pool for `aiop` queue
- Horizontal Laravel Octane scaling behind a load balancer

---

### 2.3 Repository Scaling

Multiple repositories within a workspace are supported from Phase 1. Each project is linked to exactly one repository; tasks are scoped to the project's repository.

At scale, if many tasks run against the same repository concurrently:
- Each execution clones the repository independently (no shared clone)
- For large repositories (> 1 GB), `--depth 1` shallow clone is used to minimize clone time
- For very frequent cloning of the same large repo, a "mirror cache" on the worker machine can be configured: `git clone --reference /path/to/mirror` reduces network transfer

---

### 2.4 Storage Scaling

Artifact storage is S3-compatible and scales independently. No changes required as task volume grows; S3 handles petabytes natively.

Database tables to monitor:
- `aiop_audit_log`: unbounded grow; archive monthly via scheduled job
- `aiop_heartbeats`: partitioned by month; prune after 30 days
- `aiop_execution_logs`: not in DB (S3 only); no DB concern

---

## 3. Multi-Organization Scaling

ECOS supports multiple companies (tenants). AIOP inherits multi-tenancy:

- Each company has its own workspaces
- Workers belong to workspaces, not globally
- All DB queries are company-scoped via `company_id`
- No cross-company data leakage possible

At the SaaS scale (many companies):
- Each company's AIOP data is logically isolated
- Physical isolation (separate schemas or databases) can be added as a Phase 3 option
- Worker tokens are workspace-scoped; a worker for Company A cannot process tasks from Company B

---

## 4. Cloud and Ephemeral Worker Architecture

For teams that don't have dedicated machines or want burst capacity:

### 4.1 Cloud Worker Model

```
User queues task
        │
        ▼
Task sits QUEUED with no matching worker
        │
        ▼
CloudWorkerOrchestrator detects queue depth > threshold
        │
        ▼
Orchestrator calls cloud provider API
  (AWS Lambda, GCP Cloud Run, Azure Container Instances)
        │
        ▼
Ephemeral container starts, runs aiop-worker binary
Worker registers, picks up task, executes
        │
        ▼
Execution complete → Worker sends results → Container terminates
Token is auto-revoked after deregistration
```

**Requirements:**
- Container image: `ecos-aiop-worker:latest` (includes the worker daemon + configured agent)
- Startup time: ~30–60 seconds (not suitable for sub-1-minute SLA tasks)
- Billing: cloud provider compute cost + AI API token cost
- Worker deregisters itself on shutdown (no zombie records)

### 4.2 GitHub Actions / GitLab CI Workers

Alternative: deploy the AIOP worker as a step in a CI/CD pipeline job:

```yaml
# .github/workflows/aiop-worker.yml
on:
  schedule:
    - cron: '*/10 * * * *'   # poll every 10 minutes

jobs:
  aiop-worker:
    runs-on: ubuntu-latest
    steps:
      - name: Run AIOP Worker (single task)
        env:
          AIOP_WORKER_TOKEN: ${{ secrets.AIOP_WORKER_TOKEN }}
          AIOP_API_BASE: ${{ secrets.AIOP_API_BASE }}
        run: |
          aiop-worker run-once --workspace ${{ vars.WORKSPACE_SLUG }}
```

The `run-once` mode: pick up one task, execute it, exit. No daemon, no heartbeat loop.

This is the lowest-overhead option for teams already using GitHub Actions.

---

## 5. Kubernetes Deployment

For organizations with Kubernetes infrastructure, the AIOP worker can be deployed as a Deployment with autoscaling:

```
Kubernetes Deployment: aiop-worker
  replicas: 1 (initial)
  autoscaling:
    metric: queue_depth (custom metric from AIOP Prometheus endpoint)
    min_replicas: 0
    max_replicas: 20
    scale_up_at: queue_depth > 3
    scale_down_at: queue_depth == 0 for 5 minutes

Pod spec:
  container: aiop-worker
  resources:
    requests: { cpu: 2, memory: 4Gi }
    limits:   { cpu: 4, memory: 8Gi }
  env:
    AIOP_WORKER_TOKEN: from secret
    AIOP_API_BASE: control plane URL
  volumes:
    - name: workspace-storage
      emptyDir: {}           // ephemeral per-pod workspace
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
```

Docker-in-Docker is NOT used in Kubernetes deployments. Instead:
- Workers use Tier 2 filesystem isolation (per-execution subdirectory) within the pod
- Workload isolation is provided by the pod boundary itself
- For stronger isolation, use one pod per task via the Job API

---

## 6. Distributed Execution (Phase 3)

Phase 3 introduces multi-agent orchestration across workers:

```
Task with steps:
  Step 1 → [Worker A: ClaudeCode]  → Artifact: initial_implementation.diff
  Step 2 → [Worker B: GeminiCli]   → Read artifact from step 1 → Review output
  Step 3 → [Worker A: ClaudeCode]  → Read step 2 review → Apply suggestions

Control Plane coordinates:
  - Step sequencing (step N+1 waits for step N completion)
  - Artifact passing between steps (presigned S3 download URLs)
  - Cross-worker task locking (only one worker active per step at a time)
```

This requires:
- TaskStep table extension with `execution_id` per step
- Artifact reference passing in step task descriptors
- Step-level status tracking
- Backwards compatible with Phase 1 (single-step tasks work unchanged)

---

## 7. Capacity and Load Projections

| Scenario | Workers | Tasks/Month | Peak Concurrent | Infrastructure |
|---|---|---|---|---|
| Small team (Phase 1) | 1–3 | 100–500 | 3 | Existing ECOS Docker host |
| Mid-size team (Phase 2) | 5–10 | 1,000–3,000 | 10 | Dedicated CI server or cloud |
| Large org (Phase 3) | 20–50 | 10,000+ | 50 | Kubernetes cluster |
| SaaS multi-tenant | Per-tenant pools | 100,000+ | 500+ | Multi-region Kubernetes |

---

## 8. Performance Benchmarks (Design Targets)

| Metric | Target |
|---|---|
| Task dispatch latency (queued → assigned) | < 30 seconds |
| Heartbeat processing latency | < 100ms |
| Task poll response time | < 200ms |
| Log chunk delivery to UI | < 2 seconds |
| Artifact presign response | < 500ms |
| Control plane API p99 response | < 500ms |
| Database: task list query | < 50ms (indexed) |
| S3 artifact upload (50MB diff) | < 60 seconds |
