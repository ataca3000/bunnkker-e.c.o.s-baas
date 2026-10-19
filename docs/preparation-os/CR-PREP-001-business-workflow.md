# CR-PREP-001 — Business Workflow

## Core Concept Change

**Before CR-PREP-001 (manual):**
1. Supervisor opens Operations → Preparation
2. Clicks "New Wave"
3. Manually selects orders
4. Creates wave
5. Starts preparation

**After CR-PREP-001 (automatic):**
1. At 06:00 every day, ECOS auto-creates one Preparation Session per warehouse
2. All eligible orders are automatically attached
3. Supervisor opens Operations → Today's Preparation
4. Clicks "Start Preparation" on the relevant warehouse
5. No manual selection, no wave creation

---

## Warehouse Assignment Flow

```
Order Created / Imported
        │
        ▼
WarehouseAssignmentEngine.assign()
        │
  ┌─────┴─────────────────────────────────┐
  │ Query warehouse_assignment_policies   │
  │ WHERE company_id = :company           │
  │   AND is_active = true                │
  │ ORDER BY priority ASC                 │
  └───────────────────────────────────────┘
        │
        ▼
  For each policy: matches() ?
  Score = specificity() → keep highest score
        │
  ┌─────┴──────────┐
  │ Match found?   │
  ├────YES─────────┼──► Update order.assigned_warehouse_id
  │                │    Set source = 'auto_policy'
  │                │    Dispatch WarehouseAssigned
  └────NO──────────┼──► Set source = 'unassigned'
                   │    (Appears in "Unassigned Orders" queue)
```

### Specificity Priority Rules

When two or more policies match the same order, the **most specific** wins. If specificity is equal, the **lower priority number** wins.

| Example | channel_id | governorate | Score |
|---------|-----------|-------------|-------|
| Cairo orders via Noon | noon-uuid | Cairo | 3 → wins |
| All Noon orders | noon-uuid | null | 2 |
| All Cairo orders | null | Cairo | 1 |
| Company fallback | null | null | 0 |

---

## Daily Session Lifecycle

```
[Scheduler 06:00]
      │
      ▼
CreateDailyPreparationSessionsCommand
      │
      ▼
DailyPreparationSessionManager.ensureSessionExists()
      │ (idempotent — safe to run multiple times)
      ▼
PreparationSession  status='draft'
      │
      │ auto_attach_orders=true?
      ▼
attachEligibleOrders()
  → Query orders WHERE assigned_warehouse_id = session.warehouse_id
                   AND status IN eligible_statuses
                   AND NOT already in an active session
      │
      ▼
PreparationSession  orders_count=N, products_count=M
      │
      │ Supervisor opens Operations → Today's Preparation
      ▼
"Start Preparation" → status='active'
      │
      │ During the day: new orders arrive
      ▼
Order assigned to warehouse → attachOrder() automatically called
  (via WarehouseAssigned event listener)
      │
      │ Order cancelled
      ▼
detachOrder() → detached_at set, reason recorded
      │
      │ Supervisor marks session complete
      ▼
status='completed'
      │
      │ (optional auto_close_time)
      ▼
status='closed'
```

---

## State Machine

```
draft ──────────► active ──────────► completed ──────► closed
  │                 │                                     ▲
  │                 │                                     │
  └──► cancelled    └──► paused ─────────────────────────┘
                              │
                              └──► active (resume)
```

**Valid transitions:**
| From | To | Actor |
|------|-----|-------|
| draft | active | Supervisor: "Start Preparation" |
| draft | cancelled | Supervisor: only if 0 orders prepared |
| active | paused | Supervisor: break / shift change |
| active | completed | Supervisor: all items prepared |
| active | cancelled | Supervisor: emergency only; creates audit log |
| paused | active | Supervisor: resume |
| completed | closed | System: auto-close or manual supervisor |

---

## New Order Arrives During Active Session

1. Order arrives (import, WooCommerce, manual) → status = `confirm_order`
2. `WarehouseAssignmentEngine.assign()` runs immediately
3. `WarehouseAssigned` event dispatched
4. Listener calls `DailyPreparationSessionManager.todaySession(warehouseId)`
5. If active session found → `attachOrder()` called automatically
6. Session `orders_count` incremented; `products_count` recalculated

The supervisor sees the new order appear in the session without any action needed.

---

## Unassigned Orders

Orders that cannot be matched to a warehouse appear in the **"Unassigned Orders"** queue accessible from Operations → Assignments. A supervisor:
1. Reviews the unassigned list
2. Manually overrides the warehouse
3. Override creates `WarehouseAssignmentOverride` audit record
4. Order auto-attaches to today's session for the selected warehouse

---

## Manual Override Audit Trail

Every manual override is permanent and immutable:
- `overridden_at`, `overridden_by`, `reason` always recorded
- Previous and new warehouse IDs both stored
- Visible in order history and assignment history endpoint
- Cannot be deleted (regulatory requirement for logistics operations)
