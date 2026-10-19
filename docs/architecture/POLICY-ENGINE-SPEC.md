# Policy Engine — Specification

**Document:** POLICY-ENGINE-SPEC  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONFIGURATION-ARCH-001  
**Platform:** Enterprise Configuration & Policy Platform

---

## 1. Mission

> Translate active Configuration Versions into executable business policies that Decision Engines can consume.

The Policy Engine sits between Configuration and Decision Engines. It never stores business rules itself — it assembles them from the active Configuration Version for the requested scope.

A Decision Engine never reads configuration directly. It asks the Policy Engine for a Policy, then evaluates the Policy through the Rule Evaluation Engine.

---

## 2. Policy Entity

```
Policy
├── id                        uuid
├── policy_type               enum (see Section 4)
├── name                      string
├── scope_type                enum: global | country | company | channel | warehouse | user
├── scope_id                  string (nullable — null for global scope)
├── version                   int               — policy version number
├── config_version_id         → ConfigurationVersion
├── rules[]                   → PolicyRule[]
├── is_active                 bool
├── effective_from            timestamp
├── effective_to              timestamp (nullable)
├── created_by                → User
├── published_by              → User (nullable)
└── published_at              timestamp (nullable)
```

---

## 3. PolicyRule Entity

```
PolicyRule
├── id                        uuid
├── policy_id                 → Policy
├���─ rule_type                 enum (see Rule Evaluation Engine)
├── sequence                  int               — evaluation order; lower = evaluated first
├── name                      string
├── description               string (nullable)
├── condition_expression      JSONB             — rule-type-specific conditions
├── action                    JSONB             — what to return when this rule matches
├── priority                  int               — for priority-type rules; lower = higher priority
└── is_active                 bool
```

---

## 4. Policy Type Registry

| Policy Type | Description | Primary Consumer | Config Category |
|---|---|---|---|
| `FulfillmentPolicy` | Fulfillment stage sequence, exception handling, partial fulfillment | Channel Fulfillment Engine | `fulfillment` |
| `VehiclePolicy` | Vehicle capacity limits, distribution algorithm, replanning rules | Vehicle Planning Engine | `fulfillment.vehicle` |
| `AllocationPolicy` | Order priority ordering, allocation mode, driver authority limits | Product Allocation Engine | `fulfillment.allocation` |
| `PackingPolicy` | Packing modes, label formats, material tracking | Packing OS | `fulfillment.packing` |
| `DeliveryPolicy` | POD requirements, SLA hours, max attempts, route optimization | Logistics OS | `fulfillment.delivery` |
| `InventoryPolicy` | FIFO/FEFO strategy, reservation behavior, negative stock rules | Inventory Module | `inventory` |
| `ReservationPolicy` | Reservation expiry, auto-release, shortfall handling | Reservation Engine | `inventory.reservation` |
| `ManufacturingPolicy` | Batch sizes, quality requirements, yield thresholds, scrap tolerance | Manufacturing Engine | `manufacturing` |
| `PricingPolicy` | Markup rules, discount limits, channel pricing, margin floors | Pricing Engine | `pricing` |
| `GeographyPolicy` | Shipping company priority, coverage fallback behavior | Geography & Coverage Engine | `fulfillment.geography` |
| `CRMPolicy` | Customer tier thresholds, loyalty point rules, tier benefits | CRM Module | `crm` |
| `MarketingPolicy` | Campaign eligibility, discount stacking, promotion rules | Marketing Module | `marketing` |
| `SecurityPolicy` | Role permission matrices, approval chain definitions | Auth / Permission | `security` |
| `ApprovalPolicy` | Approval chains per operation type, escalation timeouts | Approval Workflows | `approvals` |
| `AIPolicy` | AI recommendation confidence thresholds, override permissions, audit requirements | AI Integration Layer | `ai` |
| `NotificationPolicy` | Notification triggers, recipient rules, channel selection, rate limits, escalation, working hours | Enterprise Notification Platform (EPS-04) | `notifications` |
| `DocumentPolicy` | Document access defaults per category, retention rules, virus scan requirements | Enterprise Document Platform (EPS-03) | `documents` |

---

## 5. Policy Resolution

### Resolution Contract

Every Decision Engine resolves a Policy via:

```php
interface PolicyEngineContract
{
    public function resolve(
        string $policyType,
        string $scopeType,
        ?string $scopeId,
        ?string $effectiveAt = null
    ): Policy;
}
```

The `effectiveAt` parameter allows historical replay: "give me the Policy that was active at 2026-07-01 14:32:00." If null, the current Policy is returned.

### Resolution Algorithm

```
function resolve(policyType, scopeType, scopeId, effectiveAt):

    // Walk down scope hierarchy: User → Warehouse → Channel → Company → Country → Global
    for scope in [user, warehouse, channel, company, country, global]:
        configVersion = configResolver.resolve(
            category: policyType.configCategory,
            scope: scope,
            scopeId: deriveScopeId(scope, scopeId),
            effectiveAt: effectiveAt
        )
        if configVersion exists and is published:
            return buildPolicy(policyType, configVersion)

    throw PolicyNotFoundException(policyType, scopeType, scopeId)
```

