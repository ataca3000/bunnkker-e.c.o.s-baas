# Entity Catalog

**Document:** ENTITY-CATALOG  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DOMAIN-ARCH-001  
**Parent:** ENTERPRISE-DOMAIN-MODEL.md

---

## Reading Guide

Each entity entry follows this structure:

```
### [Entity Name]
- **Business Purpose:** Why this entity exists
- **Domain:** Which domain owns it
- **Aggregate:** Which aggregate root it belongs to
- **Business Identity:** How it is uniquely identified in business terms
- **Natural Keys:** Business-meaningful unique identifiers
- **Status Model:** Lifecycle states (brief; full state machines in LIFECYCLE-MODELS.md)
- **Key Relationships:** (→ = reference; ∈ = owned by; ↦ = produces)
```

---

## 1. Organization Domain

### Company
- **Business Purpose:** The top-level legal business entity that owns all ECOS data.
- **Domain:** Organization
- **Aggregate:** Company (root)
- **Business Identity:** Legal trade name + registration number
- **Natural Keys:** `company_code`, `tax_registration_number`
- **Status Model:** active | suspended | inactive
- **Key Relationships:** Owns all Branches, Warehouses, Channels, Policies, Employees

### Branch
- **Business Purpose:** A physical or logical operating location of a Company.
- **Domain:** Organization
- **Aggregate:** Company
- **Business Identity:** Branch name within its Company
- **Natural Keys:** `branch_code` (unique within Company)
- **Status Model:** active | inactive
- **Key Relationships:** ∈ Company; contains Warehouses

### Warehouse
- **Business Purpose:** A physical location where inventory is stored and operations are performed.
- **Domain:** Organization
- **Aggregate:** Company
- **Business Identity:** Warehouse name + address
- **Natural Keys:** `warehouse_code` (unique within Company)
- **Status Model:** active | inactive | under_maintenance
- **Key Relationships:** ∈ Company (via Branch or direct); owns InventoryItems; is home to PreparationWaves

### Channel
- **Business Purpose:** A sales or distribution channel through which orders arrive and are fulfilled (WooCommerce, Shopify, POS, Direct, etc.).
- **Domain:** Organization
- **Aggregate:** Company
- **Business Identity:** Channel name + type within its Company
- **Natural Keys:** `channel_code` (unique within Company)
- **Status Model:** active | paused | inactive
- **Key Relationships:** ∈ Company; referenced by Orders, Products (pricing), FulfillmentProfiles

---

## 2. Commerce Domain

### Order
- **Business Purpose:** A confirmed customer request to purchase one or more products, constituting a binding commercial transaction.
- **Domain:** Commerce
- **Aggregate:** Order (root)
- **Business Identity:** Auto-generated order number
- **Natural Keys:** `order_number` (globally unique within Company)
- **Status Model:** draft → confirmed → reserved → in_preparation → ready → dispatched → delivered | cancelled | on_hold
- **Key Relationships:** → Customer (ID ref); → Channel (ID ref); → Warehouse (ID ref); owns OrderLines; ↦ OrderCreated, OrderConfirmed, OrderCancelled, OrderDelivered

### OrderLine
- **Business Purpose:** A single product-quantity pair within an Order.
- **Domain:** Commerce
- **Aggregate:** Order
- **Business Identity:** Position number within its Order
- **Natural Keys:** None (position within Order)
- **Status Model:** inherits Order status
- **Key Relationships:** ∈ Order; → Product (ID ref); has Reservation (ID ref)

### SalesChannel
- **Business Purpose:** The external integration connector (e.g. WooCommerce store) that feeds Orders into ECOS.
- **Domain:** Commerce
- **Aggregate:** Company (via Channel)
- **Business Identity:** External platform + store identifier
- **Natural Keys:** `external_platform_id` (unique per Channel)
- **Status Model:** connected | disconnected | sync_error
- **Key Relationships:** ∈ Channel; maps external_order_id → Order

---

## 3. Inventory Domain

### Product
- **Business Purpose:** A finished good that can be sold, reserved, and fulfilled.
- **Domain:** Inventory
- **Aggregate:** Product (root)
- **Business Identity:** Product name + SKU
- **Natural Keys:** `sku` (unique within Company)
- **Status Model:** draft → active → pending_review | inactive | discontinued
- **Key Relationships:** → ProductCategory; → Recipe (optional, for manufactured products); owns ProductPrices per Channel; owns ProductChannelConfig; ↦ ProductCreated, ProductActivated, ProductPriceChanged

