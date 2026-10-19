# ADR-026 — Transfer Domain Events: Phase B Deferral

**Status:** Accepted  
**Date:** 2026-07-20  
**Deciders:** Principal Enterprise Architect, Inventory Domain Owner  
**Audit ref:** TASK-OPS-INTEGRATION-CERTIFICATION-001 — Finding C-003

---

## Context

`TransferStockAction` publishes two domain events after every warehouse transfer completes:

- `InventoryTransferred` — fires per product transferred
- `WarehouseTransferCompleted` — fires per transfer record created

During the Operations Integration Certification (2026-07-20) it was confirmed that no
listener is registered for either event in any service provider. The events fire through
`DomainEventBus::publish()` → `LaravelDomainEventBus::publish()` → Laravel `event()` with
no registered handler, which means they are silently dropped.

## Decision

Defer consumer registration to **Phase B** of the Inventory Event Platform rollout.

**Rationale:**

1. Transfer data integrity is fully enforced at the database level — the `WarehouseTransfer`
   audit record, dual ledger entries (TransferOut + TransferIn), and FIFO layer migration all
   commit atomically. The absence of downstream event consumers does not cause data corruption.

2. The intended consumer — `InventoryChannelSynchronizationListener` (currently in Phase A
   shadow mode) — must be upgraded to queue-dispatch (Phase B) before it can safely handle the
   additional transfer event volume without blocking the request thread under peak load.

3. Adding a synchronous listener in Phase A would couple warehouse transfer latency to channel
   synchronization latency, violating the performance contract of `TransferStockAction`.

## Phase B Work Items

When Phase B is activated (queue-dispatch enabled for `InventoryChannelSynchronizationListener`),
add the following registrations to `DomainEventServiceProvider::boot()`:

```php
$events->listen(InventoryTransferred::class,       InventoryChannelSynchronizationListener::class);
$events->listen(WarehouseTransferCompleted::class, InventoryChannelSynchronizationListener::class);
```

At that point both events will be dispatched to `InventorySyncJob` via the queue, and the
channel synchronization will reflect warehouse transfers in external commerce channels.

## Consequences

- **Transfer events are intentional orphans in Phase A.** This is an approved architectural
  state, not a defect. The events are published so that the publisher is correct and complete;
  the missing consumer is a Phase B gap, not a Phase A bug.
- `DomainEventServiceProvider` must carry a code comment pointing to this ADR so that the
  orphan state is discoverable without a full audit.
- This ADR supersedes the C-003 finding from TASK-OPS-INTEGRATION-CERTIFICATION-001.
  Full certification is not blocked by this decision.
