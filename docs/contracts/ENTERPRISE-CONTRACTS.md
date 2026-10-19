# Enterprise Contracts

**Document:** ENTERPRISE-CONTRACTS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONTRACT-ARCH-001  
**Predecessor:** TASK-DOMAIN-ARCH-001 (Domain Model)

---

## 1. Mission

> Every module in ECOS communicates through **explicit, versioned Contracts**. No module ever reaches directly into another module's internals. The Contract Layer is the only surface that modules expose to one another.

```
Business OS
     ↓
Enterprise Contracts  ←── This layer
     ↓
Platform Services (EPS)
     ↓
Decision Engines
     ↓
Infrastructure
```

---

## 2. Contract Types

| Type | Purpose | Direction |
|---|---|---|
| **Command Contract** | Instruct an aggregate to change state | Caller → Aggregate |
| **Query Contract** | Request a read model without side effects | Consumer → Read Model |
| **Event Contract** | Announce that something happened | Aggregate → Subscribers |
| **Service Contract** | Define a shared enterprise service interface | Consumer ↔ Service |

---

## 3. Contract Principles

| Principle | Rule |
|---|---|
| **Contract First** | Contract is defined before implementation |
| **Event First** | State changes are announced via events, not callbacks |
| **Version First** | Every contract declares a version; breaking changes require a new version |
| **Backward Compatible** | Adding optional fields is allowed; removing fields requires versioning |
| **Strong Typing** | All fields have explicit types; no `mixed` or `any` |
| **Immutable Contracts** | Published contracts are never modified in place |
| **No Shared Internal Models** | No module imports another module's internal entity classes |
| **Explicit Ownership** | Every contract declares its owner (producer) |
| **No Hidden Dependencies** | All dependencies are declared in the contract header |

---

## 4. Contract Ownership Model

| Contract Category | Owner | Examples |
|---|---|---|
| Order commands | Commerce | ConfirmOrder, CancelOrder |
| Inventory commands | Inventory | ReserveInventory, ReleaseReservation |
| Fulfillment commands | Fulfillment | StartPreparation, DispatchShipment |
| Finance commands | Finance | CreateInvoice, ReceivePayment |
| Platform service contracts | EPS (Platform) | AttachDocument, AddTimelineEntry |
| Domain events | Producing aggregate's domain | OrderConfirmed, StockAdded |
| Query contracts | Consuming module + data owner | InventoryAvailabilityQuery |

---

## 5. Contract Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRODUCING MODULE  (e.g. Commerce)                                  │
│   ├── Command Handler: ConfirmOrderCommand → Order aggregate        │
│   └── Event Publisher: OrderConfirmed → EPS-01 Event Bus           │
├─────────────────────────────────────────────────────────────────────┤
│  CONTRACT LAYER  (this layer)                                       │
│   ├── Command Contracts  (COMMAND-CONTRACTS.md)                    │
│   ├── Event Contracts    (EVENT-CONTRACTS.md)                      │
│   ├── Query Contracts    (QUERY-CONTRACTS.md)                      │
│   └── Service Contracts  (SERVICE-CONTRACTS.md)                    │
├─────────────────────────────────────────────────────────────────────┤
│  CONSUMING MODULE  (e.g. Fulfillment listening for OrderConfirmed)  │
│   └── Event Subscriber: OrderConfirmed → assign to PreparationWave │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Document Index

| Document | Purpose |
|---|---|
| `COMMAND-CONTRACTS.md` | All state-changing operations across all domains |
| `QUERY-CONTRACTS.md` | All read models and projections |
| `EVENT-CONTRACTS.md` | All domain event schemas with producer/consumer mapping |
| `SERVICE-CONTRACTS.md` | Shared enterprise service interfaces (EPS, AI, Config) |
| `CONTRACT-VERSIONING.md` | Versioning, deprecation, compatibility matrix |
| `INTEGRATION-CATALOG.md` | All internal and external integration points |
| `BOUNDARY-CONTEXT-MAP.md` | Bounded contexts, upstream/downstream relationships |
| `ANTI-CORRUPTION-LAYER.md` | ACL patterns for all external system integrations |
| `EXTERNAL-INTEGRATIONS.md` | Authentication, sync, retry, webhook, audit per external system |

---

## 7. Governance Rules

| Rule | Statement |
|---|---|
| **CON-GOV-001** | No module may directly consume another module's internal models |
| **CON-GOV-002** | Every integration uses published Contracts only |
| **CON-GOV-003** | Every external system uses an Anti-Corruption Layer |
| **CON-GOV-004** | Every Business Event has a Contract in EVENT-CONTRACTS.md |
| **CON-GOV-005** | Every Command references exactly one Aggregate |
| **CON-GOV-006** | Every Query has a single declared source of truth |
| **CON-GOV-007** | Breaking contract changes increment the major version |
| **CON-GOV-008** | Deprecated contracts must remain available for one full release cycle |
| **CON-GOV-009** | External system models must never appear in domain entity definitions |
| **CON-GOV-010** | Every contract must be registered in INTEGRATION-CATALOG.md |

---

## 8. Related Documents

- `docs/domain/ENTERPRISE-DOMAIN-MODEL.md` — Aggregates and entities all contracts reference
- `docs/domain/DOMAIN-EVENT-CATALOG.md` — Canonical event list (contracts formalize their schemas)
- `docs/architecture/ENTERPRISE-PLATFORM-SERVICES.md` — EPS service contracts
- `docs/architecture/ENTERPRISE-CONFIGURATION-PLATFORM.md` — Config/Policy service contracts
- `docs/architecture/ADR-015-enterprise-fulfillment-architecture.md` — Fulfillment flow contracts
