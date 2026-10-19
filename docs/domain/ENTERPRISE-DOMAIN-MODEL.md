# ECOS Enterprise Domain Model

**Document:** ENTERPRISE-DOMAIN-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DOMAIN-ARCH-001  
**Predecessor:** TASK-UX-ARCH-001 (UX Architecture)  
**Successor:** Enterprise Database Design

---

## 1. Mission

> Define the **canonical business model** for ECOS ERP — every entity, aggregate, value object, relationship, lifecycle, and invariant across all domains.

This document is the **single source of truth** for business modeling. Nothing that requires business understanding is defined elsewhere first.

**What this is NOT:**
- Not a database schema
- Not an API contract
- Not a UI model
- Not implementation code

---

## 2. Domain Map

ECOS is organized into **10 business domains**. Each domain is independent; cross-domain interaction happens through explicit references and business events only.

```
┌──────────────────────────────────────────────────────────────────────┐
│                     ECOS ENTERPRISE DOMAIN MAP                       │
├──────────────────┬───────────────────────────────────────────────────┤
│  ORGANIZATION    │  Company · Brand · Warehouse · Team               │
│                  │  Sales Channel · Marketing Account · Mkt Asset   │
│                  │  Integration Account (credentials)                │
├──────────────────┼───────────────────────────────────────────────────┤
│  MARKETING       │  MarketingAccount · MarketingAsset                │
│  (reserved)      │  (Future) Campaign · Attribution                  │
├──────────────────┼───────────────────────────────────────────────────┤
│  COMMERCE        │  Order · OrderLine · SalesChannel                 │
├──────────────────┼───────────────────────────────────────────────────┤
│  INVENTORY       │  Product · RawMaterial · InventoryItem            │
│                  │  Reservation · ReceiptLayer · StockMovement       │
├──────────────────┼───────────────────────────────────────────────────┤
│  MANUFACTURING   │  Recipe · RecipeLine · ProductionJob              │
├──────────────────┼───────────────────────────────────────────────────┤
│  PROCUREMENT     │  Supplier · PurchaseOrder · GoodsReceipt          │
│                  │  SupplierInvoice · MaterialRequest · Return        │
├──────────────────┼───────────────────────────────────────────────────┤
│  FULFILLMENT     │  PreparationWave · PreparedPool                   │
│                  │  ShippingWave · LoadingSession · VehicleInventory  │
│                  │  Shipment · PackingJob · Pallet                   │
├──────────────────┼───────────────────────────────────────────────────┤
│  LOGISTICS       │  Vehicle · Driver · ShippingCompany · Route       │
│                  │  DeliveryZone · Governorate                       │
├──────────────────┼───────────────────────────────────────────────────┤
│  CRM             │  Customer · CustomerAddress · Campaign            │
│                  │  Lead · Opportunity                               │
├──────────────────┼───────────────────────────────────────────────────┤
│  FINANCE         │  Invoice · Payment · CashRegister                 │
│                  │  POSSession · POSSale                             │
├──────────────────┼───────────────────────────────────────────────────┤
│  PLATFORM        │  Notification · Document · TimelineEntry          │
│                  │  AIRecommendation · Policy · AuditEvent           │
│                  │  Employee · User · Permission                     │
└──────────────────┴───────────────────────────────────────────────────┘
```

---

## 3. Aggregate Roots (Summary)

| Aggregate Root | Domain | Owns |
|---|---|---|
| **Company** | Organization | Brands, Warehouses, Teams, Policies |
| **MarketingAccount** | Marketing | MarketingAssets, OAuth tokens, credentials |
| **Order** | Commerce | OrderLines, Reservations, Fulfillment chain |
| **Product** | Inventory | Prices, Channel configs, Recipe link |
| **RawMaterial** | Inventory | Stock, ReceiptLayers, Reservations |
| **Recipe** | Manufacturing | RecipeLines, Cost snapshot |
| **Supplier** | Procurement | Contacts, POs, Performance records |
| **PurchaseOrder** | Procurement | PO Lines, GoodsReceipts, Invoices |
| **Customer** | CRM | Addresses, Contacts, Orders (ref), Loyalty |
| **PreparationWave** | Fulfillment | Wave Items, Pick Lists, Output pool |
| **ShippingWave** | Fulfillment | Loading Sessions, Allocations |
| **Vehicle** | Logistics | VehicleInventory, Assignments, Loading history |
| **Shipment** | Fulfillment | Packing Jobs, Pallets, Proof of delivery |
| **POSSession** | Finance | POS Sales, Cash movements |
| **Invoice** | Finance | Invoice Lines, Payments |
| **Campaign** | CRM | Leads, Segments, Analytics |

