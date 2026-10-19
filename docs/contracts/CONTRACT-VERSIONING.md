# Contract Versioning

**Document:** CONTRACT-VERSIONING  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONTRACT-ARCH-001  
**Parent:** ENTERPRISE-CONTRACTS.md

---

## 1. Versioning Principles

| Principle | Rule |
|---|---|
| **Every contract is versioned** | All Commands, Queries, Events, and Service Contracts declare a version |
| **Semantic versioning** | Major.Minor — Major = breaking, Minor = additive |
| **Published contracts never mutate** | v1 of a contract is frozen once published |
| **Backward compatibility by default** | New versions add fields; they never remove them |
| **Consumer declares version** | Every subscriber/consumer explicitly declares which version it consumes |
| **No silent upgrades** | Consumers must opt-in to a new contract version |

---

## 2. Contract Versioning Table

### What Counts as a Breaking Change?

| Change | Breaking? | Action |
|---|---|---|
| Add optional field to payload | No | Add to existing version; document in changelog |
| Add optional filter to Query | No | Existing consumers unaffected |
| Remove any field | **Yes** | New major version required |
| Rename a field | **Yes** | New major version required |
| Change field type | **Yes** | New major version required |
| Change enum values (remove/rename) | **Yes** | New major version required |
| Add required field | **Yes** | New major version required |
| Change event name / command name | **Yes** | New major version required; old name aliased |
| Change aggregate ownership | **Yes** | Requires ADR + CTO approval |

---

## 3. Version Lifecycle

```
Draft → Published → Deprecated → Sunset

Draft:
  - Contract is being designed; not yet consumed by any module
  - Can be changed freely

Published:
  - Contract is stable; consumed by at least one module
  - ONLY additive (non-breaking) changes allowed
  - All changes logged in contract changelog

Deprecated:
  - A newer version exists; this version still works
  - Consumers are notified of the newer version
  - Deprecation window: minimum 1 full release cycle (or 90 days, whichever is longer)
  - No new consumers may adopt a deprecated version

Sunset:
  - The old version is removed from the system
  - All consumers must have migrated before sunset date
  - Sunset date published 30 days before removal
```

---

## 4. Dual-Publish Policy

When a breaking change is required:

1. **Publish v2** — New contract version is defined and registered
2. **Dual-publish period** — Producer publishes BOTH v1 and v2 simultaneously
3. **Consumer migration window** — All consumers migrate from v1 to v2 during this window
4. **Verify no v1 consumers remain** — Integration Catalog is checked
5. **Deprecate v1** — v1 enters Deprecated state; no new consumers
6. **Sunset v1** — After the window closes, v1 is removed

**Minimum dual-publish window:** 1 release cycle (90 days for production systems).

---

## 5. Compatibility Matrix

This matrix tracks all active contract versions and their consumer compatibility status.

### Command Contracts

| Command | v1 Status | v2 Status | Notes |
|---|---|---|---|
| ConfirmOrder | Published | — | Stable |
| ReserveInventory | Published | — | Stable |
| StartPreparation | Published | — | Stable |
| CompletePreparation | Published | — | Stable |
| CreateShippingWave | Published | — | Stable |
| AssignVehicle | Published | — | Stable |
| AllocateProducts | Published | — | Stable |
| DispatchShipment | Published | — | Stable |
| ConfirmDelivery | Published | — | Stable |
| CreateInvoice | Published | — | Stable |
| RecordPayment | Published | — | Stable |
| GenerateRecommendation | Published | — | Stable |

### Event Contracts

| Event | v1 Status | Notes |
|---|---|---|
| orders.order.confirmed | Published | — |
| orders.order.cancelled | Published | — |
| orders.order.delivered | Published | — |
| inventory.raw_material.stock_added | Published | — |
| inventory.raw_material.stock_reserved | Published | — |
| fulfillment.preparation_wave.completed | Published | — |
| fulfillment.shipment.dispatched | Published | — |
| finance.invoice.issued | Published | — |
| platform.ai.recommendation_generated | Published | — |

### Service Contracts

| Service | v1 Status | Notes |
|---|---|---|
| EventPublisherService | Published | Core infrastructure |
| TimelineService | Published | Core infrastructure |
| DocumentService | Published | Core infrastructure |
| NotificationService | Published | Core infrastructure |
| ConfigurationService | Published | Core infrastructure |
| PolicyService | Published | Core infrastructure |
| AIService | Published | Evolving |

---

## 6. Versioning Identifiers

### Event Versioning

Events use the `event_version` field in the envelope:

```json
{
  "event_id": "uuid",
  "event_type": "orders.order.confirmed",
  "event_version": "v1",
  ...
  "payload": { ... }
}
```

When v2 is introduced, events publish:
```json
{ "event_type": "orders.order.confirmed", "event_version": "v2", "payload": { ... v2 fields ... } }
{ "event_type": "orders.order.confirmed", "event_version": "v1", "payload": { ... v1 fields ... } }
```
(both published simultaneously during dual-publish window)

### Command Versioning

Commands are dispatched with an explicit version header:
```
X-Contract-Version: v1
```
The command handler inspects this header and routes to the correct handler version.

### Query Versioning

Queries include a version in the path or query parameter:
```
GET /api/v1/orders?...   (API-level versioning)
```
Internally: Query objects declare `version: 'v1'` in their contract class.

---

## 7. Consumer Registration

Every module that consumes a contract must register:

| Field | Description |
|---|---|
| `consumer_module` | Module name |
| `contract_type` | command / event / query / service |
| `contract_name` | e.g. `orders.order.confirmed` |
| `version` | Which version is consumed |
| `registered_at` | Date of registration |
| `migration_deadline` | If consuming a deprecated version |

This registry lives in INTEGRATION-CATALOG.md and is the authoritative source before sunset decisions.

---

## 8. Deprecation Notification Process

1. **Announce** — CTO or architecture team announces deprecation via ADR update
2. **INTEGRATION-CATALOG.md** — Contract status updated to `Deprecated`
3. **All registered consumers** — Notified via changelog + team communication
4. **Grace period** — Minimum 90 days before sunset
5. **30-day final warning** — Architecture team reviews if any consumers remain
6. **Sunset** — Version removed; consuming the old version raises a runtime error

---

## 9. Contract Changelog Template

Every contract file maintains a changelog section:

```markdown
## Changelog

### v2 (YYYY-MM-DD)
**Breaking change:** Reason for breaking change
- Added: new_field (string, required)
- Removed: old_field (was optional)
- Migration: Replace old_field with new_field

### v1 (YYYY-MM-DD)
Initial publication.
```

---

## 10. Governance

| Rule | Requirement |
|---|---|
| **CON-GOV-007** | Breaking changes increment the major version; no exceptions |
| **CON-GOV-008** | Deprecated contracts remain available for one full release cycle minimum |
| **Architecture freeze** | Contract changes to any Published contract require CTO review if they affect cross-domain boundaries |
