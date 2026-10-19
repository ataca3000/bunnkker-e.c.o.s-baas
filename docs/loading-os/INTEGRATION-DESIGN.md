# Loading & Allocation OS — Integration Design

**Document:** INTEGRATION-DESIGN  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-LOAD-001  
**Parent:** BLUEPRINT.md

---

## 1. Integration Map

```
Preparation OS ──────────────────── Prepared Products Pool ──────────► Loading OS
                                                                              │
                    Orders ──────────────────────────────────────────────────►│
                    Reservations ────────────────────────────────────────────►│
                    Inventory ───────────────────────────────────────────────►│
                    Vehicles (Fleet) ─────────────────────────────────────────►│
                    Shipping Companies ──────────────────────────────────────►│
                                                                              │
Loading OS ─────────────────────────────────────────────────────────────────►│
                    Logistics OS ◄───────────────────────────────────────────┤
                    Packing OS ◄─────────────────────────────────────────────┤
                    Timeline ◄───────────────────────────────────────────────┤
                    Documents ◄──────────────────────────────────────────────┤
                    Notifications ◄──────────────────────────────────────────┤
                    AI Platform ◄────────────────────────────────────────────┤
```

---

## 2. Preparation OS Integration

**Relationship:** Upstream supplier. Loading OS consumes the output of Preparation OS.

### 2.1 Prepared Products Pool (Primary Bridge)

The `prepared_products_pool` table is the shared contract between Preparation OS and Loading OS.

| Field | Used By Loading OS | Purpose |
|---|---|---|
| `id` | All vehicle loading operations | Pool entry identifier |
| `company_id` | Company isolation | Scoping |
| `wave_id` | Traceability | Links loaded product back to preparation wave |
| `product_id` | Loading tasks + allocation | Which product |
| `quantity_available` | Vehicle loading | How much can be loaded |
| `status` | State machine | `available` → `loading` → `loaded` |
| `warehouse_id` | Location | Where to pick up for loading |

**Status Transitions Owned by Loading OS:**
- `available` → `loading`: when LoadVehicleAction begins loading this pool entry
- `loading` → `loaded`: when LoadVehicleAction completes
- `loading` → `available`: compensating action on CancelLoadingSessionAction

**Status Transitions Owned by Preparation OS:**
- `preparing` → `available`: when preparation completes

**No DB-level FK:** Loading OS reads the pool by UUID; no foreign key constraint. Application-layer validation only.

### 2.2 Events Consumed from Preparation OS

| Event | Loading OS Action |
|---|---|
| `preparation.pool.entry.available` | Signal to loading session that new entries exist (if session in `planning`) |
| `preparation.wave.completed` | Trigger auto-creation check: are there enough pool entries to create a loading session? |

### 2.3 Events Published to Preparation OS

| Event | When | Preparation OS Action |
|---|---|---|
| `loading.session.closed` | Session fully dispatched | Preparation OS logs the wave as `dispatched` |
| `loading.session.cancelled` | Session cancelled | Pool entries returned to `available`; Preparation OS notified |

---

## 3. Orders Integration

**Relationship:** Loading OS reads Orders; publishes back order status updates.

### 3.1 Data Read from Orders

Loading OS reads order data at these points:

| Data | Read At | Purpose |
|---|---|---|
| `order.id`, `order.number` | Vehicle Plan generation | Identifying which orders go on which vehicle |
| `order.shipping_address` | Geography Engine | Geocoding/zone resolution |
| `order.delivery_zone_id` | Geography Engine | Pre-resolved zone |
| `order.channel_id` | Shipping Company selection | Channel shipping preference |
| `order.payment_method` | Allocation priority | COD vs paid priority |
| `order.total_value` | Vehicle capacity | Max collection value check |
| `order.lines[]` | Allocation | Which products, which quantities |
| `order.delivery_window_start` / `_end` | Route constraints | Time-window delivery enforcement |
| `order.notes` | Driver manifest | Special instructions |

**Cross-domain read:** Loading OS reads via EloquentOrderReader (soft FK — UUID reference, no DB constraint to orders table in a different module boundary).

### 3.2 Order Status Updates Published by Loading OS

| Event Trigger | Order Status Update |
|---|---|
| `AllocationCompleted` | Order.fulfillment_status → `allocated` |
| `VehicleReleased` | Order.fulfillment_status → `out_for_delivery` |
| `LoadingSessionClosed` | Order.fulfillment_status stays `out_for_delivery` (Logistics takes over) |
| `LoadingSessionCancelled` | Order.fulfillment_status → `pending_dispatch` (returned to pool) |
| Partial allocation accepted | Order.fulfillment_status → `partially_allocated` |

