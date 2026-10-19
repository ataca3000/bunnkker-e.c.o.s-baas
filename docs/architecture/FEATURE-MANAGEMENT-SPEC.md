# Feature Management — Specification

**Document:** FEATURE-MANAGEMENT-SPEC  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONFIGURATION-ARCH-001  
**Platform:** Enterprise Configuration & Policy Platform

---

## 1. Mission

> Control which modules, submodules, capabilities, and workflow stages are active — per company, per channel, per role, per country, or globally.

Feature Management is the gating layer before any business logic runs. If a feature is disabled, the corresponding module, stage, or capability is completely inactive — the Policy Engine and Rule Evaluation Engine are never invoked for it.

Feature flags are independent of Policies. A flag disables a capability entirely. A Policy configures how an active capability behaves.

---

## 2. FeatureFlag Entity

```
FeatureFlag
├── id                        uuid
├── feature_key               string          — dot-notation key (e.g. "modules.packing_os")
├── name                      string
├── description               string
├── scope_type                enum: global | country | company | channel | warehouse | role
├── scope_id                  string (nullable — null for global)
├── is_enabled                bool
├── config_version_id         → ConfigurationVersion (the version that set this flag)
├── rollout_pct               int (0–100)     — % of matching scope that gets the flag (for gradual rollout)
├── metadata                  JSONB           — free-form notes, rollout notes, ticket references
├── created_by                → User
├── updated_by                → User
├── created_at                timestamp
└── updated_at                timestamp
```

---

## 3. Feature Key Taxonomy

Feature keys use dot-notation: `{area}.{module}.{submodule}.{capability}`

### Module-Level Flags

| Feature Key | Description |
|---|---|
| `modules.preparation_os` | Preparation OS module |
| `modules.loading_allocation_os` | Loading & Allocation OS module |
| `modules.packing_os` | Packing OS module |
| `modules.logistics_os` | Logistics OS module |
| `modules.vehicle_planning` | Vehicle Planning Engine |
| `modules.product_allocation` | Product Allocation Engine |
| `modules.geography_coverage` | Geography & Coverage Engine |
| `modules.pos` | Point of Sale module |
| `modules.manufacturing` | Manufacturing module |
| `modules.procurement` | Procurement module |
| `modules.crm` | CRM module |
| `modules.marketing` | Marketing module |

### Submodule-Level Flags

| Feature Key | Description |
|---|---|
| `modules.preparation_os.quality_check` | Quality check step in Preparation OS |
| `modules.packing_os.pallet_building` | Pallet building capability |
| `modules.loading_allocation_os.replanning` | Wave replanning capability |
| `modules.vehicle_planning.auto_planning` | Automatic wave creation |
| `modules.logistics_os.route_optimization` | Route optimization engine |
| `modules.procurement.supplier_invoices` | Supplier Invoice module |
| `modules.procurement.supplier_returns` | Supplier Returns module |

### Workflow Stage Flags

| Feature Key | Description |
|---|---|
| `workflow.stages.packing` | Packing stage in fulfillment pipeline |
| `workflow.stages.order_building` | Order Building stage (future) |
| `workflow.stages.order_handover` | Order Handover stage (future) |
| `workflow.stages.invoice_verification` | Invoice Verification stage |
| `workflow.stages.pallet_building` | Pallet Building stage |

### AI Feature Flags

| Feature Key | Description |
|---|---|
| `ai.recommendations.enabled` | Global AI recommendations switch |
| `ai.recommendations.allocation` | AI allocation suggestions |
| `ai.recommendations.vehicle_planning` | AI vehicle planning suggestions |
| `ai.recommendations.route_optimization` | AI route optimization |
| `ai.recommendations.demand_forecast` | Demand forecasting |
| `ai.recommendations.supplier_scoring` | AI supplier scoring |
| `ai.auto_apply.enabled` | AI may auto-apply recommendations (no human review) |

### Beta Feature Flags

| Feature Key | Description |
|---|---|
| `beta.driver_app` | Driver mobile app |
| `beta.customer_tracking` | Customer-facing order tracking |
| `beta.predictive_reorder` | Predictive reorder point suggestions |
| `beta.dynamic_routing` | Real-time route replanning |

### Channel-Specific Flags

| Feature Key | Description |
|---|---|
| `channels.allow_cod` | Cash on delivery for this channel |
| `channels.allow_wholesale` | Wholesale order mode |
| `channels.allow_partial_delivery` | Partial delivery allowed |
| `channels.require_digital_pod` | Digital proof of delivery required |

