# Enterprise Logical Data Architecture

**Document:** ENTERPRISE-LOGICAL-DATA-ARCHITECTURE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATA-ARCH-001

> **CTO Directive:** No physical database design (migrations, tables, ORM models, SQL) may begin until this Logical Data Architecture is approved.

---

## 1. Mission

> Transform the Enterprise Domain Model into a complete, database-agnostic Logical Data Architecture — the blueprint from which all physical database design will derive.

This document defines the logical structure of ECOS data without prescribing physical implementation. Technology choices (PostgreSQL specifics, column types, indexes) belong to the DATABASE-ENGINEERING-STANDARDS.md layer above.

**This document is NOT:**
- A migration file
- A SQL schema
- An ORM model
- A physical database design

---

## 2. Architectural Layers

```
┌──────────────────────────────────────────────────────┐
│  1. DOMAIN MODEL (docs/domain/)                      │
│     Aggregates, Entities, Value Objects              │
│     → authoritative business model                  │
└──────────────────────────┬───────────────────────────┘
                           │ transforms into
┌──────────────────────────▼───────────────────────────┐
│  2. LOGICAL DATA ARCHITECTURE (this layer)           │
│     Logical entities, relationships, keys            │
│     → database-agnostic blueprint                   │
└──────────────────────────┬───────────────────────────┘
                           │ implements as
┌──────────────────────────▼───────────────────────────┐
│  3. PHYSICAL DATABASE (docs/engineering/)            │
│     PostgreSQL tables, migrations, indexes           │
│     → governed by DATABASE-ENGINEERING-STANDARDS     │
└──────────────────────────────────────────────────────┘
```

---

## 3. Logical Data Architecture Principles

| # | Principle | Statement |
|---|---|---|
| 1 | **Domain First** | The Domain Model is the source of truth; the logical data architecture serves the domain |
| 2 | **Bounded Data** | Every table belongs to exactly one domain module; no cross-module tables |
| 3 | **Explicit Identity** | Every entity has an explicit identity strategy (UUID, ULID, or business number) |
| 4 | **Temporal Awareness** | Time-variant data uses explicit temporal modeling (effective_from, effective_to) |
| 5 | **Audit by Default** | Every significant entity carries audit columns (created_by, updated_by, occurred_at) |
| 6 | **Soft Delete** | Entities with business history use soft delete; they are never hard-deleted |
| 7 | **Company Isolation** | Every tenant-scoped table has a company_id column |
| 8 | **No Orphans** | Every foreign key references an existing aggregate root or is explicitly nullable with business justification |
| 9 | **Value Object Inline** | Simple Value Objects are stored inline (embedded columns); complex ones get their own entity |
| 10 | **FIFO Integrity** | Receipt layers must preserve cost layer integrity; never aggregate across layers |

---

## 4. Logical Entity Groups

The logical data architecture organizes entities into the same 10 business domains as the Domain Model.

| Domain | Key Logical Entities | Tables Estimated |
|---|---|---|
| Organization | companies, branches, warehouses, channels, employees | ~10 |
| Commerce | orders, order_lines, order_statuses | ~5 |
| Inventory | products, raw_materials, inventory_items, receipt_layers, reservations, stock_movements | ~12 |
| Manufacturing | recipes, recipe_lines, production_jobs | ~6 |
| Procurement | suppliers, purchase_orders, purchase_order_lines, goods_receipts, gr_lines, supplier_returns, supplier_invoices | ~14 |
| Fulfillment | preparation_waves, wave_items, shipping_waves, loading_sessions, allocations, prepared_products_pool | ~10 |
| Logistics | vehicles, vehicle_inventory, shipments, delivery_attempts | ~8 |
| CRM | customers, customer_addresses, campaigns, campaign_segments | ~8 |
| Finance | invoices, invoice_lines, payments, pos_sessions, pos_sales, pos_sale_lines | ~10 |
| Platform | business_events, timeline_entries, documents, document_versions, notifications, notification_deliveries, ai_recommendations | ~12 |

Total estimated: ~95 tables

---

## 5. Cross-Domain Reference Rules

The logical architecture enforces domain boundaries at the data level:

| Reference Type | Implementation | Notes |
|---|---|---|
| Aggregate ID reference | Column `{aggregate}_id UUID` (no FK) | Cross-domain: Company, Order, Product, Customer, etc. |
| Within-domain FK | Column + FK constraint | Same module: order_id on order_lines |
| N:M join | Dedicated join table in owning domain | wave_order_assignments in Fulfillment |

**Foreign Key Constraint Rules:**
- Within-domain foreign keys: FK constraint enforced
- Cross-domain references: UUID column only, no FK constraint (FK would couple modules at DB level)
- Platform polymorphic references: `{object_type} + {object_id}` pair (no FK possible)

---

## 6. Mandatory Logical Columns (Every Entity)

Every entity table must include these logical columns:

| Column Group | Columns | Purpose |
|---|---|---|
| **Identity** | `id UUID PRIMARY KEY` | Entity identity (see IDENTITY-STRATEGY.md) |
| **Tenant** | `company_id UUID NOT NULL` | Company isolation (except global entities) |
| **Audit** | `created_at TIMESTAMP NOT NULL`, `created_by UUID NOT NULL` | Creation audit |
| **Audit** | `updated_at TIMESTAMP NOT NULL`, `updated_by UUID NOT NULL` | Modification audit |
| **Soft Delete** | `deleted_at TIMESTAMP NULL`, `deleted_by UUID NULL` | Soft delete (when applicable — see SOFT-DELETE-ARCHITECTURE.md) |

Exceptions: Pure event/log tables (business_events, stock_movements, timeline_entries) omit updated_at/updated_by/deleted_at as they are append-only.

---

## 7. Document Index

| Document | Purpose |
|---|---|
| `LOGICAL-ENTITY-MODEL.md` | Full logical entity specification per domain |
| `LOGICAL-RELATIONSHIP-MODEL.md` | All entity relationships, cardinality, constraints |
| `AGGREGATE-MAPPING.md` | How each aggregate maps to its logical entities |
| `IDENTITY-STRATEGY.md` | UUID vs ULID vs business number strategy per entity |
| `LOGICAL-KEYS.md` | Natural keys, surrogate keys, composite keys per entity |
| `TEMPORAL-DATA-MODEL.md` | Time-variant data patterns (effective dates, history tables) |
| `AUDIT-DATA-MODEL.md` | Audit columns, audit tables, actor tracking |
| `SOFT-DELETE-ARCHITECTURE.md` | Which entities soft-delete, which hard-delete, patterns |
| `ARCHIVE-STRATEGY.md` | Partitioning and archival patterns (from INFORMATION-LIFECYCLE.md) |
| `DATA-PARTITIONING-STRATEGY.md` | Table partitioning strategy for high-volume entities |
| `REPORTING-PROJECTION-MODEL.md` | Logical model for read models and reporting projections |

---

## 8. Related Documents

- `docs/domain/ENTERPRISE-DOMAIN-MODEL.md` — Source domain model
- `docs/information/ENTERPRISE-INFORMATION-ARCHITECTURE.md` — Information classification
- `docs/information/INFORMATION-LIFECYCLE.md` — Lifecycle → archive/purge strategy
- `docs/information/DATA-CLASSIFICATION.md` — PII classification → encryption requirements
- `docs/engineering/DATABASE-ENGINEERING-STANDARDS.md` — Physical implementation standards
