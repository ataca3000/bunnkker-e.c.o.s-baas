# ADR-015 — Enterprise Fulfillment Architecture

**Status:** APPROVED — CRITICAL  
**Date:** 2026-07-04  
**Supersedes:** ADR-010 (Order-Driven Fulfillment / Preparation OS)  
**Task:** TASK-FULFILLMENT-ARCH-001  
**Authors:** ECOS Architecture Board

---

## Context

The previous ADR-010 placed Preparation OS as the step immediately before Packing, and included Packing and Loading as responsibilities of the Preparation module. This model was insufficient for enterprise-scale fulfillment operations.

As ECOS scales to serve high-volume manufacturing and distribution companies, the fulfillment domain must be decomposed into a proper platform of distinct operating systems, each with a clearly bounded responsibility. Preparation is one stage inside a larger Enterprise Fulfillment Platform — not the entire platform.

---

## Decision

ECOS adopts the **Enterprise Fulfillment Platform** as its official fulfillment architecture. This platform is composed of multiple distinct Operating Systems (OS) connected by defined inventory handoff points.

---

## The Enterprise Fulfillment Flow

```
Sales Orders
     ↓
Reservation Engine
     ↓
Preparation OS
     ↓
Prepared Products Pool
     ↓
Loading & Allocation OS
     ↓
Vehicle Mobile Warehouse
     ↓
Channel Fulfillment Engine
     ↓
Packing OS
     ↓
Logistics OS
     ↓
Delivery
     ↓
Returns
```

This flow is the **official ECOS Enterprise Fulfillment Architecture**.  
It is approved and becomes the design baseline for all fulfillment implementation.

---

## Stage Definitions

### 1. Sales Orders
- **Source:** Commerce Layer (WooCommerce, Shopify, manual, wholesale)
- **Output:** Confirmed orders with product lines, quantities, delivery addresses
- **Owner:** Commerce Module
- **Handoff:** Confirmed orders enter the Reservation Engine automatically

---

### 2. Reservation Engine
- **Purpose:** Reserve materials and inventory against confirmed demand before any physical work begins
- **Input:** Confirmed orders
- **Output:** Reserved inventory (materials + finished goods where available)
- **Responsibilities:**
  - Recipe expansion per order line
  - Material availability check
  - Stock reservation (increments `reserved_qty`, `on_hand_qty` unchanged)
  - Shortage identification
- **Owner:** Inventory Module (existing: `ReserveStockAction`, `ReserveOrderInventoryAction`)
- **Handoff to:** Preparation OS (via Preparation Queue)

---

### 3. Preparation OS
- **Purpose:** Transform reserved inventory into prepared products
- **Input:** Preparation Queue (confirmed orders with reservations, no batch assigned)
- **Output:** Prepared Products Pool (quantified, traceable, ready for loading)
- **Boundaries — what Preparation OS DOES:**
  - Preparation Waves
  - Product Aggregation
  - Material Availability Analysis
  - Shortage Analysis
  - Negative Stock Analysis
  - Product Preparation
  - Prepared Quantity Recording
  - Prepared Products Pool
- **Boundaries — what Preparation OS does NOT know about:**
  - Vehicles
  - Shipping
  - Drivers
  - Route Planning
  - Packing
  - Order Allocation
- **Owner:** Preparation OS Module (new, replaces Manufacturing OS)
- **Handoff to:** Prepared Products Pool

> **Critical boundary:** Preparation ends when products are placed in the Prepared Products Pool.  
> Preparation never allocates products to orders.  
> Preparation never packs.  
> Preparation never loads vehicles.

---

### 4. Prepared Products Pool
- **Purpose:** Temporary enterprise inventory containing prepared products waiting to be loaded onto vehicles
- **Position:** Between Preparation and Loading
- **Characteristics:**
  - **Traceable** — every unit tracked by product, batch origin, preparation timestamp
  - **Quantified** — exact quantities recorded per product
  - **Quality Checked** — quality status recorded per pool entry
  - **Reservable** — products can be reserved for a specific shipping wave
  - **Reallocatable** — unreserved products can be moved between shipping waves
  - **Auditable** — full movement history; every entry and exit is a recorded event