---

## 4. Feature Flag Resolution

Feature flags follow the same scope inheritance as Configuration — lower scopes override higher scopes.

```php
interface FeatureManagementContract
{
    public function isEnabled(
        string $featureKey,
        string $scopeType = 'global',
        ?string $scopeId = null
    ): bool;

    public function getFlag(
        string $featureKey,
        string $scopeType,
        ?string $scopeId
    ): FeatureFlag;
}
```

### Resolution Algorithm

```
function isEnabled(featureKey, scopeType, scopeId):

    scopes = buildScopeChain(scopeType, scopeId)

    for scope in scopes:
        flag = FeatureFlag.where(
            feature_key: featureKey,
            scope_type: scope.type,
            scope_id: scope.id
        ).first()

        if flag exists:
            return evaluateRollout(flag)

    // Not configured anywhere → default to global default
    return getGlobalDefault(featureKey)
```

---

## 5. Gradual Rollout

`rollout_pct` enables gradual feature rollout to a percentage of entities within the scope.

```
rollout_pct = 25  →  25% of companies/channels/users get the flag enabled

Evaluation:
    hash(featureKey + scopeId) % 100 < rollout_pct
    → stable per entity (same entity always gets same result)
```

This enables:
- Controlled beta releases
- A/B testing features with a subset of channels
- Phased module activation without disrupting all users at once

---

## 6. Enterprise Examples

### Example A — Company-Specific Capability

```
Company: "ECOS Food Cairo"
Features:
  modules.preparation_os             = true
  modules.loading_allocation_os      = true
  modules.packing_os                 = false     ← disabled for this company
  workflow.stages.packing            = false
  modules.vehicle_planning           = true
  ai.recommendations.enabled         = true
  ai.recommendations.allocation      = true
  ai.auto_apply.enabled              = false
```

Result: Packing OS is completely inactive for this company. No Packing stage runs in any fulfillment profile — even if a profile configures it, the Feature Management check prevents execution.

---

### Example B — Channel-Specific Features

```
Channel: "Website A" (belongs to "ECOS Food Cairo")
Inherits from Company:
  modules.packing_os                 = false (inherited)
  
Channel-specific overrides:
  channels.allow_cod                 = true
  channels.allow_partial_delivery    = true
  ai.recommendations.allocation      = false    ← disabled for this channel only
```

---

### Example C — Role-Specific Features

```
Role: "Driver"
Features:
  modules.product_allocation         = true    ← can view own allocations
  modules.loading_allocation_os      = false   ← cannot access Loading OS admin
  ai.recommendations.enabled         = true    ← can see AI suggestions
  ai.auto_apply.enabled              = false   ← cannot auto-apply
```

---

### Example D — AI Recommendation Rollout

```
Feature: ai.recommendations.route_optimization
Scope: global
rollout_pct: 20   ← only 20% of companies get route optimization AI
status: beta

Evaluation for Company "ECOS Food Cairo":
  hash("ai.recommendations.route_optimization" + "company-id-xyz") % 100 = 17
  17 < 20 → enabled ✓

Evaluation for Company "ECOS Bakery":
  hash("ai.recommendations.route_optimization" + "company-id-abc") % 100 = 73
  73 >= 20 → disabled ✗
```

---

## 7. Feature Flag Administration

| Action | Role Required |
|---|---|
| View all flags | Administrator |
| Enable/disable module flag | Administrator |
| Enable/disable channel flag | Operations Manager |
| Set rollout percentage | Administrator |
| View flag history | Operations Manager, Administrator |

All flag changes are recorded in the Configuration Audit system.

---

## 8. Integration Pattern

Every module entry point must check its feature flag before executing:

```php
// In Channel Fulfillment Engine:
if (!$this->featureManagement->isEnabled('modules.packing_os', 'channel', $channelId)) {
    // Skip packing stage entirely
    return StageResult::skipped('Feature disabled for this channel');
}
```

```php
// In AI Allocation Engine:
if (!$this->featureManagement->isEnabled('ai.recommendations.allocation', 'channel', $channelId)) {
    // Fall through to rule-based allocation
    return $this->ruleBasedAllocate($orders, $vehicleInventory);
}
```

The Feature Management check is always the **first** operation in a module. It cannot be bypassed.