---

## 6. Policy Contract for Decision Engines

Every Policy type implements a typed PHP interface. Decision Engines call typed methods — they never read raw JSONB.

```php
interface PolicyContract
{
    public function policyType(): string;
    public function configVersionId(): string;
    public function policyId(): string;
    public function policyVersion(): int;
    public function effectiveAt(): DateTimeImmutable;
}
```

### Example: AllocationPolicy

```php
interface AllocationPolicyContract extends PolicyContract
{
    public function allocationMode(): AllocationMode;
    public function getPriorityOrderedConditions(): array;   // ordered list of priority rules
    public function allowDispatcherOverride(): bool;
    public function allowDriverOverride(): bool;
    public function driverAuthority(): DriverAuthorityConfig;
    public function partialAllocationAllowed(): bool;
    public function requireManagerApprovalForPartial(): bool;
}
```

### Example: VehiclePolicy

```php
interface VehiclePolicyContract extends PolicyContract
{
    public function maxOrdersPerVehicle(): int;
    public function maxWeightKg(): float;
    public function maxVolumeM3(): float;
    public function maxStops(): int;
    public function maxWorkingHours(): float;
    public function distributionAlgorithm(): DistributionPolicy;
    public function allowPartialLoading(): bool;
    public function requireSupervisorApprovalForPartial(): bool;
}
```

### Example: GeographyPolicy

```php
interface GeographyPolicyContract extends PolicyContract
{
    public function getAllowedShippingCompanies(): array;  // ordered by priority
    public function getCoverageRequirement(): string;      // 'exact_zone' | 'governorate_fallback'
    public function onNoCoverageAction(): string;          // 'block' | 'escalate' | 'use_fallback'
    public function fallbackShippingCompanyId(): ?string;
}
```

---

## 7. Policy Evaluation Result

Every policy evaluation produces a `PolicyEvaluationResult`. The Decision Engine must pass this to the Audit system.

```
PolicyEvaluationResult
├── policy_id                 → Policy
├── policy_type               string
├── policy_version            int
├── config_version_id         → ConfigurationVersion
├── scope_type                string
├── scope_id                  string (nullable)
├── decision                  mixed           — the decision value
├── reason                    string          — human-readable explanation
├── rules_evaluated           int             — how many rules were checked
├── rules_matched             int             — how many rules fired
├── matched_rule_ids[]        → PolicyRule[]  — which rules produced the decision
├── evaluated_at              timestamp
└── effective_config_at       timestamp       — the effective timestamp of the config version used
```

---

## 8. Policy Caching

Policy resolution is called on every operational decision. Performance matters.

**Caching strategy:**
- Resolved Policies are cached by `(policyType, scopeType, scopeId, configVersionId)` in Redis
- Cache TTL: 5 minutes (short enough to pick up new published versions; long enough to reduce DB load)
- Cache is invalidated immediately when a new Configuration Version is published for the relevant scope
- Historical resolution (`effectiveAt` in the past) is never cached — always resolved fresh

---

## 9. Policy Administration

| Action | Role Required |
|---|---|
| View active policy for a scope | Operations Manager |
| View policy history | Operations Manager |
| Propose configuration change (creates draft) | Operations Manager |
| Approve and publish configuration change | Administrator |
| Rollback to previous version | Administrator |
| Schedule future effective date | Administrator |

---

## 10. Policy Engine Module Structure

```
Modules/
└── Core/
    └── ConfigurationPlatform/
        └── PolicyEngine/
            ├── Domain/
            │   ├── Models/
            │   │   ├── Policy.php
            │   │   └── PolicyRule.php
            │   ├── Contracts/
            │   │   ├���─ PolicyContract.php
            │   │   ├── PolicyEngineContract.php
            │   │   ├── AllocationPolicyContract.php
            │   │   ├���─ VehiclePolicyContract.php
            │   │   ├── FulfillmentPolicyContract.php
            │   │   ├── GeographyPolicyContract.php
            │   │   ├── InventoryPolicyContract.php
            │   │   ├── ReservationPolicyContract.php
            │   │   ├── ManufacturingPolicyContract.php
            │   │   ├── PricingPolicyContract.php
            │   │   ├── DeliveryPolicyContract.php
            │   │   ├── PackingPolicyContract.php
            │   │   ├── ApprovalPolicyContract.php
            │   │   ├── SecurityPolicyContract.php
            │   │   ├── AIpolicyContract.php
            │   │   └── CRMPolicyContract.php
            │   ���── Enums/
            │   │   └── PolicyType.php
            │   └── Exceptions/
            │       ├── PolicyNotFoundException.php
            │       └── PolicyVersionMismatchException.php
            ├── Application/
            │   └── Services/
            │       ├── PolicyEngine.php          (implements PolicyEngineContract)
            │       └── ResolvePolicyService.php
            └── Infrastructure/
                └── Cache/
                    └── RedisPolicyCache.php
```
