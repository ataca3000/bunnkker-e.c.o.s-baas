# Enterprise Architecture Document
## ECOS AI Operations Platform

**Document ID:** AIOP-ARCH-001  
**Version:** 1.0  
**Status:** Approved for Architecture Review  
**Date:** 2026-07-18  

---

## 1. High-Level Architecture

AIOP consists of three logical tiers:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TIER 1: HUMAN INTERACTION PLANE                  │
│                                                                     │
│   ┌────────────┐  ┌───────────┐  ┌────────────┐  ┌─────────────┐  │
│   │  AIOP Web  │  │  Mobile   │  │   ECOS ERP │  │  Notification│  │
│   │  Dashboard │  │   App     │  │  Integration│  │  Center     │  │
│   └────────────┘  └───────────┘  └────────────┘  └─────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS / WebSocket
┌──────────────────────────┼──────────────────────────────────────────┐
│                    TIER 2: CONTROL PLANE                            │
│                          │                                          │
│   ┌──────────────────────▼──────────────────────────────────────┐  │
│   │                  AIOP Laravel Module                         │  │
│   │                                                              │  │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │  │
│   │  │  Task    │  │ Execution │  │  Review  │  │  Agent     │ │  │
│   │  │  Engine  │  │ Orchestr. │  │ Pipeline │  │  Registry  │ │  │
│   │  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │  │
│   │                                                              │  │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │  │
│   │  │ Artifact │  │  Event   │  │ Security │  │   Worker   │ │  │
│   │  │  Vault   │  │   Bus    │  │ Gateway  │  │  Registry  │ │  │
│   │  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐   │
│   │ MySQL /  │  │  Redis   │  │   S3 /   │  │  Laravel       │   │
│   │ Postgres │  │  Queue   │  │  Storage │  │  Horizon       │   │
│   └──────────┘  └──────────┘  └──────────┘  └────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS REST (Worker API)
┌──────────────────────────┼──────────────────────────────────────────┐
│                    TIER 3: EXECUTION PLANE                          │
│                          │                                          │
│   ┌──────────────────────┼──────────────────────────────────────┐  │
│   │                      │   ECOS AI Worker                     │  │
│   │          ┌───────────▼──────────────────────┐              │  │
│   │          │  Worker Daemon (Node.js / Python) │              │  │
│   │          └───────────┬──────────────────────┘              │  │
│   │                      │                                      │  │
│   │   ┌──────────────────┼──────────────────────┐              │  │
│   │   │                  │  Agent Connectors     │              │  │
│   │   │  ┌───────────┐   │  ┌─────────────────┐ │              │  │
│   │   │  │Claude Code│   │  │  Gemini CLI     │ │              │  │
│   │   │  │ Connector │   │  │  Connector      │ │              │  │
│   │   │  └─────┬─────┘   │  └────────┬────────┘ │              │  │
│   │   │        │         │           │           │              │  │
│   │   └────────┼─────────┼───────────┼───────────┘              │  │
│   │            │         │           │                           │  │
│   │   ┌────────▼─────────▼───────────▼────────────┐             │  │
│   │   │       Sandboxed Workspace (Docker/chroot) │             │  │
│   │   │       Local Git Repository Clone          │             │  │
│   │   └────────────────────────────────────────────┘             │  │
│   └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layered Architecture

AIOP follows the same DDD layered architecture used by all ECOS modules:

### 2.1 Presentation Layer
- HTTP Controllers (REST API for workers, web routes for UI)
- Broadcast channels (WebSocket for real-time UI updates)
- API Resources (response DTOs)
- Form Requests (validation)

### 2.2 Application Layer
- Task Application Service — lifecycle state transitions
- Execution Orchestration Service — assigns tasks to workers
- Review Application Service — manages the review workflow
- Artifact Application Service — stores and retrieves outputs
- Worker Management Service — registration, heartbeats, health

### 2.3 Domain Layer
- **Aggregates:** Task, Execution, Worker, Agent, Review, Artifact
- **Value Objects:** ExecutionPolicy, ReviewPolicy, RetryPolicy, WorkerCapability, ArtifactChecksum
- **Domain Events:** TaskCreated, ExecutionStarted, ArtifactUploaded, ReviewCompleted, etc.
- **Domain Services:** TaskAssignmentService (matching tasks to capable workers), ArtifactVerificationService

