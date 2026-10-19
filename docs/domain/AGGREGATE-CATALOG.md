# Aggregate Catalog

**Document:** AGGREGATE-CATALOG  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DOMAIN-ARCH-001  
**Parent:** ENTERPRISE-DOMAIN-MODEL.md

---

## 1. What is an Aggregate?

An **Aggregate** is a cluster of related entities and value objects treated as a single unit for data changes. Every Aggregate has a **Root** — the only entity that external code may reference and modify. The root enforces all consistency rules for everything inside the boundary.

**Key rule:** Modifications to an aggregate are atomic. You can only modify one aggregate at a time within a single transaction.

---

## 2. Aggregate Summary Table

| # | Aggregate Root | Domain | Core Children | Primary Events |
|---|---|---|---|---|
| 1 | Company | Organization | Branch, Warehouse, Channel, Policy | CompanyCreated, ChannelAdded |
| 2 | Order | Commerce | OrderLine, Reservation (ref) | OrderCreated, OrderConfirmed, OrderDelivered |
| 3 | Product | Inventory | ProductPrice, ProductChannelConfig | ProductCreated, ProductActivated |
| 4 | RawMaterial | Inventory | ReceiptLayer, Reservation, StockMovement | StockAdded, StockReserved |
| 5 | Recipe | Manufacturing | RecipeLine, ExecutionInstructions | RecipeActivated, RecipeCostRecalculated |
| 6 | Supplier | Procurement | SupplierContact, SupplierPerformance | SupplierActivated, SupplierSuspended |
| 7 | PurchaseOrder | Procurement | POLine, GoodsReceipt, SupplierInvoice | POCreated, POFullyReceived |
| 8 | Customer | CRM | CustomerAddress, CustomerContact | CustomerCreated, CustomerMerged |
| 9 | PreparationWave | Fulfillment | WaveItem, PickList | WaveStarted, WaveCompleted |
| 10 | ShippingWave | Fulfillment | LoadingSession, Allocation | AllocationCompleted, WaveDispatched |
| 11 | Vehicle | Logistics | VehicleInventory, VehicleAssignment | VehicleLoaded, VehicleReturned |
| 12 | Shipment | Fulfillment | PackingJob, Pallet | ShipmentDispatched, ShipmentDelivered |
| 13 | POSSession | Finance | POSSale, CashMovement | SessionOpened, SaleCompleted |
| 14 | Invoice | Finance | InvoiceLine, Payment | InvoiceIssued, PaymentReceived |
| 15 | Campaign | CRM | Lead, Opportunity | CampaignLaunched, LeadConverted |
| 16 | MarketingAccount | Marketing | MarketingAsset | MarketingAccountCreated, MarketingAccountSuspended |

---

## 3. Aggregate Specifications

---

### AGG-01: Company

**Domain:** Organization  
**Consistency Scope:** Everything the company owns must be consistent in its setup

**Boundary (owns):**
- Branch, Warehouse, Channel, Employee, User
- FulfillmentProfile, Policy (via Configuration Platform)
- Unit, ProductCategory, MaterialCategory
- DeliveryZone, ShippingCompany

**External References:** Country, Governorate (global reference data)

**Consistency Rules:**
- A Channel must belong to exactly one Company
- A Warehouse must belong to exactly one Company (via Branch or direct)
- Deleting a Company is forbidden if it has active Orders, Inventory, or Employees
- Company code is immutable once set

**Events Produced:**
`CompanyCreated`, `CompanyUpdated`, `ChannelAdded`, `ChannelDeactivated`, `WarehouseAdded`

**Policies Consumed:**
`SecurityPolicy` (access control), `FeatureFlag` (enabled modules)

---

### AGG-02: Order

**Domain:** Commerce  
**Consistency Scope:** An Order and its financial/fulfillment state must be consistent

**Boundary (owns):**
- OrderLine(s) — 1 to N
- Fulfillment state (status transition history)
- Order financial totals (derived from lines)

