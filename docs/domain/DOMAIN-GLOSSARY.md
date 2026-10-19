# Domain Glossary

**Document:** DOMAIN-GLOSSARY  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DOMAIN-ARCH-001  
**Parent:** ENTERPRISE-DOMAIN-MODEL.md

---

## 1. Purpose

> This glossary contains **the canonical business vocabulary for ECOS**. Every term has exactly one definition. When writing code, documentation, or UI copy, use these definitions without modification.

If a term is not in this glossary, it does not yet have an official business meaning. Add it here before using it in any deliverable.

---

## 2. Business Terms

---

### Aggregate
A cluster of related domain objects (entities + value objects) that are treated as a single unit for consistency guarantees. An Aggregate Root is the only external entry point. See AGGREGATE-CATALOG.md.

---

### Allocation
The act of assigning specific prepared products from the Prepared Products Pool to a specific vehicle, for a specific set of orders, within a ShippingWave. Allocation happens in the Loading & Allocation OS.

*Not to be confused with Reservation (which is an inventory hold, not a vehicle assignment).*

---

### Approval
A business decision step required when a transaction exceeds a defined threshold (purchase order value, price change percentage, discount level). Governed by ApprovalPolicy. Approvals are logged immutably.

---

### Audit Trail
An immutable, append-only log of every action performed on a business entity. Powered by EPS-02 (Timeline) and the Audit Platform. Audit records include who, what, when, and the policy version that governed the decision.

---

### Bill of Materials (BOM)
See **Recipe**.

---

### Business Event
An immutable, time-stamped record that something meaningful happened in the system. Business Events are published to EPS-01 (Enterprise Event Platform) and consumed by interested modules. Events are facts — they describe what happened, not instructions.

---

### Business Invariant
A rule that must always be true within an Aggregate's boundary. Invariants are enforced by the Aggregate Root before any state change. They cannot be bypassed. See BUSINESS-INVARIANTS.md.

---

### Campaign
A defined marketing initiative targeting a customer segment, with a start date, end date, channel, and objective. Campaigns generate Leads and Opportunities. See ENTITY-CATALOG.md § Campaign.

---

### Capacity
The maximum load a vehicle or container can carry, expressed as a combination of weight, volume, order count, and pallet count. Governed by VehiclePolicy.

---

### Channel
A named sales or distribution route through which orders arrive and products are fulfilled (e.g. WooCommerce Store A, Direct Sales, POS). Channels are configured per Company and govern pricing, fulfillment profiles, and product availability.

---

### Company
The top-level organizational entity in ECOS. All data (orders, products, customers, inventory) is scoped to a Company. A User always operates within the context of exactly one Company at a time.

---

### Configuration
A named setting (key-value pair) that controls system behavior at a specific scope (Global → Country → Company → Channel → Warehouse → User). Configurations are versioned. See ENTERPRISE-CONFIGURATION-PLATFORM.md.

---

### Cost Layer
See **Receipt Layer**.

---

### Customer
A business or individual who has placed at least one order. A Customer is distinguished from a **Lead** (who has shown interest but not ordered). Customers are owned by the CRM domain.

---

### Decision Engine
A specialized service that makes operational decisions based on Policies and real-time context (e.g. which vehicle to assign, how to allocate products, how to handle partial fulfillment). Decision Engines do not contain business logic — they apply Policies. See DECISION-ENGINE-SPEC.md.

---

### Delivery Zone
A named geographic area (e.g. Cairo Zone A, Alexandria) used for route planning, fulfillment profile matching, and coverage analysis. A Delivery Zone is made up of one or more Governorates.

---

### Document
A file (PDF, image, Excel, certificate, etc.) attached to a business object. Documents belong to business objects, not to modules. Powered by EPS-03. See ENTERPRISE-DOCUMENT-PLATFORM.md.

---

### Domain Event
See **Business Event**.

---

### Driver
An employee authorized to operate a Vehicle and execute delivery routes. Every Driver is also an Employee.

---

### Employee
A person employed by the Company. Employees may have User accounts for system access, and some may be Drivers.

---

### Escalation
The automatic promotion of a business exception to a higher authority when a threshold or time limit is exceeded. Governed by NotificationPolicy.escalation_rules.

---

### Exception (Business)
An operational situation that deviates from the normal flow and requires human intervention (e.g. SLA breach, blocked wave item, stock shortage). Exceptions appear in the Command Center and generate Notifications.

---

### Feature Flag
A boolean setting that enables or disables a module or feature for a specific Company. Governed by the Feature Management system. See FEATURE-MANAGEMENT-SPEC.md.

