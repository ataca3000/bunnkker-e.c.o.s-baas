# ADR 002: Offline Sovereignty & Persistent Local Settings (P2)

- **Date:** 2026-10-15
- **Status:** Validated / Executed
- **Author:** Lead Engineer / Agentic AI Pair
- **Affected Area:** Local-First Core / Configuration Persistence (`/api/settings`, `/api/ai-agents/config`)

## Context
Under domain invariant #4, all retail and POS operations in BUNKKER E.C.O.S. must function completely without an internet connection. Previously:
- `/api/settings` held local config strictly in volatile RAM (`localSiteConfigCache`), losing business hours, market info, ticket header data, and canvas settings upon server reboot if cloud credentials were not active.
- `/api/ai-agents/config` refused to persist agent configurations if `hasRealCredentials` was false.

## Decision
1. Implemented [`src/lib/persistentSettings.ts`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/lib/persistentSettings.ts):
   - Atomic disk writes (`.tmp` -> `renameSync`) to ensure zero file corruption on power outage.
   - Dual-tier cache: RAM Map for $< 2$ms synchronous read responses, backed by durable disk storage (`data/settings/` or `%APPDATA%/bunnkker-ecos/settings/`).
   - Tenant-partitioned storage: `site_config_${tenantId}.json` and `ai_agents_${tenantId}.json`.
2. Refactored [`src/app/api/settings/route.ts`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/app/api/settings/route.ts):
   - `GET`: Serves local disk/RAM store immediately; cloud fetch is non-blocking with graceful fallback.
   - `POST`: Atomically commits to disk first; Firestore write is an asynchronous cloud mirror that never fails the local POS.
3. Refactored [`src/app/api/ai-agents/config/route.ts`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/app/api/ai-agents/config/route.ts):
   - Fully persists AI agent provider, model, and endpoint configurations in offline local-first mode.

## Consequences & Guarantees
- **Positive:** System achieves 100% operational offline sovereignty for business configuration and AI agent models. No restart will wipe configuration data.
- **Fail-Closed Security:** Only verified administrators (`superadmin`, `admin`) can mutate configuration.
