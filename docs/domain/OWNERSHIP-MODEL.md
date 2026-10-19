# Ownership Model

**Document:** OWNERSHIP-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DOMAIN-ARCH-001  
**Parent:** ENTERPRISE-DOMAIN-MODEL.md

---

## 1. Ownership Principle

> **Every piece of business data has exactly one owner.** The owner is always an Aggregate Root. Data that is owned by an aggregate can only be modified through that aggregate's root. No other aggregate may modify it directly.

Ownership rules define:
- Who is responsible for data consistency
- Who can create, modify, and delete the data
- What happens to the data when the owner is deactivated or deleted

---

## 2. Ownership Map

---

### Company owns:

| Owned Data | Notes |
|---|---|
| Branch(es) | Company defines its own operational branches |
| Warehouse(s) | Company owns its physical storage locations |
| Sales Channel(s) | Scoped to Brand, but Company is the isolation boundary |
| Employee(s) | Company employs its people |
| User(s) | User accounts are scoped to Company |
| Unit(s) | Company defines its units of measure |
| ProductCategory(s) | Company defines its product classification |
| MaterialCategory(s) | Company defines its material classification |
| DeliveryZone(s) | Company defines its delivery geography |
| FulfillmentProfile(s) | Company defines its fulfillment behavior |
| ShippingCompany references | Company configures its logistics partners |
| Policy configurations | Company-level policy settings via Config Platform |
| Feature flag settings | Company-level feature enablement |

**Cascade behavior:** Deactivating a Company freezes all its data. Deletion is only possible after a full data retention period and only by system administrators.

---

### Brand owns:

| Owned Data | Notes |
|---|---|
| Sales Channel(s) | Brand defines its selling endpoints (WooCommerce, Amazon, POS, etc.) |
| Marketing Account(s) | Brand owns its advertising platform accounts (Meta, Google, TikTok) |
| Integration Account(s) | Brand owns its technical integration credentials (formerly Business Account) |

**Cascade behavior:** Deactivating a Brand deactivates all its Sales Channels, Marketing Accounts, and Integration Accounts. Orders and historical data are preserved.

---

### Marketing Account owns:

| Owned Data | Notes |
|---|---|
| Marketing Asset(s) | Pages, Ad Accounts, Pixels, Catalogs — all scoped to this account |
| OAuth tokens | Encrypted; rotated automatically |
| API credentials | Encrypted; managed by credential rotation policy |
| Sync settings | Controls which data is synced and how frequently |
| Webhook configuration | Controls which platform events are received |

**Does NOT own:**
- Sales Channels (never)
- Orders (never)
- Customers (never)
- Products (never)

**References (not owned):**
- Brand — continues to exist if Marketing Account is deactivated
- Company — purely for isolation; not a cascade dependency

**Cascade behavior:** Deactivating a Marketing Account suspends all its Marketing Assets. Attribution data (on Orders) is preserved — UTM fields on historical Orders are never deleted.

---

### Order owns:

| Owned Data | Notes |
|---|---|
| OrderLine(s) | Lines cannot exist without their Order |
| Order status history | Immutable log of every status transition |
| Order financial totals | Derived from OrderLines; recalculated on line change |
| Order timeline entries (via EPS-02) | History belongs to the Order |
| Order documents (via EPS-03) | Files attached to this Order |

**References (not owned):**
- Customer — the Customer continues to exist if the Order is cancelled
- Product (in OrderLine) — product exists independently
- Reservation — referenced by ID; Reservation has its own lifecycle
- Warehouse — continues to exist independently

**Cascade behavior:** Cancelling an Order fires OrderCancelled event. Reservation aggregate listens and releases reserved quantities.

---

### Product owns:

| Owned Data | Notes |
|---|---|
| ProductPrice(s) — one per Channel | Pricing is an attribute of the Product per Channel |
| ProductChannelConfig(s) — one per Channel | Visibility and availability settings per Channel |
| Manufacturing readiness state | Derived from Recipe linkage and stock analysis |
| Product timeline entries (via EPS-02) | |
| Product documents (via EPS-03) | Certifications, photos, spec sheets |