---

### FIFO
First-In, First-Out — the inventory costing method used in ECOS. The oldest Receipt Layer (by date) is consumed first. FIFO determines the cost of goods sold (COGS) for each material consumption.

---

### Finished Good
A Product that is the output of a manufacturing Recipe. Distinguished from a raw material or packaging material. Finished Goods are sold; Raw Materials are consumed in production.

---

### Fulfillment
The end-to-end process of converting a confirmed Order into a delivered shipment. ECOS fulfillment consists of: Reservation → Preparation → Loading → (Packing) → Logistics → Delivery.

---

### Fulfillment Profile
A named configuration that specifies which fulfillment stages apply for a given Channel + Delivery Zone combination. Profiles are configured in the Configuration OS and drive the behavior of the Fulfillment Platform.

---

### Goods Receipt (GR)
A record of physical goods arriving at a Warehouse from a Supplier against a PurchaseOrder (or directly). Posting a GR creates inventory Receipt Layers and triggers StockAdded events. See ENTITY-CATALOG.md § GoodsReceipt.

---

### Governorate (محافظة)
An Egyptian administrative region. Used for delivery zone assignment and geographic coverage. Reference data — not company-specific.

---

### Invariant
See **Business Invariant**.

---

### Invoice
A financial document requesting payment for goods or services. Customer invoices are created on Order delivery. Supplier invoices are received from Suppliers against PurchaseOrders.

---

### Lead
A potential customer who has shown interest but has not yet placed an order. Leads are generated by Campaigns and can be converted to Customers.

---

### Loading
The physical act of placing prepared products from the Prepared Products Pool onto a Vehicle during a Loading Session. Loading is managed by the Loading & Allocation OS.

---

### Loading Session
A single open/close session during which products are loaded onto a specific Vehicle for a specific ShippingWave. Loading Sessions are records of the physical loading activity.

---

### Margin
The difference between a Product's selling price and its cost, expressed as a percentage of the selling price. Governed by PricingPolicy.min_margin_percentage.

---

### Material Request (MR)
An internal procurement request to authorize the purchase of raw materials before a formal PurchaseOrder is created. Material Requests go through an approval workflow before becoming POs.

---

### Notification
A message delivered to a User or external contact (email, SMS, WhatsApp, in-app, push) triggered by a business event. Notifications are policy-driven (NotificationPolicy). Powered by EPS-04.

---

### Opportunity
A qualified sales potential associated with a specific Customer (or Lead) and one or more Products, tracked within a Campaign.

---

### Order
A confirmed customer request to purchase products. The central entity in Commerce. An Order owns its lines, drives the fulfillment chain, and generates an Invoice on delivery.

---

### Packing
An optional fulfillment stage (governed by FulfillmentProfile) where products are physically packed into pallets or boxes before dispatch. Packing is managed by the Packing OS.

---

### Pallet
A physical packaging unit containing one or more packed items. Pallets are owned by a Shipment.

---

### Policy
A named, versioned set of business rules governing a specific domain of behavior (e.g. FulfillmentPolicy, PricingPolicy, VehiclePolicy). Policies are configured per Company and consumed by Decision Engines and Aggregates. Governed by the Policy Engine. See POLICY-ENGINE-SPEC.md.

---

### Prepared Products Pool
A holding area where prepared products wait after completing the Preparation OS, before being allocated and loaded in the Loading OS. The Pool is the handoff boundary between Preparation and Loading.

---

### Preparation
The warehouse activity of picking, counting, and staging raw materials and finished products needed to fulfill a set of Orders. Preparation is organized into Preparation Waves and managed by the Preparation OS.

---

### Preparation Wave
The primary operational unit of the Preparation OS. A Preparation Wave groups a set of Orders for simultaneous preparation. Waves have a lifecycle from draft to completed. See AGGREGATE-CATALOG.md § PreparationWave.

---

### Product
A finished good that can be sold, reserved, and fulfilled. Products have a SKU, pricing per Channel, and optionally a Recipe for manufacturing. See ENTITY-CATALOG.md § Product.

---

### Production Job
An instruction to manufacture a specific quantity of a Product using a specific Recipe. Production Jobs consume reserved raw materials and produce finished goods stock.

---

### Purchase Order (PO)
A formal document sent to a Supplier authorizing the purchase of goods. POs have a value, line items, and generate Goods Receipts on delivery.

---

### Raw Material
An ingredient or component (food ingredient, packaging material) used in manufacturing Recipes. Raw Materials are tracked by FIFO receipt layers.

