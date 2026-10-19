# ADR-021: Enterprise Snapshot Platform

**Status:** Accepted  
**Date:** 2026-07-06  
**Task:** TASK-ARCH-001 — Enterprise Snapshot Platform Extraction  
**Authors:** Engineering Leadership, CTO Office  
**Supersedes:** N/A — extends ADR-020 (Immutable Financial Snapshot)

---

## Context

ADR-020 introduced immutable financial and business context snapshots inside `Modules/Commerce/Orders`. TASK-ORDER-006C completed the 3-layer immutable model (WHY + WHAT + HOW). However, as ECOS grows to cover POS, Supplier Invoices, Manufacturing Orders, and Procurement, every new module would need to re-implement the same snapshot infrastructure from scratch.

This ADR extracts the snapshot pattern into a shared platform at `Modules/Common/Snapshots` — a reusable infrastructure capability, not a feature of any individual module.

---

## Decision

Establish `Modules/Common/Snapshots` as the **Enterprise Snapshot Platform**, providing:

1. **Contracts** — interfaces each consuming module must implement
2. **Builders** — pure assemblers that produce DTOs from contract implementations
3. **Engine** — SHA-256 integrity computation and verification
4. **Registry** — known aggregate types
5. **Timeline** — standardized lifecycle event entries
6. **Platform Events** — SnapshotCreated, SnapshotLocked, SnapshotIntegrityVerified, SnapshotVerificationFailed
7. **SnapshotManager** — the single orchestration point

### Architecture

```
Modules/Common/Snapshots/
├── Domain/
│   ├── Contracts/
│   │   ├── Snapshotable.php               ← base identity contract
│   │   ├── BusinessContextProvider.php    ← 40+ context getters
│   │   ├── FinancialSnapshotProvider.php  ← financial data + line items
│   │   ├── IntegrityProvider.php          ← buildIntegrityCanonical()
│   │   └── SnapshotPersistenceAdapter.php ← module-specific DB writes
│   ├── DTOs/
│   │   ├── BusinessContextDTO.php
│   │   ├── FinancialSnapshotDTO.php
│   │   └── FinancialLineSnapshotDTO.php
│   ├── Engine/
│   │   └── IntegrityEngine.php            ← sha256 compute + verify
│   ├── Events/
│   │   ├── SnapshotCreated.php
│   │   ├── SnapshotLocked.php
│   │   ├── SnapshotIntegrityVerified.php
│   │   └── SnapshotVerificationFailed.php
│   ├── Exceptions/
│   │   └── SnapshotConsistencyException.php  ← base (non-final)
│   ├── Registry/
│   │   └── SnapshotRegistry.php           ← known aggregate types
│   └── Timeline/
│       └── SnapshotTimelineBuilder.php    ← standardized lifecycle entries
├── Application/
│   ├── Builders/
│   │   ├── BusinessContextSnapshotBuilder.php
│   │   └── FinancialSnapshotBuilder.php
│   ├── Services/
│   │   └── SnapshotManager.php            ← primary entry point
│   └── Validators/
│       └── SnapshotValidator.php
└── Providers/
    └── SnapshotServiceProvider.php
```

### SnapshotManager Creation Sequence

```
Module calls SnapshotManager::createFor(contextProvider, financialProvider, persistence, actorId)
    │
    ├─ 1. SnapshotValidator validates financial provider (throws PlatformConsistencyException)
    ├─ 2. BusinessContextSnapshotBuilder.build(contextProvider) → BusinessContextDTO
    ├─ 3. FinancialSnapshotBuilder.build(financialProvider) → FinancialSnapshotDTO
    │        ├─ Aggregates cost totals from FinancialLineSnapshotDTO[]
    │        ├─ Computes gross profit, margin diagnostics, margin status
    │        ├─ Derives recipe version
    │        ├─ Generates snapshotUuid (Str::uuid)
    │        └─ Computes integrity hash via IntegrityEngine::compute()
    │
    ├─ 4. DB::transaction {
    │        ├─ persistence.persistBusinessContext(dto, actorId)  [WHY]
    │        ├─ persistence.logSnapshotEvent(business_context_captured, ...)
    │        ├─ persistence.persistFinancialSnapshot(dto, actorId)  [WHAT]
    │        └─ persistence.logSnapshotEvent(financial_snapshot_created, ...)
    │   }
    │
    └─ 5. Event::dispatch (OUTSIDE transaction):
             ├─ SnapshotCreated(type='business_context')
             ├─ SnapshotCreated(type='financial')
             └─ SnapshotLocked(grandTotal, grossProfit, marginStatus, integrityHash)
```

