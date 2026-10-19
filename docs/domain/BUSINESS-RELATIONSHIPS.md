# Business Relationships

**Document:** BUSINESS-RELATIONSHIPS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DOMAIN-ARCH-001  
**Parent:** ENTERPRISE-DOMAIN-MODEL.md

---

## 1. Relationship Types

| Symbol | Type | Meaning |
|---|---|---|
| `∈` | **Composition** | Child is owned by parent; cannot exist without it; deleted with parent |
| `→` | **Reference** | Holds another aggregate's ID; does not own it; foreign key |
| `↔` | **Association** | Bidirectional relationship; each side has independent lifecycle |
| `⊂` | **Aggregation** | Child can exist independently but is part of a group |
| `1:N` | **One to Many** | One parent, many children |
| `N:M` | **Many to Many** | Requires a join/association entity |

---

## 2. Organization Domain Relationships

```
Company
  ∈ Branch (1:N) — Company owns its branches
  ∈ Warehouse (1:N via Branch, or direct) — Company owns its warehouses
  ∈ Channel (1:N) — Company owns its channels
  ∈ Employee (1:N) — Company employs people
  ∈ Unit (1:N) — Company defines its units of measure
  ∈ ProductCategory (1:N) — Company owns its product categories
  ∈ MaterialCategory (1:N) — Company owns its material categories
  ∈ DeliveryZone (1:N) — Company defines its delivery zones
  ∈ FulfillmentProfile (1:N) — Company defines its fulfillment profiles

Branch
  → Company (N:1)
  ∈ Warehouse (1:N)

Warehouse
  → Branch (N:1, optional — may be directly under Company)
  → Company (N:1)

Channel
  → Company (N:1)
  ∈ SalesChannel connector (1:1 or 1:N per platform)
```

---

## 3. Commerce Domain Relationships

```
Order
  → Customer (N:1 reference — Commerce → CRM; ID only)
  → Channel (N:1 reference — Commerce → Organization; ID only)
  → Warehouse (N:1 reference — Commerce → Organization; ID only)
  → Company (N:1)
  ∈ OrderLine (1:N — Order owns its lines)

OrderLine
  ∈ Order (N:1)
  → Product (N:1 reference — Commerce → Inventory; ID only)
  → Reservation (1:1 optional reference — Commerce → Inventory; ID only)

SalesChannel
  → Channel (N:1)
  ↔ Order (1:N, external_order_id ↔ Order.order_number mapping)
```

---

## 4. Inventory Domain Relationships

```
Product
  → Company (N:1)
  → ProductCategory (N:1)
  → Recipe (N:1 optional reference — Inventory → Manufacturing; ID only)
  ∈ ProductPrice (1:N, one per Channel)
  ∈ ProductChannelConfig (1:N, one per Channel)
  ∈ InventoryItem (1:N, one per Warehouse)
  ∈ Reservation (1:N — product reservations)
  ∈ StockMovement (1:N)

ProductCategory
  → Company (N:1)
  → ProductCategory (N:1 self-reference — parent category; optional)

RawMaterial
  → Company (N:1)
  → MaterialCategory (N:1)
  → Unit (N:1 — base unit of measure)
  → Supplier (N:1 optional reference — preferred supplier; ID only)
  ∈ ReceiptLayer (1:N — FIFO cost layers)
  ∈ Reservation (1:N)
  ∈ StockMovement (1:N)
  ∈ InventoryItem (1:N, one per Warehouse)

ReceiptLayer
  ∈ RawMaterial (N:1)
  → GoodsReceipt (N:1 optional reference)

Reservation
  ∈ RawMaterial or Product (polymorphic, N:1)
  → Order or ProductionJob (polymorphic purpose reference — ID only)
```

---

## 5. Manufacturing Domain Relationships

```
Recipe
  → Company (N:1)
  → Product (N:1 — the product this recipe produces)
  ∈ RecipeLine (1:N — Recipe owns its lines)

RecipeLine
  ∈ Recipe (N:1)
  → RawMaterial (N:1 reference — Manufacturing → Inventory; ID only)
  → Unit (N:1 reference)

ProductionJob (future)
  → Recipe (N:1)
  → Product (N:1)
  → Warehouse (N:1)
  → Company (N:1)
  ∈ MaterialReservation (1:N via Reservation entity)
```

