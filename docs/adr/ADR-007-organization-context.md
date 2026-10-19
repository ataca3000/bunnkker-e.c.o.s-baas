# ADR-007 — Organization Context Foundation

**Status:** Accepted  
**Task:** TASK-ORG-001  
**Date:** 2026-06-29

---

## Context

ECOS ERP is a multi-company, multi-branch, multi-warehouse platform. As the system expands
beyond its current single-tenant inception, every domain model will eventually need a
scoping strategy: *which company (and branch / warehouse) does this record belong to?*

Before implementing query scopes, permission filters, or API-level tenant isolation, the
architectural foundation must be established:

1. **The correct entity hierarchy** must be confirmed — orphaned relationships break the
   security boundary.
2. **A contract interface** (`OwnsCompany`) must exist so the RBAC scope system (ADR-006 §5)
   and future global query scopes have a type-safe handle on scoped models.
3. **A migration roadmap** must list every model that will need scope columns, grouped by
   phase, so migrations are never sprinted ad-hoc without architectural awareness.

---

## Confirmed Hierarchy: Company → Branch → Warehouse

```
Company
└── Branch          (branches.company_id → companies.id)
    └── Warehouse   (warehouses.branch_id → branches.id)
                    (warehouses.company_id → companies.id  ← denormalized shortcut)
```

**Branch** holds `company_id`. **Warehouse** holds both `branch_id` AND `company_id`.
The `company_id` on `Warehouse` is intentional denormalization: it avoids a join through
`branches` when querying "all warehouses for company X", which is the most common
access pattern. A CHECK constraint (or application-layer invariant) must ensure that
`warehouses.company_id` always equals `warehouses.branch.company_id`.

No orphan issue was found. The hierarchy is intact.

---

## Decisions

### 1. `OwnsCompany` Interface

A PHP interface `Modules\Core\Organization\Contracts\OwnsCompany` is created with a
single method:

```php
public function getCompanyId(): ?string;
```

**Why a single method?** The interface is deliberately minimal. Its purpose is not to
describe the full "company relationship" (Eloquent handles that), but to declare to the
type system: *"this model has a company_id column"*. The RBAC scope system needs to call
`$model->getCompanyId()` without knowing the concrete class. PHPStan can then verify
every call site is backed by a real implementation.

**Why not a Trait?** A trait provides behaviour; this contract requires behaviour from
the implementor. Models that implement `OwnsCompany` must have the column — if a model
returns `null` from `getCompanyId()` because the column doesn't exist, that is a bug.
An interface makes that bug a type error at analysis time.

**Placement:** `Modules/Core/Organization/Contracts/` — Core is the only module with no
upstream dependencies; all other modules may depend on it safely.

### 2. UserRole Scope Columns Are Sufficient

`user_roles` (from TASK-SECURITY-001A) already carries:

| Column | Purpose |
|--------|---------|
| `company_id` | Role active only within this company |
| `branch_id` | Role active only within this branch |
| `warehouse_id` | Role active only within this warehouse |

All three are nullable. A role assignment with all-null scope is global (system-wide).
A role assignment with `company_id` set is company-scoped. This covers the 3-level
hierarchy without a separate scope table.

**No action required on `user_roles` for this task.**

### 3. Phased Migration Roadmap

Scope columns are added in phases, coordinated with the feature sprint that first
*requires* company isolation for that model. Adding them speculatively ahead of the
feature causes migration churn. Waiting too long causes data-integrity gaps.

---

## Migration Roadmap

### Phase 0 — Already Correct (No Action Needed)

| Model | Table | Scope Columns Present |
|-------|-------|-----------------------|
| Company | `companies` | Root entity — has no `company_id` by design |
| Branch | `branches` | `company_id` ✓ |
| Warehouse | `warehouses` | `company_id` ✓, `branch_id` ✓ |
| InventoryItem | `inventory_items` | `company_id` ✓, `warehouse_id` ✓ |
| StockLedgerEntry | `stock_ledger_entries` | `company_id` ✓, `warehouse_id` ✓ |
| InventoryLayerConsumption | `inventory_layer_consumptions` | `company_id` ✓, `warehouse_id` ✓ |
| InventoryCountSession | `count_sessions` | `company_id` ✓, `warehouse_id` ✓ |
| PurchaseOrder | `purchase_orders` | `company_id` ✓, `warehouse_id` ✓ |
| Channel | `channels` | `company_id` ✓ |
| UserRole | `user_roles` | `company_id` ✓, `branch_id` ✓, `warehouse_id` ✓ |