**Order status updates are published as events** (`loading.allocation.completed`, etc.) and consumed by the Orders module listener — Loading OS does not write to the orders table directly.

---

## 4. Reservations Integration

**Relationship:** Loading OS reads reservations to validate allocated quantities match reserved stock.

### 4.1 Reservation Reads

| Validation | When |
|---|---|
| `reservation.quantity_reserved` ≥ `allocation.quantity_allocated` | Before AllocationApproval |
| Reservation status = `active` | Before loading begins |

**No direct writes to reservations from Loading OS.** Reservation release (if order cancelled or deferred) is handled by the Orders module in response to Loading OS events.

---

## 5. Inventory Integration

**Relationship:** Loading OS reads stock for validation; Inventory module updates stock on VehicleLoaded event.

### 5.1 Loading OS → Inventory (via events)

| Event | Inventory Action |
|---|---|
| `loading.vehicle.loaded` | `InventoryListener` → decrements `warehouse_stock.quantity_reserved` by loaded qty; decrements `quantity_available` |
| `loading.session.cancelled` | `InventoryListener` → returns loaded qty to `quantity_available` for not-yet-loaded pool entries |
| `logistics.delivery.completed` (inbound) | `InventoryListener` → marks reservation as fulfilled |

### 5.2 Stock Validation Before Loading

Before LoadVehicleAction executes:
1. Query `stock_ledger_entries` to confirm product exists in warehouse with enough reserved qty
2. Confirm `prepared_products_pool.quantity_available` ≥ loading task qty
3. If mismatch: raise `StockDiscrepancyException`; pause loading; alert dispatcher

---

## 6. Vehicles (Fleet) Integration

**Relationship:** Loading OS reads vehicle registry; publishes vehicle state changes.

### 6.1 Data Read from Fleet

| Data | Read At | Purpose |
|---|---|---|
| `vehicle.id` | Assignment | Which vehicle |
| `vehicle.plate_number` | Manifests, driver app | Identification |
| `vehicle.max_weight_kg` | Capacity check | Hard limit |
| `vehicle.max_volume_m3` | Capacity check | Hard limit |
| `vehicle.vehicle_type` | Routing + product constraints | Refrigerated, flatbed, etc. |
| `vehicle.service_area_ids` | Vehicle Planning | Which zones the vehicle can serve |
| `vehicle.status` | Assignment | `available` only |

**No direct write to vehicles table from Loading OS.** Fleet integration is event-driven.

### 6.2 Events Published to Fleet

| Event | Fleet Action |
|---|---|
| `loading.vehicle.assigned` | Fleet marks vehicle as `allocated` |
| `loading.vehicle.released` | Fleet updates vehicle to `on_route` |
| `loading.session.cancelled` | Fleet returns vehicle to `available` |

---

## 7. Shipping Companies Integration

**Relationship:** Loading OS reads shipping company profiles for capacity, coverage, and policy enforcement.

### 7.1 Data Read from Shipping Companies

| Data | Read At | Purpose |
|---|---|---|
| `shipping_company.coverage_zones[]` | Geography Engine | Which zones are served |
| `shipping_company.max_weight_per_vehicle` | Vehicle Planning | Capacity constraint |
| `shipping_company.max_orders_per_vehicle` | Vehicle Planning | Capacity constraint |
| `shipping_company.max_cod_value` | Policy enforcement | COD limit per vehicle |
| `shipping_company.min_shipment_value` | Policy enforcement | Minimum value per shipment |
| `shipping_company.restricted_products[]` | Policy enforcement | Prohibited product list |
| `shipping_company.requires_manifest` | Document requirements | Whether a signed manifest is required |

**Shipping company data is read-only from Loading OS perspective.** No writes.

---

## 8. Logistics OS Integration

**Relationship:** Loading OS is upstream of Logistics OS. Vehicle release is the handoff point.

### 8.1 Handoff Protocol

When `ReleaseVehicleAction` executes:
1. Loading OS publishes `loading.vehicle.released`
2. `LogisticsHandoffListener` in Logistics OS receives the event
3. Logistics OS creates a `Shipment` record with:
   - `vehicle_assignment_id` (reference back to Loading OS)
   - `route_plan_id` (from Loading OS route plan)
   - `driver_id`
   - `orders[]` (from allocation records)
   - `manifests[]` (generated by Loading OS)

**Logistics OS does NOT pull data from Loading OS tables directly.** All data needed is in the event payload or fetched via the API `/api/v1/loading/vehicle-assignments/{id}/allocation-summary`.

### 8.2 Inbound from Logistics OS

