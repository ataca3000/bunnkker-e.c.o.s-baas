# Product Allocation Engine — Specification

**Document:** PRODUCT-ALLOCATION-ENGINE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-FULFILLMENT-ARCH-002  
**ADR Reference:** ADR-015  
**Position in Platform:** After Vehicle Loading — operates on Vehicle Inventory, not Warehouse Inventory

---

## 1. Mission

> Allocate Vehicle Inventory to the orders on that vehicle, producing a definitive delivery manifest per order.

The Product Allocation Engine answers the question: **given that a vehicle is loaded with N units of product X, which of its assigned orders receive which quantities?**

Allocation is a post-loading operation. It does not touch warehouse inventory. It operates exclusively on `VehicleInventoryItem` records and produces `OrderAllocation` records.

---

## 2. Critical Distinction: Allocation vs. Loading

| Concept | When | What is allocated | Owner |
|---|---|---|---|
| **Reservation** | Order confirmed | Warehouse inventory reserved | Inventory Module |
| **Loading** | Loading Session | Pool → Vehicle inventory | Loading & Allocation OS |
| **Allocation** | After loading | Vehicle inventory → Order | **Product Allocation Engine** |
| **Delivery** | On route | Allocated qty confirmed delivered | Logistics OS |

Allocation happens AFTER the vehicle is loaded. A product unit's lifecycle:

```
Warehouse Stock
  → (reservation)   reserved_qty incremented
  → (pool)          PreparedProductsPool entry created
  → (loading)       VehicleInventoryItem created
  → (allocation)    OrderAllocation record created    ← THIS ENGINE
  → (delivery)      VehicleInventoryMovement(delivered) created
```

---

## 3. Allocation Modes

Seven allocation modes are supported. The active mode is defined in the Fulfillment Profile's `vehicle_allocation` stage config.

| Mode | Description | Best For |
|---|---|---|
| `full_auto` | System allocates all orders automatically using active priority policy | Standard channels |
| `partial_auto` | System allocates what it can; gaps flagged for manual resolution | Shortage scenarios |
| `manual` | Dispatcher allocates every order manually | Premium/special channels |
| `ai_suggested` | AI proposes allocation; dispatcher reviews + approves | High-volume optimization |
| `priority` | Allocate highest-priority orders first; remaining orders get what's left | SLA-critical |
| `fifo` | Allocate in order of order creation timestamp | Standard fairness policy |
| `custom_policy` | Execute a named custom allocation policy (configurable, see Section 5) | Business-specific rules |

---

## 4. Default Priority Policy

When allocation mode is `full_auto` or `priority`, the engine follows the **Order Priority Policy** to determine allocation sequence.

### Default Priority Ranking

```
Priority 1 (Highest): Paid Orders
  └── reason: payment received, highest commitment level

Priority 2: COD Orders (Cash on Delivery)
  └── reason: customer commitment via order; payment at door

Priority 3: Deferred Orders
  └── reason: deliberately scheduled for later delivery

Priority 4: Others
  └── reason: catch-all for non-standard order types
```

> **This priority ranking is configurable.** It is never hardcoded in the engine. The active priority policy is defined in the channel's Fulfillment Profile and stored as an ordered list of order types.

### Priority Policy Entity

```
AllocationPriorityPolicy
├── id                    uuid
├── profile_id            → FulfillmentProfile
├── name                  string
├── priority_rules[]      → AllocationPriorityRule[] (ordered)
└── is_default            bool
```

```
AllocationPriorityRule
├── policy_id             → AllocationPriorityPolicy
├── sequence              int         — 1 = highest priority
├── condition_type        enum:
│                           payment_status    — by order payment status
│                           order_type        — by order type (retail/wholesale/etc)
│                           customer_tier     — by customer loyalty tier
│                           order_value       — by order total value
│                           sla_deadline      — by remaining time to SLA
│                           custom_flag       — by a boolean field on the order
├── condition_value       string      — e.g. "paid", "cod", "gold_tier"
└── tiebreak_by           enum: order_created_at | order_value | random
```

---

## 5. Custom Allocation Policies

For channels with complex allocation rules, a Custom Allocation Policy can be defined as a named, versioned ruleset.

```
CustomAllocationPolicy
├── id                    uuid
├── company_id            → Company
├── name                  string
├── description           string
├── version               int
├── rules[]               → CustomAllocationRule[] (evaluated in order)
└── is_active             bool
```