---

### Receipt Layer
A FIFO cost layer representing a specific batch of material received at a specific unit cost on a specific date. Receipt Layers are immutable after posting. They are consumed in FIFO order when materials are used.

*Also called: Cost Layer, FIFO Layer, Inventory Layer.*

---

### Recipe
A Bill of Materials defining the ingredients, quantities, and instructions required to produce one unit of a Product. Recipes have versions; only one version can be active per Product at a time.

---

### Reservation
A hold on a specific quantity of a Product or RawMaterial for a specific purpose (Order fulfillment or Production Job). Reservations ensure that stock committed to a purpose is not consumed by something else.

---

### Route
A planned sequence of delivery stops for a Vehicle, covering multiple Orders and Customers.

---

### Shipment
The physical movement of goods from a Warehouse to a Customer. Shipments are executed by Vehicles and Drivers and tracked through the Logistics OS.

---

### Shipping Wave
The primary operational unit of the Loading & Allocation OS. A Shipping Wave groups Orders for loading onto vehicles and dispatch. Shipping Waves consume the Prepared Products Pool.

---

### SKU (Stock Keeping Unit)
A unique identifier for a Product within a Company. SKUs are immutable after a Product is activated. Format: uppercase letters, digits, and hyphens.

---

### SLA (Service Level Agreement)
A time-based commitment to deliver an Order by a specific deadline. SLA tracking is automated; breaches trigger Exceptions and Notifications.

---

### Status
The current lifecycle state of a business entity. States follow defined state machines (LIFECYCLE-MODELS.md). Illegal transitions are rejected by the Aggregate Root.

---

### Stock Movement
An immutable record of a quantity change in inventory (in or out, with reason and reference). Stock Movements are the audit trail of all inventory changes.

---

### Supplier
An external company that provides raw materials or services to the business. Suppliers are managed in the Procurement domain.

---

### Supplier Invoice
A financial document received from a Supplier claiming payment for delivered goods. Supplier Invoices are linked to PurchaseOrders and/or Goods Receipts and create accounts payable.

---

### Supplier Return
The process of returning goods to a Supplier due to quality or quantity issues. Returns reverse the associated Goods Receipt and adjust inventory.

---

### Timeline
A chronological, immutable history of all significant events for a business object. Every Order, Customer, Supplier, Vehicle, etc. has a Timeline. Powered by EPS-02. See TIMELINE-UX-STANDARD.md.

---

### Unit
A unit of measure used for quantities (kg, litre, piece, box, pallet). Units are company-defined reference data.

---

### Value Object
An immutable domain object identified by its attributes, not by an ID. Value Objects are replaced when changed, never mutated. See VALUE-OBJECT-CATALOG.md.

---

### Vehicle
A transport unit (truck, van, motorcycle) used to deliver goods. Vehicles have a capacity (weight + volume), a current Driver assignment, and maintain a real-time VehicleInventory.

---

### Vehicle Inventory
The real-time record of products currently loaded on a Vehicle. Vehicle Inventory is decremented when deliveries are confirmed and reconciled when the Vehicle returns to the warehouse.

---

### Warehouse
A physical location where inventory is stored and fulfillment operations are performed. Every operational entity (preparation, loading, stock) is scoped to a Warehouse.

---

### Wave
See **Preparation Wave** or **Shipping Wave** depending on context.  
- **Preparation Wave** = Preparation OS operational unit  
- **Shipping Wave** = Loading & Allocation OS operational unit

---

## 3. Abbreviations

| Abbreviation | Full Term |
|---|---|
| BOM | Bill of Materials (= Recipe) |
| COGS | Cost of Goods Sold |
| EPS | Enterprise Platform Services |
| FIFO | First-In, First-Out |
| GR | Goods Receipt |
| MR | Material Request |
| OS | Operating System (in ECOS: a named operational module, e.g. Preparation OS) |
| PO | Purchase Order |
| POS | Point of Sale |
| SKU | Stock Keeping Unit |
| SLA | Service Level Agreement |
| VO | Value Object |

---

## 4. Terms Intentionally Excluded

The following terms are intentionally NOT in this glossary because they refer to implementation details, not business concepts:

| Excluded Term | Why Excluded |
|---|---|
| Table, Column, Row | Database implementation concerns |
| Controller, Service, Repository | Code architecture patterns |
| API, Endpoint, Request | Technical interface concerns |
| Migration, Seeder | Database tooling |
| Cache, Queue, Job | Infrastructure concerns |
| Component, Hook, State | UI implementation concerns |