- **Schema (logical):**
  ```
  PreparedProductsPool
  ├── id
  ├── company_id → Company
  ├── warehouse_id → Warehouse
  ├── product_id → Product
  ├── preparation_batch_id → PreparationBatch (origin)
  ├── quantity_available
  ├── quantity_reserved    (reserved for a shipping wave)
  ├── quality_status       enum: passed | failed | pending_review
  ├── prepared_at
  ├── reserved_for_wave_id → ShippingWave (nullable)
  └── notes
  ```
- **Owner:** Preparation OS (writes) / Loading & Allocation OS (reads and consumes)

---

### 5. Loading & Allocation OS
- **Purpose:** Convert Prepared Products into Vehicle Inventory
- **Input:** Prepared Products Pool + Shipping Wave Plans
- **Output:** Loaded vehicles (each vehicle becomes a Mobile Warehouse with its own inventory)
- **Responsibilities:**
  - Shipping Wave Planning
  - Vehicle Assignment
  - Vehicle Requirement Calculation
  - Loading Sessions
  - Vehicle Inventory management
  - Partial Loading support
  - Reallocation (when products move between vehicles or waves)
  - Loading Exceptions handling
- **Owner:** Loading & Allocation OS Module (new)
- **Handoff to:** Vehicle Mobile Warehouse

> This is a **brand-new enterprise module** with no predecessor in ADR-010.

---

### 6. Vehicle Mobile Warehouse
- **Purpose:** Every vehicle is a mobile warehouse, not a transportation object only
- **Architecture:**
  ```
  Vehicle
  ├── Inventory (owns its own inventory stock)
  ├── Loading Sessions[] (record how inventory arrived)
  ├── Assigned Orders[]
  ├── Inventory Movements[]
  ├── Inventory History
  ├── Capacity (weight + volume)
  ├── Driver → User
  ├── Route
  └── Timeline
  ```
- **Principle:** Inventory traceability continues inside the vehicle. Prepared Products Pool → Loading Session → Vehicle Inventory is a fully auditable chain.
- **Owner:** Loading & Allocation OS Module (vehicle lifecycle) / Logistics OS (route execution)

---

### 7. Channel Fulfillment Engine
- **Purpose:** Execute the correct fulfillment workflow for each channel, based on its configured Fulfillment Profile
- **Input:** Vehicle Inventory + Channel Fulfillment Profiles
- **Responsibilities:**
  - Load and execute the active Fulfillment Profile for each channel
  - Route orders through the correct sequence of fulfillment stages
  - Handle exceptions at any stage
  - Support re-routing (changing stage sequence mid-execution)
  - Support dynamic workflow changes
  - Integrate with AI Platform for optimization
- **Owner:** Channel Fulfillment Engine (new, cross-cutting)

---

### 8. Packing OS
- **Purpose:** Pack products into customer orders where the active Fulfillment Profile requires packing
- **CRITICAL CHANGE:** Packing is **no longer mandatory** for every channel
- **Packing is workflow-dependent:** whether Packing OS runs is determined entirely by the channel's Fulfillment Profile
- **Responsibilities:**
  - Packing sessions
  - Order-by-order packing (Profile B)
  - Pallet building (Profile C)
  - Packing materials tracking
  - Pack quality verification
  - Label generation
- **Owner:** Packing OS Module
- **Position:** Packing appears AFTER Loading & Allocation — not before it

> Diagrams showing Preparation → Packing are **invalid**. The correct sequence is  
> Preparation → Pool → Loading → Vehicle → Channel Fulfillment Engine → [Packing if profile requires it]

---

### 9. Logistics OS
- **Purpose:** Manage route execution and delivery
- **CRITICAL CHANGE:** Logistics now starts **after Loading & Allocation OS**, not after Preparation OS
- **Input:** Loaded vehicles with inventory, route assignments
- **Responsibilities:**
  - Route planning and optimization
  - Driver dispatch
  - Delivery confirmation
  - Delivery exceptions
  - ETA tracking
  - Proof of delivery