### ProductCategory
- **Business Purpose:** A hierarchical classification of Products for organization, reporting, and pricing rules.
- **Domain:** Inventory
- **Aggregate:** Product
- **Business Identity:** Category name path
- **Natural Keys:** `category_code` (unique within Company + scope=product)
- **Status Model:** active | inactive
- **Key Relationships:** ∈ Company; may have parent ProductCategory; referenced by Products

### RawMaterial
- **Business Purpose:** An ingredient or component used in manufacturing recipes.
- **Domain:** Inventory
- **Aggregate:** RawMaterial (root)
- **Business Identity:** Material name + internal code
- **Natural Keys:** `material_code` (unique within Company)
- **Status Model:** active | out_of_stock | discontinued
- **Key Relationships:** → MaterialCategory; → Unit; owns ReceiptLayers; owns Reservations; ↦ StockAdded, StockReserved, StockConsumed, LowStockAlert

### MaterialCategory
- **Business Purpose:** A classification of RawMaterials (raw, packaging, etc.).
- **Domain:** Inventory
- **Aggregate:** RawMaterial
- **Business Identity:** Category name
- **Natural Keys:** `category_code` (unique within Company + scope=material)
- **Status Model:** active | inactive
- **Key Relationships:** ∈ Company; referenced by RawMaterials

### InventoryItem
- **Business Purpose:** The current stock state of a specific Product or RawMaterial in a specific Warehouse.
- **Domain:** Inventory
- **Aggregate:** Product (for finished goods) or RawMaterial (for materials)
- **Business Identity:** (entity_type, entity_id, warehouse_id)
- **Natural Keys:** Composite (entity_type + entity_id + warehouse_id) — unique
- **Status Model:** in_stock | low_stock | out_of_stock | unavailable
- **Key Relationships:** ∈ Product or RawMaterial; ∈ Warehouse

### ReceiptLayer
- **Business Purpose:** A FIFO cost layer representing a specific goods receipt at a specific unit cost. Enables accurate COGS calculation.
- **Domain:** Inventory
- **Aggregate:** RawMaterial
- **Business Identity:** Goods receipt reference + receipt date
- **Natural Keys:** `layer_id` (system-generated)
- **Status Model:** open | partially_consumed | fully_consumed
- **Key Relationships:** ∈ RawMaterial; → GoodsReceipt (ID ref); immutable once created

### Reservation
- **Business Purpose:** A promise that a specific quantity of a Product or RawMaterial is held for a specific purpose (Order or ProductionJob).
- **Domain:** Inventory
- **Aggregate:** RawMaterial (for materials) or Product (for products)
- **Business Identity:** (reservable_entity, entity_id, purpose_type, purpose_id)
- **Natural Keys:** Composite
- **Status Model:** pending → confirmed → consumed | cancelled | expired
- **Key Relationships:** ∈ RawMaterial or Product; → Order or ProductionJob (purpose ref); ↦ ReservationCreated, ReservationConsumed, ReservationCancelled

### StockMovement
- **Business Purpose:** An immutable record of every change to inventory quantity (in or out, with reason and reference).
- **Domain:** Inventory
- **Aggregate:** RawMaterial or Product
- **Business Identity:** Movement timestamp + reference
- **Natural Keys:** `movement_id` (system-generated, immutable)
- **Status Model:** Immutable (no lifecycle)
- **Key Relationships:** ∈ RawMaterial or Product; → GoodsReceipt, Order, ProductionJob (reference)

### Unit
- **Business Purpose:** A unit of measure (kg, litre, piece, box, etc.).
- **Domain:** Inventory
- **Aggregate:** Company
- **Business Identity:** Unit abbreviation
- **Natural Keys:** `unit_code` (unique within Company)
- **Status Model:** active | inactive
- **Key Relationships:** ∈ Company; referenced by RawMaterial, RecipeLine

---

## 4. Manufacturing Domain

### Recipe
- **Business Purpose:** A Bill of Materials defining the ingredients, quantities, and instructions required to produce one unit of a Product.
- **Domain:** Manufacturing
- **Aggregate:** Recipe (root)
- **Business Identity:** Recipe name + target Product
- **Natural Keys:** `recipe_code` (unique within Company); link (product_id, version) is unique
- **Status Model:** draft → active → archived
- **Key Relationships:** → Product (target); owns RecipeLines; owns ExecutionInstructions; ↦ RecipeActivated, RecipeCostRecalculated