```
CustomAllocationRule
├── policy_id             → CustomAllocationPolicy
├── sequence              int
├── condition_field       string    — e.g. "order.payment_status", "order.customer_tier"
├── condition_operator    enum: eq | neq | gt | gte | lt | lte | in | not_in
├── condition_value       string
├── allocation_action     enum:
│                           allocate_full     — allocate full requested quantity
│                           allocate_partial  — allocate up to available
│                           skip              — do not allocate to this order now
│                           defer             — move to next allocation cycle
│                           escalate          — flag for supervisor decision
└── notes                 string (nullable)
```

---

## 6. OrderAllocation Entity

Every allocation decision produces an `OrderAllocation` record. This is the definitive record of what a driver should deliver for each order.

```
OrderAllocation
├── id                    uuid
├── vehicle_id            → Vehicle
├── wave_id               → ShippingWave
├── order_id              → Order
├── order_line_id         → OrderLine
├── product_id            → Product
├── allocation_mode       enum (see Section 3)
├── priority_rank         int         — which priority level this order was assigned
│
├── quantity_requested    decimal(18,4)  — what the order originally required
├── quantity_allocated    decimal(18,4)  — what was allocated to this order
├── quantity_loaded       decimal(18,4)  — what is actually on the vehicle
├── quantity_delivered    decimal(18,4)  — confirmed delivered (updated by Logistics OS)
├── quantity_remaining    decimal(18,4)  — computed: allocated - delivered
│
├── is_partial            bool          — allocated < requested
├── partial_reason        string (nullable) — why allocation is partial
│
├── allocated_by          enum: system | dispatcher | driver
├── allocated_by_user_id  → User (nullable — null for system allocation)
├── allocated_at          timestamp
├── override_reason       string (nullable) — required if allocated_by ≠ system
│
└── allocation_history[]  → AllocationRevision[] (see Section 7)
```

---

## 7. Decision Hierarchy

Allocation decisions flow through three tiers. No tier may skip a tier above it — each override must acknowledge the previous decision.

```
System Recommendation (automatic)
          ↓
Dispatcher Override (optional, requires reason)
          ↓
Driver Override (optional, requires reason)
          ↓
Final Allocation (the record that drives delivery)
```

**Non-destructive history:** Every change creates a new `AllocationRevision` record. The original system allocation is never deleted.

### AllocationRevision Entity (immutable log)

```
AllocationRevision
├── id                    uuid
├── allocation_id         → OrderAllocation
├── revision_number       int           — 1 = original system allocation
├── actor_type            enum: system | dispatcher | driver
├── actor_id              → User (nullable for system)
├── quantity_before       decimal(18,4)
├── quantity_after        decimal(18,4)
├── reason                string        — required for all non-system revisions
└── recorded_at           timestamp
```

**Rule:** `AllocationRevision` records are immutable. They cannot be modified or deleted after creation.

---

## 8. Driver Override Authority

The driver operates in the field. They have authority to adjust their own vehicle's allocation up until they start delivering.

### Driver Allowed Actions

| Action | Description | Constraint |
|---|---|---|
| **Increase allocation** | Allocate more of a product to an order | Cannot exceed `quantity_loaded` on vehicle |
| **Decrease allocation** | Reduce quantity for an order | Cannot reduce below 0; freed quantity becomes available for other orders |
| **Split allocation** | Give partial quantity now; remainder at next delivery | Requires Partial Fulfillment to be enabled in profile |
| **Delay allocation** | Defer delivery of an order to later today or next trip | Requires supervisor notification |

**In all cases: reason is mandatory. Without a reason, the override is rejected by the system.**

### Driver Override Limits

The Fulfillment Profile may constrain driver override authority:

```
FulfillmentProfile.driver_authority_config (JSONB)
├── can_increase_allocation   bool
├── can_decrease_allocation   bool
├── can_split_allocation      bool
├── can_delay_allocation      bool
└── require_supervisor_approval_for_decrease  bool
```

---

## 9. Allocation Execution Flow

```
1. VehiclePlan approved + Loading Session completed
        ↓
2. AllocationEngine.allocate(vehicle_id, wave_id)
        ↓
3. Load orders assigned to this vehicle (from VehiclePlanSlot)
        ↓
4. Load vehicle inventory (VehicleInventoryItem records)
        ↓
5. Apply active AllocationPriorityPolicy: sort orders by priority
        ↓
6. For each order (in priority order):
        a. Calculate quantity_requested per product per order line
        b. Check quantity available on vehicle (not yet allocated)
        c. Allocate min(requested, available)
        d. If allocated < requested → mark as partial
        e. Write OrderAllocation record
        ↓
7. If any orders have partial allocation:
        a. Check Fulfillment Profile: is partial delivery allowed?
        b. If NO → raise PartialAllocationException (blocking)
        c. If YES → flag for planner review (warning)
        ↓
8. AllocationCompleted event emitted
        ↓
9. Dispatcher reviews (if manual or ai_suggested mode, or if exceptions)
        ↓
10. Driver receives allocation manifest (via Driver App / Print)
```

