# Soft Delete Architecture

**Document:** SOFT-DELETE-ARCHITECTURE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATA-ARCH-001  
**Parent:** ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md

---

## 1. Delete Strategies

ECOS uses three delete strategies depending on the entity:

| Strategy | Description | Implementation |
|---|---|---|
| **Soft Delete** | Record is marked as deleted but retained | `deleted_at` + `deleted_by` columns; filtered out in queries |
| **Status-Based** | Record transitions to terminal status (no deletion at all) | `status = cancelled/discontinued/inactive`; no delete columns |
| **Append-Only** | Record can never be deleted | No delete columns; retained permanently until archived |

---

## 2. Strategy Assignment by Entity

### Status-Based (No Deletion — Use Status Lifecycle)
These entities use status transitions to indicate they are no longer active. They are NEVER deleted.

| Entity | Terminal Statuses | Notes |
|---|---|---|
| Order | cancelled, delivered | Financial record; 7-year retention |
| Invoice | voided, cancelled | Financial record; never deleted |
| Payment | refunded | Financial record |
| PurchaseOrder | cancelled | |
| GoodsReceipt | rejected | |
| POSSession | closed, reconciled | |
| PreparationWave | cancelled, completed | |
| ShippingWave | returned | |
| Shipment | delivered, failed | |

### Soft Delete (deleted_at / deleted_by)
These entities can be removed from operational use but are retained for referential integrity and history.

| Entity | When Soft-Deleted | deleted_at Active? |
|---|---|---|
| Product | Discontinued; replaced | Yes — queries exclude unless explicitly requested |
| RawMaterial | Discontinued | Yes |
| Category | Merged or removed | Yes — only allowed if no active entity references it |
| Supplier | Deactivated | Yes |
| Customer | GDPR: anonymized first, then soft-deleted | Yes |
| Employee | Terminated | Yes |
| Vehicle | Decommissioned | Yes |
| Channel | Deactivated | Yes |
| Warehouse | Closed | Yes |
| Branch | Closed | Yes |
| Recipe | Archived version | Yes |

### Append-Only (No Deletion, No Soft Delete)
These records must never be deleted. They are the permanent historical record.

| Entity | Reason |
|---|---|
| business_events | Immutable event record |
| stock_movements | FIFO integrity; financial audit |
| receipt_layers | FIFO cost audit |
| timeline_entries | Immutable history (comments can be soft-deleted only) |
| audit_log | Compliance requirement |
| notification_deliveries | Delivery proof |

---

## 3. Soft Delete Implementation

### Standard Soft Delete Pattern
```
Table columns:
  deleted_at  TIMESTAMP NULL  — NULL means active
  deleted_by  UUID NULL       — Who deleted (NULL means active)

Application-level filter:
  All queries automatically add: WHERE deleted_at IS NULL
  (implemented via Laravel SoftDeletes trait or equivalent)

To "see deleted" records:
  Explicit .withTrashed() in code; only for admin/audit queries
```

### Soft Delete Constraints
Before soft-deleting, the application must check:

```
1. No active references from other entities
   Example: Cannot soft-delete a Product if any Order in non-terminal status references it

2. No open financial obligations
   Example: Cannot soft-delete a Supplier if any open PO or unpaid invoice references it

3. Status pre-conditions met
   Example: Cannot soft-delete a Warehouse if it has active stock or open orders
```

If constraints fail: return a `CannotDeleteEntityException` with the reason.

---

## 4. Hard Delete Policy

**Hard delete is forbidden for all business entities in ECOS.**

Hard delete is only permitted for:
- Test data created in test environments (not production)
- Technical artifacts (job records, queue items after processing)
- Anonymized PII that has passed its retention period (executed by the data purge job)

---

## 5. Cascade Behavior on Soft Delete

Soft-deleting a parent does NOT automatically soft-delete children. The application must handle cascades explicitly.

| Parent Soft Deleted | Children Behavior |
|---|---|
| Category | Children categories soft-deleted (orphan prevention) |
| Warehouse (closed) | Products/materials still reference it; historical records valid |
| Company (suspended) | No cascade; company data intact; access blocked at auth layer |

---

## 6. Query Patterns

### Standard (active records only)
```
Active records: WHERE deleted_at IS NULL
(default for all application queries)
```

### Admin / Audit (include soft-deleted)
```
All records including deleted: remove the deleted_at IS NULL filter
(used for audit reports and admin data management)
```

### Restore (undo soft delete)
```
Set deleted_at = NULL, deleted_by = NULL
Record restore action in audit_log
```