### Orders Module as Consumer (TASK-ARCH-001 PART 11)

Orders provides three adapter implementations:

| Adapter | Implements | Responsibility |
|---|---|---|
| `OrderBusinessContextAdapter` | `BusinessContextProvider` | Resolves policy versions, price/cost provenance, delivery rate from Order domain |
| `OrderFinancialSnapshotAdapter` | `FinancialSnapshotProvider` + `IntegrityProvider` | Maps Order fields to financial contract; builds canonical integrity string |
| `OrderSnapshotPersistenceAdapter` | `SnapshotPersistenceAdapter` | Writes to Order-specific Eloquent models; fires backward-compat domain events |

`CreateOrderSnapshotService` remains in Orders as a thin wrapper:
1. Calls `buildLineData()` (Order-specific BOM + cost engine + pricing — stays Order-domain)
2. Creates the three adapters
3. Delegates to `SnapshotManager::createFor()`
4. Catches platform `SnapshotConsistencyException` → rethrows as Orders subclass

### Exception Hierarchy

```
RuntimeException
└── Modules\Common\Snapshots\Domain\Exceptions\SnapshotConsistencyException  [non-final, platform base]
    └── Modules\Commerce\Orders\Domain\Exceptions\SnapshotConsistencyException  [Orders subclass]
```

This allows existing tests catching the Orders exception to continue to work unmodified, while the platform validator throws the platform exception.

### SnapshotRegistry — Supported Aggregate Types

| Key | Description |
|---|---|
| `order` | Commerce Order |
| `pos_sale` | POS Sale |
| `invoice` | Customer Invoice |
| `purchase_order` | Procurement Purchase Order |
| `goods_receipt` | Inventory Goods Receipt |
| `supplier_invoice` | Supplier Invoice |
| `manufacturing_order` | Manufacturing Order |
| `supplier_return` | Supplier Return |

New aggregate types are registered via `SnapshotRegistry::register()`.

---

## Platform Events

| Event | Subscribers | Payload |
|---|---|---|
| `SnapshotCreated` | AI Platform, BI pipelines, Analytics | snapshotUuid, snapshotType, aggregateType, aggregateId, companyId, brandId, channelId, timestamp |
| `SnapshotLocked` | Accounting OS, Audit | snapshotUuid, aggregateType, grandTotal, grossProfit, marginStatus, integrityHash, lockedAt |
| `SnapshotIntegrityVerified` | Compliance, Audit trail | snapshotUuid, aggregateType, aggregateId, verifiedAt, verifiedBy |
| `SnapshotVerificationFailed` | Security, Compliance | snapshotUuid, aggregateType, aggregateId, detectedAt, detectedBy |

**AI Platform** subscribes to `SnapshotCreated` and `SnapshotLocked` — a single ingestion point for all aggregate types across all modules. This replaces per-module subscriptions.

---

## BI Reporting Contract

BI pipelines that previously queried `order_financial_snapshots` directly continue to work unchanged. No DB schema was modified by this extraction.

For future modules, the BI team subscribes to platform `SnapshotCreated` events and routes based on `aggregateType`.

---

## Backward Compatibility

- **`GET /orders/{id}/snapshot` API response:** Unchanged. The resource still returns `business_context` nested inside the financial snapshot response.
- **Order-specific domain events** (`OrderFinancialSnapshotCreated`, `OrderFinancialSnapshotLocked`, `OrderBusinessContextCaptured`): Still fired by `OrderSnapshotPersistenceAdapter`. Existing listeners are not affected.
- **Orders `SnapshotConsistencyException`:** Remains catchable by existing test code. Subclasses platform base exception.
- **`CreateOrderSnapshotService::verifyIntegrityHash()`:** Signature and behavior unchanged. Now delegates hash comparison to `IntegrityEngine::verify()`.

---

## Consequences

**Positive:**
- Any future module (POS, Invoicing, Procurement) can create immutable snapshots by implementing 3 interfaces — no snapshot infrastructure to re-implement.
- BI and AI pipelines have a single event subscription point across all aggregate types.
- Platform tests can validate snapshot correctness without touching Order Eloquent models.

**Negative:**
- New module complexity: 3 adapter implementations required per consumer module.
- `CreateOrderSnapshotService` now depends on the platform layer — `Modules/Common` must boot before `Modules/Commerce/Orders`.

---

## Related

- [ADR-020](ADR-020-immutable-financial-snapshot.md) — Immutable Financial + Business Context Snapshot (TASK-ORDER-006C)
- [ADR-011](ADR-011-event-driven-architecture.md) — Everything is an Event