### RecipeLine
- **Business Purpose:** A single ingredient entry in a Recipe specifying material, quantity, and waste percentage.
- **Domain:** Manufacturing
- **Aggregate:** Recipe
- **Business Identity:** Position within Recipe
- **Natural Keys:** None (position within Recipe)
- **Status Model:** inherits Recipe status
- **Key Relationships:** ∈ Recipe; → RawMaterial (ID ref); → Unit (ID ref)

### ProductionJob
- **Business Purpose:** An instruction to manufacture a specific quantity of a Product using a specific Recipe.
- **Domain:** Manufacturing
- **Aggregate:** ProductionJob (root — future; currently part of PreparationWave scope)
- **Business Identity:** Job number
- **Natural Keys:** `job_number` (unique within Company)
- **Status Model:** planned → in_progress → completed | cancelled
- **Key Relationships:** → Recipe; → Product; → Warehouse; owns MaterialReservations; ↦ ProductionStarted, ProductionCompleted

---

## 5. Procurement Domain

### Supplier
- **Business Purpose:** An external company that provides raw materials or services to the business.
- **Domain:** Procurement
- **Aggregate:** Supplier (root)
- **Business Identity:** Supplier trade name + tax registration
- **Natural Keys:** `supplier_code` (unique within Company)
- **Status Model:** active | under_review | suspended | inactive
- **Key Relationships:** owns SupplierContacts, SupplierDocuments; referenced by PurchaseOrders; ↦ SupplierActivated, SupplierSuspended

### SupplierContact
- **Business Purpose:** A named person at a Supplier who can be contacted.
- **Domain:** Procurement
- **Aggregate:** Supplier
- **Business Identity:** Name + role at Supplier
- **Natural Keys:** None (owned by Supplier)
- **Status Model:** active | inactive
- **Key Relationships:** ∈ Supplier

### PurchaseOrder
- **Business Purpose:** A formal commercial document sent to a Supplier authorizing the purchase of goods at agreed prices.
- **Domain:** Procurement
- **Aggregate:** PurchaseOrder (root)
- **Business Identity:** PO number
- **Natural Keys:** `po_number` (unique within Company)
- **Status Model:** draft → submitted → confirmed → partially_received → fully_received | cancelled
- **Key Relationships:** → Supplier; → Warehouse (delivery to); owns PurchaseOrderLines; owns GoodsReceipts; → SupplierInvoice; ↦ POCreated, POConfirmed, POFullyReceived

### PurchaseOrderLine
- **Business Purpose:** A single material-quantity-price entry in a PurchaseOrder.
- **Domain:** Procurement
- **Aggregate:** PurchaseOrder
- **Business Identity:** Position within PO
- **Natural Keys:** None (position within PO)
- **Status Model:** open | partially_received | fully_received | cancelled
- **Key Relationships:** ∈ PurchaseOrder; → RawMaterial; → Unit

### GoodsReceipt
- **Business Purpose:** A record of physical goods arriving at a Warehouse against a PurchaseOrder (or a direct receipt).
- **Domain:** Procurement
- **Aggregate:** PurchaseOrder (or standalone for direct receipts)
- **Business Identity:** GR number
- **Natural Keys:** `gr_number` (unique within Company)
- **Status Model:** draft → confirmed → posted | reversed
- **Key Relationships:** → PurchaseOrder (optional); → Warehouse; owns GoodsReceiptLines; ↦ GoodsReceived, StockAdded (on post)

### GoodsReceiptLine
- **Business Purpose:** A single material-quantity entry in a GoodsReceipt.
- **Domain:** Procurement
- **Aggregate:** PurchaseOrder (via GoodsReceipt)
- **Business Identity:** Position within GR
- **Natural Keys:** None
- **Status Model:** inherits GoodsReceipt
- **Key Relationships:** ∈ GoodsReceipt; → RawMaterial; → Unit; creates ReceiptLayer on post

### MaterialRequest
- **Business Purpose:** An internal request to procure raw materials before a formal PO is created.
- **Domain:** Procurement
- **Aggregate:** PurchaseOrder (created after approval)
- **Business Identity:** Request number
- **Natural Keys:** `mr_number` (unique within Company)
- **Status Model:** draft → submitted → approved → converted | rejected | cancelled
- **Key Relationships:** → RawMaterial; → Warehouse; may spawn PurchaseOrder; ↦ MaterialRequested, MaterialRequestApproved

