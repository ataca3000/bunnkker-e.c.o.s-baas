# Bounded Context Map

**Document:** BOUNDARY-CONTEXT-MAP  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONTRACT-ARCH-001  
**Parent:** ENTERPRISE-CONTRACTS.md

---

## 1. What Is a Bounded Context?

A bounded context is a defined boundary within which a specific domain model applies. Inside the boundary, terms, entities, and rules have a single, unambiguous meaning. Outside the boundary, the same term may mean something different.

In ECOS, bounded contexts correspond directly to domain modules. The relationship between contexts is defined in this map.

---

## 2. Bounded Context Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ECOS BOUNDED CONTEXT MAP                         │
│                                                                             │
│   ┌──────────────┐    events    ┌───────────────┐   events  ┌──────────┐  │
│   │  Commerce    │ ──────────→  │  Fulfillment  │ ────────→ │Logistics │  │
│   │  (Orders)    │              │ (Prep+Loading)│           │(Vehicles)│  │
│   └──────┬───────┘              └───────┬───────┘           └────┬─────┘  │
│          │ events                       │ events                 │ events  │
│          ↓                              ↓                         ↓        │
│   ┌──────────────┐              ┌───────────────┐   events  ┌──────────┐  │
│   │    CRM       │              │  Inventory    │ ←──────── │  Procure │  │
│   │ (Customers)  │              │  (Stock/Cost) │           │ment      │  │
│   └──────────────┘              └───────┬───────┘           └──────────┘  │
│                                         │ events                           │
│                                         ↓                                  │
│   ┌──────────────┐              ┌───────────────┐           ┌──────────┐  │
│   │  Finance     │ ←events───── │Manufacturing  │           │  Config  │  │
│   │ (Invoices)   │              │  (Recipes)    │           │ Platform │  │
│   └──────────────┘              └───────────────┘           └──────────┘  │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐ │
│   │           ENTERPRISE PLATFORM SERVICES (Shared Kernel)              │ │
│   │    EPS-01 Events │ EPS-02 Timeline │ EPS-03 Docs │ EPS-04 Notify   │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Context Definitions

### CTX-01: Commerce
```
Owned Aggregates:   Order, OrderLine, Channel
Canonical Concepts: Order, OrderLine, Channel, Sale
Published Contracts:
  Events:   orders.order.confirmed, orders.order.cancelled, orders.order.in_preparation,
            orders.order.ready, orders.order.dispatched, orders.order.delivered,
            orders.order.delivery_failed, orders.order.on_hold
  Queries:  OrderListQuery, OrderDetailQuery, OrderTimelineQuery
Consumed Contracts:
  Events:   fulfillment.preparation_wave.started (→ in_preparation),
            fulfillment.preparation_wave.completed (→ ready),
            fulfillment.shipment.dispatched (→ dispatched),
            fulfillment.shipment.delivered (→ delivered)
  Queries:  CustomerSummaryQuery (from CRM), InventoryAvailabilityQuery (from Inventory)
Upstream:  Customer Identity (CRM), Product Catalog (Inventory), Channel Config (Config)
Downstream: Fulfillment, Finance, CRM (all consume order events)
Language:  "Order" means a commercial transaction. An Order has a Channel and a Customer.
Note:      Commerce does not know how items are physically prepared or shipped.
           It only receives events and updates order status.
```

### CTX-02: Inventory
```
Owned Aggregates:   Product, RawMaterial, ReceiptLayer, Reservation, StockMovement
Canonical Concepts: Stock, Availability, Reservation, Receipt Layer, FIFO Cost
Published Contracts:
  Events:   inventory.raw_material.stock_added, inventory.raw_material.stock_reserved,
            inventory.raw_material.reservation_cancelled, inventory.raw_material.stock_consumed,
            inventory.raw_material.stock_adjusted, inventory.cost_layer.consumed
  Queries:  InventoryAvailabilityQuery, StockLedgerQuery, BulkInventoryAvailabilityQuery
Consumed Contracts:
  Events:   orders.order.confirmed (→ ReserveInventory),
            orders.order.cancelled (→ ReleaseReservation),
            fulfillment.preparation_wave.completed (→ ConsumeReservation),
            procurement.goods_receipt.posted (→ stock_added)
Upstream:  Commerce (order demand), Procurement (stock replenishment)
Downstream: Fulfillment (availability), Manufacturing (material availability), Finance (COGS)
Language:  "Product" in Inventory means a finished good with stock.
           "RawMaterial" is a manufacturing input with FIFO receipt layers.
           "Available" = on_hand - reserved.
Note:      Inventory never knows about orders or customers. It only knows about stock.
```

