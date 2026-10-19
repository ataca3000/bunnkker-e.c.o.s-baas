# TASK-IAM-005 — Enterprise UI Authorization Platform · Engineering Report

**Date:** 2026-08-04 · **ADR:** [ADR-041](../adr/ADR-041-enterprise-ui-authorization-platform.md) · **Builds on:** ADR-038/039/040 · **Status:** Complete, pending review · **Working tree:** uncommitted

---

## 1. Executive Summary

TASK-IAM-005 makes the entire ECOS interface **adapt to the current user's effective
identity**. The backend authorization stack (permissions, visibility, data scope, policies,
Role Templates, user management) is now consumed by a single frontend platform: `/auth/me`
delivers one complete `authorization` context, a global `<AuthorizationProvider>` distributes
it, and a shared set of hooks/components lets any screen render according to that context —
**with no page implementing its own authorization logic, and no extra network requests**.

The dynamic sidebar, dynamic landing page, and dashboard profile are wired live. The platform
is verified end-to-end in the browser (login → full authorization payload → dynamic rail, zero
console errors) and by **11 passing unit tests** that prove the navigation filter restricts a
non-system user to strictly fewer modules. Backend regression: **86 IAM feature tests green**.
**Zero breaking changes.** Backend remains the single source of truth — this is UX only.

## 2. Architecture

```
Business pages ─▶ Authorization hooks/components ─▶ <AuthorizationProvider> ─▶ /auth/me `authorization`
                                                                                 ↑ built by
                                              AuthorizationContextBuilder ◀─ effectiveProfile (ADR-040)
```

One context, delivered once with `/auth/me`, normalised and distributed via React context;
recomputed only when the user changes (fully cached).

## 3. Files Created

**Backend:** `Modules/IAM/Application/Services/AuthorizationContextBuilder.php`.

**Frontend — `frontend/src/features/authorization/`:**
`authorization-context.ts` (React context), `authorization-provider.tsx`, `use-navigation.ts`
(dynamic sidebar + pure `isModuleVisible`), `authorization.test.ts` (11 tests). Expanded:
`types.ts` (AuthorizationContext + DTO + `normalizeContext`), `use-authorization.ts`
(+`usePermission/usePolicies/useFeature/useDashboard/useLandingPage`), `components/can.tsx`
(+`VisibilityBoundary/ScopeBoundary/Feature/ReadOnly`), `index.ts` (barrel).

**Docs:** `docs/adr/ADR-041-*.md`.

## 4. Files Modified

- Backend: `AuthenticatedUserDTO.php` — additively carries the `authorization` context.
- Frontend: `features/auth/types.ts` (`AuthUser.authorization?`), `providers/app-providers.tsx`
  (mount `<AuthorizationProvider>`), `components/layout/module-rail.tsx` (render
  `useNavigation().modules`), `features/auth/components/login-form.tsx` (redirect to landing page).

## 5. Authorization Components

`<Can>` / `<Cannot>` (permission, `all`/`any`), `<CanViewField>` (field permission),
`<VisibilityBoundary>` (semantic hidden field), `<HasScope>` / `<ScopeBoundary>` (data scope
width), `<Feature>` (org feature flag), `<ReadOnly>` (accessible non-interactive state,
`aria-disabled` + no pointer/focus), `<PermissionBoundary>`, `<RequirePermission>` (route guard).
Hooks: `useAuthorization`, `usePermission`, `useVisibility`, `useScope`, `usePolicies`,
`useFeature`, `useNavigation`, `useDashboard`, `useLandingPage`.

## 6. Dynamic Navigation

`useNavigation()` filters `config/module-navigation.ts` through the pure `isModuleVisible` gate:
**feature flag → system bypass → always-visible (dashboard) → Role-Template navigation whitelist
(authoritative when present) → permission-domain fallback**. `ModuleRail` consumes it; the
sidebar builds itself with no hardcoded per-user navigation. Verified live: admin (system) sees
all 16 modules; unit-tested that a whitelist user sees only their modules.

## 7. Dashboard Profiles

`useDashboard()` returns the profile + hidden/collapsed/widget-order from the user's primary
Role Template (the ADR-039 dashboard vocabulary: 8 widget ids, 7 profiles). Warehouse Clerk →
warehouse profile with financial widgets hidden; Sales Rep → crm profile; CEO → executive.
Landing page (`useLandingPage`) drives the post-login redirect.

## 8. Performance Analysis

- **Zero extra requests:** the whole context ships with `/auth/me` and lives in the auth store;
  every hook reads it synchronously and memoises. No authorization call fans out to the network.
- The provider recomputes only when the store `user` reference changes; `useNavigation` /
  `useAuthorization` are `useMemo`-guarded on the context.
- The module registry stays static and lazy per the existing config; filtering is O(modules).

## 9. Accessibility Review

- Hidden actions/modules are **not rendered** → not focusable, not in the tab order.
- `<ReadOnly>` exposes `aria-disabled="true"` and removes pointer interaction on the region.
- The dynamic rail preserves the existing `aria-label`/`aria-current` semantics on each link.

## 10. Test Results

- **Frontend unit (vitest):** `authorization.test.ts` — **11 passed** (permission normalisation +
  grants, context normalisation, and the dynamic-sidebar gate incl. "restricted user sees strictly
  fewer modules than a system user").
- **Frontend type-check:** `tsc --noEmit` — **zero errors** across all touched files.
- **Browser E2E:** login as admin → `/auth/me` returns the full 12-key `authorization` block
  (`is_system: true`) → dynamic rail renders 16 modules → **zero console errors**.
- **Backend regression:** `tests/Feature/IAM` — **86 passed** (the DTO change is additive/safe).

## 11. Breaking Change Assessment

**None.** Backend: `AuthenticatedUserDTO` gains a defaulted `authorization` field (additive).
Frontend: `AuthUser.authorization?` is optional; the provider falls back to the flat
permissions/is_system for pre-existing payloads; `ModuleRail` renders a filtered subset of the
same modules (system users are unaffected — they see all). No existing component's API changed.

## 12. Future Readiness

- **Per-page adoption** (forms/grids/quick-actions/notifications/search) is incremental: pages
  swap ad-hoc checks for `<Can>/<CanViewField>/<Feature>/<ReadOnly>` and `useScope`. The platform
  is in place; adoption is opt-in per screen (the ADR-038 "inert until adopted" model).
- **Org feature flags:** the `feature_flags` payload field exists; wiring an org feature-flag
  store lights up `<Feature>` gating with no frontend change.
- **Saved views / theme profiles / notification filtering** build on the same context
  (preferences + policies already delivered).
- **User Workspace (IAM-004 Phase 2)** consumes these components directly.