### SupplierInvoice
- **Business Purpose:** A financial document from a Supplier claiming payment for delivered goods.
- **Domain:** Procurement
- **Aggregate:** PurchaseOrder (linked) or standalone (ADR-011 Mode 3)
- **Business Identity:** Supplier invoice number + date
- **Natural Keys:** `supplier_invoice_number` (unique per Supplier)
- **Status Model:** draft → posted → paid | disputed
- **Key Relationships:** → Supplier; → PurchaseOrder (optional); → GoodsReceipt (optional); → Invoice (finance); ↦ SupplierInvoicePosted

### SupplierReturn
- **Business Purpose:** A reversal of a GoodsReceipt when materials are returned to a Supplier due to quality or quantity issues.
- **Domain:** Procurement
- **Aggregate:** PurchaseOrder
- **Business Identity:** Return number
- **Natural Keys:** `return_number` (unique within Company)
- **Status Model:** draft → submitted → confirmed → dispatched | cancelled
- **Key Relationships:** → Supplier; → GoodsReceipt; → Warehouse; ↦ ReturnCreated, ReturnDispatched

---

## 6. Fulfillment Domain

### PreparationWave
- **Business Purpose:** A batch of Orders grouped together for simultaneous preparation in the warehouse, constituting the primary operational unit of the Preparation OS.
- **Domain:** Fulfillment
- **Aggregate:** PreparationWave (root)
- **Business Identity:** Wave number
- **Natural Keys:** `wave_number` (unique within Company + date)
- **Status Model:** draft → planned → in_progress → completed | blocked | cancelled
- **Key Relationships:** → Warehouse; aggregates Orders (ID refs); owns WaveItems; owns PickList; writes to PreparedProductsPool; ↦ WaveStarted, WaveCompleted, WaveBlocked

### WaveItem
- **Business Purpose:** A single product-quantity requirement within a PreparationWave.
- **Domain:** Fulfillment
- **Aggregate:** PreparationWave
- **Business Identity:** Position within Wave
- **Natural Keys:** None
- **Status Model:** pending → in_progress → prepared | short | blocked
- **Key Relationships:** ∈ PreparationWave; → Product or RawMaterial; → Reservation

### PreparedProductsPool
- **Business Purpose:** A holding area of prepared products that are ready to be loaded onto vehicles but have not yet been assigned to a ShippingWave.
- **Domain:** Fulfillment
- **Aggregate:** PreparationWave (output pool)
- **Business Identity:** (product_id, warehouse_id, source_wave_id)
- **Natural Keys:** Composite
- **Status Model:** available → allocated | consumed | expired
- **Key Relationships:** ∈ PreparationWave (source); → Product; → ShippingWave (allocated to)

### ShippingWave
- **Business Purpose:** A batch of prepared orders grouped for dispatch in the same loading session, constituting the primary operational unit of the Loading OS.
- **Domain:** Fulfillment
- **Aggregate:** ShippingWave (root)
- **Business Identity:** Wave number
- **Natural Keys:** `shipping_wave_number` (unique within Company + date)
- **Status Model:** draft → planned → loading → loaded | dispatched | cancelled
- **Key Relationships:** → Warehouse; aggregates Orders (ID refs); owns LoadingSessions; → Vehicle (assigned); ↦ ShippingWaveCreated, AllocationCompleted, WaveDispatched

### LoadingSession
- **Business Purpose:** The physical act of loading prepared products from the PreparedProductsPool onto a specific Vehicle for a ShippingWave.
- **Domain:** Fulfillment
- **Aggregate:** ShippingWave
- **Business Identity:** Session number
- **Natural Keys:** `session_number` (unique within Company)
- **Status Model:** open → in_progress → completed | closed
- **Key Relationships:** ∈ ShippingWave; → Vehicle; → Warehouse; records LoadingEvents; ↦ LoadingSessionStarted, LoadingSessionClosed