**References (not owned):**
- ProductCategory — exists independently
- Recipe — Recipe aggregate owns itself; Product holds a reference
- InventoryItem — owned by the Product aggregate (stock state IS part of Product)

**Cascade behavior:** Discontinuing a Product sets all ProductChannelConfigs to inactive. Existing Orders referencing discontinued Products are unaffected.

---

### RawMaterial owns:

| Owned Data | Notes |
|---|---|
| ReceiptLayer(s) | FIFO cost layers are part of the material's stock model |
| Reservation(s) | Quantity holds on this material |
| StockMovement(s) | Immutable audit trail of all stock changes |
| InventoryItem(s) — one per Warehouse | Stock state per location |
| Material timeline entries (via EPS-02) | |
| Material documents (via EPS-03) | Lab reports, certificates, photos |

**References (not owned):**
- MaterialCategory — exists independently
- Unit — exists independently
- Supplier — Supplier exists independently; Material holds last-known supplier ID

---

### Recipe owns:

| Owned Data | Notes |
|---|---|
| RecipeLine(s) | Ingredients list is part of the Recipe |
| ExecutionInstructions | Preparation steps owned by Recipe |
| CostSnapshot | Point-in-time cost calculation; regenerated on Recipe change |
| Recipe timeline entries (via EPS-02) | |

**References (not owned):**
- Product (target) — Product exists independently; Recipe points to it
- RawMaterial (per RecipeLine) — exists independently
- Unit — exists independently

---

### Supplier owns:

| Owned Data | Notes |
|---|---|
| SupplierContact(s) | Contacts are part of the Supplier identity |
| SupplierPerformanceRecord(s) | Derived metrics from POs and GRs |
| Supplier documents (via EPS-03) | Contracts, certificates |
| Supplier timeline entries (via EPS-02) | |

**References (not owned):**
- PurchaseOrder(s) — PurchaseOrder owns its own lifecycle
- RawMaterial(s) — Material exists independently; may list Supplier as preferred

---

### PurchaseOrder owns:

| Owned Data | Notes |
|---|---|
| PurchaseOrderLine(s) | Lines cannot exist without PO |
| GoodsReceipt(s) | Receipts are records against this PO |
| SupplierInvoice link | Invoice may be linked after receipt |
| PO status history | |
| PO timeline entries (via EPS-02) | |
| PO documents (via EPS-03) | Supplier quotes, delivery notes |

**References (not owned):**
- Supplier — exists independently
- Warehouse — exists independently
- RawMaterial (per POLine) — exists independently

**Cascade behavior:** Cancelling a PO does NOT cancel already-posted GoodsReceipts. Posted receipts must be reversed separately.

---

### Customer owns:

| Owned Data | Notes |
|---|---|
| CustomerAddress(es) | Addresses belong to this Customer |
| CustomerContact(s) | Phone numbers, emails |
| CustomerPreference(s) | Notification preferences, language, channel preference |
| Customer timeline entries (via EPS-02) | |
| Customer documents (via EPS-03) | Contracts, KYC documents |

**References (not owned):**
- Order(s) — Orders reference Customer; Customer does not own Orders
- Governorate (per address) — global reference data

**Cascade behavior:** Customer merge transfers all Orders, Timeline, Documents, Addresses to the surviving record. Source record is archived, not deleted.

---

### PreparationWave owns:

| Owned Data | Notes |
|---|---|
| WaveItem(s) | Product requirements for this wave |
| PickList | Generated work instruction for warehouse staff |
| Output written to PreparedProductsPool | Wave is the source of pool entries |
| Wave timeline entries (via EPS-02) | |
| Wave documents (via EPS-03) | Pick lists, quality reports |

**References (not owned):**
- Order(s) — Orders exist independently; Wave references them
- Product/RawMaterial (via WaveItems) — exist independently
- Reservation(s) — Wave consumes reservations but does not own them
- Warehouse — exists independently

---

