# ADR-POS-002 — Vite + React SPA (not Next.js)

**Status:** Accepted  
**Date:** 2026-06-30  
**Deciders:** Architecture Team

---

## Context

The POS specification references Next.js as the frontend framework. However, the ECOS ERP frontend is a **Vite + React 19** single-page application. The existing SPA lives in `frontend/src/`, uses a client-side router (`react-router-dom`), and organises features under `src/features/{feature}/`. There is no Next.js setup in the repository.

## Decision

Build the POS frontend as a feature module within the **existing Vite + React SPA**. POS screens will live at `src/features/pos/` and will follow the established feature structure: `pages/`, `components/`, `hooks/`, `services/`, `store/`, `types/`, `schemas/`.

Routes will be added to `src/router/routes.ts` (ROUTES constants) and `src/router/router.ts`.

## Consequences

**Positive:**
- Reuses existing build tooling, design system, shared components, auth context, and API client.
- No new framework to deploy or maintain.
- POS shares the same bundle in environments that need the full ERP.

**Negative / Watch-outs:**
- Any Next.js-specific advice in the spec (SSR, `pages/`, App Router) does not apply. Map to React Router equivalent.
- Code-splitting must be explicit (`React.lazy`) for the POS bundle chunk.

## Alternatives Considered

- **Separate Next.js app for POS** — rejected. Creates a second deployment target, duplicates auth/routing/design-system, and conflicts with the existing SPA architecture.
- **Separate Vite app for POS** — rejected. Same duplication problem, no benefit over integrating into the existing app.