### PackingJob
- **Business Purpose:** A task to pack products into pallets or boxes for a specific Order or batch before dispatch (applicable when FulfillmentProfile includes packing).
- **Domain:** Fulfillment
- **Aggregate:** Shipment
- **Business Identity:** Job number
- **Natural Keys:** `packing_job_number` (unique within Company)
- **Status Model:** pending → in_progress → completed
- **Key Relationships:** ∈ Shipment; → Order(s); → Pallet(s); ↦ PackingStarted, PackingCompleted

### Pallet
- **Business Purpose:** A physical unit of packaging containing one or more packed items.
- **Domain:** Fulfillment
- **Aggregate:** Shipment
- **Business Identity:** Pallet barcode / serial
- **Natural Keys:** `pallet_code` (unique)
- **Status Model:** packing → sealed → loaded | delivered | returned
- **Key Relationships:** ∈ Shipment (via PackingJob); → Vehicle (loaded onto)

### Shipment
- **Business Purpose:** The physical movement of goods from a Warehouse to a Customer, representing the Logistics OS unit.
- **Domain:** Fulfillment
- **Aggregate:** Shipment (root)
- **Business Identity:** Shipment number
- **Natural Keys:** `shipment_number` (unique within Company)
- **Status Model:** created → dispatched → in_transit → delivered | failed | partial_delivery | returned
- **Key Relationships:** → Vehicle; → Driver; → Order(s); → Warehouse (origin); → Customer (destination); owns PackingJobs; ↦ ShipmentDispatched, ShipmentDelivered, ShipmentFailed

---

## 7. Logistics Domain

### Vehicle
- **Business Purpose:** A company-owned or contracted transport unit used to deliver goods to customers.
- **Domain:** Logistics
- **Aggregate:** Vehicle (root)
- **Business Identity:** Plate number + company registration
- **Natural Keys:** `plate_number` (unique within Company)
- **Status Model:** available | assigned | in_transit | under_maintenance | inactive
- **Key Relationships:** → ShippingCompany (if contracted); → Driver (current assignment); owns VehicleInventory; ↦ VehicleAssigned, VehicleLoaded, VehicleReturned

### VehicleInventory
- **Business Purpose:** The real-time record of products currently loaded on a specific Vehicle.
- **Domain:** Logistics
- **Aggregate:** Vehicle
- **Business Identity:** (vehicle_id, product_id, order_id)
- **Natural Keys:** Composite
- **Status Model:** loaded → delivered | returned | damaged
- **Key Relationships:** ∈ Vehicle; → Product; → Order

### Driver
- **Business Purpose:** A person authorized to operate a Vehicle and complete deliveries.
- **Domain:** Logistics
- **Aggregate:** Vehicle (for assignment) / Employee (for HR)
- **Business Identity:** Employee ID + driver license
- **Natural Keys:** `driver_license_number` (unique)
- **Status Model:** available | assigned | off_duty | suspended
- **Key Relationships:** ∈ Employee; assigned to Vehicle; ↦ DriverAssigned, DriverDeassigned

### ShippingCompany
- **Business Purpose:** A third-party logistics provider used when ECOS does not have its own vehicles.
- **Domain:** Logistics
- **Aggregate:** Company (reference entity)
- **Business Identity:** Company name + registration
- **Natural Keys:** `shipping_company_code` (unique within Company)
- **Status Model:** active | inactive
- **Key Relationships:** → Vehicle(s) (if owned); referenced by Shipment

### DeliveryZone
- **Business Purpose:** A named geographic area used for route planning, fulfillment profiles, and coverage analysis.
- **Domain:** Logistics
- **Aggregate:** Company
- **Business Identity:** Zone name + polygon or governorate list
- **Natural Keys:** `zone_code` (unique within Company)
- **Status Model:** active | inactive
- **Key Relationships:** ∈ Company; contains Governorates; referenced by FulfillmentProfile, GeographyEngine

### Governorate
- **Business Purpose:** An Egyptian administrative region (محافظة). Used for delivery zone assignment and geographic coverage.
- **Domain:** Logistics
- **Aggregate:** Platform (global reference data)
- **Business Identity:** Official governorate name (Arabic + English)
- **Natural Keys:** `governorate_code` (ISO/official)
- **Status Model:** (static reference data; no lifecycle)
- **Key Relationships:** belongs to DeliveryZone; referenced by CustomerAddress