### 2.4 Infrastructure Layer
- Eloquent repositories for all aggregates
- S3/filesystem adapter for artifact storage
- Redis adapter for queue and pub/sub
- Webhook adapter for external notifications
- Worker API client (outbound calls to workers for push scenarios)

---

## 3. Module Decomposition

```
Modules/
└── AIOP/
    ├── Domain/
    │   ├── Models/
    │   │   ├── AiopAgent.php
    │   │   ├── AiopWorker.php
    │   │   ├── AiopTask.php
    │   │   ├── AiopExecution.php
    │   │   ├── AiopArtifact.php
    │   │   ├── AiopReview.php
    │   │   ├── AiopApproval.php
    │   │   ├── AiopProject.php
    │   │   ├── AiopRepository.php
    │   │   ├── AiopWorkspace.php
    │   │   └── AiopAuditLog.php
    │   ├── Events/
    │   ├── ValueObjects/
    │   └── Contracts/
    ├── Application/
    │   ├── Actions/
    │   ├── Services/
    │   └── DTOs/
    ├── Infrastructure/
    │   ├── Repositories/
    │   ├── Connectors/         ← Agent connector implementations
    │   └── Providers/
    └── Presentation/
        ├── Http/
        │   ├── Controllers/
        │   │   ├── TaskController.php
        │   │   ├── WorkerApiController.php   ← Worker REST endpoints
        │   │   ├── ExecutionController.php
        │   │   ├── ReviewController.php
        │   │   └── ArtifactController.php
        │   └── Requests/
        └── Resources/
```

---

