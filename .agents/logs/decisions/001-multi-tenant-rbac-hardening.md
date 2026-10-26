# ADR 001: Multi-Tenant Partitioning and RBAC Hardening (P1)

- **Date:** 2026-10-15
- **Status:** Validated / Executed
- **Author:** Lead Engineer / Agentic AI Pair
- **Affected Area:** Motor Central / API Routes (`purchases`, `tickets`, `settings`, `audit`)

## Context
A prior architecture review identified that several API routes were operating without tenant scoping (`tenantId`), allowing potential cross-tenant leakage in multi-branch setups. Additionally:
- `POST /api/settings` was exposed to unauthenticated mutations.
- `GET /api/purchases`, `POST /api/purchases`, `PATCH /api/purchases` were not enforcing role checks or tenant filtering.
- `GET /api/tickets`, `POST /api/tickets`, `PATCH /api/tickets` lacked tenant partitioning.
- `GET /api/audit` and `POST /api/audit` lacked tenant filtering and DB-backed role verification.

## Decision
1. Injected `getTenantId(request)` across `src/app/api/purchases/route.ts`, `src/app/api/tickets/route.ts`, `src/app/api/settings/route.ts`, and `src/app/api/audit/route.ts`.
2. Enforced fail-closed DB verification via `requireActiveRole(request, allowedRoles)` for state mutations (`POST`, `PATCH`).
3. Partitioned Prisma queries strictly with `where: { tenantId }` and inserts with `data: { tenantId, ... }`.
4. Sanitized all error responses to prevent exposing internal Prisma exceptions to clients.

## Consequences & Guarantees
- **Positive:** Multi-tenant boundaries are strictly maintained; unauthenticated network actors cannot tamper with business configurations or inspect cross-tenant data.
- **Offline Compatibility:** Fully compliant with local-first SQLite WAL architecture via fail-closed verification against local SQLite.