- **Owner:** Logistics OS Module

---

### 10. Delivery
- Successful completion of customer orders
- Triggers: order status → `delivered`, inventory consumption recorded from vehicle inventory

---

### 11. Returns
- Reverse logistics from customers back into warehouse
- Returns linked to original order + vehicle + loading session for full traceability
- Return inventory goes through inspection before rejoining warehouse stock

---

## New Entities

### Shipping Wave
A Shipping Wave is the enterprise planning unit for loading and dispatch.

```
ShippingWave
├── id
├── company_id
├── warehouse_id
├── wave_number         (e.g. WAVE-2026-001234)
├── orders[]            → Order[]
├── vehicles[]          → Vehicle[]
├── priority            enum: critical | high | standard | low
├── region              (governorate / city / zone)
├── sla_deadline        timestamp
├── loading_status      enum: planning | in_progress | completed | exceptions
├── completion_status   enum: pending | partial | completed
├── planned_at
├── planned_by          → User
└── ActivityEvents[]
```

**Supported operations:** Merge, Split, Pause, Replan, Auto-Planning (AI-driven)

---

### Loading Session
No direct loading is allowed outside a Loading Session.

```
LoadingSession
├── id
├── shipping_wave_id    → ShippingWave
├── vehicle_id          → Vehicle
├── operator_id         → User
├── started_at
├── finished_at
├── status              enum: open | completed | closed_with_exceptions
├── products_loaded[]   → { product_id, quantity_loaded }
├── required_products[] → { product_id, quantity_required }
├── missing_products[]  → { product_id, quantity_missing, reason }
├── duration_minutes    (computed: finished_at - started_at)
└── exceptions[]        → LoadingException[]
```

---

### Loading Exception
```
LoadingException
├── id
├── loading_session_id  → LoadingSession
├── exception_type      enum: (see Section 9)
├── severity            enum: blocking | warning | informational
├── description
├── resolved_at
├── resolved_by         → User
└── resolution_notes
```

**Supported exception types:**
- `vehicle_full`
- `product_missing`
- `short_loading`
- `over_loading`
- `driver_missing`
- `vehicle_change`
- `route_change`
- `loading_delay`

---

### Fulfillment Profile
Every Channel owns exactly one Fulfillment Profile. The profile determines the execution workflow.

```
FulfillmentProfile
├── id
├── channel_id          → Channel
├── name
├── stages[]            → FulfillmentStage[]  (ordered)
└── is_active
```

```
FulfillmentStage
├── profile_id          → FulfillmentProfile
├── stage_type          enum: preparation | vehicle_allocation | packing | order_building
│                             | order_handover | pallet_building | invoice_verification | delivery
├── sequence_order      int
├── is_required         bool
└── config              JSONB (stage-specific settings)
```

**Example Profiles:**

Profile A — High-volume distribution:
```
Preparation → Vehicle Allocation → Packing → Delivery
```

Profile B — Premium / per-order handover:
```
Preparation → Vehicle Allocation → Order Building → Order Handover → Delivery
```

Profile C — Wholesale / pallet:
```
Preparation → Vehicle Allocation → Pallet Building → Invoice Verification → Delivery
```

**The workflow is configurable. Never hardcoded.**

---

## Responsibility Matrix

| Responsibility | Previous Owner | New Owner |
|---|---|---|
| Preparation Waves | Preparation OS | Preparation OS ✓ |
| Product Aggregation | Preparation OS | Preparation OS ✓ |
| Material Shortage Analysis | Preparation OS | Preparation OS ✓ |
| Prepared Products Pool | — | Preparation OS (writes) |
| Shipping Wave Planning | — | Loading & Allocation OS |
| Vehicle Assignment | Operations Planning | Loading & Allocation OS |
| Loading Sessions | — | Loading & Allocation OS |
| Vehicle Inventory | — | Loading & Allocation OS |
| Loading Exceptions | — | Loading & Allocation OS |
| Fulfillment Profile Execution | — | Channel Fulfillment Engine |
| Packing | Preparation OS | Packing OS (workflow-dependent) |
| Route Planning | Logistics OS | Logistics OS ✓ |
| Delivery Confirmation | Logistics OS | Logistics OS ✓ |
| Driver Management | Operations Planning | Loading & Allocation OS + Logistics OS |