### Route
- **Business Purpose:** A planned sequence of stops for a Vehicle to deliver orders to customers.
- **Domain:** Logistics
- **Aggregate:** ShippingWave (operational route) or Vehicle (planned route)
- **Business Identity:** Route code + date
- **Natural Keys:** `route_code` (unique per Shipping Wave)
- **Status Model:** planned → active → completed
- **Key Relationships:** → Vehicle; → Driver; sequence of Shipments

---

## 8. CRM Domain

### Customer
- **Business Purpose:** A business or individual who purchases from the company.
- **Domain:** CRM
- **Aggregate:** Customer (root)
- **Business Identity:** Customer name + phone (primary contact)
- **Natural Keys:** `customer_code` (unique within Company); `phone_number` (unique within Company)
- **Status Model:** lead → active → at_risk | inactive | churned
- **Key Relationships:** owns CustomerAddresses; owns CustomerContacts; referenced by Orders; ↦ CustomerCreated, CustomerMerged, CustomerChurned

### CustomerAddress
- **Business Purpose:** A physical delivery location for a Customer.
- **Domain:** CRM
- **Aggregate:** Customer
- **Business Identity:** Address label (Home, Work, etc.)
- **Natural Keys:** None (owned by Customer)
- **Status Model:** active | inactive
- **Key Relationships:** ∈ Customer; → Governorate; → DeliveryZone (resolved)

### Campaign
- **Business Purpose:** A marketing initiative targeting a customer segment.
- **Domain:** CRM
- **Aggregate:** Campaign (root)
- **Business Identity:** Campaign name + date range
- **Natural Keys:** `campaign_code` (unique within Company)
- **Status Model:** draft → scheduled → active → completed | cancelled
- **Key Relationships:** → Customer Segment; owns Leads; ↦ CampaignLaunched, CampaignCompleted

### Lead
- **Business Purpose:** A potential customer who has shown interest but has not yet made a purchase.
- **Domain:** CRM
- **Aggregate:** Campaign or standalone
- **Business Identity:** Contact information
- **Natural Keys:** `lead_code` (unique within Company)
- **Status Model:** new → contacted → qualified → converted | disqualified
- **Key Relationships:** may convert to Customer; ∈ Campaign (optional)

### Opportunity
- **Business Purpose:** A qualified sales opportunity with a specific product/value in mind.
- **Domain:** CRM
- **Aggregate:** Campaign
- **Business Identity:** Opportunity name + customer
- **Natural Keys:** `opportunity_code`
- **Status Model:** open → negotiating → won | lost
- **Key Relationships:** → Customer or Lead; → Product(s); ∈ Campaign

---

## 9. Finance Domain

### Invoice
- **Business Purpose:** A financial document issued to a Customer requesting payment for delivered goods or services.
- **Domain:** Finance
- **Aggregate:** Invoice (root)
- **Business Identity:** Invoice number + date
- **Natural Keys:** `invoice_number` (unique within Company + fiscal year)
- **Status Model:** draft → issued → partially_paid → paid | overdue | cancelled | refunded
- **Key Relationships:** → Order(s); → Customer; owns InvoiceLines; owns Payments; ↦ InvoiceIssued, PaymentReceived, InvoiceOverdue

### InvoiceLine
- **Business Purpose:** A single line item on an Invoice.
- **Domain:** Finance
- **Aggregate:** Invoice
- **Business Identity:** Position within Invoice
- **Natural Keys:** None
- **Status Model:** inherits Invoice
- **Key Relationships:** ∈ Invoice; → Product or OrderLine

### Payment
- **Business Purpose:** A record of a financial transfer received from a Customer or made to a Supplier.
- **Domain:** Finance
- **Aggregate:** Invoice (for customer payments) or SupplierInvoice (for supplier payments)
- **Business Identity:** Payment reference + date
- **Natural Keys:** `payment_reference` (unique per method)
- **Status Model:** pending → confirmed → settled | reversed
- **Key Relationships:** ∈ Invoice or SupplierInvoice; → PaymentMethod; ↦ PaymentReceived, PaymentReversed

### POSSession
- **Business Purpose:** A single POS operating session, opening with a cash float and closing with a cash reconciliation.
- **Domain:** Finance
- **Aggregate:** POSSession (root)
- **Business Identity:** Session number + date + cashier
- **Natural Keys:** `session_number` (unique per Warehouse per day)
- **Status Model:** open → closed | suspended
- **Key Relationships:** → Warehouse; → Employee (cashier); owns POSSales; owns CashMovements; ↦ SessionOpened, SessionClosed