### CTX-03: Fulfillment
```
Owned Aggregates:   PreparationWave, ShippingWave, PreparedProductsPool, AllocationRecord
Canonical Concepts: Wave, Preparation, Pool, Loading, Allocation, FulfillmentProfile
Published Contracts:
  Events:   fulfillment.preparation_wave.created, fulfillment.preparation_wave.started,
            fulfillment.preparation_wave.completed, fulfillment.prepared_pool.added,
            fulfillment.shipping_wave.vehicle_assigned, fulfillment.shipping_wave.allocation_completed,
            fulfillment.shipment.dispatched, fulfillment.shipment.delivered, fulfillment.shipment.failed
  Queries:  PreparationDashboardQuery, WaveSummaryQuery, PreparedProductsPoolQuery
Consumed Contracts:
  Events:   orders.order.confirmed (→ eligible for wave inclusion),
            orders.order.ready (→ eligible for shipping wave),
            inventory.raw_material.stock_reserved (→ wave start pre-check)
  Commands: ReserveInventory (via Inventory), AssignVehicle (calls Logistics)
Upstream:  Commerce (orders drive waves), Inventory (stock availability)
Downstream: Commerce (status updates), Inventory (consumption), Logistics (vehicle assignment)
Language:  "Wave" is the operational execution unit. A Wave groups orders for physical processing.
           "Pool" is prepared products waiting for vehicle assignment.
           "Allocation" is the plan for which vehicle carries which products for which order.
```

### CTX-04: Logistics
```
Owned Aggregates:   Vehicle, VehicleInventory, Shipment, LoadingSession, DeliveryAttempt
Canonical Concepts: Vehicle, Fleet, Loading, Shipment, Delivery, Driver
Published Contracts:
  Events:   logistics.vehicle.assigned, logistics.vehicle.loaded, logistics.vehicle.dispatched,
            logistics.delivery_confirmed, logistics.vehicle.returned
  Queries:  VehicleDashboardQuery, ShipmentStatusQuery
Consumed Contracts:
  Events:   fulfillment.shipping_wave.vehicle_assigned (→ create LoadingSession)
  Commands: LoadVehicle (called by Loading OS)
Upstream:  Fulfillment (wave triggers vehicle work)
Downstream: Fulfillment (shipment events consumed for order status)
Language:  "Shipment" is the physical transport record for a vehicle's deliveries.
           A Vehicle has inventory (what is loaded) and a delivery schedule.
ACL:       External logistics providers (Bosta, couriers) pass through BostaACL
```

### CTX-05: Manufacturing
```
Owned Aggregates:   Recipe, RecipeLine, ProductionJob
Canonical Concepts: Recipe, Bill of Materials, Ingredient, Yield, Waste Percentage
Published Contracts:
  Events:   manufacturing.recipe.approved, manufacturing.production_job.started,
            manufacturing.production_job.completed
  Queries:  RecipeMaterialAvailabilityQuery
Consumed Contracts:
  Queries:  InventoryAvailabilityQuery (per material in recipe)
Upstream:  Inventory (raw material availability)
Downstream: Inventory (stock consumption), Finance (COGS per production run)
Language:  "Recipe" is a Bill of Materials for producing one unit of a Product.
           Manufacturing's "Product" is the output SKU; Inventory's "Product" is the stock entity.
```

### CTX-06: Procurement
```
Owned Aggregates:   Supplier, PurchaseOrder, GoodsReceipt, SupplierReturn, SupplierInvoice
Canonical Concepts: Supplier, PO, GR, Receiving, Return
Published Contracts:
  Events:   procurement.purchase_order.created, procurement.goods_receipt.posted,
            procurement.supplier_return.created, procurement.supplier_invoice.posted
  Queries:  SupplierHealthQuery, PurchaseOrderListQuery
Consumed Contracts:
  Events:   inventory.raw_material.stock_adjusted (monitors for low stock alerts)
Upstream:  Configuration (supplier terms, approval thresholds)
Downstream: Inventory (GR posts stock), Finance (AP accrual)
Language:  "GR" (Goods Receipt) is the physical receiving event; it posts stock.
           A PO is the commercial agreement; a GR is the physical fulfillment of a PO line.
```

### CTX-07: CRM
```
Owned Aggregates:   Customer, Campaign, CustomerSegment
Canonical Concepts: Customer, Segment, Campaign, Lifetime Value, Risk Level
Published Contracts:
  Events:   crm.customer.created, crm.customer.risk_level_changed
  Queries:  CustomerSummaryQuery
Consumed Contracts:
  Events:   orders.order.delivered (→ update LTV), orders.order.delivery_failed (→ record failure),
            finance.invoice.issued (→ update balance), finance.invoice.paid (→ settle account)
Upstream:  Commerce (customer purchasing behavior)
Downstream: Commerce (customer identity for orders), EPS-04 (customer notification preferences)
Language:  "Customer" in CRM includes full relationship, history, and risk profile.
           Commerce only holds customer_id as a reference; all customer data lives here.
```

### CTX-08: Finance
```
Owned Aggregates:   Invoice, Payment, JournalEntry, POSSession, POSSale, CostLedger
Canonical Concepts: Invoice, Payment, Journal Entry, COGS, Revenue, AP/AR
Published Contracts:
  Events:   finance.invoice.issued, finance.invoice.paid, finance.pos_sale.completed,
            finance.pos_session.opened, finance.pos_session.closed
  Queries:  InvoiceListQuery, POSSessionSummaryQuery
Consumed Contracts:
  Events:   orders.order.delivered (→ CreateInvoice),
            inventory.cost_layer.consumed (→ COGS entry),
            procurement.goods_receipt.posted (→ AP accrual),
            finance.pos_sale.completed → inventory consumption + order creation
Upstream:  Commerce, Inventory, Procurement (all produce financial events)
Downstream: CRM (invoice/payment updates customer balance)
Language:  "Invoice" is the commercial billing document. Finance never directly queries order tables.
           Finance reads FIFO layer costs from Inventory events — never from raw material records.
```