---

## Consequences

### Positive
1. **Preparation OS** has a clean, narrow responsibility with a defined exit point (Prepared Products Pool)
2. **Vehicle inventory** is now first-class — traceability extends all the way from warehouse shelf to customer door
3. **Packing** is no longer a bottleneck in the wrong place — it happens where the Fulfillment Profile specifies
4. **Logistics** starts from a loaded vehicle, not from a preparation batch, which is the correct physical boundary
5. **Fulfillment Profiles** make the system configurable for any business model without code changes
6. **AI integration** is possible at each stage transition (predictions, optimization, anomaly detection)

### Constraints
1. Any feature touching preparation/loading/packing/logistics must first check which stage owns that responsibility in the new architecture
2. Diagrams showing `Preparation → Packing` are invalid and must be removed
3. The batch lifecycle (ADR-009) must be updated to reflect the new stage separation
4. New modules (Loading & Allocation OS, Packing OS, Channel Fulfillment Engine) must be built as separate DDD modules

---

## Migration from ADR-010

| ADR-010 Concept | ADR-015 Replacement |
|---|---|
| Preparation OS includes Packing | Preparation OS ends at Prepared Products Pool; Packing is a separate OS |
| Batch lifecycle: preparing → packing → ready_for_shipping | Multi-stage: Preparation → Pool → Loading → Vehicle → Packing (if profile) → Logistics |
| Vehicle assignment inside Operations Planning | Vehicle assignment inside Loading & Allocation OS |
| Loading as a batch state | Loading as a dedicated Operating System |
| Single fulfillment flow | Configurable Fulfillment Profiles per channel |
| No explicit pool between stages | Prepared Products Pool is a first-class entity |

---

## Future Modules (Placeholder — Do NOT Implement)

### Order Building (Future)
**Purpose:** Transform Vehicle Inventory into completed customer orders for channels requiring order-by-order handover.  
**Position in flow:** After Vehicle Mobile Warehouse, before Order Handover.  
**Implementation:** Future module. Do not implement until a dedicated ADR is approved.

### Order Handover (Future)
**Purpose:** Transfer completed customer orders from warehouse team to driver.  
**Data captured:**
- Driver
- Operator
- Timestamp
- Signature
- Notes
- Missing Orders
**Position in flow:** After Order Building, before Delivery.  
**Implementation:** Future module. Do not implement until a dedicated ADR is approved.

---

## Decision Engines (TASK-FULFILLMENT-ARCH-002)

The following decision engines complete the Enterprise Fulfillment Platform. Each engine is configurable and produces auditable decisions. No operational workflow may be hardcoded.

### Geography & Coverage Engine
- **Runs:** Before vehicle planning, at order grouping time
- **Purpose:** Group orders by governorate + zone; auto-select shipping company per group
- **Inputs:** Orders with delivery addresses, ShippingCompany coverage maps, Channel shipping rules
- **Output:** GeographyGroups (zone + shipping_company + orders)
- **Detail:** `GEOGRAPHY-COVERAGE-ENGINE.md`

### Vehicle Planning Engine
- **Runs:** After geography grouping, before Loading Sessions
- **Purpose:** Calculate optimal vehicle count and distribution per geography group
- **Constraints:** max_orders, max_weight, max_volume, max_stops, max_working_hours
- **Output:** VehiclePlan with slots → becomes ShippingWave input
- **Detail:** `VEHICLE-PLANNING-ENGINE.md`

