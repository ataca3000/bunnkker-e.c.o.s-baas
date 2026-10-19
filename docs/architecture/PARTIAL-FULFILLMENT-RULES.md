# Partial Fulfillment Rules — Specification

**Document:** PARTIAL-FULFILLMENT-RULES  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-FULFILLMENT-ARCH-002  
**ADR Reference:** ADR-015  
**Scope:** Cross-cutting — applies to Allocation, Packing, and Delivery stages

---

## 1. Core Principle

> Partial fulfillment behavior is **fully configurable per Fulfillment Profile**. No stage in the platform may hardcode a partial fulfillment decision.

"Partial fulfillment" means delivering or processing less than the full ordered quantity for an order line. Whether this is allowed, how it is handled, and who must approve it are all determined by the channel's Fulfillment Profile — not by the application code.

---

## 2. Three Partial Fulfillment Dimensions

Partial fulfillment can occur at three independent stages. Each is independently configured:

| Dimension | When | Description |
|---|---|---|
| **Partial Allocation** | After vehicle loading | Vehicle inventory < order's requested quantity |
| **Partial Packing** | During Packing OS | Packing materials or labels short; unable to pack full order |
| **Partial Delivery** | On route | Driver delivers less than allocated (customer refused, address failed, etc.) |

Each dimension has its own `allow_*` flag in the Fulfillment Profile.

---

## 3. Fulfillment Profile Configuration

The `partial_fulfillment_config` JSONB block is added to every Fulfillment Profile:

```json
{
  "partial_fulfillment_config": {
    "allow_partial_allocation": true,
    "allow_partial_packing": false,
    "allow_partial_delivery": true,
    "require_manager_approval_for_partial_allocation": true,
    "require_manager_approval_for_partial_delivery": false,
    "require_customer_approval_for_partial_delivery": false,
    "driver_authority": {
      "can_increase_allocation": true,
      "can_decrease_allocation": true,
      "can_split_allocation": true,
      "can_delay_allocation": false,
      "require_supervisor_approval_for_decrease": true
    }
  }
}
```

### Configuration Fields

| Field | Type | Description |
|---|---|---|
| `allow_partial_allocation` | bool | Allow orders to be dispatched with less than full quantity |
| `allow_partial_packing` | bool | Allow partial packing of order boxes |
| `allow_partial_delivery` | bool | Allow delivery of less than allocated quantity |
| `require_manager_approval_for_partial_allocation` | bool | Block partial allocation until manager approves |
| `require_manager_approval_for_partial_delivery` | bool | Block partial delivery until manager approves |
| `require_customer_approval_for_partial_delivery` | bool | **Future** — notify and confirm with customer before partial delivery |
| `driver_authority.*` | object | What drivers are allowed to change in their own allocation |

---

## 4. Profile Examples

### Profile A — High-Volume Distribution

```json
{
  "name": "High-Volume Distribution",
  "partial_fulfillment_config": {
    "allow_partial_allocation": true,
    "allow_partial_packing": false,
    "allow_partial_delivery": false,
    "require_manager_approval_for_partial_allocation": true,
    "require_manager_approval_for_partial_delivery": false,
    "driver_authority": {
      "can_increase_allocation": false,
      "can_decrease_allocation": true,
      "can_split_allocation": false,
      "can_delay_allocation": false,
      "require_supervisor_approval_for_decrease": true
    }
  }
}
```

**Rules:**
- Vehicle may dispatch with partial load (manager must approve)
- Driver may not increase their allocation or split deliveries
- Partial delivery is NOT allowed — driver must return undelivered items

---

### Profile B — Premium Per-Order