**External References (ID only):**
- Customer (CRM domain)
- Channel (Organization domain)
- Warehouse (Organization domain)
- Product (Inventory domain — ID in OrderLine)
- Reservation (Inventory domain — ID reference per line)

**Consistency Rules:**
- An Order must have at least one OrderLine
- OrderLine quantities must be positive integers
- Total must be the sum of all OrderLine totals (no discrepancy)
- Cancelling an Order must also cancel all associated Reservations (via event)
- Order status can only advance forward (no backward transitions) except: confirmed → on_hold → confirmed
- An Order cannot be delivered without a confirmed Shipment

**Events Produced:**
`OrderCreated`, `OrderConfirmed`, `OrderReserved`, `OrderOnHold`, `OrderInPreparation`, `OrderReady`, `OrderDispatched`, `OrderDelivered`, `OrderCancelled`, `OrderPartialDelivery`

**Policies Consumed:**
`FulfillmentPolicy` (which stages apply), `ReservationPolicy` (auto-reserve on confirm?)

---

### AGG-03: Product

**Domain:** Inventory  
**Consistency Scope:** A Product's identity, pricing, and channel configuration are always in sync

**Boundary (owns):**
- ProductPrice per Channel (1 per Channel)
- ProductChannelConfig (visibility, availability per Channel)
- Manufacturing readiness indicators (derived)

**External References (ID only):**
- ProductCategory
- Recipe (optional — if manufactured)
- Company

**Consistency Rules:**
- SKU is unique within Company and immutable once active
- A Product must have at least one active price to be sold
- Price must be > cost (unless a policy explicitly allows loss-making prices)
- A discontinued Product cannot receive new Orders
- A Product cannot be activated without a valid cost source

**Events Produced:**
`ProductCreated`, `ProductActivated`, `ProductDeactivated`, `ProductPriceChanged`, `ProductCostUpdated`, `ProductDiscontinued`, `RecipeLinked`

**Policies Consumed:**
`PricingPolicy` (pricing rules, margin floor), `InventoryPolicy` (low stock thresholds)

---

### AGG-04: RawMaterial

**Domain:** Inventory  
**Consistency Scope:** Material stock levels and FIFO cost layers are always consistent

**Boundary (owns):**
- ReceiptLayer(s) — FIFO cost layers; immutable once created
- Reservation(s) — quantity holds for production or orders
- StockMovement(s) — immutable audit trail
- InventoryItem (stock state per Warehouse)

**External References (ID only):**
- MaterialCategory
- Unit
- Supplier (last known supplier; reference only)

**Consistency Rules:**
- Total available stock = sum(ReceiptLayers.remaining_qty) − sum(Reservations.reserved_qty)
- A Reservation cannot exceed available stock (unless InventoryPolicy.allow_negative_reservation = true)
- ReceiptLayers are consumed FIFO — oldest layer first
- A ReceiptLayer cannot be modified after posting
- Consumed quantity across all layers must equal total consumption recorded in StockMovements

**Events Produced:**
`StockAdded`, `StockConsumed`, `StockAdjusted`, `StockReserved`, `ReservationCancelled`, `LowStockAlert`, `OutOfStockAlert`, `CostLayerAdded`

**Policies Consumed:**
`InventoryPolicy` (reorder point, negative stock rules), `PricingPolicy` (COGS method = FIFO)

---

### AGG-05: Recipe

**Domain:** Manufacturing  
**Consistency Scope:** A Recipe's materials, quantities, and cost snapshot are always consistent

**Boundary (owns):**
- RecipeLine(s) — 1 to N
- ExecutionInstructions (steps, notes)
- CostSnapshot (point-in-time total cost; recalculated on save)

**External References (ID only):**
- Product (target)
- RawMaterial (per RecipeLine)
- Unit (per RecipeLine)