### Product Allocation Engine
- **Runs:** After vehicle loading, before dispatch
- **Purpose:** Allocate vehicle inventory to the specific orders on that vehicle
- **Decision Hierarchy:** System → Dispatcher → Driver (all decisions stored immutably)
- **Default priority:** Paid → COD → Deferred → Others (configurable per profile)
- **Detail:** `PRODUCT-ALLOCATION-ENGINE.md`

### Partial Fulfillment Rules
- **Scope:** Cross-cutting — applies to Allocation, Packing, and Delivery stages
- **Purpose:** Define per-profile rules for when partial operations are allowed and who must approve
- **Dimensions:** Partial Allocation, Partial Packing, Partial Delivery (independently configured)
- **Detail:** `PARTIAL-FULFILLMENT-RULES.md`

---

## Architecture Governance

> This task (TASK-FULFILLMENT-ARCH-002) establishes the fulfillment constraint on the Enterprise Fulfillment Platform:
>
> **No operational workflow in the fulfillment pipeline may be hardcoded.**
>
> Every fulfillment decision must be driven by one of:
> - A Fulfillment Profile stage configuration
> - A ShippingCompany coverage map
> - A ChannelShippingRule priority
> - An AllocationPriorityPolicy
> - A PartialFulfillmentRules config block
> - A VehiclePlan calculation result
>
> Application code may enforce the decision. It may never make the decision.

---

## Configuration Platform Dependency (TASK-CONFIGURATION-ARCH-001)

All configurable behaviors in this ADR are governed by the Enterprise Configuration & Policy Platform.

Every Decision Engine in the fulfillment pipeline must:
1. Resolve its Policy via the Policy Engine (never read configuration directly)
2. Evaluate rules via the Rule Evaluation Engine (never hardcode conditions)
3. Return a `RuleEvaluationResult` that references the Policy and Config Version used
4. Produce an audit record for every decision

**Policy types consumed by the Fulfillment Platform:**

| Engine | Policy Type |
|---|---|
| Geography & Coverage Engine | `GeographyPolicy` |
| Vehicle Planning Engine | `VehiclePolicy` |
| Product Allocation Engine | `AllocationPolicy` |
| Channel Fulfillment Engine | `FulfillmentPolicy` |
| Packing OS | `PackingPolicy` |
| Logistics OS | `DeliveryPolicy` |

See `ENTERPRISE-CONFIGURATION-PLATFORM.md` for the full platform specification.

---

## Enterprise Platform Services Dependency (TASK-EPS-ARCH-001)

The Enterprise Fulfillment Platform integrates with all four Enterprise Platform Services.

| EPS Service | How the Fulfillment Platform Uses It |
|---|---|
| **EPS-01 Event Platform** | Every stage transition publishes a BusinessEvent (preparation.wave.completed, loading.session.opened, allocation.completed, logistics.delivery.confirmed, etc.) |
| **EPS-02 Timeline Platform** | Orders, Vehicles, Preparation Waves, and Loading Sessions all have auto-generated timelines from fulfillment events |
| **EPS-03 Document Platform** | Delivery proofs, packing lists, shipping labels, and quality reports are stored and attached to Orders via the Document Platform |
| **EPS-04 Notification Platform** | Loading exceptions, shortage alerts, partial fulfillment approvals, and delivery confirmations are all delivered via the Notification Platform, governed by NotificationPolicy |

**Governance rules GOV-011 to GOV-016 apply to the Fulfillment Platform:**
- No Fulfillment OS publishes its own notifications (GOV-014)
- No Fulfillment OS manages its own activity log (GOV-012)
- Delivery proofs and packing lists are stored in EPS-03, not in module-specific storage (GOV-013)

See `ENTERPRISE-PLATFORM-SERVICES.md` for the full EPS specification.

---

## Enterprise Domain Model Dependency (TASK-DOMAIN-ARCH-001)

The Fulfillment Platform is governed by the Enterprise Domain Model. All entities, aggregates, relationships, and lifecycle rules defined here are canonical.

