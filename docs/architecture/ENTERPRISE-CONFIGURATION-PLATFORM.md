# Enterprise Configuration & Policy Platform

**Document:** ENTERPRISE-CONFIGURATION-PLATFORM  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONFIGURATION-ARCH-001

---

## 1. Vision

> Every business decision in ECOS must be explainable, reproducible, and configurable — without changing application code.

The Enterprise Configuration & Policy Platform is the architectural foundation that makes this possible. It is the single source of truth for every configurable behavior inside ECOS.

### The Problem It Solves

Without this platform:
- Business rules live inside individual modules, siloed and inconsistent
- A rule change requires a code deployment
- No one can answer "why did the system make this decision at 14:32 yesterday?"
- Rules for one company silently bleed into rules for another
- AI recommendations cannot explain which policy they used

With this platform:
- Every decision is traceable to a Policy and a Configuration Version
- Rules are changed in the Configuration OS — no deployment needed
- The system can reproduce any historical decision exactly
- Each company has its own independently configured behavior
- AI must declare which policy it consulted and at what version

---

## 2. Platform Architecture

```
Business Modules
(Inventory, Commerce, Manufacturing, POS, Procurement...)
        │
        │ invoke Decision Engines
        ▼
Decision Engines
(Geography, Vehicle Planning, Allocation, Fulfillment,
 Inventory, Manufacturing, Pricing, Reservation...)
        │
        │ consume Policies
        ▼
Policy Engine
(FulfillmentPolicy, VehiclePolicy, AllocationPolicy,
 InventoryPolicy, PricingPolicy, AIPolicy...)
        │
        ��� resolves Configuration
        ▼
Configuration Resolver
(scope resolution: Global → Country → Company → Channel → Warehouse)
        ��
        │ reads
        ▼
Configuration Platform
┌────────────────────────────────────────────────────┐
│  Configuration OS   │  Versioning   │  Audit       │
│  Policy Engine      │  Feature Mgmt │  Rule Engine │
└─���──────────────────────────────────────────────────┘
        │
        ▼
Enterprise Settings
(Governed, versioned, immutable history, auditable)
```

---

## 3. Platform Components

| Component | Responsibility | Spec Document |
|---|---|---|
| **Configuration OS** | Centralize every configurable business behavior; manage settings across all modules and scopes | `CONFIGURATION-OS-SPEC.md` |
| **Policy Engine** | Translate configuration into executable business policies; expose policies to Decision Engines | `POLICY-ENGINE-SPEC.md` |
| **Rule Evaluation Engine** | Evaluate business rules consistently; return structured decision results | `RULE-EVALUATION-ENGINE.md` |
| **Feature Management** | Control which modules, submodules, and capabilities are active per company/channel/role | `FEATURE-MANAGEMENT-SPEC.md` |
| **Configuration Versioning** | Every configuration change creates an immutable, publishable, rollbackable version | `CONFIGURATION-VERSIONING.md` |
| **Configuration Audit** | Every configuration change and every policy evaluation is permanently recorded | `CONFIGURATION-AUDIT.md` |

---

## 4. Core Principles

### 4.1 No Hardcoded Business Rules

No business module may contain hardcoded operational business rules. A "business rule" is any decision that could reasonably vary by company, channel, region, or time.

**Hardcoded (forbidden):**
```php
if ($order->payment_status === 'paid') {
    $priority = 1;
} else {
    $priority = 2;
}
```

**Policy-driven (required):**
```php
$priority = $this->policyEngine
    ->resolve(AllocationPolicy::class, $order->channel_id)
    ->evaluateOrderPriority($order);
```

### 4.2 Every Decision is Auditable

Every time a Decision Engine evaluates a rule, it must record:
- Which Policy was used
- Which Configuration Version the Policy was derived from
- What the input was
- What the decision was
- Why that decision was made (which rule matched)
- The timestamp

If you cannot replay a decision from audit records, the architecture is violated.

### 4.3 Scope Inheritance

Configuration inherits from higher scopes. Lower scopes override higher scopes.

```
Global Default
    ↓ (overridable by)
Country Settings
    ↓ (overridable by)
Company Settings
    ↓ (overridable by)
Channel Settings
    ↓ (overridable by)
Warehouse Settings
    ↓ (overridable by)
User Settings (optional, limited categories only)
```

A company that doesn't configure a setting inherits the global default. A channel that doesn't configure a setting inherits its company's setting.

### 4.4 Versioning is Mandatory

No configuration is ever edited in place. Every change creates a new version. The previous version is archived but never deleted. Rollback restores an archived version to active.

### 4.5 AI Must Declare Its Policy

AI recommendations must always include:
- The Policy it consulted
- The Configuration Version the policy was at
- The confidence level of the recommendation
- Whether a manual override is permitted
- An audit record of the recommendation