**Consistency Rules:**
- A Recipe must have at least one RecipeLine
- RecipeLine quantities must be positive
- Waste percentage must be 0–100%
- Only one Recipe version may be `active` per Product at any time
- Activating a new version automatically archives the previous one
- CostSnapshot must be recalculated whenever any RecipeLine changes

**Events Produced:**
`RecipeCreated`, `RecipeActivated`, `RecipeArchived`, `RecipeCostRecalculated`, `RecipeCloned`

**Policies Consumed:**
`ManufacturingPolicy` (waste tolerance, cost method)

---

### AGG-06: Supplier

**Domain:** Procurement  
**Consistency Scope:** Supplier identity, contacts, and performance are always in sync

**Boundary (owns):**
- SupplierContact(s)
- SupplierPerformanceRecord(s) (derived from POs + GRs)
- SupplierDocument(s) (via EPS-03)

**External References (ID only):**
- Company (owner)
- DeliveryZone (supply coverage, optional)

**Consistency Rules:**
- A Supplier must have at least one active contact
- Supplier code is unique within Company and immutable once set
- A suspended Supplier cannot receive new PurchaseOrders
- Tax registration number (if provided) must be unique within Company

**Events Produced:**
`SupplierCreated`, `SupplierActivated`, `SupplierSuspended`, `SupplierPerformanceUpdated`

**Policies Consumed:**
`ApprovalPolicy` (PO approval thresholds)

---

### AGG-07: PurchaseOrder

**Domain:** Procurement  
**Consistency Scope:** A PO's lines, receipts, and invoices are always consistent

**Boundary (owns):**
- PurchaseOrderLine(s) — 1 to N
- GoodsReceipt(s) — 0 to N (received against this PO)
- SupplierInvoice (optional link)
- MaterialRequest (optional source)

**External References (ID only):**
- Supplier
- Warehouse (delivery destination)
- RawMaterial (per POLine)

**Consistency Rules:**
- Total received quantity per line cannot exceed ordered quantity (unless InventoryPolicy allows over-receipt)
- A GoodsReceipt cannot be posted against a cancelled PO
- A PO transitions to `fully_received` only when all lines reach their ordered quantity
- A PO above the approval threshold requires ApprovalPolicy-governed approval before submission

**Events Produced:**
`POCreated`, `POSubmitted`, `POConfirmed`, `GoodsReceived`, `POPartiallyReceived`, `POFullyReceived`, `POCancelled`

**Policies Consumed:**
`ApprovalPolicy` (PO value thresholds), `InventoryPolicy` (over-receipt rules)

---

### AGG-08: Customer

**Domain:** CRM  
**Consistency Scope:** Customer identity, addresses, and contact info are always consistent

**Boundary (owns):**
- CustomerAddress(es) — 0 to N
- CustomerContact(s) (phones, emails)
- CustomerPreference(s) (notification channels, language)

**External References (ID only):**
- Governorate (per address)
- DeliveryZone (resolved from address)

**Consistency Rules:**
- A Customer must have at least one phone number
- Phone number is unique within Company
- A Customer cannot be deleted if they have active Orders
- Customer merge must transfer all Orders, Addresses, and Timeline to the surviving record
- Default address must exist if a Customer has any addresses

**Events Produced:**
`CustomerCreated`, `CustomerUpdated`, `CustomerAddressAdded`, `CustomerMerged`, `CustomerChurned`, `CustomerReactivated`

**Policies Consumed:**
`CRMPolicy` (loyalty rules, segment definitions)

---

### AGG-09: PreparationWave

**Domain:** Fulfillment  
**Consistency Scope:** Wave contents and preparation state are always consistent

**Boundary (owns):**
- WaveItem(s) — product requirements
- PickList (generated from WaveItems)
- PreparedProductsPool outputs (written to pool on completion)

**External References (ID only):**
- Warehouse
- Order(s) (included in wave)
- Product(s) (via WaveItems)
- Reservation(s) (consumed)