---

## 4. Cross-Domain Dependency Rules

Cross-domain dependencies are strictly controlled. A domain may:
- **Reference** another domain's aggregate by ID (always allowed)
- **Listen** to another domain's events (always allowed)
- **Query** another domain's public read model (allowed via Query Service)

A domain must **NEVER**:
- Directly call another domain's service methods
- Hold a foreign key to another domain's internal entity (only aggregate roots)
- Modify another domain's aggregate directly
- Inherit from another domain's entity

### Allowed Cross-Domain References

```
Commerce → CRM (Customer ID)
Commerce → Inventory (Product ID)
Commerce → Organization (Company, Channel, Warehouse IDs)
Fulfillment → Commerce (Order IDs)
Fulfillment → Inventory (Product, RawMaterial IDs)
Fulfillment → Logistics (Vehicle, Driver IDs)
Fulfillment → Organization (Warehouse ID)
Procurement → Inventory (RawMaterial ID)
Procurement → CRM (Supplier ID, treated as Supplier domain)
Manufacturing → Inventory (Product, RawMaterial IDs)
Finance → Commerce (Order ID)
Finance → Procurement (PurchaseOrder, SupplierInvoice IDs)
Finance → Organization (Company ID)
Platform (EPS) → ALL (read only; event subscription)
```

### Forbidden Cross-Domain Dependencies

```
Inventory must NOT own Order business logic
Commerce must NOT own Inventory state
Fulfillment must NOT own Order financial state
Manufacturing must NOT own Commerce decisions
Finance must NOT own Fulfillment logic
```

---

## 5. Enterprise Architecture Governance Rules

| Rule | Statement |
|---|---|
| **DOM-GOV-001** | Every entity has exactly one Aggregate Owner |
| **DOM-GOV-002** | Every business term has one canonical definition (see DOMAIN-GLOSSARY.md) |
| **DOM-GOV-003** | Every business invariant references exactly one governing Policy |
| **DOM-GOV-004** | Every aggregate produces Business Events when its state changes |
| **DOM-GOV-005** | No module may redefine an entity already defined in this Enterprise Domain Model |
| **DOM-GOV-006** | Cross-domain interaction is via event subscription or aggregate ID reference only |
| **DOM-GOV-007** | Aggregate boundaries are consistency boundaries — transactional modifications never span aggregates |
| **DOM-GOV-008** | Value Objects are immutable — they are replaced, not updated |
| **DOM-GOV-009** | Business Events are immutable and append-only — they are never deleted or modified |
| **DOM-GOV-010** | Every entity is owned by a Company — no global entities exist (except Organization-level entities like Country) |

---

## 6. Document Index

| Document | Purpose |
|---|---|
| `ENTITY-CATALOG.md` | Complete catalog of all 60+ entities with full definitions |
| `AGGREGATE-CATALOG.md` | All 15 aggregate roots with boundaries and rules |
| `VALUE-OBJECT-CATALOG.md` | All reusable value objects |
| `BUSINESS-RELATIONSHIPS.md` | All relationships, allowed/forbidden dependencies |
| `LIFECYCLE-MODELS.md` | State machines for every aggregate |
| `OWNERSHIP-MODEL.md` | Data ownership rules per aggregate |
| `DOMAIN-EVENT-CATALOG.md` | All 80+ business events |
| `BUSINESS-INVARIANTS.md` | All business rules with policy references |
| `DOMAIN-GLOSSARY.md` | Canonical business vocabulary |

---

## 7. Cross-Platform Integration