---

## 6. Procurement Domain Relationships

```
Supplier
  → Company (N:1)
  ∈ SupplierContact (1:N)
  ∈ SupplierPerformanceRecord (1:N, derived)
  ↔ PurchaseOrder (1:N reference — Supplier is referenced by POs)

PurchaseOrder
  → Company (N:1)
  → Supplier (N:1)
  → Warehouse (N:1 — delivery destination)
  → MaterialRequest (N:1 optional source)
  ∈ PurchaseOrderLine (1:N)
  ∈ GoodsReceipt (1:N)
  → SupplierInvoice (1:1 optional reference)

PurchaseOrderLine
  ∈ PurchaseOrder (N:1)
  → RawMaterial (N:1 reference — Procurement → Inventory; ID only)
  → Unit (N:1)

GoodsReceipt
  → PurchaseOrder (N:1 optional — may be standalone)
  → Warehouse (N:1)
  ∈ GoodsReceiptLine (1:N)

GoodsReceiptLine
  ∈ GoodsReceipt (N:1)
  → RawMaterial (N:1)
  → Unit (N:1)
  creates ReceiptLayer on posting

SupplierInvoice
  → Supplier (N:1)
  → PurchaseOrder (N:1 optional)
  → GoodsReceipt (N:1 optional)
  → Invoice (N:1 optional — Finance; ID only)

SupplierReturn
  → Supplier (N:1)
  → GoodsReceipt (N:1)
  → Warehouse (N:1)
```

---

## 7. Fulfillment Domain Relationships

```
PreparationWave
  → Warehouse (N:1)
  → Company (N:1)
  ↔ Order (N:M — wave contains many orders; order may only be in one active wave)
  ∈ WaveItem (1:N)
  → PreparedProductsPool (1:N output writes)

WaveItem
  ∈ PreparationWave (N:1)
  → Product or RawMaterial (polymorphic)
  → Reservation (1:1 optional)

PreparedProductsPool
  → PreparationWave (N:1 source)
  → Product (N:1)
  → ShippingWave (N:1 allocated to, optional)

ShippingWave
  → Warehouse (N:1)
  → Company (N:1)
  ↔ Order (N:M)
  ∈ LoadingSession (1:N)
  ↔ Vehicle (N:M — multiple vehicles may load in a wave; one vehicle may be in one active wave)

LoadingSession
  ∈ ShippingWave (N:1)
  → Vehicle (N:1)
  → Warehouse (N:1)

Shipment
  → Company (N:1)
  → Vehicle (N:1)
  → Driver (N:1)
  ↔ Order (N:M — one shipment may carry multiple orders)
  → Warehouse (N:1 origin)
  → Customer (N:1 destination, resolved from Order)
  ∈ PackingJob (1:N optional)
  ∈ Pallet (1:N optional)

FulfillmentProfile
  ∈ Company (N:1)
  ↔ Channel (N:M — profile applies to certain channels)
  ↔ DeliveryZone (N:M — profile applies to certain zones)
```

---

## 8. Logistics Domain Relationships

```
Vehicle
  → Company (N:1)
  → ShippingCompany (N:1 optional)
  → Driver (N:1 current assignment, optional)
  → Warehouse (N:1 home base, optional)
  ∈ VehicleInventory (1:N)

Driver
  → Company (N:1)
  ∈ Employee (1:1 — every driver is an employee)
  → Vehicle (N:1 current, optional)

DeliveryZone
  → Company (N:1)
  ↔ Governorate (N:M — a zone covers many governorates; a governorate belongs to one zone per company)

Governorate
  ⊂ DeliveryZone (N:1 per Company configuration)
```

---

## 9. CRM Domain Relationships

```
Customer
  → Company (N:1)
  ∈ CustomerAddress (1:N)
  ∈ CustomerContact (1:N — phones, emails)
  ∈ CustomerPreference (1:1)
  ↔ Order (1:N reference — CRM → Commerce; ID only)

CustomerAddress
  ∈ Customer (N:1)
  → Governorate (N:1)
  → DeliveryZone (N:1 resolved)

Campaign
  → Company (N:1)
  ↔ Customer Segment (N:M — a campaign targets segments)
  ∈ Lead (1:N)
  ∈ Opportunity (1:N)

Lead
  ∈ Campaign (N:1 optional)
  → Customer (N:1 optional — once converted)
  → Company (N:1)

Opportunity
  ∈ Campaign (N:1)
  → Customer or Lead (polymorphic)
  → Product(s) (N:M reference)
```