**Consistency Rules:**
- A Wave cannot be started without all required Reservations confirmed
- PreparedQuantity per item cannot exceed ReservedQuantity unless ManufacturingPolicy.allow_overprepare = true
- A Wave cannot be completed if any WaveItem is in `blocked` status
- Completing a Wave writes to PreparedProductsPool; this write is idempotent

**Events Produced:**
`WaveCreated`, `WaveStarted`, `WaveCompleted`, `WaveBlocked`, `WaveCancelled`, `ItemPrepared`, `ItemShort`

**Policies Consumed:**
`ManufacturingPolicy` (overprepare rules), `FulfillmentPolicy` (wave size, SLA)

---

### AGG-10: ShippingWave

**Domain:** Fulfillment  
**Consistency Scope:** Wave allocations, loading sessions, and vehicle assignments are consistent

**Boundary (owns):**
- LoadingSession(s)
- AllocationRecord(s) (which orders are loaded on which vehicle)

**External References (ID only):**
- Warehouse
- Order(s)
- Vehicle(s)
- PreparedProductsPool (consumed from)

**Consistency Rules:**
- Vehicle capacity must not be exceeded (governed by VehiclePolicy)
- All Orders in a wave must have prepared products available in the pool before dispatch
- A ShippingWave cannot be dispatched if any LoadingSession is still open
- Vehicle must be in `available` status to be assigned

**Events Produced:**
`ShippingWaveCreated`, `VehicleAssigned`, `LoadingSessionStarted`, `AllocationCompleted`, `WaveDispatched`, `WaveCancelled`

**Policies Consumed:**
`VehiclePolicy` (capacity, partial loading), `FulfillmentPolicy` (profile stages)

---

### AGG-11: Vehicle

**Domain:** Logistics  
**Consistency Scope:** Vehicle capacity, inventory, and assignment state are consistent

**Boundary (owns):**
- VehicleInventory (current cargo)
- VehicleAssignment history

**External References (ID only):**
- Driver (current)
- ShippingCompany (if contracted)
- Warehouse (home base)

**Consistency Rules:**
- Total loaded weight must not exceed Vehicle.max_weight_kg (VehiclePolicy)
- Total loaded volume must not exceed Vehicle.max_volume_m3 (VehiclePolicy)
- A Vehicle cannot be assigned to a new ShippingWave while status = in_transit
- VehicleInventory is decremented on delivery confirmation; cannot go negative

**Events Produced:**
`VehicleAssigned`, `VehicleLoaded`, `VehicleDispatched`, `VehicleReturned`, `VehicleUnderMaintenance`, `DeliveryConfirmed`

**Policies Consumed:**
`VehiclePolicy` (capacity, partial loading rules)

---

### AGG-12: Shipment

**Domain:** Fulfillment  
**Consistency Scope:** A shipment's cargo, packing state, and delivery state are always consistent

**Boundary (owns):**
- PackingJob(s) (if FulfillmentProfile includes packing)
- Pallet(s)
- DeliveryAttempt(s)

**External References (ID only):**
- Vehicle
- Driver
- Order(s)
- Warehouse (origin)

**Consistency Rules:**
- A Shipment cannot be dispatched before required FulfillmentProfile stages complete
- Partial delivery must be explicitly recorded; remaining items create a new Shipment or return
- Failed delivery must record a reason and trigger a reattempt or return policy

**Events Produced:**
`ShipmentCreated`, `PackingStarted`, `PackingCompleted`, `ShipmentDispatched`, `DeliveryAttempted`, `ShipmentDelivered`, `ShipmentFailed`, `ShipmentReturned`

**Policies Consumed:**
`FulfillmentPolicy` (stages, retry rules), `DeliveryPolicy` (partial delivery rules)

---

### AGG-13: POSSession

**Domain:** Finance  
**Consistency Scope:** Cash balance, sales, and reconciliation are always consistent

