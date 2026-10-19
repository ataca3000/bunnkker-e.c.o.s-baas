# ADR-024: Single Source of Truth for Editable Entities

**Status:** Accepted  
**Date:** 2026-07-16  
**Authors:** Platform Engineering  
**Scope:** All ECOS OS modules  
**Related:** ADR-011 (Event-Driven), ADR-022 (Allocation Orchestration)

---

## Context

ECOS follows an Enterprise Workspace architecture where business entities can be edited from multiple entry points:

- Workspace Grid
- Detail Drawer
- Detail Page
- Edit Page
- Quick Actions
- Inline Editors

Historically, some inline editors maintained independent local state or updated separate cache entries, causing inconsistencies between the Workspace and the Detail views.

**This architecture is no longer permitted.**

---

## Decision

Every business entity in ECOS must have one canonical representation.  
All editing operations must update that canonical entity.  
No view may maintain its own persistent copy of entity data.

---

## Canonical Entity Rule

```
Order
├── Orders Workspace
├── Order Drawer
├── Order Detail Page
├── Order Edit Page
└── Timeline
```

All five represent the same `Order`. Editing from any location edits the same entity.

The same principle applies to every entity across every OS module.

---

## Data Flow

```
User Edit
    │
    ▼
PATCH Entity
    │
    ▼
Database
    │
    ▼
API Resource
    │
    ▼
React Query Cache
    │
    ▼
All Views Refresh
```

---

## React Query Rule

Mutations must invalidate the canonical cache hierarchy.  
**Never invalidate only one screen.**

Example for Orders:

```
['company', companyId, 'orders']          ← broad prefix
    ├── ['company', companyId, 'orders', params]   ← list
    ├── ['company', companyId, 'orders', id]       ← detail
    ├── ['company', companyId, 'orders', 'count', tab]
    └── ['company', companyId, 'orders', id, 'activities']
```

Invalidating the 3-segment prefix `['company', companyId, 'orders']` covers all four shapes simultaneously via React Query prefix matching.

Every module must follow the same hierarchical key structure.

---

## Forbidden Patterns

| Pattern | Status |
|---|---|
| Grid-only model (data that only lives in the list response) | ❌ Prohibited |
| Drawer-only model | ❌ Prohibited |
| Edit-page-only model | ❌ Prohibited |
| Persistent duplicated local state | ❌ Prohibited |
| Separate DTOs containing different business values per view | ❌ Prohibited |
| `setQueryData` with an unregistered cache key | ❌ Prohibited |
| Invalidating only the list query after a mutation | ❌ Prohibited |
| Invalidating only the detail query after a mutation | ❌ Prohibited |

---

## Inline Editing Rule

Any field editable from a Workspace Grid must update the entity itself via the canonical `PATCH` endpoint.

### Orders

| Field | Inline editable | Updates entity |
|---|---|---|
| Status | ✅ | ✅ |
| Address / Area | ✅ | ✅ |
| Zone / City | ✅ | ✅ |
| GPS Location | ✅ | ✅ |
| Confirmation | ✅ | ✅ |
| Reservation | ✅ | ✅ |
| Driver | planned | must follow this rule |
| Sales Rep | planned | must follow this rule |
| Notes | ✅ | ✅ |

### Products

| Field | Inline editable | Updates entity |
|---|---|---|
| Price | planned | must follow this rule |
| Category | planned | must follow this rule |
| Brand | planned | must follow this rule |
| Status | planned | must follow this rule |

The behavior is identical across all entities.

---

## UI Rule

> Workspace editing is only another entry point. It is not another data source.

- Local state inside an inline editor is permitted **only for ephemeral UI concerns**: popover open/closed, save indicator (idle → saving → saved → failed), cascade selection state that is reset when the editor opens.
- Local state must **never** persist a copy of entity data that outlives the editing interaction.
- Displayed values in the grid **must always come from the server-side Order/entity object**, never from component-local cached values.

---

## Implementation Checklist (per mutation)

- [ ] Mutation calls the correct backend endpoint (`PATCH /entity/{id}` or equivalent)
- [ ] `onSuccess` invalidates the broad prefix key (covers list + detail)
- [ ] `setQueryData` (if used for instant cache seed) targets the registered detail key
- [ ] No `onSuccess` scoped to a single screen's query key when the mutation affects entity-level fields
- [ ] Component displays values from props/server data, not from `useState` initialized at mount

---

## Scope

This ADR is mandatory for:

| OS | Status |
|---|---|
| Commerce OS (Orders, Fulfillments) | ✅ Implemented |
| Inventory OS | mandatory |
| Procurement OS | mandatory |
| CRM OS | mandatory |
| Logistics OS | mandatory |
| Manufacturing OS | mandatory |
| Finance OS | mandatory |
| Organization OS | mandatory |

Any future module must follow this rule from day one.

---

## Consequences

**Positive:**
- Every screen in ECOS always displays the same data
- No synchronization bugs between Workspace and Detail views
- No stale UI after inline edits
- No duplicated business state
- Single invalidation covers all views

**Negative:**
- Broader cache invalidation means slightly more network requests per mutation compared to targeted single-view invalidation
- Acceptable trade-off: correctness always over micro-optimisation

---

## Reference Implementation

`frontend/src/features/orders/hooks/use-orders.ts` — the Orders module is the canonical reference implementation of this pattern. All mutations use `invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY] })` to cover all views from a single invalidation call.
