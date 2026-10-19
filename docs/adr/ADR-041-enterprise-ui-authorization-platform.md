# ADR-041 — Enterprise UI Authorization Platform (Adaptive Frontend)

**Status:** Accepted — 2026-08-04
**Builds on:** [ADR-038 Authorization](ADR-038-enterprise-authorization-platform.md) · [ADR-039 Role Templates](ADR-039-enterprise-role-templates.md) · [ADR-040 User Management](ADR-040-enterprise-user-management-platform.md)
**Task:** TASK-IAM-005

---

## Context

The backend authorization stack is complete (ADR-038/039/040). The frontend had only the
minimal `features/authorization/` primitives from ADR-038 Part 7. Nothing made the UI
*adapt* to the user: the sidebar rendered every module, the dashboard/landing were static,
and there was no single provider distributing the user's effective identity. We need the UI
to render itself according to the current user's permissions, visibility, scope, policies,
and feature flags — **without any page implementing its own authorization logic**.

## Decision 1 — One context, delivered once, distributed globally

`/auth/me` now carries a complete `authorization` block (permissions, visibility, scopes,
policies, navigation, dashboard, landing page, feature flags, effective templates), built by
`AuthorizationContextBuilder` from the user's composed Role Templates (ADR-040
`effectiveProfile`). A single `<AuthorizationProvider>` normalises it and distributes it via
React context. **No authorization evaluation issues a network request** — everything reads the
cached context and recomputes only when the user changes.

## Decision 2 — Hooks + components are the only authorization surface

```
Business pages ──▶ Authorization hooks/components ──▶ AuthorizationProvider ──▶ /auth/me context
```

- **Hooks:** `useAuthorization`, `usePermission`, `useVisibility`, `useScope`, `usePolicies`,
  `useFeature`, `useNavigation`, `useDashboard`, `useLandingPage`.
- **Components:** `<Can>`, `<Cannot>`, `<CanViewField>`, `<VisibilityBoundary>`, `<HasScope>`,
  `<ScopeBoundary>`, `<Feature>`, `<ReadOnly>`, `<PermissionBoundary>`, `<RequirePermission>`.

No page reads roles or inspects permission arrays directly.

## Decision 3 — The sidebar builds itself

`useNavigation()` filters the static module registry (`config/module-navigation.ts`) through a
pure, testable gate: **feature flag → system-bypass → always-visible → Role-Template navigation
whitelist (authoritative when present) → permission-domain fallback**. The `ModuleRail` renders
`useNavigation().modules` instead of the full list. No hardcoded per-user navigation.

## Decision 4 — Landing + dashboard come from the user's templates

On login the app redirects to the user's `landing_page` (a `ROUTES` key from their primary
template), falling back to the dashboard. The dashboard profile (`useDashboard`) comes from the
same context. Backward-compatible: users without templates fall back to permission-driven
navigation and the default dashboard.

## Decision 5 — Frontend never trusts itself

This platform is **UX only**. The backend remains the single source of truth: sensitive fields
are already masked at the API layer (ADR-038 `HidesSensitiveFields`), records are filtered by
the Data Scope engine, and every mutation is authorized server-side. Hiding a control never
grants or denies access — it only avoids showing the user affordances they cannot use.

## Consequences

**Positive:** the entire UI adapts to the user's effective identity from one cached context;
zero extra requests; one shared authorization surface; the sidebar/landing/dashboard are
dynamic; deep per-page adoption (forms/grids/quick-actions) is incremental and opt-in.

**Neutral:** per-resource visibility/scope enforcement adoption remains the ADR-038 track;
org feature flags default to all-enabled until an org feature-flag store is added (the payload
field already exists).

**Accessibility:** `<ReadOnly>` sets `aria-disabled` and removes pointer interaction; hidden
actions are not rendered (so not focusable).