**Boundary (owns):**
- POSSale(s)
- POSSaleLine(s) (via POSSale)
- CashMovement(s)

**External References (ID only):**
- Warehouse
- Employee (cashier)

**Consistency Rules:**
- Session closing balance must equal: opening float + sales cash − refunds − expenses
- A Session cannot have two open sessions for the same Warehouse at the same time (one active session per register per warehouse)
- A Sale cannot be completed without sufficient stock (Inventory check via reservation)
- Void requires a reason and manager approval (ApprovalPolicy)

**Events Produced:**
`SessionOpened`, `SaleCompleted`, `SaleRefunded`, `SaleVoided`, `CashMovementRecorded`, `SessionClosed`, `SessionReconciled`

**Policies Consumed:**
`ApprovalPolicy` (void approval), `InventoryPolicy` (stock deduction on sale)

---

### AGG-14: Invoice

**Domain:** Finance  
**Consistency Scope:** Invoice totals, line items, and payment status are consistent

**Boundary (owns):**
- InvoiceLine(s)
- Payment(s)

**External References (ID only):**
- Order(s)
- Customer

**Consistency Rules:**
- Invoice total = sum of InvoiceLines
- Paid amount cannot exceed Invoice total
- An Invoice moves to `paid` only when sum(Payments) >= Invoice total
- A cancelled Invoice must reverse all associated Payments
- Invoice number is immutable once issued

**Events Produced:**
`InvoiceCreated`, `InvoiceIssued`, `PaymentReceived`, `InvoicePartiallyPaid`, `InvoicePaid`, `InvoiceOverdue`, `InvoiceCancelled`, `RefundIssued`

**Policies Consumed:**
`ApprovalPolicy` (discount approval above threshold)

---

### AGG-15: Campaign

**Domain:** CRM  
**Consistency Scope:** Campaign targeting, leads, and performance are consistent

**Boundary (owns):**
- Lead(s)
- Opportunity(s)
- CampaignAnalytics (derived)

**External References (ID only):**
- Customer Segment (reference)
- Channel (optional — channel-specific campaign)

**Consistency Rules:**
- A Campaign cannot be launched without a defined audience segment
- Start date must be before end date
- A Lead must belong to at most one active Campaign

**Events Produced:**
`CampaignCreated`, `CampaignScheduled`, `CampaignLaunched`, `LeadCreated`, `LeadConverted`, `CampaignCompleted`, `CampaignCancelled`

**Policies Consumed:**
`MarketingPolicy` (send rate limits, channel restrictions), `CRMPolicy` (segment rules)

---

### AGG-16: MarketingAccount

**Domain:** Marketing  
**Status:** RESERVED — Architecture Only (implements in TASK-MARKETING-001)  
**Consistency Scope:** Marketing platform account credentials, tokens, and assets are consistent

**Boundary (owns):**
- MarketingAsset(s) — Facebook Pages, Ad Accounts, Pixels, Catalogs, etc.
- OAuth tokens (encrypted)
- API credentials (encrypted)
- Sync settings
- Webhook configuration

**External References (ID only):**
- Company (for isolation)
- Brand (direct ownership — Marketing Account belongs to Brand)

**Consistency Rules:**
- A MarketingAccount belongs to exactly one Brand
- `marketing_account.company_id` must always equal `brand.company_id`
- An `asset_type` must be valid for the account's `provider` enum value
- Marketing Assets never create Orders; attribution is via UTM metadata on Orders only

**Events Produced (reserved):**
`MarketingAccountCreated`, `MarketingAccountSuspended`, `MarketingAccountTokenRefreshed`, `MarketingAccountDisconnected`, `MarketingAssetCreated`, `MarketingAssetSynced`, `MarketingAssetErrored`

**Policies Consumed:**
`FeatureFlag` (marketing module enabled), `SecurityPolicy` (credential encryption requirements)
