# Lean Architecture
## ECOS Claude Bridge v1.0

**Document ID:** CB-ARCH-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## Four Components

That is all there is.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌────────────────┐           ┌─────────────────────────────┐  │
│   │   ECOS ERP     │           │   Developer UI              │  │
│   │                │◄──────────│   (Phone / Browser)         │  │
│   │  Claude Bridge │           │                             │  │
│   │  Module        ├──────────►│   - Dashboard               │  │
│   │                │           │   - Tasks                   │  │
│   │  - Task queue  │           │   - Logs                    │  │
│   │  - Reports     │           │   - Reports                 │  │
│   │  - Reviews     │           │   - Settings                │  │
│   │  - API         │           └─────────────────────────────┘  │
│   └───────┬────────┘                                            │
│           │                                                     │
│           │  HTTPS (outbound from worker)                       │
│           │                                                     │
│   ┌───────▼────────┐           ┌─────────────────────────────┐  │
│   │  Claude Worker │  launches │   Claude Code               │  │
│   │                ├──────────►│                             │  │
│   │  Windows       │           │   Already installed         │  │
│   │  Background    │◄──────────│   locally.                  │  │
│   │  Service       │  output   │   Worker passes the task.   │  │
│   └────────────────┘           │   Claude Code does the work.│  │
│                                └─────────────────────────────┘  │
│                                                                 │
│   Everything runs on one Windows workstation.                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### ECOS ERP (Claude Bridge Module)

A Laravel module inside ECOS. Provides:
- REST API for the Worker (task polling, result upload)
- REST API for the UI (task CRUD, review actions)
- Task queue and lifecycle state machine
- Artifact storage (file storage; S3 optional later)
- Audit log
- Notification to reviewer when a task completes

Nothing new is deployed. Claude Bridge runs inside the existing ECOS application container.

---

### Claude Worker

A lightweight background service that runs on the developer's Windows PC.

Responsibilities (only these, nothing else):
- Authenticate with ECOS using a pre-configured API token
- Send a heartbeat every 30 seconds
- Poll for the next pending task every 10 seconds
- Run Claude Code with the task description as the prompt
- Stream log output to ECOS while Claude Code runs
- Upload the git diff and execution report when Claude Code finishes
- Report completion status (success or failure)
- Restart automatically after crash or reboot

The Worker does not clone repositories. Claude Code does that. The Worker launches Claude Code in the correct working directory.

---

### Claude Code

Claude Code is already installed on the developer's machine. The Worker launches it as a subprocess with the task description as the prompt. Claude Code handles everything else:
- Reading the codebase
- Writing files
- Running tests
- Producing output

The Worker does not know what Claude Code is doing internally. It captures stdout/stderr and forwards it to ECOS.

---

### Developer UI

A section of the ECOS frontend (Next.js). Five pages. Mobile-first.

Users view the dashboard, create tasks, read logs, read reports, and approve or reject results. No native mobile app is needed — the ECOS web interface at the mobile breakpoint is sufficient.

---

## Communication Flow

```
UI (browser)      →  ECOS API    →  Database / Storage
Claude Worker     →  ECOS API    →  Database / Storage
Claude Worker     ←  ECOS API    (task assignments, 10s poll)
Claude Worker     →  ECOS API    (heartbeat, logs, artifacts)
UI (browser)      ←  ECOS       (response to API calls; no WebSocket in Phase 1)
```

All communication is outbound from the Worker. No inbound connections to the Worker machine are required. Corporate firewalls are not a problem.

---

## What Is Not in Phase 1

| Omitted | Reason |
|---|---|
| WebSocket / real-time streaming | Simple page-refresh is sufficient for Phase 1 |
| S3 artifact storage | ECOS local storage is sufficient; S3 can be added |
| Docker container execution | Unnecessary overhead for one machine |
| Multiple workers | Phase 1 supports exactly one worker per ECOS instance |
| Token refresh / rotation | Single long-lived token is acceptable for one-machine MVP |
| Webhook outbound notifications | Not needed for Phase 1 |
| PR creation | Developer merges manually in Phase 1 |

---

## Technology Summary

| Component | Technology | Notes |
|---|---|---|
| ECOS Module | Laravel 12 (PHP 8.4) | Same stack as ECOS ERP |
| Database | PostgreSQL | Same DB as ECOS ERP |
| File Storage | Laravel Storage (local) | Artifacts stored on ECOS server |
| Worker | Node.js (Windows service via PM2) | Simple, cross-platform |
| UI | Next.js | Same frontend as ECOS ERP |