| Domain Model Document | Fulfillment Relevance |
|---|---|
| `ENTITY-CATALOG.md` | PreparationWave, ShippingWave, LoadingSession, Shipment, PackingJob, Pallet, Vehicle, VehicleInventory, PreparedProductsPool |
| `AGGREGATE-CATALOG.md` | AGG-09 PreparationWave, AGG-10 ShippingWave, AGG-11 Vehicle, AGG-12 Shipment |
| `LIFECYCLE-MODELS.md` | Full state machines for PreparationWave, ShippingWave, Vehicle, Shipment |
| `DOMAIN-EVENT-CATALOG.md` | All `fulfillment.*` and `logistics.*` events |
| `BUSINESS-INVARIANTS.md` | INV-FUL-001 through INV-FUL-007 |
| `OWNERSHIP-MODEL.md` | PreparationWave, ShippingWave, Vehicle, Shipment ownership rules |

> Full Domain Model: `docs/domain/ENTERPRISE-DOMAIN-MODEL.md`

---

## Contract Architecture Dependency (TASK-CONTRACT-ARCH-001)

The Fulfillment Platform publishes and consumes formal Contracts. No fulfillment stage may communicate with another domain except through these published contracts.

| Contract Category | Fulfillment Contracts |
|---|---|
| Commands Produced | CMD-FUL-001 CreatePreparationWave, CMD-FUL-002 StartPreparation, CMD-FUL-003 CompletePreparation, CMD-FUL-004 CreateShippingWave, CMD-FUL-005 AssignVehicle, CMD-FUL-006 AllocateProducts, CMD-FUL-007 LoadVehicle, CMD-FUL-008 DispatchShipment, CMD-FUL-009 ConfirmDelivery, CMD-FUL-010 FailDelivery |
| Events Produced | fulfillment.preparation_wave.* (4 events), fulfillment.shipping_wave.* (2 events), fulfillment.shipment.* (3 events), fulfillment.prepared_pool.added |
| Events Consumed | orders.order.confirmed, orders.order.ready, inventory.raw_material.stock_reserved |
| Queries Exposed | QRY-FUL-001 PreparationDashboardQuery, QRY-FUL-002 WaveSummaryQuery, QRY-FUL-003 PreparedProductsPoolQuery, QRY-FUL-004 VehicleDashboardQuery, QRY-FUL-005 ShipmentStatusQuery |
| Bounded Context | CTX-03 Fulfillment, CTX-04 Logistics (BOUNDARY-CONTEXT-MAP.md) |

> Full Contract Architecture: `docs/contracts/ENTERPRISE-CONTRACTS.md`

---

## Database Engineering Standards Dependency (TASK-DATABASE-ENGINEERING-001)

All Fulfillment domain tables are subject to the full Database Engineering Standards.

| Table | Identity | Partitioned | Class D Risk |
|---|---|---|---|
| `preparation_waves` | UUID | No | Status-based; never deleted |
| `wave_items` | UUID | No | Cascade RESTRICT from wave |
| `shipments` | UUID | No | Status-based; financial record |
| `shipment_orders` | UUID | No | Join table; no cascade delete |
| `vehicle_assignments` | UUID | No | Audit trail; append-only |
| `loading_waves` | UUID | No | Status-based |

**Key implications for Fulfillment schema:**
- Wave transitions are status-only (`ENG-GOV-004`: use VARCHAR + CHECK for all status columns)
- `CHG-001`: Any change to wave/shipment tables follows DATABASE-CHANGE-POLICY.md
- Fulfillment events (`shipping_wave.created`, `shipment.dispatched`, etc.) write to `business_events` (ULID, monthly partitioned)
- `ENG-GOV-006`: ecos_app role cannot DROP or TRUNCATE wave/shipment tables

> Full Standards: `docs/engineering/DATABASE-ENGINEERING-STANDARDS.md`  
> Change Policy: `docs/engineering/DATABASE-CHANGE-POLICY.md`  
> Partitioning Strategy: `docs/data/DATA-PARTITIONING-STRATEGY.md`

---

## Shipping Ownership Rules

**Decision Date:** 2026-07-12  
**Task:** TASK-SHIPPING-CONSOLIDATION-001