AI never bypasses the Policy Engine.

---

## 5. Decision Flow

Every operational decision in ECOS follows this exact flow:

```
1. Business Module triggers a Decision Engine
        ���
2. Decision Engine calls Policy Engine:
   policyEngine.resolve(PolicyType, scope)
        ↓
3. Policy Engine calls Configuration Resolver:
   configResolver.resolve(configCategory, scope)
        ↓
4. Configuration Resolver applies scope inheritance:
   User? → Warehouse? → Channel? → Company? → Country? → Global
        ↓
5. Configuration Resolver returns active ConfigurationVersion
        ↓
6. Policy Engine builds Policy from ConfigurationVersion
        ↓
7. Decision Engine calls Rule Evaluation Engine:
   ruleEngine.evaluate(policy, input)
        ↓
8. Rule Evaluation Engine returns RuleEvaluationResult:
   { decision, reason, policyId, configVersionId, timestamp }
        ↓
9. Decision Engine acts on the decision
        ↓
10. Configuration Audit records the evaluation
```

---

## 6. Policy → Decision Engine Mapping

| Policy Type | Consumed By | Governs |
|---|---|---|
| `FulfillmentPolicy` | Channel Fulfillment Engine | Stage sequence, exception handling, re-routing |
| `VehiclePolicy` | Vehicle Planning Engine | Capacity limits, distribution algorithm, replanning |
| `AllocationPolicy` | Product Allocation Engine | Priority ordering, allocation mode, driver authority |
| `PackingPolicy` | Packing OS | Packing modes, materials, label formats |
| `DeliveryPolicy` | Logistics OS | POD requirements, SLA, max attempts, route optimization |
| `InventoryPolicy` | Inventory Module | FIFO/FEFO rules, reservation behavior, negative stock |
| `ReservationPolicy` | Reservation Engine | Reservation expiry, auto-release, shortfall handling |
| `ManufacturingPolicy` | Manufacturing Engine | Batch rules, quality requirements, yield thresholds |
| `PricingPolicy` | Pricing Engine | Markup rules, discount limits, channel pricing |
| `GeographyPolicy` | Geography & Coverage Engine | Shipping company priority, coverage fallback |
| `CRMPolicy` | CRM Module | Customer tier rules, loyalty thresholds |
| `MarketingPolicy` | Marketing Module | Campaign eligibility, discount stacking |
| `SecurityPolicy` | Auth / Permission System | Role permissions, approval chains |
| `ApprovalPolicy` | Approval Workflows | Approval chains, escalation timeouts |
| `AIPolicy` | AI Integration Layer | AI recommendation usage, confidence thresholds, override rules |
| `NotificationPolicy` | Enterprise Notification Platform (EPS-04) | Notification triggers, recipient rules, channel selection, escalation |
| `DocumentPolicy` | Enterprise Document Platform (EPS-03) | Document access, retention, scan requirements per category |

---

## 7. Feature Flag → Module Mapping

Feature flags gate which capabilities are active. They are evaluated before any business logic runs.

```
if (!featureManagement.isEnabled('packing_os', $channel->id)) {
    // Skip Packing stage entirely
    return;
}
```

Feature flags are independent of policies. A flag disables a capability entirely. A policy configures how an active capability behaves.

---

## 8. Scope Hierarchy — Concrete Example

A Fulfillment Profile is resolved like this:

```
Request: FulfillmentPolicy for Channel "Website A" (Company "ECOS Food")

1. Check User scope          → no user-level fulfillment config
2. Check Warehouse scope     → no warehouse-level override
3. Check Channel scope       → "Website A" has partial_delivery = false configured
4. (Channel wins — stop here)

Resolution: use Channel-scoped config
ConfigurationVersion: v14 (Website A / FulfillmentPolicy / 2026-07-01)
```

If no channel-level config existed:

```
5. Check Company scope       → "ECOS Food" has partial_delivery = true
(Company wins — stop here)
```

---

## 9. Architecture Governance Rules

The following rules are enforced in all ECOS architecture decisions:

| Rule | Statement |
|---|---|
| GOV-001 | No business module may implement business decisions directly |
| GOV-002 | Every operational decision must reference a Policy, a Configuration Version, and produce an Audit Record |
| GOV-003 | No configuration value may be hardcoded in application code |
| GOV-004 | Every Policy must be derived from a published Configuration Version |
| GOV-005 | AI recommendations must declare the Policy and Configuration Version they used |
| GOV-006 | No policy evaluation may be skipped, even in tests — use test-scoped configuration |
| GOV-007 | Scope inheritance is always resolved by the Configuration Resolver — never manually in code |
| GOV-008 | Configuration changes require an audit reason |
| GOV-009 | Published configuration cannot be deleted — only archived |
| GOV-010 | A configuration change does not take effect until it is published |

