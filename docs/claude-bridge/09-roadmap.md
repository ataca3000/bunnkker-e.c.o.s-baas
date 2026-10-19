# Roadmap
## ECOS Claude Bridge v1.0

**Document ID:** CB-RM-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## Principle

Each phase ships something independently usable. A phase that only adds infrastructure value without something the developer can touch is not a phase — it is a yak shave.

---

## Phase 1 — Working Product

**Goal:** A developer can queue a task from ECOS, Claude Code runs on their machine, and they review the output from their phone.

**Scope:**

- Laravel module (`Modules/ClaudeBridge`) with 5 tables, migrations, controllers, and routes
- 21 REST endpoints
- Node.js worker script (~500 lines), PM2 configuration
- 5-page Next.js UI: Dashboard, Task List, Create Task, Task Detail (Summary/Log/Diff/Report tabs), Settings
- Worker setup: download package, configure, run
- Artifact storage: Laravel local file storage
- Audit log: append-only, complete action coverage
- Security: bcrypt token auth, AES-256 encrypted worker config, HTTPS enforcement, company_id isolation

**What a developer can do when Phase 1 ships:**

1. Register their Windows machine as a worker in ECOS Settings
2. Create a task with a description ("Add CSV export to the Orders endpoint")
3. Queue the task
4. Watch the status update on Dashboard / Task Detail
5. Read the log to see what Claude Code did
6. Review the diff
7. Approve or request changes
8. Mark as merged after manually merging the branch

**Phase 1 explicitly excludes:**

- Real-time log streaming (page refresh only)
- Multiple workers
- PR creation from ECOS
- Token expiry / rotation schedule
- Role-based access
- Retry UI (developer cancels and re-queues manually)

**Phase 1 is done when:** a task flows from "Create" to "Merged" end-to-end on a real machine with real Claude Code output.

---

## Phase 2 — Daily Driver

**Goal:** Remove the friction of using it every day. Phase 1 is enough to prove the concept; Phase 2 is what makes it the developer's default workflow.

**Additions:**

**Live log streaming.** Replace page-refresh log viewing with real-time output. Requires WebSocket (Laravel Reverb, already in the stack) or Server-Sent Events. Developer watches Claude Code think in real time.

**In-app diff review.** Side-by-side diff viewer in the browser. Phase 1 requires downloading the patch. Phase 2 renders it inline with syntax highlighting, expandable context, and line-level commenting.

**Re-run on changes requested.** Instead of cancelling and re-creating the task, the reviewer can request changes with comments, and the developer edits the task description in-place. "Re-queue" button on the Task Detail sends it through another execution attempt with the updated description.

**Notification on task done.** ECOS pushes a browser notification when Claude Code finishes. The developer doesn't need to check the dashboard manually.

**Token expiry policy.** Worker tokens expire after a configurable period (default: 90 days). Warning email sent at 7 days. Tokens can be rotated without downtime by generating the new token, updating config.json, and restarting the worker.

**Basic RBAC.** Two roles: `cb:reviewer` (can review and approve tasks) and `cb:operator` (can create and queue tasks). Assigned per-user in ECOS. Phase 1 grants all authenticated users both roles.

**Phase 2 is done when:** the developer's first instinct for "I need to add something" is to open ECOS and queue a task, not to open a terminal.

---

## Phase 3 — Team Use

**Goal:** A second developer can also use it. The product becomes a team tool, not a personal one.

**Additions:**

**Multiple workers.** More than one registered worker. Task assignment: tasks are either unassigned (any available worker picks them up) or pinned to a specific worker by the task creator.

**Task assignment UI.** When creating a task, the developer can optionally pin it to a specific registered machine.

**Worker health dashboard.** Shows each registered worker's status, last seen time, Claude version, and task history. Identifies workers that have been offline for more than 24 hours.

**Rate limiting.** Worker endpoints get per-token rate limits to prevent a runaway loop from flooding ECOS.

**IP allowlist.** Optional per-worker IP restriction. If configured, the worker's heartbeat and task poll requests must originate from the declared IP.

**Artifact retention UI.** Admin can configure retention periods per artifact type. See the current storage usage. Manually delete artifact files older than a threshold.

**Phase 3 is done when:** a second developer registers their own machine and uses the Bridge independently without any coordination with the first developer.

---

## What Will Not Be Built

These ideas have been considered and excluded permanently unless the product strategy fundamentally changes.

| Idea | Why Excluded |
|---|---|
| Cloud workers (EC2, GitHub Actions, etc.) | Out of scope: the value prop is running on the developer's local machine with their local secrets and codebase access. Cloud workers require secret management, repo cloning, sandboxing — a different product. |
| Docker execution isolation | Adds complexity; the developer already trusts Claude Code on their machine. The risk model doesn't justify the isolation overhead for a single-developer tool. |
| Multi-provider (Gemini, GPT-4, etc.) | Claude Code only. This is a Claude Bridge, not an agent router. |
| Automatic git push / PR creation | The developer reviews and merges manually. Auto-push increases the blast radius of a bad run. |
| Workspace hierarchy / sub-organizations | company_id is the only scope. One company, one worker pool. |
| Plugin or connector framework | There are no other AI systems to connect. |
| Autonomous multi-step orchestration | The developer writes the task description; Claude Code does the work; the developer reviews. No chaining. |

---

## Decision Log

| # | Decision | Status |
|---|---|---|
| 1 | Use PHP/Laravel for the backend module (not a standalone service) | Decided |
| 2 | Use Node.js + PM2 for the worker (not a compiled binary) | Decided |
| 3 | Worker token is bcrypt-hashed Bearer token (not JWT) | Decided |
| 4 | ANTHROPIC_API_KEY stays on the worker machine; never in ECOS | Decided |
| 5 | Phase 1 uses local file storage for artifacts (not S3) | Decided |
| 6 | Phase 1: page refresh only, no WebSocket | Decided |
| 7 | Phase 1: one worker per ECOS instance | Decided |
| 8 | Worker config encrypted with machine-derived key | Decided |
| 9 | Audit log at DB level: no DELETE/UPDATE privileges | Decided |
| 10 | UI lives as Next.js pages under the ECOS frontend (not a separate app) | Decided |