### ShippingWave owns:

| Owned Data | Notes |
|---|---|
| LoadingSession(s) | Sessions are records of the loading activity |
| AllocationRecord(s) | Which products went to which vehicle |
| Wave timeline entries (via EPS-02) | |

**References (not owned):**
- Order(s), Vehicle(s), Warehouse — exist independently
- PreparedProductsPool entries consumed — pool entries are owned by PreparationWave

---

### Vehicle owns:

| Owned Data | Notes |
|---|---|
| VehicleInventory (current cargo state) | What is currently on this vehicle |
| VehicleAssignment history | Who drove it and when |
| Vehicle timeline entries (via EPS-02) | |
| Vehicle documents (via EPS-03) | Registration, insurance, maintenance records |

**References (not owned):**
- Driver — Employee exists independently; vehicle holds current assignment
- ShippingCompany — exists independently

---

### Shipment owns:

| Owned Data | Notes |
|---|---|
| PackingJob(s) | If FulfillmentProfile includes packing |
| Pallet(s) | Physical packing containers |
| DeliveryAttempt(s) | Immutable record of each delivery attempt |
| Shipment timeline entries (via EPS-02) | |
| Shipment documents (via EPS-03) | Proof of delivery photos, delivery notes |

**References (not owned):**
- Order(s), Vehicle, Driver, Warehouse, Customer — all exist independently

---

### POSSession owns:

| Owned Data | Notes |
|---|---|
| POSSale(s) | Sales completed in this session |
| POSSaleLine(s) — via POSSale | Sale detail lines |
| CashMovement(s) | All cash ins and outs for this session |
| Session timeline entries (via EPS-02) | |

**References (not owned):**
- Warehouse, Employee — exist independently
- Customer (per sale) — exists independently
- Product (per sale line) — exists independently

---

### Invoice owns:

| Owned Data | Notes |
|---|---|
| InvoiceLine(s) | Invoice detail lines |
| Payment(s) | Payment records against this invoice |
| Invoice timeline entries (via EPS-02) | |
| Invoice documents (via EPS-03) | PDF invoice, remittance advice |

**References (not owned):**
- Order(s), Customer — exist independently

---

### Campaign owns:

| Owned Data | Notes |
|---|---|
| Lead(s) | Leads generated by this campaign |
| Opportunity(s) | Sales opportunities from this campaign |
| CampaignAnalytics (derived) | Engagement and conversion metrics |
| Campaign timeline entries (via EPS-02) | |

**References (not owned):**
- CustomerSegment — exists independently
- Customer (per converted Lead) — exists independently

---

## 3. Platform Ownership

EPS platform entities have special ownership rules:

| Entity | Owner | Rule |
|---|---|---|
| TimelineEntry | EPS-02 | Immutable; attached to any aggregate via polymorphic key |
| Document | EPS-03 | Attached to any aggregate; Document content outlives the relationship |
| Notification | EPS-04 | Created by platform; consumed by recipient User |
| AIRecommendation | AI Platform | Created by AI; acted upon or dismissed by User |
| AuditEvent | Audit Platform | Immutable; attached to any aggregate action |

---

## 4. Company-Scoped Isolation Rule

> **Every entity in ECOS is scoped to a Company.** No entity is visible to users of another Company. No cross-Company references are permitted except by system administrators.

Every Aggregate Root must have a `company_id` field. Every query across any domain filters by `company_id` first.

**Exceptions (global reference data — not company-scoped):**
- Country
- Governorate
- Currency (ISO codes)
- Units (if shared across companies; otherwise company-scoped)

---

## 5. Deletion Policy

| Scenario | Policy |
|---|---|
| Entity has active children | Cannot delete; must deactivate/archive first |
| Entity referenced by active Orders | Cannot delete |
| Entity with only historical references | Archive (soft-delete), never hard-delete |
| Platform entities (Timeline, Audit) | Never deleted; retention period applies |
| User requests data deletion | GDPR anonymization: replace PII with `[REDACTED]`, preserve business data integrity |
