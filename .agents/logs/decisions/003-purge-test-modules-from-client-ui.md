# ADR 003: Purge Testing Benches from Client-Facing UI (P3)

- **Date:** 2026-10-15
- **Status:** Validated / Executed
- **Author:** Lead Engineer / Agentic AI Pair
- **Affected Area:** Frontend UI Navigation & Dev Test Pipeline

## Context
During architectural debt review and master system mapping, a "Pruebas de Lógica" / "Laboratorio de Estrés" section was discovered inside the superadmin and admin production dashboard.
Exposing test harnesses to store owners and cashiers introduces severe operational risks (accidental data wiping, simulated concurrency storms) and violates the zero-bloat principle.

## Decision
1. **Frontend Navigation Clean-up:**
   - Removed `tests` item from [`src/components/admin/AdminLayout.tsx`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/components/admin/AdminLayout.tsx).
   - Removed `tests` item from [`src/components/admin/IconCarouselNav.tsx`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/components/admin/IconCarouselNav.tsx).
   - Removed `tests` card from [`src/components/dashboard/SuperAdminDashboard.tsx`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/components/dashboard/SuperAdminDashboard.tsx).
2. **Access Control:**
   - Added automatic redirection in [`src/middleware.ts`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/middleware.ts) from `/dashboard/tests` to `/dashboard`.
   - Disabled `/api/tests/cleanup` in `production` and scoped test cleanup strictly by `tenantId`.
3. **Engineering Integrity:**
   - Refactored [`scripts/test-logic.js`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/scripts/test-logic.js) to eliminate silent error-swallowing, ensuring truth-in-reporting for Vitest execution.

## Consequences & Guarantees
- Cleaner, zero-bloat UI for retail operators.
- Zero risk of accidental test data purge in production stores.
- Testing remains strictly within developer terminal and CI workflows.
