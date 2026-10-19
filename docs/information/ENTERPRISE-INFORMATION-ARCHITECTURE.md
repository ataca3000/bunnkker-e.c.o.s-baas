# Enterprise Information Architecture

**Document:** ENTERPRISE-INFORMATION-ARCHITECTURE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-INFORMATION-ARCH-001

---

## 1. Mission

> Define how every piece of information in ECOS is identified, classified, governed, stored, searched, retained, and consumed — so that data is consistent, discoverable, secure, and always trustworthy.

---

## 2. Information Architecture Principles

| # | Principle | Statement |
|---|---|---|
| 1 | **Single Source of Truth** | Every data element has exactly one authoritative source; no duplicate definitions |
| 2 | **Classification First** | Every data element is classified before it is stored |
| 3 | **Govern at Origin** | Data quality is enforced at point of entry; never cleaned downstream |
| 4 | **Privacy by Design** | Personal data is identified, minimized, and governed from day one |
| 5 | **Information Lifecycle** | Data has a defined lifecycle: create → use → archive → purge |
| 6 | **Searchability** | All significant business objects are searchable without querying raw tables |
| 7 | **Lineage** | Every analytical data point is traceable to its source transaction |
| 8 | **Consistent Identity** | Every entity uses a consistent identity scheme (defined in IDENTITY-STRATEGY.md) |
| 9 | **Retention Compliance** | Retention periods are enforced, not aspirational |
| 10 | **Context Isolation** | Company data is isolated — no tenant sees another tenant's data |

---

## 3. Information Categories

ECOS manages four distinct categories of information, each with different governance requirements:

| Category | Definition | Examples | Governance |
|---|---|---|---|
| **Master Data** | The core entities that define the business — slow-changing, high-value | Products, Customers, Suppliers, Employees, Warehouses | Strict change control; version history required |
| **Reference Data** | Standardized lookup values that define the vocabulary | Countries, Currencies, Units of Measure, Categories | Centrally owned; rarely changes; widely shared |
| **Transactional Data** | Records of business events as they happen | Orders, Invoices, Stock Movements, Payments | Immutable once committed; append-only |
| **Analytical Data** | Aggregated, pre-computed views for reporting and AI | KPI snapshots, Demand forecasts, Projections | Derived from transactional data; refreshed by events |

---

## 4. Information Architecture Map

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    ECOS INFORMATION ARCHITECTURE                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ORIGINATION LAYER                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ User Input (Forms)  │ External APIs (ACL)  │ System Events (Auto)  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                │                  │                    │                   │
│                ▼                  ▼                    ▼                   │
│  VALIDATION LAYER (govern at origin)                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Business Rules  │  Policy Engine  │  Schema Validation  │  Dedup    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│                                    ▼                                      │
│  OPERATIONAL STORE (PostgreSQL — source of truth)                         │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │ Master     │  │ Reference  │  │ Transactional │  │ Event Store    │   │
│  │ Data       │  │ Data       │  │ Data          │  │ (EPS-01)       │   │
│  └────────────┘  └────────────┘  └──────────────┘  └────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  PROJECTION / SEARCH LAYER                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Meilisearch (search indexes)  │  Read Models  │  Analytical Projec- │  │
│  │                               │  (CQRS)       │  tions (aggregated) │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│                                    ▼                                      │
│  CONSUMPTION LAYER                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ APIs  │  Dashboards  │  Reports  │  AI / Analytics  │  Exports      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Subject Domains

Each domain owns a portion of the information architecture. No domain may own data outside its bounded context.

| Domain | Data Owned | Shared Read Model |
|---|---|---|
| Organization | Company, Branch, Warehouse, Channel, Employee | org.company, org.warehouse |
| Commerce | Order, OrderLine, Channel pricing | orders.summary |
| Inventory | Product, RawMaterial, Stock, ReceiptLayer | inventory.availability |
| Manufacturing | Recipe, ProductionJob | manufacturing.recipe |
| Procurement | Supplier, PO, GR, SupplierInvoice | procurement.supplier_health |
| Fulfillment | Wave, Pool, Loading, Allocation | fulfillment.wave_status |
| Logistics | Vehicle, Shipment, Route | logistics.fleet_status |
| CRM | Customer, Campaign, Segment | crm.customer_summary |
| Finance | Invoice, Payment, JournalEntry, POS | finance.ar_summary |
| Platform | Event, Timeline, Document, Notification, AI | platform.timeline, platform.notifications |

---

## 6. Information Governance Roles

| Role | Responsibility |
|---|---|
| **Data Owner** | Business domain that created and is accountable for the data |
| **Data Steward** | Engineering responsibility — schema design, migration standards, query performance |
| **Data Consumer** | Any module or user reading the data via query contracts |
| **Data Custodian** | Infrastructure team responsible for storage, backup, replication |
| **Privacy Officer** | Responsible for PII classification, retention policy, and GDPR compliance |

---

## 7. Governance Rules

| Rule | Statement |
|---|---|
| **INFO-GOV-001** | Every data element has exactly one Owner domain; no entity is defined in multiple domains |
| **INFO-GOV-002** | Cross-domain data access is via Query Contracts only; never direct database joins |
| **INFO-GOV-003** | Personal data (PII) must be classified before any entity is designed |
| **INFO-GOV-004** | Transactional data is immutable once committed; corrections are new transactions |
| **INFO-GOV-005** | Every data element that enters via an external system passes through an ACL translator |
| **INFO-GOV-006** | Search indexes are projections; source of truth is always the operational store |
| **INFO-GOV-007** | Analytical data is derived from events and transactions; never from operational mutations |
| **INFO-GOV-008** | Retention periods are enforced by automated jobs, not manual processes |
| **INFO-GOV-009** | Company data isolation (tenant isolation) is enforced at application layer; every query includes company_id |
| **INFO-GOV-010** | PII is anonymized (not deleted) when a GDPR erasure request is received |

---

## 8. Document Index

| Document | Purpose |
|---|---|
| `MASTER-DATA-MODEL.md` | All master data entities, ownership, governance, change control |
| `REFERENCE-DATA-MODEL.md` | All lookup/reference data: categories, currencies, units, statuses |
| `TRANSACTIONAL-DATA-MODEL.md` | Transactional patterns: immutability, correction, audit |
| `ANALYTICAL-DATA-MODEL.md` | Projections, KPI snapshots, AI training data classification |
| `INFORMATION-LIFECYCLE.md` | Create → active → archived → purged lifecycle per data category |
| `DATA-CLASSIFICATION.md` | PII, confidential, internal, public classification with handling rules |
| `DATA-GOVERNANCE.md` | Ownership, stewardship, quality rules, violation procedures |
| `SEARCH-ARCHITECTURE.md` | Meilisearch index design, indexing triggers, field mapping |
| `REPORTING-INFORMATION-MODEL.md` | Report-ready data model, KPI definitions, reporting governance |

---

## 9. Related Documents

- `docs/contracts/ENTERPRISE-CONTRACTS.md` — Query Contracts define how data is consumed cross-domain
- `docs/domain/ENTERPRISE-DOMAIN-MODEL.md` — Every entity in this IA is a domain entity
- `docs/domain/ENTITY-CATALOG.md` — Entity definitions, keys, and status models
- `docs/architecture/ENTERPRISE-PLATFORM-SERVICES.md` — EPS-01 produces events that populate analytical data
- `docs/data/ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md` — Logical data layer (next document set)
