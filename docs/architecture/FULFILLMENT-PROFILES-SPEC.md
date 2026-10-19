# Fulfillment Profiles — Configuration Specification

**Document:** FULFILLMENT-PROFILES-SPEC  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-04  
**Task:** TASK-FULFILLMENT-ARCH-001  
**ADR Reference:** ADR-015

---

## 1. Core Principle

> Fulfillment workflows are **configurable per channel**, not hardcoded.

The Channel Fulfillment Engine does not have a fixed sequence of stages. Each channel owns a Fulfillment Profile that specifies:
1. Which stages run
2. The order in which they run
3. Which stages are required vs. optional
4. Stage-specific configuration

No two channels need the same workflow. A high-volume distribution channel, a premium per-order handover channel, and a wholesale pallet channel can all coexist in the same system with completely different fulfillment sequences.

---

## 2. FulfillmentProfile Entity

```
FulfillmentProfile
├── id                    uuid
├── channel_id            → Channel (one profile per channel)
├── name                  string              — human-readable name (e.g. "Standard Distribution")
├── description           string (nullable)
├── stages[]              → FulfillmentStage[] (ordered)
├── is_active             bool
├── version               int                 — increments on every modification
├── created_by            → User
├── updated_by            → User
├── created_at            timestamp
└── updated_at            timestamp
```

Every channel has exactly one active Fulfillment Profile at any time.  
When a profile is modified, a new version is created. The Channel Fulfillment Engine always uses the latest active version.

---

## 3. FulfillmentStage Entity

```
FulfillmentStage
├── id                    uuid
├── profile_id            → FulfillmentProfile
├── stage_type            enum (see Section 4)
├── sequence_order        int     — 1-indexed; determines execution order
├── is_required           bool    — if true, order cannot proceed past this stage until complete
├── config                JSONB   — stage-specific settings (see Section 5)
├── on_exception          enum:
│                           halt           — stop the entire order; require supervisor resolution
│                           skip           — skip this stage and continue (only for optional stages)
│                           escalate       — notify supervisor but continue
└── created_at            timestamp
```

---

## 4. Stage Type Registry

The following stage types are available in the Stage Registry:

| Stage Type | Description | Owner Module |
|---|---|---|
| `preparation` | Prepare products from material reservation | Preparation OS |
| `vehicle_allocation` | Load products onto vehicle via Loading Session | Loading & Allocation OS |
| `packing` | Pack products into individual order boxes | Packing OS |
| `pallet_building` | Build pallets from boxes (wholesale) | Packing OS |
| `invoice_verification` | Verify supplier invoice against goods received | Procurement Module |
| `order_building` | Assemble final per-customer order from vehicle inventory | **Future — DO NOT IMPLEMENT** |
| `order_handover` | Formal handover of assembled order to driver | **Future — DO NOT IMPLEMENT** |
| `delivery` | Route execution and delivery confirmation | Logistics OS |

**Stage Registry guarantees:**
- Each stage type maps to exactly one module
- Each stage type has a defined input contract and a defined output contract
- Adding a new stage type requires a new module, not changes to existing modules

---

## 5. Stage-Specific Configuration (JSONB)

Each stage type accepts its own configuration schema.

### `preparation` config
```json
{
  "wave_size_max": 200,
  "auto_start": true,
  "quality_check_required": false
}
```

| Field | Type | Description |
|---|---|---|
| `wave_size_max` | int | Maximum products per preparation wave |
| `auto_start` | bool | Auto-start preparation when queue threshold is reached |
| `quality_check_required` | bool | Require QC sign-off before releasing to pool |

---

### `vehicle_allocation` config
```json
{
  "auto_wave_creation": true,
  "max_vehicles_per_wave": 10,
  "allow_partial_loading": true,
  "require_supervisor_approval_for_partial": true
}
```

| Field | Type | Description |
|---|---|---|
| `auto_wave_creation` | bool | Auto-create shipping wave from qualifying orders |
| `max_vehicles_per_wave` | int | Hard cap on vehicles per single shipping wave |
| `allow_partial_loading` | bool | Allow vehicle to dispatch without full load |
| `require_supervisor_approval_for_partial` | bool | Gate partial loading on supervisor sign-off |

---

### `packing` config
```json
{
  "mode": "per_order",
  "packing_materials_required": true,
  "label_format": "a4_standard",
  "pack_at_vehicle": false
}
```

| Field | Type | Description |
|---|---|---|
| `mode` | enum: `per_order` / `batch` | Pack each order individually, or batch pack |
| `packing_materials_required` | bool | Track packing material consumption |
| `label_format` | string | Label template identifier |
| `pack_at_vehicle` | bool | Pack at vehicle side (mobile packing); if false, packing is at a fixed station |

---

### `pallet_building` config
```json
{
  "pallet_capacity_kg": 800,
  "pallet_capacity_units": 50,
  "wrapping_required": true,
  "label_format": "pallet_a3"
}
```

---

### `invoice_verification` config
```json
{
  "tolerance_pct": 2.0,
  "auto_approve_within_tolerance": true,
  "require_signature": true
}
```