---

## 10. DDD Module Structure

```
Modules/
└── Core/
    └── ConfigurationPlatform/
        ├── Configuration/
        │   ├── Domain/
        │   │   ├── Models/
        ��   │   │   ├── ConfigurationSetting.php
        │   │   │   └── ConfigurationVersion.php
        │   │   ├── Enums/
        │   │   │   ├── ConfigurationCategory.php
        │   │   ��   ├── ConfigurationScope.php
        │   │   │   └── VersionStatus.php
        │   │   └── Services/
        │   │       └── ConfigurationResolver.php
        │   └── Application/
        │       ├── Services/
        │       │   ├── PublishConfigurationService.php
        │       │   └── RollbackConfigurationService.php
        │       └── Queries/
        │           └── GetActiveConfigurationQuery.php
        ├── PolicyEngine/
        │   ├── Domain/
        │   │   ├── Models/
        │   │   │   ├── Policy.php
        ���   │   │   └── PolicyRule.php
        │   │   ├── Contracts/
        │   │   │   └── PolicyContract.php
        │   │   └── Services/
        │   │       └── PolicyEngine.php
        │   └── Application/
        │       └── Services/
        │           └── ResolvePolicyService.php
        ├── RuleEngine/
        │   ├── Domain/
        │   │   ├── Contracts/
        │   │   │   └── RuleEvaluatorContract.php
        │   │   ├── Models/
        │   │   │   └── RuleEvaluationResult.php
        ���   │   └── Evaluators/
        │   │       ├── ConditionalRuleEvaluator.php
        │   │       ├── PriorityRuleEvaluator.php
        │   │       ├── ScoreRuleEvaluator.php
        │   │       ├── ThresholdRuleEvaluator.php
        │   │       ├── TimeRuleEvaluator.php
        │   │       ├── LocationRuleEvaluator.php
        │   │       └── AiAssistedRuleEvaluator.php
        │   └── Application/
        │       └── Services/
        │           └── RuleEvaluationEngine.php
        ├── FeatureManagement/
        │   ���── Domain/
        │   │   └── Models/
        │   │       └── FeatureFlag.php
        │   └── Application/
        │       └── Services/
        │           └── FeatureManagementService.php
        ├── Versioning/
        │   └── (see CONFIGURATION-VERSIONING.md)
        └── Audit/
            └── (see CONFIGURATION-AUDIT.md)
```

---

## 11. Enterprise Platform Services Integration (TASK-EPS-ARCH-001)

The Configuration Platform governs the behavior of all four Enterprise Platform Services through their respective policies.

| EPS Service | Policy | What Is Configured |
|---|---|---|
| EPS-01 Event Platform | (EventPolicy — future) | Event retention periods, replay limits, dead letter thresholds |
| EPS-02 Timeline Platform | — (display config only) | Retention days, which event categories appear in timelines |
| EPS-03 Document Platform | `DocumentPolicy` | Access defaults per category, retention rules, scan provider |
| EPS-04 Notification Platform | `NotificationPolicy` | Triggers, recipients, channels, rate limits, escalation, working hours |

The Configuration Platform also manages feature flags for all EPS modules:

```
modules.event_platform
modules.timeline
modules.document_platform
modules.notification_platform
modules.notification_platform.email
modules.notification_platform.sms
modules.notification_platform.whatsapp
modules.notification_platform.push
modules.notification_platform.webhook
```

See `ENTERPRISE-PLATFORM-SERVICES.md` for the full EPS specification.

---

## 12. Related Documents

- `CONFIGURATION-OS-SPEC.md` — Configuration categories, scope ownership, configuration entity design
- `POLICY-ENGINE-SPEC.md` — Policy types, policy entities, Decision Engine contracts
- `RULE-EVALUATION-ENGINE.md` ��� Rule types, evaluation algorithm, result schema
- `FEATURE-MANAGEMENT-SPEC.md` — Feature flags, scoping, enterprise examples
- `CONFIGURATION-VERSIONING.md` — Version lifecycle, approval, rollback, future effective dates
- `CONFIGURATION-AUDIT.md` �� Audit event schema, query patterns, retention
- `ADR-015-enterprise-fulfillment-architecture.md` — Enterprise Fulfillment (consumer of this platform)
- `GEOGRAPHY-COVERAGE-ENGINE.md` — Consumes GeographyPolicy
- `VEHICLE-PLANNING-ENGINE.md` — Consumes VehiclePolicy
- `PRODUCT-ALLOCATION-ENGINE.md` — Consumes AllocationPolicy
- `PARTIAL-FULFILLMENT-RULES.md` — Governed by FulfillmentPolicy
- `FULFILLMENT-PROFILES-SPEC.md` — Profiles are the FulfillmentPolicy configuration artifact
- `ENTERPRISE-PLATFORM-SERVICES.md` — Enterprise Platform Services (EPS-01 to EPS-04)
- `ENTERPRISE-NOTIFICATION-PLATFORM.md` — EPS-04, governed by NotificationPolicy
- `ENTERPRISE-DOCUMENT-PLATFORM.md` — EPS-03, governed by DocumentPolicy