### POSSale
- **Business Purpose:** A completed retail sale transaction within a POSSession.
- **Domain:** Finance
- **Aggregate:** POSSession
- **Business Identity:** Sale receipt number
- **Natural Keys:** `receipt_number` (unique within Session)
- **Status Model:** pending → completed | voided | refunded
- **Key Relationships:** ∈ POSSession; → Customer (optional); owns POSSaleLines; creates Order + Invoice; ↦ SaleCompleted, SaleRefunded

### POSSaleLine
- **Business Purpose:** A single product-quantity line within a POSSale.
- **Domain:** Finance
- **Aggregate:** POSSession (via POSSale)
- **Business Identity:** Position within Sale
- **Natural Keys:** None
- **Status Model:** inherits POSSale
- **Key Relationships:** ∈ POSSale; → Product

### CashMovement
- **Business Purpose:** A record of cash in or out during a POSSession (opening float, sale, expense, closing reconciliation).
- **Domain:** Finance
- **Aggregate:** POSSession
- **Business Identity:** Movement timestamp + type
- **Natural Keys:** None (owned by Session)
- **Status Model:** Immutable
- **Key Relationships:** ∈ POSSession

---

## 10. Platform Domain

### Employee
- **Business Purpose:** A person employed by the Company who uses or is referenced by ECOS.
- **Domain:** Platform
- **Aggregate:** Company
- **Business Identity:** Employee ID + full name
- **Natural Keys:** `employee_code` (unique within Company)
- **Status Model:** active | on_leave | inactive | terminated
- **Key Relationships:** ∈ Company; may be Driver; has User account; ↦ EmployeeActivated, EmployeeDeactivated

### User
- **Business Purpose:** A system account that can log in and perform actions in ECOS.
- **Domain:** Platform
- **Aggregate:** Company
- **Business Identity:** Email address
- **Natural Keys:** `email` (unique globally)
- **Status Model:** active | suspended | inactive
- **Key Relationships:** ∈ Employee (usually); has Roles and Permissions

### Notification
- **Business Purpose:** A message delivered to a User or external contact triggered by a business event.
- **Domain:** Platform (EPS-04)
- **Aggregate:** EPS Platform
- **Business Identity:** Notification ID
- **Natural Keys:** System-generated UUID
- **Status Model:** pending → delivered | failed | expired
- **Key Relationships:** → recipient (User or external); → source BusinessEvent; ↦ NotificationSent, NotificationFailed

### Document
- **Business Purpose:** A file attached to a business object (PDF, image, certificate, etc.).
- **Domain:** Platform (EPS-03)
- **Aggregate:** EPS Platform (polymorphic, attached to any aggregate)
- **Business Identity:** Display name + parent object
- **Natural Keys:** System-generated UUID
- **Status Model:** uploading → scanning → clean | quarantined | archived
- **Key Relationships:** → any Aggregate (polymorphic relationship); ↦ DocumentAttached, DocumentQuarantined

### TimelineEntry
- **Business Purpose:** An immutable record of a specific event or action in the history of a business object.
- **Domain:** Platform (EPS-02)
- **Aggregate:** EPS Platform (immutable)
- **Business Identity:** (object_type, object_id, occurred_at)
- **Natural Keys:** System-generated UUID
- **Status Model:** Immutable (no lifecycle)
- **Key Relationships:** → any Aggregate (polymorphic)

### AIRecommendation
- **Business Purpose:** A machine-generated suggestion, prediction, or risk flag for a specific business object.
- **Domain:** Platform (AI)
- **Aggregate:** EPS Platform
- **Business Identity:** (object_type, object_id, model, generated_at)
- **Natural Keys:** System-generated UUID
- **Status Model:** active → acted_upon | dismissed | expired
- **Key Relationships:** → any Aggregate; → AIPolicy; → User (actor if acted/dismissed)

### FulfillmentProfile
- **Business Purpose:** A named configuration of fulfillment behavior specifying which stages (preparation, packing, logistics) apply for a given Channel + delivery zone combination.
- **Domain:** Fulfillment (Configuration)
- **Aggregate:** Company (via Configuration Platform)
- **Business Identity:** Profile name
- **Natural Keys:** `profile_code` (unique within Company)
- **Status Model:** draft → active | inactive
- **Key Relationships:** ∈ Channel; → DeliveryZone(s); governs ShippingWave fulfillment stages