### CTX-09: AI Platform
```
Owned Aggregates:   AIRecommendation (platform entity)
Canonical Concepts: Recommendation, Confidence, Model, Dismissal, Action Hint
Published Contracts:
  Events:   platform.ai.recommendation_generated
  Queries:  AIRecommendationsQuery, KPIDashboardQuery
Consumed Contracts:
  Events:   ALL domain events (AI subscribes to everything via EPS-01)
  Queries:  Any read model (for context enrichment)
Upstream:  EPS-01 (source of all events)
Downstream: EPS-04 (notification of high-confidence recommendations), EPS-02 (timeline entries)
Language:  AI Platform has a read-only view of the world. It never writes to domain aggregates.
           All AI-suggested actions become Commands if the user confirms them.
Note:      AI Platform is downstream of everything. It produces Recommendations only.
           GOV-015: AI never queries operational modules directly.
```

### CTX-10: Configuration Platform
```
Owned Aggregates:   ConfigurationScope, PolicyDefinition, PolicyVersion, FeatureFlag, RuleSet
Canonical Concepts: Policy, Configuration, Feature Flag, Rule, Scope, Version
Published Contracts:
  Service:  ConfigurationService, PolicyService, FeatureFlagService
Consumed Contracts: None — Configuration Platform is consulted, it does not subscribe to events
Upstream:  None (Configuration is a root context — no domain upstream)
Downstream: EVERY other context (all policy-governed behavior references Config Platform)
Language:  "Policy" is a configurable business rule with scope hierarchy.
           Every invariant in BUSINESS-INVARIANTS.md references a Policy in this context.
Note:      The Configuration Platform is a Shared Kernel — consumed by all, owned by Platform.
```

### CTX-11: Enterprise Platform Services (Shared Kernel)
```
Owned Aggregates:   BusinessEvent, TimelineEntry, Document, Notification
Canonical Concepts: Event, Timeline, Document, Notification
Published Contracts:
  Services: EventPublisherService, TimelineService, DocumentService, NotificationService
  Queries:  TimelineQuery, DocumentListQuery, NotificationInboxQuery
Consumed Contracts: N/A — EPS is infrastructure
Relationship:  Shared Kernel — EPS is consumed by all contexts, but is not a domain context itself
Note:      EPS is the pipe, not the water. It has no business logic.
           GOV-011 to GOV-016 define how all contexts must use EPS.
```

---

## 4. Upstream / Downstream Summary

| Context | Upstream (depends on) | Downstream (consumed by) |
|---|---|---|
| Commerce | CRM, Inventory, Config | Fulfillment, Finance, CRM |
| Inventory | Procurement (stock input), Config | Commerce, Fulfillment, Manufacturing, Finance |
| Fulfillment | Commerce, Inventory, Config | Commerce, Logistics, Inventory |
| Logistics | Fulfillment | Fulfillment (shipment events) |
| Manufacturing | Inventory, Config | Inventory (consumption), Finance |
| Procurement | Config | Inventory, Finance |
| CRM | Commerce | Commerce (customer identity) |
| Finance | Commerce, Inventory, Procurement | CRM |
| AI Platform | ALL (via EPS-01) | EPS-02, EPS-04 |
| Config Platform | None | ALL |
| EPS | None | ALL |

---

## 5. Cross-Context Translation Rules

When a concept crosses a bounded context boundary, translation is required:

| Source Context | Concept | Target Context | Translated Concept |
|---|---|---|---|
| Commerce | Order.customer_id | CRM | → Customer entity via CustomerSummaryQuery |
| Commerce | Order.product_id | Inventory | → Product.available via InventoryAvailabilityQuery |
| Fulfillment | PreparedProduct | Inventory | → ReceiptLayer consumption via ConsumeReservation |
| Procurement | GR line | Inventory | → ReceiptLayer creation via PostGoodsReceipt |
| Finance | Invoice | CRM | → Customer balance update via finance events |
| WooCommerce | WooOrder | Commerce | → ECOS Order via WooCommerceACL |
| Bosta | DeliveryStatus | Fulfillment | → Shipment status update via BostaACL |

---

## 6. Anti-Corruption Layer Locations

All external context boundaries use ACL:

| External System | ACL Document | Owner |
|---|---|---|
| WooCommerce | ANTI-CORRUPTION-LAYER.md § WooCommerce | Commerce |
| Meta / Instagram | ANTI-CORRUPTION-LAYER.md § Meta | Commerce |
| Bosta | ANTI-CORRUPTION-LAYER.md § Bosta | Logistics |
| WhatsApp | ANTI-CORRUPTION-LAYER.md § WhatsApp | EPS-04 |
| Payment Gateways | ANTI-CORRUPTION-LAYER.md § Payment | Finance |