### Phase 1 — Partially Scoped: Add `company_id` (Sprint: Operations Tenant Isolation)

These models already carry `warehouse_id` (implying warehouse ownership) but lack a
direct `company_id`. Since `warehouses.company_id` is always set, a JOIN can derive the
company today. However, a direct column eliminates the join and is required before
activating query-level tenant scopes.

| Model | Table | Missing |
|-------|-------|---------|
| GoodsReceipt | `goods_receipts` | `company_id` |
| InventoryReceiptLayer | `inventory_receipt_layers` | `company_id` |
| StockMovement | `stock_movements` | `company_id` |
| Fulfillment | `fulfillments` | `company_id` |
| SyncLog | `sync_logs` | `company_id` |

**Trigger:** When RBAC scope enforcement is activated for inventory or fulfillment
operations. A nullable `company_id` column can be added with a backfill migration
before the UNIQUE constraint is tightened.

### Phase 2 — Not Yet Scoped: Core Commerce Models (Sprint: Multi-Company Commerce)

These models have no scope columns. They function correctly in single-company mode
because there is no tenant filter active yet.

| Model | Table | To Add |
|-------|-------|--------|
| Product | `products` | `company_id` |
| Supplier | `suppliers` | `company_id` |
| Customer | `customers` | `company_id` |
| Order | `orders` | `company_id` (has `assigned_warehouse_id` for ops) |
| BillOfMaterial | `bill_of_materials` | `company_id` |

**Trigger:** When the first multi-company demo or customer onboarding requires data
isolation between companies.

### Phase 3 — Evaluated Later (May Remain Global)

| Model | Table | Decision |
|-------|-------|----------|
| Category | `categories` | May be per-company (custom taxonomies) or global (shared). Decide at sprint time. |
| Unit | `units` | Likely global (kg, m, pcs are universal). No action unless company-specific UoMs are requested. |
| Role | `roles` | IAM global definitions. Scoping happens via `user_roles` assignments, not the Role row itself. |
| Permission | `permissions` | Global definitions. Never company-scoped. |
| ProductMapping | `product_mappings` | Scoped transitively via `channel_id → channels.company_id`. Direct column not required. |
| OrderLine / PurchaseOrderLine / GoodsReceiptLine / FulfillmentLine / BomLine | child tables | Scoped transitively via parent model. Direct column never needed. |
| UserPreference | `user_preferences` | Per-user preference store. Not company-scoped by design. |

---

## Implementing `OwnsCompany` on Models

When Phase 1 or Phase 2 migrations land, the corresponding model implements the
interface:

```php
use Modules\Core\Organization\Contracts\OwnsCompany;

class GoodsReceipt extends Model implements OwnsCompany
{
    public function getCompanyId(): ?string
    {
        return $this->company_id;
    }
}
```

The Phase 0 models with `company_id` already present (InventoryItem, PurchaseOrder,
Channel, etc.) should also implement `OwnsCompany` in the same sprint that activates
tenant scoping — no earlier, to avoid interface sprawl without behaviour.

---

## Consequences

### Positive
- A single, stable interface anchors the entire scoped authorization system. No future
  sprint needs to "design the interface" — it is ready.
- The migration roadmap prevents ad-hoc scope column additions. Every phase has a clear
  trigger tied to a real feature requirement.
- The hierarchy is confirmed correct. No breaking migrations are needed to fix structure.
- The `user_roles` scope columns are complete for the 3-level hierarchy.

### Negative / Trade-offs
- `OwnsCompany` is not yet implemented on any model. Until Phase 0 models opt-in, the
  interface has no callers. This is intentional — it prevents premature abstraction
  before the consuming feature (scoped RBAC) is built.
- Phase 1 models will need a backfill migration for `company_id`. Backfills on large
  tables carry risk; they must be run with `DB::statement` or a queued job, not a simple
  `ALTER TABLE`.

---

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| Single `tenant_id` column on every model | "Tenant" is ambiguous in a multi-company ERP. Company is the correct term. Branch and Warehouse sub-scopes would still need separate columns. |
| Polymorphic `scopeable` relationship | Adds JOIN complexity; prevents foreign-key enforcement at the DB level. |
| Storing company_id in session / middleware only | Not persisted in the DB means audit trails and background jobs lose scope context. |
| Adding scope columns to all models immediately | Premature migration churn. Phase-gated by feature need. |