---

## 14. Enterprise Domain Model Dependency (TASK-DOMAIN-ARCH-001)

The Configuration Platform governs behavior by consuming Policies. Policies are referenced by Aggregates during business decisions. The Domain Model defines which Policy each Aggregate consumes.

| Policy | Governed Aggregates (from AGGREGATE-CATALOG.md) |
|---|---|
| FulfillmentPolicy | PreparationWave (AGG-09), ShippingWave (AGG-10), Shipment (AGG-12) |
| VehiclePolicy | Vehicle (AGG-11), ShippingWave (AGG-10) |
| ReservationPolicy | RawMaterial (AGG-04), Product (AGG-03) via Reservation entity |
| PricingPolicy | Product (AGG-03) |
| ManufacturingPolicy | Recipe (AGG-05), PreparationWave (AGG-09) |
| ApprovalPolicy | PurchaseOrder (AGG-07), POSSession (AGG-13), Invoice (AGG-14) |
| InventoryPolicy | RawMaterial (AGG-04), PurchaseOrder (AGG-07) |
| CRMPolicy | Customer (AGG-08), Campaign (AGG-15) |

Every Invariant in BUSINESS-INVARIANTS.md references the Policy that governs its exception conditions.

> Full Domain Model: `docs/domain/ENTERPRISE-DOMAIN-MODEL.md`

---

## 13. Enterprise UX Architecture Dependency (TASK-UX-ARCH-001)

The Configuration Platform governs how every UX component behaves across tenants and channels.

| Config Area | UX Impact |
|---|---|
| NotificationPolicy | Controls which notification types reach which channels (in-app / email / WhatsApp / SMS) |
| DocumentPolicy | Defines document categories, retention rules, and scan behavior shown in the Documents tab |
| AIPolicy | Governs which AI insights appear in the DataGrid AI column and AI Insights drawer tab |
| Feature flags | Enable/disable AI UX, Timeline, Documents, and Notification features per company |
| ApprovalPolicy | Powers the Approval notification type and Inbox Approvals section |

The UX Architecture is defined in `docs/ux/ENTERPRISE-UX-ARCHITECTURE.md`. Configuration Platform settings control behavior; UX standards control presentation. They are independent layers.

---

## 15. Enterprise Contract Architecture Dependency (TASK-CONTRACT-ARCH-001)

The Configuration Platform exposes three published Service Contracts. All consumers must use these contracts — never reach into the platform internals directly.

| Service Contract | Contract ID | What Is Exposed |
|---|---|---|
| ConfigurationService | SVC-CFG-001 | get(), getMany(), set() — scope-resolved config values |
| PolicyService | SVC-CFG-002 | evaluate(), evaluateMany() — policy decision with reason |
| FeatureFlagService | SVC-CFG-003 | isEnabled(), getVariant() — feature gate checks |

**CON-GOV-001** applies: No module may access ConfigurationPlatform internals (models, database, services) directly. Only SVC-CFG-001, SVC-CFG-002, and SVC-CFG-003 are the public surface.

> Full Contract Architecture: `docs/contracts/ENTERPRISE-CONTRACTS.md`  
> Service Contracts: `docs/contracts/SERVICE-CONTRACTS.md`

---

## 16. Database Engineering Standards Dependency (TASK-DATABASE-ENGINEERING-001)

Configuration Platform tables are subject to the full Database Engineering Standards.

| Config Table | Identity | Partitioned | Notes |
|---|---|---|---|
| `configuration_entries` | UUID | No | (company_id, key) natural key |
| `configuration_versions` | UUID | No | T3 version history pattern |
| `policy_definitions` | UUID | No | Append-on-change |
| `feature_flags` | UUID | No | Small, cached |

**Key implications:**
- `ENG-GOV-001`: Naming follows DATABASE-NAMING-CONVENTIONS.md
- `ENG-GOV-003`: Migrations follow MIGRATION-STANDARDS.md
- Configuration values that are L2 Confidential (pricing formulas, cost structures) must not appear in migration files or logs
- `CHG-003`: Structural changes to configuration tables require Architecture Board review (Class C)

> Full Standards: `docs/engineering/DATABASE-ENGINEERING-STANDARDS.md`  
> Change Policy: `docs/engineering/DATABASE-CHANGE-POLICY.md`  
> Data Classification: `docs/information/DATA-CLASSIFICATION.md`