```json
{
  "name": "Premium Per-Order Handover",
  "partial_fulfillment_config": {
    "allow_partial_allocation": false,
    "allow_partial_packing": false,
    "allow_partial_delivery": false,
    "require_manager_approval_for_partial_allocation": true,
    "require_manager_approval_for_partial_delivery": false,
    "driver_authority": {
      "can_increase_allocation": false,
      "can_decrease_allocation": false,
      "can_split_allocation": false,
      "can_delay_allocation": false,
      "require_supervisor_approval_for_decrease": true
    }
  }
}
```

**Rules:**
- Zero partial operations allowed
- Every order must be fully allocated, fully packed, fully delivered
- No driver authority to modify allocation
- Premium channel requires complete fulfillment or nothing

---

### Profile C — Wholesale / Flexible

```json
{
  "name": "Wholesale Flexible",
  "partial_fulfillment_config": {
    "allow_partial_allocation": true,
    "allow_partial_packing": true,
    "allow_partial_delivery": true,
    "require_manager_approval_for_partial_allocation": false,
    "require_manager_approval_for_partial_delivery": false,
    "driver_authority": {
      "can_increase_allocation": true,
      "can_decrease_allocation": true,
      "can_split_allocation": true,
      "can_delay_allocation": true,
      "require_supervisor_approval_for_decrease": false
    }
  }
}
```

**Rules:**
- Full flexibility — all partial operations allowed
- Driver has maximum authority
- Wholesale relationships accept partial fulfillment
- Remaining quantities create automatic follow-up orders

---

## 5. Partial Fulfillment Events

When partial fulfillment occurs at any stage, a structured event is recorded:

```
PartialFulfillmentEvent
├── id
├── event_type            enum:
│                           partial_allocation    — at allocation stage
│                           partial_packing       — at packing stage
│                           partial_delivery      — at delivery stage
├── order_id              → Order
├── order_line_id         → OrderLine
├── product_id            → Product
├── quantity_expected     decimal(18,4)
├── quantity_actual       decimal(18,4)
├── shortage_quantity     decimal(18,4)    — computed: expected - actual
├── reason_type           enum:
│                           vehicle_shortage      — vehicle had less than needed
│                           product_damage        — product damaged
│                           customer_refused      — customer refused partial
│                           address_failure       — delivery address problem
│                           driver_decision       — driver override
│                           supervisor_decision   — supervisor override
│                           system_policy         — blocked by profile config
├── reason_notes          string (nullable)
├── actor_type            enum: system | supervisor | dispatcher | driver
├── actor_id              → User
├── approval_required     bool
├── approved_by           → User (nullable)
├── approved_at           timestamp (nullable)
└── created_at            timestamp
```

---

## 6. Approval Workflow

When `require_manager_approval_for_partial_*` is `true`, the following flow applies:

```
Partial condition detected
        ↓
PartialFulfillmentEvent created (status: pending_approval)
        ↓
Supervisor notified (push notification + Command Center alert)
        ↓
Supervisor reviews:
    ├── Approve   → Event status: approved; fulfillment continues
    └── Reject    → Event status: rejected; order is blocked; escalated to dispatcher
```

**If supervisor is unavailable:** The system holds the operation. No partial fulfillment proceeds without approval when approval is required — even if the driver is waiting.

**Timeout policy (configurable per profile):**
- `approval_timeout_minutes`: after this time, auto-escalate to next supervisor level
- `approval_timeout_action`: enum: `auto_approve` | `auto_reject` | `escalate_only`

---

## 7. The Immutable Decision Record

Every partial fulfillment decision — whether made by the system, a supervisor, a dispatcher, or a driver — is stored permanently and can never be overwritten.

```
Partial fulfillment is not a "state" — it is a chain of decisions.
```

The full chain is always accessible:

```
Order #ORD-00234, Product: Honey 500g
  Requested: 5 units
  
  Decision 1 (system, allocation):
    Allocated: 4 units
    Reason: vehicle_shortage (1 unit not on vehicle)
    Status: partial_allocation_approved (manager approved at 06:35)
  
  Decision 2 (driver, delivery):
    Delivered: 3 units
    Reason: customer_refused (customer only wanted 3)
    Status: driver_override (no supervisor approval required per profile)
  
  Final delivered: 3 of 5 units
  Remaining: 2 units → triggers follow-up order creation
```