ECOS defines two distinct layers for geography and shipping. Each layer has a single owner with exclusive responsibility.

---

### Layer 1 — Reference Layer: Egypt Geography

**Owner:** `Modules/Logistics/Geography`  
**Tables:** `logistics_governorates`, `logistics_cities`, `logistics_city_aliases`  
**Purpose:** Canonical master data — every governorate and city in Egypt with official names, aliases, and codes.

**Rules:**
- Contains **reference data only**. No commercial rules. No pricing. No brand-specific settings.
- Every other module that needs geography data reads from this layer.
- Adding a new city or governorate is an infrastructure operation, not a business configuration.
- Managed via the Logistics OS → Egypt Geography workspace.

---

### Layer 2 — Commercial Policy Layer: Brand Shipping

**Owner:** `Modules/Organization/Brands` → Brand Drawer → Shipping & Delivery tab  
**Tables:** `brand_shipping_settings`, `brand_governorate_settings`, `brand_city_settings`  
**Purpose:** Each brand's commercial delivery policy — which areas it serves, at what price, under what rules.

**Rules:**
- All shipping business logic lives here: coverage, pricing, COD, free shipping, SLA, unsupported area action.
- The `ShippingEngine` (`Modules/Organization/Brands/Application/Services/ShippingEngineService`) reads from these tables to evaluate whether an incoming order can be fulfilled and at what shipping cost.
- No shipping policy is stored in the legacy `config_delivery_geographies` / `config_delivery_zones` tables — those are superseded.

---

### Shipping Engine Contract

All order sources (WooCommerce, Manual Order, POS Delivery, future API/Mobile) **must** call the Shipping Engine before creating or accepting an order. Walk-in POS is the sole exception.

```
ShippingEngineContract::evaluate(
    brandId:         string,
    governorateId:   int,
    cityId:          ?int,
    isDeliveryOrder: bool
): ShippingValidationResult
```

`ShippingValidationResult` has four outcomes:

| Decision | Meaning | Order Status |
|---|---|---|
| `allow` | Area supported, quote attached | Proceeds normally |
| `pendingReview` | Area unsupported, brand policy = review | `needs_shipping_review` |
| `reject` | Area unsupported, brand policy = reject | HTTP 422 returned to caller |
| `walkIn` | No governorate provided (POS walk-in) | Bypasses shipping engine |

> `needs_shipping_review` (`OrderStatus::NeedsShippingReview`) is the dedicated status for shipping validation failures that the brand has elected to review rather than reject. It must **never** be conflated with `pending` (generic holding state).

---

## Related Documents

- ADR-006: Inventory Domain Events
- ADR-009: Batch Operational State Machine (see update in TASK-FULFILLMENT-ARCH-001)
- ADR-012: Unified Enterprise Pricing Policy
- ADR-013: Batch Strategy Pattern (see update in TASK-FULFILLMENT-ARCH-001)
- `ENTERPRISE-FULFILLMENT-PLATFORM.md` — full platform specification
- `LOADING-ALLOCATION-OS-SPEC.md` — Loading & Allocation OS detail
- `VEHICLE-ARCHITECTURE-SPEC.md` — Vehicle as Mobile Warehouse detail
- `FULFILLMENT-PROFILES-SPEC.md` — Fulfillment Profile configuration
- `GEOGRAPHY-COVERAGE-ENGINE.md` — Geography & Coverage Engine (TASK-FULFILLMENT-ARCH-002)
- `VEHICLE-PLANNING-ENGINE.md` — Vehicle Planning Engine (TASK-FULFILLMENT-ARCH-002)
- `PRODUCT-ALLOCATION-ENGINE.md` — Product Allocation Engine (TASK-FULFILLMENT-ARCH-002)
- `PARTIAL-FULFILLMENT-RULES.md` — Partial Fulfillment Rules (TASK-FULFILLMENT-ARCH-002)
- `docs/contracts/ENTERPRISE-CONTRACTS.md` — Enterprise Integration Contracts
