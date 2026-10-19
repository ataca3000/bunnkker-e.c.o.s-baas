# ECOS Claude Bridge v1.0
## Architecture Documentation

**Status:** Architecture Complete — Awaiting Approval to Implement  
**Last Updated:** 2026-07-18  

---

## What It Is

A lean integration that lets a developer queue tasks for Claude Code running on their Windows workstation, then review the output from any device. Think of it as a very small CI for AI coding work.

**Core workflow:** Create task → Queue → Worker runs Claude Code → Upload artifacts → Review → Approve/Merge

---

## Documents

| # | Document | Contents |
|---|---|---|
| 01 | [Vision](01-vision.md) | Product definition, core workflow, 5 design principles |
| 02 | [Lean Architecture](02-lean-architecture.md) | 4-component diagram, technology choices, Phase 1 omissions |
| 03 | [Domain Model](03-domain-model.md) | 5 entities, 10-state task machine, what is NOT a domain entity |
| 04 | [Database Design](04-database-design.md) | 5 tables with full column definitions, indexes, retention |
| 05 | [Worker Architecture](05-worker-architecture.md) | Node.js+PM2 service, startup sequence, execution flow, failure handling |
| 06 | [REST API](06-rest-api.md) | 21 endpoints across 4 groups, full request/response examples |
| 07 | [UI / UX](07-ui-ux.md) | 5 pages with ASCII wireframes, mobile-first design |
| 08 | [Security](08-security.md) | Token design, key isolation, tenant scoping, audit integrity |
| 09 | [Roadmap](09-roadmap.md) | 3 phases, what will not be built, decision log |

---

## Key Decisions (Summary)

| Decision | Choice |
|---|---|
| Backend | Laravel 12 module inside ECOS (`Modules/ClaudeBridge`) |
| Worker runtime | Node.js + PM2 Windows service |
| Worker auth | bcrypt-hashed Bearer token (no JWT, no expiry in Phase 1) |
| ANTHROPIC_API_KEY | Lives on the worker machine only; never enters ECOS |
| Artifact storage | Laravel local file storage (no S3 in Phase 1) |
| Real-time | Page refresh only in Phase 1 (no WebSocket) |
| Multi-worker | Phase 1: one worker per ECOS instance |
| Worker config | AES-256 encrypted, machine-derived key |
| Audit log | DB-level append-only (no DELETE/UPDATE permissions) |
| Secrets in task payload | None — the task contains only description and repo path |
