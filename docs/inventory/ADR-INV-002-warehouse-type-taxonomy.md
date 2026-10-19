# ADR-INV-002 — Warehouse Type Taxonomy

**Status:** Accepted  
**Date:** 2026-07-06  
**Context:** TASK-ARCH-001 — Inventory Core Architecture Review  
**Risk Resolved:** RISK-INV-005

---

## Context

The current `warehouses` table has no `warehouse_type` column. All warehouses are implicitly of the same type. This assumption breaks when the Loading OS (ADR-015) is implemented:

- Loading OS loads prepared products onto delivery vehicles. Stock physically moves from a storage warehouse onto a vehicle. The vehicle is a mobile stock location — it must appear as a warehouse to the inventory engine, but with different behavior and access rules.
- Returns and damage workflows need a virtual/staging area separate from sellable stock.
- In-transit stock (goods moving between two physical warehouses) has no location representation.

Without a type discriminator, these locations cannot be created without polluting standard warehouse lists, or cannot be created at all.

---

## Decision

Add a `warehouse_type` column to `warehouses` with the following taxonomy:

| Type | Value | Description |
|------|-------|-------------|
| **Standard** | `standard` | Normal physical storage (default for all existing warehouses) |
| **Transit** | `transit` | Intermediate in-transit location between two Standard warehouses |
| **Vehicle** | `vehicle` | Stock location representing a delivery vehicle; managed by Loading OS |
| **Virtual** | `virtual` | Staging area: returns, quarantine, damage hold, production staging |

**All existing warehouses default to `standard`.** The migration is non-breaking.

**Policy Enforcement (application layer):**
- Only `Loading OS` actions may transfer stock `into` a `vehicle` warehouse.
- Only `Returns / Inventory Count` actions may transfer stock `into` a `virtual` warehouse.
- `vehicle` and `virtual` warehouses are excluded from standard picking and receiving UIs.
- `standard` and `transit` warehouses are shown in warehouse selection dropdowns for procurement, manufacturing, and operations.

**Policy Enforcement (database layer):**
None required — policy is enforced in application-layer Actions. The database column is a label, not a constraint.

---

## Consequences

**Benefits:**
- Loading OS can create a vehicle warehouse per vehicle/driver with a single migration.
- Returns and damage workflows get a first-class staging location.
- Reporting can filter by warehouse type (e.g. "show me all vehicle stock in transit today").
- No breaking changes to existing warehouse code — `standard` is the default.

**Costs:**
- UI dropdowns must filter by `warehouse_type` in each context. This is a straightforward filter addition.

---

## Migration

```php
Schema::table('warehouses', function (Blueprint $table) {
    $table->string('warehouse_type', 30)->default('standard')->after('is_active');
    $table->index('warehouse_type');
});
```

All existing warehouses automatically become `standard`. No data migration needed.