## 4. Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      AIOP Control Plane                         │
│                                                                 │
│  ┌─────────────────┐         ┌─────────────────────────────┐   │
│  │  Task Manager   │◄────────│  REST API (Worker-Facing)   │   │
│  │                 │         │  /api/aiop/worker/*         │   │
│  │ - Create Task   │         └─────────────────────────────┘   │
│  │ - Queue Task    │                        ▲                  │
│  │ - Assign Task   │                        │                  │
│  │ - Monitor Task  │                 HTTPS REST                │
│  └────────┬────────┘                        │                  │
│           │ Dispatch                         │                  │
│  ┌────────▼────────┐         ┌──────────────┴──────────────┐   │
│  │  Task Queue     │         │     ECOS AI Worker           │   │
│  │  (Redis)        │         │     (runs on dev machine)    │   │
│  └────────┬────────┘         └─────────────────────────────┘   │
│           │                                                     │
│  ┌────────▼────────┐         ┌─────────────────────────────┐   │
│  │ Execution       │─────────►  Artifact Vault              │   │
│  │ Orchestrator    │         │  (S3 / Storage)              │   │
│  └────────┬────────┘         └─────────────────────────────┘   │
│           │ Events                                              │
│  ┌────────▼────────┐         ┌─────────────────────────────┐   │
│  │  Event Bus      │────────►│  Review Pipeline             │   │
│  │  (Laravel Events│         │  - Assign Reviewer           │   │
│  │   + Horizon)    │         │  - Collect Feedback          │   │
│  └────────┬────────┘         │  - Route to Approval         │   │
│           │                  └─────────────────────────────┘   │
│  ┌────────▼────────┐                                           │
│  │  Broadcast      │─────────► WebSocket → Frontend UI        │
│  │  (Laravel Echo) │                                           │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Deployment Diagram

### 5.1 Single-Team Deployment (Current ECOS Setup)

```
┌──────────────────────────────────────────────┐
│          ECOS Application Server             │
│  (ecos-app Docker container)                 │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │  Laravel AIOP Module (PHP-FPM)          │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │  Laravel Horizon (Queue Worker)         │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
         │                    │
┌────────▼──────┐    ┌────────▼──────┐
│  MySQL/PgSQL  │    │  Redis        │
│  (ecos-mysql) │    │  (ecos-redis) │
└───────────────┘    └───────────────┘
         │
┌────────▼──────────────────────────────────────┐
│        S3 / Object Storage                    │
│        Artifact Vault                         │
└───────────────────────────────────────────────┘

         ↑ HTTPS REST API
┌────────┴──────────────────────────────────────┐
│     Developer Machines / CI Servers           │
│                                               │
│  ┌─────────────────┐  ┌─────────────────┐    │
│  │  ECOS AI Worker │  │  ECOS AI Worker │    │
│  │  (Machine A)    │  │  (Machine B)    │    │
│  │  Claude Code    │  │  Gemini CLI     │    │
│  └─────────────────┘  └─────────────────┘    │
└───────────────────────────────────────────────┘
```

### 5.2 Multi-Team Enterprise Deployment

```
                    ┌──────────────────────┐
                    │   Load Balancer       │
                    │   (nginx / ALB)       │
                    └──────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
┌─────────▼──────┐   ┌─────────▼──────┐   ┌─────────▼──────┐
│  AIOP Control  │   │  AIOP Control  │   │  AIOP Control  │
│  Plane Node 1  │   │  Plane Node 2  │   │  Plane Node N  │
└────────────────┘   └────────────────┘   └────────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Shared Services    │
                    │  ┌───────────────┐   │
                    │  │  Database     │   │
                    │  │  (Primary +   │   │
                    │  │   Replica)    │   │
                    │  └───────────────┘   │
                    │  ┌───────────────┐   │
                    │  │  Redis        │   │
                    │  │  (Cluster)    │   │
                    │  └───────────────┘   │
                    │  ┌───────────────┐   │
                    │  │  S3           │   │
                    │  │  Artifact     │   │
                    │  │  Vault        │   │
                    │  └───────────────┘   │
                    └──────────────────────┘
```

---

## 6. Sequence Diagrams

### 6.1 Task Creation and Assignment

```
Manager         AIOP UI       Control Plane    Task Queue    Worker (Machine A)
   │               │               │                │                │
   │  Create Task  │               │                │                │
   ├──────────────►│               │                │                │
   │               │  POST /tasks  │                │                │
   │               ├──────────────►│                │                │
   │               │               │ Validate       │                │
   │               │               │ Persist Task   │                │
   │               │               │ Emit TaskCreated│               │
   │               │               ├───────────────►│                │
   │               │               │                │ Task enqueued  │
   │               │  TaskCreated  │                │                │
   │               │◄──────────────┤                │                │
   │  Live Update  │               │                │                │
   │◄──────────────┤               │                │    Poll Queue  │
   │               │               │                │◄───────────────┤
   │               │               │                │ Return Task    │
   │               │               │                ├───────────────►│
   │               │               │ AcquireTask    │                │
   │               │               │◄───────────────────────────────►│
   │               │               │ Task Assigned  │                │
   │               │               │ TaskAssigned   │                │
   │               │               ├───────────────►│                │
   │               │  TaskAssigned │                │                │
   │               │◄──────────────┤                │                │
   │  Live Update  │               │                │                │
   │◄──────────────┤               │                │                │
```

### 6.2 Execution and Artifact Upload

```
Worker           Agent Connector    AI Agent CLI    Control Plane     UI
  │                    │                 │                │            │
  │  Start Execution   │                 │                │            │
  ├───────────────────►│                 │                │            │
  │                    │  Invoke CLI     │                │            │
  │                    ├────────────────►│                │            │
  │  POST /execution/start               │                │            │
  ├─────────────────────────────────────────────────────►│            │
  │                    │                 │  Running...    │  ExecutionStarted
  │                    │                 │                ├───────────►│
  │                    │                 │                │  Live Update
  │  POST /execution/log (streaming)     │                │            │
  ├─────────────────────────────────────────────────────►│            │
  │                    │                 │                │  Log lines │
  │                    │                 │                ├───────────►│
  │                    │  CLI Output     │                │            │
  │                    │◄────────────────┤                │            │
  │  POST /artifacts/upload              │                │            │
  ├─────────────────────────────────────────────────────►│            │
  │                    │                 │                │  ArtifactUploaded
  │                    │                 │                ├───────────►│
  │  POST /execution/complete            │                │            │
  ├─────────────────────────────────────────────────────►│            │
  │                    │                 │  ExecutionCompleted         │
  │                    │                 │                ├───────────►│
  │                    │                 │  ReviewRequested            │
  │                    │                 │                ├───────────►│
```

### 6.3 Review and Approval

```
Reviewer        AIOP UI       Control Plane      Git Repository
    │               │               │                  │
    │  Open Review  │               │                  │
    ├──────────────►│               │                  │
    │               │  GET /review  │                  │
    │               ├──────────────►│                  │
    │               │  Artifacts +  │                  │
    │               │  Diff + Logs  │                  │
    │               │◄──────────────┤                  │
    │  Review UI    │               │                  │
    │◄──────────────┤               │                  │
    │               │               │                  │
    │  Approve      │               │                  │
    ├──────────────►│               │                  │
    │               │ POST /approve │                  │
    │               ├──────────────►│                  │
    │               │               │ Emit ApprovalGranted
    │               │               │                  │
    │               │               │  Trigger Merge   │
    │               │               ├─────────────────►│
    │               │               │                  │ git merge / PR
    │               │               │ MergeCompleted   │
    │               │               │◄─────────────────┤
    │               │ Notification  │                  │
    │               │◄──────────────┤                  │
    │  Notification │               │                  │
    │◄──────────────┤               │                  │
```

---

## 7. Communication Flow

```
Component Communication Matrix:

SOURCE                  →  DESTINATION             PROTOCOL
────────────────────────────────────────────────────────────
Manager Browser         →  Control Plane API       HTTPS REST
Manager Browser         ←  Control Plane           WebSocket (Echo)
Mobile App              →  Control Plane API       HTTPS REST
Mobile App              ←  Control Plane           SSE / Push Notifications
AI Worker               →  Control Plane API       HTTPS REST (mTLS optional)
Control Plane           →  Redis Queue             TCP (Redis protocol)
AI Worker               →  Redis Queue             TCP (Redis protocol, Phase 2)
Control Plane           →  S3/Storage              HTTPS (SDK)
Control Plane           →  Git Provider            HTTPS (Git over HTTP)
Control Plane           →  Notification Channels   HTTPS (webhooks)
```

---

## 8. Data Flow

### 8.1 Task Creation Flow
```
Manager Input → Validation → Task Record → Queue Entry → Worker Poll → Execution
```

### 8.2 Artifact Flow
```
AI Agent Output → Worker Buffer → HTTPS Upload → S3 Storage → Checksum Verify → Review
```

### 8.3 Review Flow
```
ExecutionComplete Event → Assign Reviewer → Notify → Review UI → Decision Event → Action
```

### 8.4 Audit Flow
```
Every State Change → Domain Event → Event Listener → Audit Log Record (append-only)
```

---

## 9. Runtime Architecture

### 9.1 Control Plane Runtime
- Laravel PHP-FPM: handles synchronous HTTP requests (UI, Worker API)
- Laravel Horizon: processes async jobs (event fanout, notifications, repository operations)
- Redis Pub/Sub: broadcasts real-time events to browser WebSocket connections
- Laravel Echo Server / Reverb: WebSocket server for frontend real-time updates

### 9.2 Worker Runtime
- Standalone daemon process (Node.js recommended; Python alternative)
- Single-threaded event loop with concurrent subprocess management
- Spawns one subprocess per AI agent execution
- Subprocess runs inside a Docker container or restricted filesystem namespace
- Stdout/stderr from subprocess streamed to control plane in real time

### 9.3 Task Queue Runtime
- Redis-backed queue managed by Laravel Horizon
- Separate queue channels: `aiop-tasks` (high priority), `aiop-events` (standard), `aiop-cleanup` (low)
- Worker polling interval: configurable, default 10 seconds
- Task locks: distributed locks via Redis to prevent double-assignment

### 9.4 Artifact Storage Runtime
- S3-compatible object storage (AWS S3, Cloudflare R2, MinIO)
- Objects prefixed by workspace/project/task/execution
- Artifacts uploaded as multipart for large diffs (>10 MB)
- Retention: 90 days hot storage, 1 year cold archive (Glacier / equivalent)
