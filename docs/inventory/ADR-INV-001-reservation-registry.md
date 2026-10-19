# ADR-INV-001 — Per-Order Reservation Registry

**Status:** Accepted  
**Date:** 2026-07-06  
**Context:** TASK-ARCH-001 — Inventory Core Architecture Review  
**Risk Resolved:** RISK-INV-003

---

## Context

The current reservation engine uses a single `reserved_qty` counter on `InventoryItem`. All callers — Commerce, POS, Manufacturing, Preparation OS, Logistics — share this counter. There is no record of which entity holds which reservation for how much quantity.

This design is insufficient for a multi-module ERP because:

1. **Selective release is impossible.** When a POS order is cancelled, you must release exactly that order's reservation quantity. If the counter drifts (bug, race condition, or logic error), there is no way to detect or correct it.
2. **Expiration is impossible.** A reservation held past its window (e.g. a pending order that was abandoned) permanently locks stock with no reclaim mechanism.
3. **Auditability is impossible.** "How much stock is held by active Commerce orders?" cannot be answered without joining to order tables and recalculating — there is no authoritative reservation record.
4. **Preparation OS already worked around this gap** by implementing its own `PreparationInventoryReservation` table, confirming the need is real.

---

## Decision

Add an `inventory_reservations` table as a **per-order reservation registry** alongside the existing `reserved_qty` counter.

**Dual-Path Strategy:**
- `reserved_qty` on `InventoryItem` is **retained** as the fast O(1) availability check path. It must equal the sum of all `active` rows in `inventory_reservations` at all times (enforced by Actions).
- `inventory_reservations` provides per-reservation auditability, selective release, and expiration.

**Key Fields:**
- `reserver_type` (string) — discriminator: `'sales_order'`, `'pos_order'`, `'prep_wave'`, `'manufacturing_order'`, `'loading_allocation'`
- `reserver_id` (UUID) — the entity that owns this reservation
- `quantity` (decimal 15,4)
- `status` — `active | released | consumed | expired`
- `expires_at` — nullable; set by caller for time-bounded reservations

**Action Updates (same DB transaction):**
- `ReserveStockAction` — insert into `inventory_reservations` AND increment `reserved_qty`
- `ReleaseStockAction` — accept `reserver_type` + `reserver_id` to update specific row to `released` AND decrement `reserved_qty`
- `ShipStockAction` — mark reservation `consumed` AND decrement both `on_hand_qty` and `reserved_qty`

**Expiration:**
- A scheduled command runs every 15 minutes.
- Finds `inventory_reservations` rows where `status = 'active'` and `expires_at < now()`.
- Calls `ReleaseStockAction` for each expired reservation.
- Publishes `ReservationExpired` event.

---

## Backward Compatibility

`reserver_type` and `reserver_id` are nullable in the initial schema. Existing callers that do not pass these fields continue to function — the counter is updated as before, and no registry row is created. This allows gradual migration: update callers module-by-module to pass reservation context.

---

## Consequences

**Benefits:**
- Full auditability of who holds what stock and why.
- Selective release: cancel one order without touching others.
- Automatic expiration: no permanent reservation leaks.
- Foundation for reservation reports in the Operations Center.

**Costs:**
- Additional row per reservation increases write volume marginally.
- Reservation counter and registry can drift if an Action updates one without the other (mitigated by always doing both in the same transaction).

---

## Migration Strategy

See `TASK-ARCH-001-refactoring-plan.md`, REF-003.  
No existing data migration needed — the registry starts empty and is populated by new reservations.