---

## 8. Follow-Up Order Rules

When partial delivery is allowed and occurs, the system must decide what to do with undelivered quantities.

### FollowUpPolicy (configurable per profile)

```json
{
  "follow_up_policy": {
    "auto_create_follow_up_order": true,
    "follow_up_delivery_window_hours": 24,
    "notify_customer_on_partial": true,
    "undelivered_quantity_disposition": "return_to_pool"
  }
}
```

| Field | Description |
|---|---|
| `auto_create_follow_up_order` | Automatically create a new order for the undelivered quantity |
| `follow_up_delivery_window_hours` | SLA for the follow-up delivery |
| `notify_customer_on_partial` | Send customer notification when partial delivery occurs |
| `undelivered_quantity_disposition` | What to do with undelivered product: `return_to_pool`, `return_to_warehouse`, `hold_on_vehicle` |

---

## 9. Integration Points

| Module | Interaction |
|---|---|
| **Fulfillment Profiles** | Partial rules are read from profile config; never hardcoded |
| **Product Allocation Engine** | Reads `allow_partial_allocation` before creating partial allocations |
| **Packing OS** | Reads `allow_partial_packing` before starting partial pack jobs |
| **Logistics OS** | Reads `allow_partial_delivery` + `require_customer_approval` before confirming partial delivery |
| **Driver App** | Reads `driver_authority` config to show/hide driver override options |
| **Commerce** | Creates follow-up orders when `auto_create_follow_up_order = true` |

---

## 9B. Configuration Platform Dependency (TASK-CONFIGURATION-ARCH-001)

Partial Fulfillment Rules are not hardcoded in any module. They are resolved from `FulfillmentPolicy` through the Policy Engine.

### Policy Consumed: `FulfillmentPolicy`

```php
$policy = $policyEngine->resolve(FulfillmentPolicy::class, 'channel', $channelId);
$result = $ruleEngine->evaluate($policy, [
    'dimension'    => 'partial_delivery',
    'order'        => $order,
    'vehicle'      => $vehicle,
    'actor_type'   => 'driver',
], 'partial_fulfillment_permission');
// Returns: { decision: { allowed: false }, reason: "Profile B: partial delivery not permitted", ... }
```

### Configuration Settings Governing This Module

| Setting Key | Description |
|---|---|
| `channels.allow_partial_delivery` | Partial deliveries permitted for this channel |
| `fulfillment.allocation.allow_partial_allocation` | Partial allocation permitted |
| `fulfillment.packing.mode` | Packing mode (affects partial packing behavior) |

### Feature Flag

Partial fulfillment rules are enforced by the module that executes the relevant stage. No separate feature flag — the rules are embedded in FulfillmentPolicy.

### Audit

Every `PartialFulfillmentEvent` references the `PolicyEvaluationAudit` record that permitted or blocked it. This creates a complete chain:

```
PartialFulfillmentEvent → PolicyEvaluationAudit → ConfigurationVersion
```

---

## 10. Key Business Rules (Enforcement Points)

| Rule | Where Enforced |
|---|---|
| Partial allocation blocked if `allow_partial_allocation = false` | Product Allocation Engine |
| Partial allocation requires approval if `require_manager_approval_for_partial_allocation = true` | Product Allocation Engine |
| Driver cannot increase allocation if `can_increase_allocation = false` | Product Allocation Engine |
| Partial delivery blocked if `allow_partial_delivery = false` | Logistics OS |
| Driver cannot delay allocation if `can_delay_allocation = false` | Driver App + Product Allocation Engine |
| All partial fulfillment events are immutable after creation | Domain model constraint |
| Reason is mandatory for all non-system decisions | Product Allocation Engine + Logistics OS |
