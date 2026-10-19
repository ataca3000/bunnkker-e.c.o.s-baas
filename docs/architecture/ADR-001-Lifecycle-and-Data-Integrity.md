# ADR-001 — Entity Lifecycle and Data Integrity

**Date:** 2026-06-26
**Status:** Accepted
**Author:** ECOS Architecture Team

---

## Context

ECOS ERP is the **single source of truth** for all business data across the organization:
products, customers, suppliers, warehouses, purchase orders, goods receipts, and sales orders.
Unlike a simple CRUD application, an ERP system carries legal, financial, and operational obligations
that prevent arbitrary deletion of records.

The core tension is between:

- **Operators** wanting to "clean up" entities that are no longer active (e.g., a discontinued product,
  an inactive supplier).
- **The system** needing to preserve the historical integrity of every transaction that referenced
  those entities (e.g., a purchase order line that referenced a now-discontinued product must still
  be readable and auditable years later).

Early in the project, a decision was required: how does ECOS handle the removal of master data
entities and transactional documents?

---

## Decision

### 1. No Hard Delete from the UI

**No master data entity or transactional document shall be permanently deleted through the application UI.**

Permanent deletion is prohibited at the application layer for all business entities.
The only permissible permanent removals are:

- Automated cleanup of non-business temporary data (e.g., authentication tokens, session records,
  ephemeral queue messages) where no business history is involved.
- Explicit, documented data corrections performed by an authorized engineer under a controlled
  change process — never through the application UI.

### 2. Archive as a Business Lifecycle State

Business entities support a lifecycle that distinguishes between **Active**, **Archived**,
and **Permanently Removed** states.

**Archive** is the business concept: an entity that is no longer active in day-to-day
operations but must remain accessible for historical records, auditing, and regulatory
compliance. An archived entity is invisible in active workflows (selection lists, new
transactions) but fully visible in historical views and reports.

The persistence mechanism for archiving — whether a timestamp-based flag, a status field,
or a dedicated archive partition — is an **infrastructure concern**. It may change as the
system evolves without affecting the business rules described in this ADR. The business
rule is the behaviour, not the implementation.

Business entities that support the Archive lifecycle:

| Entity | Domain |
|---|---|
| Products | Inventory |
| Categories | Master Data |
| Units | Master Data |
| Warehouses | Master Data |
| Suppliers | Purchasing |
| Customers | Sales |
| Companies | Organization |
| Branches | Organization |
| Channels | Commerce |
| Product–Channel Mappings | Commerce |
| Bills of Materials | Manufacturing |

### 3. Lifecycle Status for Transactional Documents

Transactional documents (orders, purchase orders, goods receipts) are never deleted. Instead, they
progress through an explicit Finite State Machine (FSM) lifecycle. A document that must be "removed"
is **cancelled**, not deleted.

Current lifecycle FSMs:

| Document | States |
|---|---|
| Purchase Order | `draft → submitted → approved → partially_received → received → closed / cancelled` |
| Goods Receipt | `draft → posted` (cancellation not permitted after posting — financial reversal required) |
| Order | `pending → confirmed → partially_fulfilled → fulfilled / cancelled` |
| Inventory Count Session | `draft → in_progress → completed → approved / cancelled` |
| Fulfillment | `pending → fulfilled / cancelled` |

**Cancellation is terminal.** A cancelled document cannot be re-opened. A new document must be
created if the business operation needs to be retried.

### 4. Archive Instead of Delete for Deactivated Entities

When an entity must be made inactive (e.g., a product is discontinued, a warehouse is closed),
the entity is **archived**, not hard-deleted. Archived entities:

- Do not appear in active selection lists or dropdowns.
- Remain visible in historical transactions and reports.
- Retain all their data, relationships, and audit history.
- Can be restored (un-archived) by an authorized user.

### 5. ERP as Single Source of Truth

ECOS ERP is the authoritative record for all business data. External systems (WooCommerce, future
integrations) are **consumers** of ERP data, not co-owners.

- Prices, inventory levels, and product data originate in the ERP and are pushed to external channels.
- Data received from external channels (orders, customers) is imported into the ERP and governed
  by ERP rules from that point forward.
- In any conflict, the ERP record takes precedence.

### 6. Historical Data Preservation

Every transaction that references a master data entity preserves the **value at the time of the
transaction**, not a foreign key alone. Examples:

- Goods Receipt lines store `unit_price` and `landed_unit_cost` at the time of posting.
- Order lines store `unit_price` at the time the order was placed.
- FIFO receipt layers store `unit_cost` at the time of receipt.

This means that even if a product's cost changes tomorrow, historical receipts and COGS calculations
remain accurate.

---

## Consequences

### Positive

- **Audit integrity:** Every historical transaction can be read, reported, and audited at any future
  point in time without data loss.
- **Referential safety:** No orphaned references. Deleting an entity that is referenced by a
  transaction is prohibited at the business rule level, enforced at the application layer and
  reinforced by database constraints.
- **Regulatory compliance:** Financial and inventory records are preserved in accordance with
  standard accounting and audit requirements.
- **ERP reliability:** The system is the definitive record. Operators and management can trust
  the data they see.

### Negative / Trade-offs

- **Storage growth:** Records accumulate indefinitely. Archived entities and cancelled documents
  consume storage permanently.
- **Query complexity:** All queries over business entities must distinguish between active and
  archived records. This filter must be applied consistently — including in reporting queries,
  data migrations, and any future integrations.
- **No "undo" for mistakes:** If an operator accidentally creates a purchase order, they must cancel
  it — they cannot delete it. This can frustrate users unfamiliar with ERP conventions.
- **Migration complexity:** Changing the schema of a table containing years of historical records
  requires careful backward-compatible migrations.

---

## Future Considerations

- **Data archival to cold storage:** As the database grows, a future ADR may introduce an archival
  policy that moves records older than a defined threshold (e.g., 7 years) to a separate archive
  database or object storage, while keeping the primary database performant.
- **GDPR / Data subject erasure:** If the system must comply with GDPR's right-to-erasure,
  a pseudonymisation strategy (replacing PII with anonymised tokens) will be needed rather than
  hard deletion. This does not violate the Archive principle — the record persists but its
  identifying data is anonymised.
- **Approval workflows for archive/restore:** Currently, archiving requires the appropriate access
  level. Future RBAC implementation will add fine-grained control over who can archive and restore
  which entity types.