---

### `delivery` config
```json
{
  "route_optimization": true,
  "require_proof_of_delivery": true,
  "pod_type": "signature",
  "max_delivery_attempts": 3,
  "sla_hours": 24
}
```

| Field | Type | Description |
|---|---|---|
| `route_optimization` | bool | Use AI route optimization |
| `require_proof_of_delivery` | bool | Block completion without POD |
| `pod_type` | enum: `signature` / `photo` / `otp` / `none` | Proof of delivery method |
| `max_delivery_attempts` | int | Before auto-escalating to exception |
| `sla_hours` | int | Delivery SLA hours from dispatch |

---

## 6. Standard Profile Examples

### Profile A — High-Volume Distribution

```json
{
  "name": "High-Volume Distribution",
  "stages": [
    {
      "stage_type": "preparation",
      "sequence_order": 1,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "wave_size_max": 500,
        "auto_start": true,
        "quality_check_required": false
      }
    },
    {
      "stage_type": "vehicle_allocation",
      "sequence_order": 2,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "auto_wave_creation": true,
        "max_vehicles_per_wave": 20,
        "allow_partial_loading": true,
        "require_supervisor_approval_for_partial": true
      }
    },
    {
      "stage_type": "packing",
      "sequence_order": 3,
      "is_required": false,
      "on_exception": "escalate",
      "config": {
        "mode": "batch",
        "packing_materials_required": false,
        "pack_at_vehicle": true
      }
    },
    {
      "stage_type": "delivery",
      "sequence_order": 4,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "route_optimization": true,
        "require_proof_of_delivery": false,
        "max_delivery_attempts": 2,
        "sla_hours": 12
      }
    }
  ]
}
```

**Flow:** Preparation → Vehicle Allocation → Packing (optional) → Delivery

---

### Profile B — Premium Per-Order Handover

```json
{
  "name": "Premium Per-Order Handover",
  "stages": [
    {
      "stage_type": "preparation",
      "sequence_order": 1,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "wave_size_max": 50,
        "auto_start": false,
        "quality_check_required": true
      }
    },
    {
      "stage_type": "vehicle_allocation",
      "sequence_order": 2,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "auto_wave_creation": false,
        "max_vehicles_per_wave": 3,
        "allow_partial_loading": false,
        "require_supervisor_approval_for_partial": true
      }
    },
    {
      "stage_type": "packing",
      "sequence_order": 3,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "mode": "per_order",
        "packing_materials_required": true,
        "label_format": "premium_branded",
        "pack_at_vehicle": false
      }
    },
    {
      "stage_type": "delivery",
      "sequence_order": 4,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "route_optimization": true,
        "require_proof_of_delivery": true,
        "pod_type": "signature",
        "max_delivery_attempts": 3,
        "sla_hours": 48
      }
    }
  ]
}
```

**Flow:** Preparation → Vehicle Allocation → Packing (required, per-order, quality-checked) → Delivery

---

### Profile C — Wholesale / Pallet

```json
{
  "name": "Wholesale Pallet Fulfillment",
  "stages": [
    {
      "stage_type": "preparation",
      "sequence_order": 1,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "wave_size_max": 1000,
        "auto_start": true,
        "quality_check_required": true
      }
    },
    {
      "stage_type": "vehicle_allocation",
      "sequence_order": 2,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "auto_wave_creation": true,
        "max_vehicles_per_wave": 5,
        "allow_partial_loading": false,
        "require_supervisor_approval_for_partial": true
      }
    },
    {
      "stage_type": "pallet_building",
      "sequence_order": 3,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "pallet_capacity_kg": 800,
        "pallet_capacity_units": 50,
        "wrapping_required": true,
        "label_format": "pallet_a3"
      }
    },
    {
      "stage_type": "invoice_verification",
      "sequence_order": 4,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "tolerance_pct": 2.0,
        "auto_approve_within_tolerance": true,
        "require_signature": true
      }
    },
    {
      "stage_type": "delivery",
      "sequence_order": 5,
      "is_required": true,
      "on_exception": "halt",
      "config": {
        "route_optimization": false,
        "require_proof_of_delivery": true,
        "pod_type": "signature",
        "max_delivery_attempts": 1,
        "sla_hours": 72
      }
    }
  ]
}
```

**Flow:** Preparation → Vehicle Allocation → Pallet Building → Invoice Verification → Delivery

---

## 6B. Partial Fulfillment Configuration (TASK-FULFILLMENT-ARCH-002)

Every Fulfillment Profile includes a `partial_fulfillment_config` block. This block controls whether partial operations are allowed at each stage and who must approve them.

> Full specification: `PARTIAL-FULFILLMENT-RULES.md`

### Config Schema

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

### Per-Profile Summary

| Profile | Partial Allocation | Partial Delivery | Driver Authority |
|---|---|---|---|
| A — High-Volume Distribution | Yes (manager approval) | No | Decrease only (supervisor required) |
| B — Premium Per-Order | No | No | None |
| C — Wholesale / Pallet | Yes (no approval required) | Yes | Full authority |

