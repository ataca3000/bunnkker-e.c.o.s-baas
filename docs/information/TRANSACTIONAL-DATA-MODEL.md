# Transactional Data Model

**Document:** TRANSACTIONAL-DATA-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-INFORMATION-ARCH-001  
**Parent:** ENTERPRISE-INFORMATION-ARCHITECTURE.md

---

## 1. What Is Transactional Data?

Transactional data records what happened in the business — when, by whom, and with what result. It is the evidence of business activity.

**Characteristics:**
- Created by business actions (commands, user interactions, external events)
- **Immutable once committed** — cannot be edited or deleted in normal operations
- Grows continuously — the database only grows, never shrinks (until archival)
- Must be consistent with master data at the time of creation
- Subject to financial audit requirements — retained for 7+ years

---

## 2. Immutability Rules

| Rule | Statement |
|---|---|
| **TXN-001** | Transactional records are immutable once their status becomes terminal (e.g. order delivered, invoice paid) |
| **TXN-002** | Corrections are new transactions — a credit note corrects an invoice; a new order replaces a cancelled one |
| **TXN-003** | No UPDATE statement may change financial amounts on a committed transaction |
| **TXN-004** | Status changes are the only allowed mutation on transactional records |
| **TXN-005** | All status changes are audited (actor, timestamp, reason) |
| **TXN-006** | StockMovements are append-only; inventory adjustments create new movements, they never modify old ones |

---

## 3. Key Transactional Entities

### 3.1 Order (Commerce)
```
Mutability:   status field only; amounts are immutable after confirmation
Correction:   Cancelled order → new order; no order editing after confirmation
Audit:        Every status change logged in EPS-02 Timeline
Retention:    7 years (financial audit)
```

### 3.2 Invoice (Finance)
```
Mutability:   status field only; all amounts immutable once issued
Correction:   Credit note creates a new Invoice with negative lines; original never mutated
Audit:        EPS-02 Timeline + Finance AuditEvent
Retention:    7 years (Egyptian tax law minimum)
```

### 3.3 Payment (Finance)
```
Mutability:   None — payments are immutable records of receipt
Correction:   Refund creates a new Payment with negative amount
Audit:        Full actor + timestamp + method recorded
Retention:    7 years
```

### 3.4 StockMovement (Inventory)
```
Mutability:   None — a StockMovement is a fact that happened
Correction:   If a movement was recorded in error, a compensating StockMovement is created
Fields:       entity_type, entity_id, movement_type, quantity, direction (+/-), unit_cost, warehouse_id, actor, occurred_at, source_type, source_id
Retention:    7 years (FIFO cost audit)
```

### 3.5 ReceiptLayer (Inventory)
```
Mutability:   remaining_qty decrements as stock is consumed (FIFO)
              All other fields are immutable once created
Audit:        remaining_qty changes are StockMovements; no direct edit without StockMovement
Retention:    7 years
```

### 3.6 PurchaseOrder (Procurement)
```
Mutability:   status field; additional lines before confirmation only
              Amounts immutable after confirmation
Correction:   Cancelled PO → new PO; received quantities on GR are immutable
Retention:    7 years
```

### 3.7 GoodsReceipt (Procurement)
```
Mutability:   None — GR quantities are immutable once posted
Correction:   Return (SupplierReturn) is a compensating transaction
Retention:    7 years
```

### 3.8 POSSale (Finance)
```
Mutability:   None — a completed POS sale is a fact
Correction:   Refund creates a new POSSale with negative quantities
Retention:    7 years
```

### 3.9 PreparationWave (Fulfillment)
```
Mutability:   status field; prepared quantities on completion
              Orders cannot be added after wave starts
Retention:    2 years (operational record; no financial impact)
```

### 3.10 BusinessEvent (EPS-01)
```
Mutability:   None — events are immutable, append-only
              Events are never deleted
Retention:    Per event type (financial events 7 years; operational events 2 years)
```

---

## 4. Correction Patterns

| Scenario | Correct Approach | Incorrect Approach |
|---|---|---|
| Invoice has wrong amount | Issue credit note (new Invoice) | Edit invoice amounts |
| Stock movement was wrong | Create compensating movement | Delete/edit movement |
| PO has wrong supplier | Cancel + new PO | Change supplier on existing PO |
| GR over-received | Create supplier return | Edit GR quantities |
| POS sale refunded | Create refund sale | Delete POS sale |
| Order delivered to wrong customer | Record failed delivery + correction order | Edit order customer |

---

## 5. Transactional Data Volume Estimates

| Entity | Growth Rate | Notes |
|---|---|---|
| Order | Per business activity | ~thousands per day in high-volume scenario |
| Invoice | 1:1 with Orders | Same as Order volume |
| StockMovement | Multiple per order | Reservation + consumption + adjustment per item |
| BusinessEvent | Multiple per transaction | 3-5 events per order lifecycle |
| TimelineEntry | 1:1 with events | Mirrors event volume |
| ReceiptLayer | Per GR line | Grows with procurement activity |

This informs partitioning strategy in DATA-PARTITIONING-STRATEGY.md.

---

## 6. Transaction Boundary Rules

| Rule | Statement |
|---|---|
| **TXN-BOUND-001** | A transaction (database TX) must complete atomically — either all operations succeed or none |
| **TXN-BOUND-002** | Business events are published AFTER the database transaction commits (outbox pattern) |
| **TXN-BOUND-003** | No transaction spans multiple aggregate boundaries |
| **TXN-BOUND-004** | Compensation logic (rollback of a business operation) is a new forward transaction, never a database rollback of past data |