| Event | Loading OS Action |
|---|---|
| `logistics.delivery.completed` | Updates `vehicle_inventory_items.status = delivered` |
| `logistics.delivery.failed` | Updates `vehicle_inventory_items.status = returned`; raises LoadingException |
| `logistics.delivery.partial` | Updates allocation records with actual delivered qty |

---

## 9. Packing OS Integration

**Relationship:** Packing OS is optional. It sits between Loading OS (vehicle loading) and vehicle release.

### 9.1 Integration Mode

Packing OS is enabled/disabled per Fulfillment Profile (`packing_stage.enabled`).

**When Packing OS is enabled:**
- After VehicleLoaded event, vehicle enters `pending_packing` state (not directly `loaded`)
- Packing OS generates packing lists from allocation records
- When packing is complete, Packing OS publishes `packing.completed`
- Loading OS listener receives this; vehicle proceeds to allocation review

**When Packing OS is disabled:**
- VehicleLoaded → directly triggers allocation logic

### 9.2 Data Shared with Packing OS

Loading OS provides Packing OS with:
- Vehicle inventory items (what is on the vehicle)
- Allocation records (what is destined for which order)
- Order delivery notes and special handling instructions

---

## 10. Timeline Integration

Every significant Loading OS state transition writes a Timeline entry via `TimelineService::record()`.

| Subject Type | Subject ID | Used For |
|---|---|---|
| `LoadingSession` | session_id | Session-level timeline (visible in Loading Session drawer) |
| `VehicleAssignment` | assignment_id | Vehicle-level timeline (visible in Vehicle drawer) |
| `AllocationRecord` | allocation_id | Allocation-level timeline (visible in Allocation drawer) |

**TimelineService interface:**
```php
TimelineService::record(
    companyId:    string,
    subjectType:  string,      // 'LoadingSession'
    subjectId:    string,      // UUID
    eventType:    string,      // 'loading.vehicle.released'
    title:        string,      // 'Vehicle ABC-1234 released'
    description?: string,
    actorId?:     string,
    sourceModule: string,      // 'Operations.Loading'
    metadata?:    array
)
```

---

## 11. Documents Integration

Documents are attached to Loading Sessions and Vehicle Assignments via `DocumentService`.

| Document Type | Subject | When Created |
|---|---|---|
| `loading_manifest` | VehicleAssignment | After allocation approved |
| `driver_manifest` | VehicleAssignment | Before vehicle release |
| `loading_session_report` | LoadingSession | After session closed |
| `exception_report` | LoadingSession | If exceptions occurred |
| `partial_allocation_report` | LoadingSession | If partial allocations resolved |

**DocumentService interface:**
```php
DocumentService::attach(
    companyId:    string,
    subjectType:  string,      // 'VehicleAssignment'
    subjectId:    string,      // UUID
    documentType: string,      // 'loading_manifest'
    file:         UploadedFile,
    notes?:       string,
    actorId?:     string
)
```

---

## 12. Notifications Integration

| Notification | Trigger | Recipients | Channel |
|---|---|---|---|
| Session created | EVT-LOAD-001 | Loading managers | In-app + Email |
| Vehicle plan ready for review | EVT-LOAD-002 (requires_planner_review=true) | Loading managers | In-app |
| Driver assigned | EVT-LOAD-007 | Driver | Push (mobile) |
| Allocation needs approval | EVT-LOAD-005 | Loading managers | In-app |
| Partial allocation detected | EVT-LOAD-005 (orders_partial > 0) | Loading managers + Dispatchers | In-app + Email |
| Vehicle released | EVT-LOAD-008 | Loading managers, Driver | In-app + Push |
| Session closed | EVT-LOAD-009 | Loading managers | In-app + Email |
| Session cancelled | EVT-LOAD-010 | Loading managers, assigned drivers | In-app + Email + Push |

---

## 13. AI Platform Integration

See AI-INTEGRATION.md for complete AI integration design. Summary of integration points:

| AI Service | Called By | When |
|---|---|---|
| `VehiclePlanningRecommender` | GenerateVehiclePlanAction | When `loading.ai_allocation_suggestions` flag enabled |
| `RouteOptimizer` | RoutePlanAction | When `loading.route_optimization` flag enabled |
| `AllocationSuggestionEngine` | AllocateProductsAction | When allocation_mode = `ai_suggested` |
| `CapacityPredictor` | Dashboard query | On-demand analytics |
| `DeliveryRiskPredictor` | ReleaseVehicleAction | Before vehicle release |
| `BottleneckDetector` | Background job | Runs every 30 minutes during active sessions |
