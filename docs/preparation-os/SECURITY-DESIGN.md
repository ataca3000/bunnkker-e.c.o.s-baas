# Preparation OS — Security Design

**Document:** SECURITY-DESIGN  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-PREP-001  
**Parent:** PREPARATION-OS-BLUEPRINT.md  
**Security Standards:** docs/09_Security_Standards.md, DATABASE-SECURITY-STANDARDS.md

---

## 1. Roles

Preparation OS defines four operational roles. Roles are additive — a Supervisor has all Operator permissions plus more.

| Role | Code | Description |
|---|---|---|
| **Preparation Planner** | `preparation.planner` | Creates waves, generates demand, runs MRP/PRP, adjusts wave orders |
| **Preparation Supervisor** | `preparation.supervisor` | All Planner permissions + start/complete/cancel waves, approve waves, override shortages, assign workers |
| **Warehouse Operator** | `preparation.operator` | Records prepared quantities, views pick list, accesses mobile interface |
| **Preparation Viewer** | `preparation.viewer` | Read-only access to all preparation data; no write actions |

**Role inheritance:**
```
preparation.supervisor
    └── preparation.planner
            └── preparation.viewer

preparation.operator
    └── preparation.viewer
```

---

## 2. Permission Matrix

| Permission | Planner | Supervisor | Operator | Viewer |
|---|---|---|---|---|
| `preparation.dashboard.view` | ✓ | ✓ | ✓ | ✓ |
| `preparation.waves.view` | ✓ | ✓ | ✓ | ✓ |
| `preparation.waves.create` | ✓ | ✓ | — | — |
| `preparation.waves.plan` | ✓ | ✓ | — | — |
| `preparation.waves.start` | — | ✓ | — | — |
| `preparation.waves.complete` | — | ✓ | — | — |
| `preparation.waves.cancel` | — | ✓ | — | — |
| `preparation.waves.override_shortage` | — | ✓ | — | — |
| `preparation.waves.approve` | — | ✓ | — | — |
| `preparation.items.view` | ✓ | ✓ | ✓ | ✓ |
| `preparation.items.update` | ✓ | ✓ | ✓ | — |
| `preparation.pool.view` | ✓ | ✓ | ✓ | ✓ |
| `preparation.pool.quality_check` | — | ✓ | — | — |
| `preparation.workers.view` | ✓ | ✓ | — | ✓ |
| `preparation.workers.assign` | — | ✓ | — | — |
| `preparation.stations.view` | ✓ | ✓ | ✓ | ✓ |
| `preparation.stations.manage` | — | ✓ | — | — |
| `preparation.exceptions.view` | ✓ | ✓ | ✓ | ✓ |
| `preparation.exceptions.resolve` | — | ✓ | — | — |
| `preparation.analytics.view` | ✓ | ✓ | — | ✓ |

---

## 3. Approval Points

Approval points are workflow gates requiring a user with the appropriate role to explicitly act before the flow continues.

| Approval Point | Required Permission | Trigger |
|---|---|---|
| **Wave Planning Approval** | `preparation.waves.approve` | Required before `start` if `ManufacturingPolicy.require_wave_approval = true` |
| **Shortage Override** | `preparation.waves.override_shortage` | Required to start a wave that has unresolved shortages |
| **Wave Completion** | `preparation.waves.complete` | Always required; no auto-completion |
| **Quality Check Pass/Fail** | `preparation.pool.quality_check` | Required before pool entry can be reserved by Loading OS |
| **Exception Resolution** | `preparation.exceptions.resolve` | Required to close a blocking exception |

---

## 4. Tenant Isolation

Every query and mutation in Preparation OS is scoped to `company_id`.

```php
// All queries automatically scoped:
PreparationWave::where('company_id', $user->company_id)->...

// Never:
PreparationWave::find($waveId) // missing company scope — forbidden
```

Authorization middleware verifies:
1. User is authenticated (Sanctum token valid)
2. User's `company_id` matches the requested resource's `company_id`
3. User has the required permission

---

## 5. Sensitive Data Handling

### Customer Name Snapshot

`preparation_wave_orders.customer_name_snapshot` contains PII (L1 Personal — DATA-CLASSIFICATION.md).

- Encrypted at rest using AES-256 (application-level, as per DATABASE-SECURITY-STANDARDS.md)
- Decrypted only for display; never logged
- Never returned in bulk list endpoints (only in single wave detail for authorized roles)
- Stored format: `v1:{base64_encrypted}`

### API Response Masking
In list views, customer names are masked: `"M. Hassan"` — first letter + surname only.  
Full name only shown in Wave Detail drawer to `preparation.supervisor` role.

---

## 6. Audit Requirements

All state-changing operations on Preparation OS entities are audited.

| Action | Audited | Audit Stored In |
|---|---|---|
| Wave created | ✓ | `audit_log` + Timeline entry |
| Wave status change | ✓ | `audit_log` + Timeline entry |
| Wave approved | ✓ | `audit_log` + Timeline entry |
| Shortage overridden | ✓ | `audit_log` (before/after state) + Timeline |
| Wave cancelled | ✓ | `audit_log` + Timeline entry |
| Prepared quantity recorded | ✓ | `audit_log` |
| Pool quality check | ✓ | `audit_log` + PoolMovement record |
| Worker assigned/released | ✓ | `audit_log` + Timeline |
| Exception created/resolved | ✓ | `audit_log` + Timeline |

Audit records capture: `actor_id`, `actor_type`, `action`, `object_type`, `object_id`, `before_state`, `after_state`, `ip_address`.

---

## 7. Feature Flags

Preparation OS respects two mandatory feature flags:

| Flag | Key | Effect |
|---|---|---|
| **Module enabled** | `modules.preparation_os` | If false: all endpoints return 503 with module disabled message |
| **Preparation stage** | `workflow.stages.preparation` | Controls whether this stage is part of the active Fulfillment Profile |

Both flags are managed via the Configuration Platform (ENTERPRISE-CONFIGURATION-PLATFORM.md) and cannot be bypassed.

---

## 8. Policy Dependencies

Preparation OS consumes these policies via the Policy Engine (GOV-001, GOV-002):

| Policy | Key | Settings Consumed |
|---|---|---|
| **ManufacturingPolicy** | `ManufacturingPolicy` | `require_wave_approval`, `allow_overprepare`, `overprepare_tolerance_pct`, `auto_trigger_mrp`, `mrp_priority_mode` |
| **FulfillmentPolicy** | `FulfillmentPolicy` | `require_pool_quality_check`, `wave_max_orders`, `wave_auto_start_threshold` |
| **InventoryPolicy** | `InventoryPolicy` | `allow_negative_reservation`, `fifo_method` |

Every wave stores `config_version_id` referencing the active policy version at planning time (GOV-010 compliance).

---

## 9. HTTP Security Controls

| Control | Implementation |
|---|---|
| Authentication | Laravel Sanctum; Bearer token required on all endpoints |
| CSRF | SPA: cookie-based Sanctum CSRF; API: token-only |
| Rate limiting | 60 requests/minute per user on command endpoints; 120/min on read endpoints |
| Input sanitization | Laravel FormRequest validation; no raw string concatenation |
| SQL injection | Eloquent ORM; no direct user input in column names |
| CORS | Configured per environment; production: explicit allow-list |
| TLS | All traffic HTTPS; enforced at reverse proxy level |