Every entity in this Domain Model integrates with the Enterprise Platform Services:

| EPS Service | Domain Integration |
|---|---|
| EPS-01 Event Platform | Every aggregate produces typed domain events |
| EPS-02 Timeline Platform | Every aggregate has a Timeline keyed by (object_type, object_id) |
| EPS-03 Document Platform | Any aggregate may have Documents attached |
| EPS-04 Notification Platform | Business events trigger Notifications via NotificationPolicy |

Every aggregate is governed by:
- **Policy Engine** — one or more Policies govern behavior
- **Configuration Platform** — settings control thresholds and defaults
- **Feature Flags** — features can be enabled/disabled per company
- **Decision Engines** — operational decisions are made by registered engines

---

## 8. Contract Architecture Dependency (TASK-CONTRACT-ARCH-001)

Every aggregate in this Domain Model communicates through formal Contracts. The Domain Model defines WHAT exists; the Contract Architecture defines HOW aggregates communicate.

| Domain Model Document | Contract Document |
|---|---|
| AGGREGATE-CATALOG.md (15 aggregates) | COMMAND-CONTRACTS.md (commands per aggregate) |
| DOMAIN-EVENT-CATALOG.md (80+ events) | EVENT-CONTRACTS.md (formal schema per event) |
| ENTITY-CATALOG.md (read models) | QUERY-CONTRACTS.md (queries per entity) |
| ENTERPRISE-PLATFORM-SERVICES.md (EPS) | SERVICE-CONTRACTS.md (service interfaces) |
| BUSINESS-RELATIONSHIPS.md (cross-domain) | BOUNDARY-CONTEXT-MAP.md (upstream/downstream) |

> Full Contract Architecture: `docs/contracts/ENTERPRISE-CONTRACTS.md`

---

## 9. Database Engineering Standards Dependency (TASK-DATABASE-ENGINEERING-001)

Every aggregate in this Domain Model maps to one or more tables. The Logical Data Architecture and Database Engineering Standards govern how those tables are built.

| Domain Model Concept | Logical Data Architecture | Engineering Standard |
|---|---|---|
| Aggregate (root entity) | AGGREGATE-MAPPING.md (AGG-01 to AGG-15) | DATABASE-NAMING-CONVENTIONS.md |
| Entity identity | IDENTITY-STRATEGY.md (UUID/ULID/BusinessNum) | ENG-GOV-002: no auto-increment IDs |
| Cross-domain references | LOGICAL-RELATIONSHIP-MODEL.md (no cross-domain FK) | FOREIGN-KEY-STANDARDS.md |
| Soft delete behavior | SOFT-DELETE-ARCHITECTURE.md (3 strategies) | CONSTRAINT-STANDARDS.md partial UNIQUE |
| Temporal patterns | TEMPORAL-DATA-MODEL.md (T1–T4) | INDEXING-STANDARDS.md time-based |
| Audit trail | AUDIT-DATA-MODEL.md | DATABASE-SECURITY-STANDARDS.md |

**CTO Directive:** No physical database design may begin for any aggregate without the Logical Data Architecture and these standards being in place.

> Logical Data Architecture: `docs/data/ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md`  
> Engineering Standards: `docs/engineering/DATABASE-ENGINEERING-STANDARDS.md`  
> Change Policy: `docs/engineering/DATABASE-CHANGE-POLICY.md`

---

## 10. Related Documents

- `docs/architecture/ENTERPRISE-PLATFORM-SERVICES.md` — EPS-01 to EPS-04
- `docs/architecture/ENTERPRISE-CONFIGURATION-PLATFORM.md` — Policy Engine, Feature Flags
- `docs/architecture/ADR-015-enterprise-fulfillment-architecture.md` — Fulfillment flow
- `docs/ux/ENTERPRISE-UX-ARCHITECTURE.md` — UX standards for every entity
- `docs/contracts/ENTERPRISE-CONTRACTS.md` — Integration contracts for every aggregate
- `docs/domain/Operations-Planning.md` — Preparation OS operational detail
- `docs/architecture/ENTERPRISE-FULFILLMENT-PLATFORM.md` — Fulfillment Platform
