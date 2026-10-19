# ADR-036: Enterprise Engineering Workspace

- **Status:** Accepted
- **Date:** 2026-07-23
- **Task:** TASK-ENG-V2-005
- **Depends on:** ADR-032 (AI Repair), ADR-033 (Self-Healing Pipeline), ADR-034 (Guardian), ADR-035 (Intelligence Platform)

## Context

Engineering OS V2 spans five platforms with 60+ API routes and eight frontend pages,
but there was no single operational surface: monitoring a repair loop required
visiting the repair page, the supervisor page, and the releases page separately, and
nothing offered a merged activity view, global search, or exports.

## Decision

### 1. Visualization-only aggregation layer

The Workspace performs no engineering decisions, executes no validations, repairs,
or AI calls, and owns no business logic. Backend support is a single
WorkspaceAggregationService that composes EXISTING services — RepairEngine and
GuardianEngine dashboards, AIReviewEngine (Supervisor), the Intel* engines
(analytics, debt, insights, predictions, confidence), and ReleaseValidationService —
plus read-only projections for the merged timeline, global search, and CSV export.
The only workspace-owned state is the saved-views table.

### 2. Composed executive payload

GET /workspace/executive returns one payload composing engineering health (repair
success rate, validation accept rate, guardian allow rate, supervisor score,
debt score), the repair and guardian dashboards, release readiness rows with
blocking issues, and open insights — one round trip for the top-level view.

### 3. Unified timeline

GET /workspace/timeline merges the three append-only histories (repair events,
validation events, guardian decisions) into one reverse-chronological stream with
per-source filtering. No new event storage: it projects the existing audit tables.

### 4. Drill-down by navigation, not duplication

The frontend workspace page (route /engineering/workspace) links into the existing
Repair, Supervisor, and Releases pages for detail work instead of re-implementing
them. Live monitor (15s polling) and executive KPIs (60s) auto-refresh.

### 5. Saved views and export

engineering_workspace_views stores per-user named filter sets (context + filters
JSON, optional company-wide sharing; only the owner can modify). CSV export is a
bounded (1000-row) read-only projection of repair sessions, validations, or
guardian runs, downloaded through the authenticated client as a blob.

## Database

One table: engineering_workspace_views (uuid PK, company_id, user_id, name,
context, filters JSON, is_shared).

## API

10 routes under /api/system/engineering/workspace (executive, live, timeline,
search, release-readiness, export, views CRUD), all auth:sanctum + throttle:60,1,
company-scoped.

## Alternatives Considered

1. **Dedicated workspace read models / materialized views** — rejected: premature;
   the source tables are indexed and bounded queries are fast at current scale.
2. **WebSocket live updates** — rejected for V2-005: polling at 15s meets the
   monitoring need without new infrastructure; Reverb integration can come later.
3. **Embedding the existing pages as components** — rejected: navigation drill-down
   keeps one owner per screen and avoids double-fetching.

## Consequences

**Positive:** one operational surface over the entire Engineering OS; zero
duplicated business logic; merged auditable activity stream; exports and saved
views without new write paths into other modules.

**Negative:** executive payload fans out to several services per request
(mitigated: each sub-query is bounded; caching can be added behind the same
endpoint); localization strings are English-first pending the project-wide
translation pass.

## Verification Note (2026-07-23)

End-to-end verified against the live dev stack: migrations applied, all 10 routes
registered, the page rendered with live KPIs, the live monitor showed real repair
sessions and guardian runs (including auto-opened repair sessions from blocked
gates), and the timeline showed merged repair/guardian events with real block
reasons. The verification surfaced and fixed several latent defects from earlier
waves (see the V2 status memory): a frontend-wide crash from a bad axios import in
the ENG-009 service, stripped-backslash FQCNs in AIReviewEngine, a missing enum
helper, an argument-order mismatch in RepairAuditService, three missing
HasApiResponse trait namespaces, and five MySQL index-limit migration failures.