---

## 10. Finance Domain Relationships

```
Invoice
  → Company (N:1)
  → Customer (N:1)
  ↔ Order (1:N or N:M — one invoice may cover multiple orders)
  ∈ InvoiceLine (1:N)
  ∈ Payment (1:N)

Payment
  ∈ Invoice or SupplierInvoice (polymorphic)
  → PaymentMethod (N:1 — cash, card, bank transfer, etc.)

POSSession
  → Warehouse (N:1)
  → Employee (N:1 cashier)
  → Company (N:1)
  ∈ POSSale (1:N)
  ∈ CashMovement (1:N)

POSSale
  ∈ POSSession (N:1)
  → Customer (N:1 optional)
  ∈ POSSaleLine (1:N)
  creates Order (1:1) and Invoice (1:1) on completion

POSSaleLine
  ∈ POSSale (N:1)
  → Product (N:1)
```

---

## 11. Platform Domain Relationships

```
Employee
  → Company (N:1)
  ∈ User (1:1 — user account for system access)

User
  ∈ Employee (1:1, usually)
  → Role(s) (N:M — roles define permissions)

Document (EPS-03)
  → any Aggregate (polymorphic — object_type + object_id)
  → Company (N:1)
  ∈ DocumentVersion (1:N)
  ∈ DocumentRelationship (1:N)

TimelineEntry (EPS-02)
  → any Aggregate (polymorphic)
  → User or System (actor)

Notification (EPS-04)
  → User or external contact (recipient)
  → BusinessEvent (source, optional)
  → NotificationPolicy (governs delivery)

AIRecommendation
  → any Aggregate (target)
  → AIPolicy (governs generation)
  → User (actor when acted upon or dismissed)
```

---

## 12. Cross-Domain Reference Rules

### Allowed Cross-Domain References (by domain pair)

| From Domain | To Domain | Allowed References |
|---|---|---|
| Commerce | CRM | Customer.id |
| Commerce | Inventory | Product.id (in OrderLine) |
| Commerce | Organization | Company.id, Channel.id, Warehouse.id |
| Fulfillment | Commerce | Order.id |
| Fulfillment | Inventory | Product.id, RawMaterial.id |
| Fulfillment | Logistics | Vehicle.id, Driver.id |
| Fulfillment | Organization | Warehouse.id |
| Procurement | Inventory | RawMaterial.id |
| Procurement | Organization | Company.id, Warehouse.id |
| Manufacturing | Inventory | Product.id, RawMaterial.id |
| Finance | Commerce | Order.id |
| Finance | Procurement | PurchaseOrder.id, SupplierInvoice.id |
| Finance | CRM | Customer.id |
| Finance | Organization | Company.id |
| Platform (EPS) | ALL | Any aggregate ID (read-only, event subscription) |

### Forbidden Dependencies

| Forbidden | Reason |
|---|---|
| Commerce → Fulfillment (direct service call) | Commerce fires events; Fulfillment subscribes |
| Inventory → Order (business logic) | Inventory decrement is triggered by event, not called |
| Finance → Inventory (stock data) | Finance uses price/cost from Inventory read model only |
| Manufacturing → Commerce | Manufacturing does not know about Orders |
| CRM → Procurement | Customers and Suppliers are independent |
| Fulfillment → Finance | Fulfillment doesn't trigger invoicing directly |

---

## 13. Many-to-Many Relationships (Join Entities)

| Relationship | Join Entity | Key Fields |
|---|---|---|
| Order ↔ PreparationWave | WaveOrderAssignment | wave_id, order_id |
| Order ↔ ShippingWave | ShippingWaveOrder | wave_id, order_id |
| Order ↔ Shipment | ShipmentOrder | shipment_id, order_id |
| Channel ↔ FulfillmentProfile | ProfileChannelAssignment | profile_id, channel_id |
| FulfillmentProfile ↔ DeliveryZone | ProfileZoneAssignment | profile_id, zone_id |
| Campaign ↔ CustomerSegment | CampaignSegment | campaign_id, segment_id |
| Opportunity ↔ Product | OpportunityProduct | opportunity_id, product_id |