---

## 10. Shortage Handling

When vehicle inventory is insufficient to fully allocate all orders:

| Scenario | Action |
|---|---|
| Vehicle loaded less than planned | Check partial_fulfillment_rules in profile |
| Product damaged during loading | LoadingException raised; allocation skipped for that product |
| Order added after allocation | Re-run allocation for affected vehicle only |
| Driver discovers missing product on route | Driver creates shortage report; allocation revised |

---

## 11. Allocation Summary

After all allocations are complete, the engine produces a summary per vehicle:

```
AllocationSummary
├── vehicle_id
├── wave_id
├── total_orders              int
├── fully_allocated_orders    int
├── partially_allocated_orders int
├── unallocated_orders        int
├── total_products            int
├── allocation_coverage_pct   decimal (fully_allocated / total × 100)
└── exceptions[]
```

---

## 12. AI Integration (Future)

| Entry Point | Capability |
|---|---|
| EP-A1 | Predict optimal allocation sequence to maximize delivery success rate |
| EP-A2 | Detect allocation patterns that correlate with failed deliveries |
| EP-A3 | Suggest partial allocation splits that minimize customer impact |
| EP-A4 | Dynamic reallocation: when a delivery fails, suggest best reallocation |

---

## 12B. Configuration Platform Dependency (TASK-CONFIGURATION-ARCH-001)

The Product Allocation Engine does not contain hardcoded priority rules. All priority ordering, allocation modes, and override permissions are governed by `AllocationPolicy`.

### Policy Consumed: `AllocationPolicy`

```php
$policy = $policyEngine->resolve(AllocationPolicy::class, 'channel', $channelId);
$result = $ruleEngine->evaluate($policy, [
    'order'            => $order,
    'vehicle_inventory' => $vehicleInventory,
    'actor_type'       => 'system',
], 'order_allocation_priority');
// Returns: { decision: { priority_rank: 1 }, reason: "Paid order — rule sequence 1 matched", ... }
```

### Configuration Settings Governing This Engine

| Setting Key | Description |
|---|---|
| `fulfillment.allocation.mode` | Default allocation mode |
| `fulfillment.allocation.priority_policy` | Active AllocationPriorityPolicy name |
| `fulfillment.allocation.allow_dispatcher_override` | Dispatchers may override |
| `fulfillment.allocation.allow_driver_override` | Drivers may override |
| `fulfillment.allocation.allow_partial_allocation` | Partial allocation permitted |

### Feature Flag

```
modules.product_allocation   — must be enabled for this engine to run
```

### Audit

Every allocation decision (system, dispatcher, or driver) produces a `PolicyEvaluationAudit` record. The `RuleEvaluationResult` is stored alongside the `OrderAllocation.allocation_history[]`. This creates two complementary audit trails — one in the Configuration Platform and one in the allocation domain model.

---

## 13. DDD Module Structure

```
Modules/
└── Operations/
    └── ProductAllocation/
        ├── Domain/
        │   ├── Models/
        │   │   ├── OrderAllocation.php
        │   │   ├── AllocationRevision.php
        │   │   ├── AllocationPriorityPolicy.php
        │   │   └── CustomAllocationPolicy.php
        │   ├── Enums/
        │   │   ├── AllocationMode.php
        │   │   └── AllocationActorType.php
        │   ├── Services/
        │   │   └── AllocationPriorityResolver.php
        │   └── Exceptions/
        │       ├── PartialAllocationException.php
        │       └── AllocationOverrideUnauthorizedException.php
        ├── Application/
        │   ├── Services/
        │   │   ├── AllocateVehicleInventoryService.php
        │   │   ├── DispatcherOverrideAllocationService.php
        │   │   ├── DriverOverrideAllocationService.php
        │   │   └── ReallocateAfterShortageService.php
        │   └── Queries/
        │       ├── GetAllocationManifestQuery.php
        │       └── GetAllocationSummaryQuery.php
        ├── Infrastructure/
        └── Presentation/
```