---

## 6C. Allocation Policy Configuration (TASK-FULFILLMENT-ARCH-002)

The `vehicle_allocation` stage config may include an allocation policy block to control how vehicle inventory is distributed to orders.

> Full specification: `PRODUCT-ALLOCATION-ENGINE.md`

```json
{
  "stage_type": "vehicle_allocation",
  "config": {
    "allocation_mode": "priority",
    "allocation_priority_policy": "paid_first",
    "allow_dispatcher_override": true,
    "allow_driver_override": true
  }
}
```

| Field | Type | Values |
|---|---|---|
| `allocation_mode` | enum | `full_auto` / `partial_auto` / `manual` / `ai_suggested` / `priority` / `fifo` / `custom_policy` |
| `allocation_priority_policy` | string | Name of configured AllocationPriorityPolicy (default: `paid_first`) |
| `allow_dispatcher_override` | bool | Whether dispatchers may override system allocation |
| `allow_driver_override` | bool | Whether drivers may override allocation (subject to `driver_authority` limits) |

---

## 7. Channel Fulfillment Engine

The Channel Fulfillment Engine executes the profile at runtime.

### Execution Algorithm

```
function executeProfile(order, profile):
    stages = profile.stages sorted by sequence_order

    for stage in stages:
        if stage.is_required:
            result = executeStage(stage, order)
            if result.failed:
                if stage.on_exception == 'halt':
                    raise FulfillmentException(order, stage, result.error)
                if stage.on_exception == 'escalate':
                    notify_supervisor(order, stage, result.error)
                    continue
        else:
            executeStage(stage, order)  // best effort; skip on failure
```

### Stage Contract

Every stage module must implement the `FulfillmentStageContract`:

```php
interface FulfillmentStageContract
{
    public function canExecute(Order $order, FulfillmentStage $stage): bool;
    public function execute(Order $order, FulfillmentStage $stage): StageResult;
    public function rollback(Order $order, FulfillmentStage $stage): void;
}
```

---

## 8. Profile Versioning

When an operator modifies a profile:
1. The old profile version is archived (not deleted)
2. A new version is created with the modifications
3. The new version becomes active immediately for new orders
4. In-flight orders continue to execute against the profile version they started with

This ensures that modifying a profile never breaks an order that is already in progress.

---

## 9. Profile Administration

| Action | Role Required |
|---|---|
| View profiles | Operations Manager, Wave Planner |
| Create profile | Operations Manager |
| Modify profile | Operations Manager |
| Activate / Deactivate | Operations Manager |
| View profile history | Operations Manager, Warehouse Supervisor |

---

## 9B. Configuration Platform Dependency (TASK-CONFIGURATION-ARCH-001)

Fulfillment Profiles are the primary configuration artifact for `FulfillmentPolicy`. They are stored in the Configuration Platform as versioned JSON values.

### Policy Consumed: `FulfillmentPolicy`

The Channel Fulfillment Engine resolves FulfillmentPolicy before executing any stage:

```php
$policy = $policyEngine->resolve(FulfillmentPolicy::class, 'channel', $channelId);
// $policy contains the active FulfillmentProfile for this channel
// including stage sequence, per-stage config, and partial_fulfillment_config
```

### Configuration Setting

| Setting Key | Value |
|---|---|
| `channels.fulfillment_profile_id` | ID of the active FulfillmentProfile for this channel |

The FulfillmentProfile JSON (stage list + partial fulfillment config + allocation policy config) is stored as the `value` of a `ConfigurationVersion` for `setting_key = 'channels.fulfillment_profile_id'`.

### Feature Flag

```
workflow.stages.packing      — checked before executing Packing stage
workflow.stages.pallet_building — checked before Pallet Building stage
workflow.stages.invoice_verification — checked before Invoice Verification stage
```

### Audit

Every stage execution records a `PolicyEvaluationAudit` with `policy_type = 'FulfillmentPolicy'`. If a stage is skipped due to a feature flag, that is also recorded.

---

## 10. Fulfillment Profiles Module: DDD Structure

```
Modules/
└── Operations/
    └── FulfillmentProfiles/
        ├── Domain/
        │   ├── Models/
        │   │   ├── FulfillmentProfile.php
        │   │   └── FulfillmentStage.php
        │   ├── Contracts/
        │   │   └── FulfillmentStageContract.php
        │   ├── Enums/
        │   │   ├── StageType.php
        │   │   └── ExceptionPolicy.php
        │   └── Exceptions/
        │       ├── InvalidStageSequenceException.php
        │       └── ProfileNotActiveException.php
        ├── Application/
        │   ├── Services/
        │   │   ├── CreateFulfillmentProfileService.php
        │   │   ├── UpdateFulfillmentProfileService.php
        │   │   └── ChannelFulfillmentEngine.php     (orchestrator)
        │   └── Queries/
        │       ├── GetChannelProfileQuery.php
        │       └── GetProfileVersionHistoryQuery.php
        ├── Infrastructure/
        └── Presentation/
```
