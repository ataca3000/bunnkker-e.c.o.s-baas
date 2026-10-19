# ADR-AIOP-008: Execution Isolation
## Architecture Decision Record

**Status:** Accepted  
**Date:** 2026-07-18  

---

## Context

AI agents run arbitrary code-generation workflows that may include running tests, invoking build tools, and exploring the filesystem. Without isolation:
- One AI task could corrupt another task's workspace
- A buggy AI agent could damage the host machine
- Secrets from one task could leak to another
- AI-generated code could be executed without review

We need an isolation strategy that is secure, practical, and deployable on developer machines and CI servers.

---

## Decision

### Execution Isolation: Docker-First, Filesystem Fallback

#### Tier 1: Docker Container Isolation (Recommended)

Each task execution runs in a dedicated Docker container:

```
Container Configuration:
  Image: ecos-aiop-worker-sandbox:latest  (minimal, audited image)
  
  Volume Mounts:
    /workspace/{task_id}  →  rw  (task workspace, created fresh per execution)
    /tools                →  ro  (read-only tools: git, language runtimes)
    
  Network:
    None (--network none) for default executions
    Restricted egress allowed only for tasks requiring package installation
    
  Resource Limits:
    CPU:    2 cores maximum
    Memory: 4 GB maximum
    Disk:   20 GB workspace maximum
    Time:   Configurable timeout (default 30 minutes)
    
  User:
    Non-root user (uid:gid = 1000:1000)
    
  Capabilities:
    All Linux capabilities dropped (--cap-drop ALL)
    No privileged mode
    No host PID namespace
    No host network namespace
```

#### Workspace Lifecycle

```
Task Assigned
     │
     ▼
Create Workspace Directory
/workspaces/{task_id}/

     │
     ▼
Clone Repository into Workspace
(using task-scoped deploy key)
     │
     ▼
Inject Environment Variables
(secrets from control plane)
     │
     ▼
Start Docker Container
(mount workspace read-write)
     │
     ▼
AI Agent Executes Inside Container
     │
     ▼
Collect Changed Files
Compute Diff
     │
     ▼
Upload Artifacts to S3
     │
     ▼
Container Stops
Workspace Purged (configurable delay)
Deploy Key Revoked
Secrets Cleared from Memory
```

#### Tier 2: Filesystem Isolation (Fallback for machines without Docker)

On machines where Docker is not available (or not permitted), use OS-level isolation:

```
Isolation Method:
  - Dedicated OS user per worker (e.g., ecos-worker-a)
  - User has read/write access only to /home/ecos-worker-a/workspaces/
  - User cannot access other users' home directories
  - User cannot write to system directories
  - Workspace created per task: /home/ecos-worker-a/workspaces/{task_id}/
  - Workspace purged at task completion

Limitations vs Docker:
  - Less network isolation (OS-level firewall rules required separately)
  - Less process isolation (host processes visible in /proc)
  - Acceptable only for trusted machines with network-level controls
```

### Secret Lifecycle in Isolated Execution

```
Control Plane                Worker Process          Container
     │                            │                      │
     │  Task Assignment           │                      │
     │  (includes encrypted       │                      │
     │   secrets bundle)          │                      │
     ├───────────────────────────►│                      │
     │                            │ Decrypt secrets      │
     │                            │ (in memory only)     │
     │                            │                      │
     │                            │ Start container with │
     │                            │ env vars (--env)     │
     │                            ├─────────────────────►│
     │                            │                      │ AI Agent uses
     │                            │                      │ env vars for
     │                            │                      │ API access
     │                            │                      │
     │                            │ Container stops      │
     │                            │◄─────────────────────┤
     │                            │ Secrets cleared      │
     │                            │ from memory          │
```

### Concurrent Execution Isolation

If a single worker machine runs multiple concurrent executions:
- Each execution has its own Docker container instance
- Each container has its own isolated workspace directory
- Containers cannot communicate with each other
- The worker daemon manages container lifecycle with unique IDs

### Anti-Patterns (Explicitly Forbidden)

- AI agents **must not** run with root/admin privileges inside the container
- AI agents **must not** have write access to any directory outside /workspace
- AI agents **must not** have access to the host Docker socket
- Containers **must not** share network namespaces
- Secrets **must not** be written to any file inside the workspace

---

## Consequences

### Positive
- Docker isolation provides OS-level security boundaries around AI execution
- Per-execution workspace prevents cross-task contamination
- Secret lifecycle ensures credentials are not persisted post-execution

### Negative
- Docker required on all Tier 1 worker machines (operational overhead)
- Container startup time adds 5–15 seconds to each execution (acceptable)
- Disk management required: workspaces must be cleaned up to prevent disk exhaustion
