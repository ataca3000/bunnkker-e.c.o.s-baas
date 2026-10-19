# Configuration OS — Specification

**Document:** CONFIGURATION-OS-SPEC  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONFIGURATION-ARCH-001  
**Platform:** Enterprise Configuration & Policy Platform

---

## 1. Mission

> Centralize every configurable business behavior across all ECOS modules, scopes, and environments.

The Configuration OS is the storage and management layer of the Enterprise Configuration Platform. It does not evaluate rules (that's the Rule Evaluation Engine) and does not build policies (that's the Policy Engine). It stores, versions, and exposes configuration settings.

---

## 2. Configuration Setting Entity

```
ConfigurationSetting
├── id                        uuid
├── category                  → ConfigurationCategory (enum)
├── key                       string          — dot-notation key (e.g. "fulfillment.allocation.mode")
├── name                      string          — human-readable label
├── description               string
├── data_type                 enum: string | int | decimal | bool | json | enum_value | list
├── default_value             text            — the global default
├── allowed_values            JSONB (nullable) — for enum_value type: list of valid values
├── scope_levels              JSONB           — which scopes may override this setting
│                                               (e.g. ["company", "channel"])
├── is_sensitive              bool            — mask value in audit logs
├── requires_approval         bool            — publishing requires approval
├── deprecation_notice        string (nullable)
└── created_at                timestamp
```

---

## 3. Configuration Version Entity

```
ConfigurationVersion
├── id                        uuid
├── setting_id                → ConfigurationSetting
├── category                  → ConfigurationCategory
├── scope_type                enum: global | country | company | channel | warehouse | user
├── scope_id                  string (nullable — null for global)
├── version_number            int             — auto-incremented per (setting, scope)
├── status                    enum: draft | published | archived
├── value                     text            — the configuration value
├── effective_from            timestamp       — when this version becomes active
├── effective_to              timestamp (nullable) — when it expires
├── changelog                 text            — human description of what changed and why
├── created_by                → User
├── approved_by               → User (nullable)
├── approved_at               timestamp (nullable)
├── published_by              → User (nullable)
├── published_at              timestamp (nullable)
└── archived_at               timestamp (nullable)
```

At any given time, for a given (setting, scope), at most one version has `status = published` and `effective_from <= now() <= effective_to`.

---

## 4. Configuration Categories

### Category: `enterprise`
**Purpose:** Core enterprise identity and behavior settings  
**Scope:** Global, Company  
**Ownership:** System Administrator  

| Key | Type | Description |
|---|---|---|
| `enterprise.multi_company` | bool | Enable multi-company mode |
| `enterprise.currency_default` | string | Default system currency |
| `enterprise.timezone_default` | string | Default timezone |
| `enterprise.date_format` | string | Display date format |
| `enterprise.language_default` | string | Default UI language |

---

### Category: `companies`
**Purpose:** Per-company operational configuration  
**Scope:** Company  
**Ownership:** Company Administrator  

| Key | Type | Description |
|---|---|---|
| `companies.operational_day_start` | string | Time when operational day begins (HH:MM) |
| `companies.default_warehouse_id` | string | Default warehouse for this company |
| `companies.allow_negative_stock` | bool | Allow stock to go below zero |
| `companies.require_batch_approval` | bool | Waves require supervisor approval |

---

### Category: `channels`
**Purpose:** Per-channel commerce and fulfillment settings  
**Scope:** Channel  
**Ownership:** Operations Manager  

| Key | Type | Description |
|---|---|---|
| `channels.fulfillment_profile_id` | string | Active Fulfillment Profile for this channel |
| `channels.default_shipping_company_id` | string | Default shipping company |
| `channels.sla_hours` | int | Default delivery SLA hours |
| `channels.allow_partial_delivery` | bool | Partial deliveries permitted |
| `channels.require_pod` | bool | Proof of delivery required |
| `channels.allocation_mode` | enum | Default allocation mode |

---

### Category: `inventory`
**Purpose:** Inventory management rules and thresholds  
**Scope:** Global, Company, Warehouse  
**Ownership:** Inventory Manager  

| Key | Type | Description |
|---|---|---|
| `inventory.costing_method` | enum | `fifo` / `fefo` / `weighted_average` |
| `inventory.allow_negative_stock` | bool | Allow on-hand to go below zero |
| `inventory.reservation_expiry_hours` | int | Auto-release reservations after N hours |
| `inventory.safety_stock_pct` | decimal | Safety stock % of average daily consumption |
| `inventory.dead_stock_days_threshold` | int | Days without movement before flagged as dead stock |
| `inventory.auto_reorder_enabled` | bool | Enable automatic reorder point triggering |

---

### Category: `manufacturing`
**Purpose:** Production rules and quality thresholds  
**Scope:** Global, Company  
**Ownership:** Production Manager  

| Key | Type | Description |
|---|---|---|
| `manufacturing.default_yield_tolerance_pct` | decimal | Acceptable variance from BOM yield |
| `manufacturing.require_qc_sign_off` | bool | Quality check sign-off before releasing to pool |
| `manufacturing.max_batch_size` | int | Maximum units per manufacturing batch |
| `manufacturing.allow_partial_production` | bool | Allow releasing partial production runs |

---

### Category: `preparation`
**Purpose:** Preparation OS settings  
**Scope:** Global, Company, Warehouse  
**Ownership:** Operations Manager  

| Key | Type | Description |
|---|---|---|
| `preparation.wave_size_max` | int | Maximum orders per preparation wave |
| `preparation.auto_start` | bool | Auto-start preparation on threshold |
| `preparation.quality_check_required` | bool | QC required before pool release |
| `preparation.shortage_threshold_pct` | decimal | Alert when material availability < threshold |

---

### Category: `fulfillment`
**Purpose:** Enterprise fulfillment pipeline settings  
**Scope:** Global, Company, Channel  
**Ownership:** Operations Manager  

Sub-categories:

#### `fulfillment.geography`

| Key | Type | Description |
|---|---|---|
| `fulfillment.geography.coverage_mode` | enum | `exact_zone` / `governorate_fallback` |
| `fulfillment.geography.on_no_coverage` | enum | `block` / `escalate` / `use_fallback` |
| `fulfillment.geography.address_resolution_mode` | enum | `manual` / `geocode` / `customer_selected` |

#### `fulfillment.vehicle`

| Key | Type | Description |
|---|---|---|
| `fulfillment.vehicle.max_orders_per_vehicle` | int | Default maximum orders per vehicle |
| `fulfillment.vehicle.max_weight_kg` | decimal | Default maximum weight per vehicle |
| `fulfillment.vehicle.max_volume_m3` | decimal | Default maximum volume per vehicle |
| `fulfillment.vehicle.max_stops` | int | Default maximum stops per vehicle |
| `fulfillment.vehicle.distribution_algorithm` | enum | `round_robin_weight` / `geographic_proximity` / `order_priority` / `fifo` |
| `fulfillment.vehicle.allow_partial_loading` | bool | Allow vehicles to depart with partial load |

#### `fulfillment.allocation`

| Key | Type | Description |
|---|---|---|
| `fulfillment.allocation.mode` | enum | Default allocation mode |
| `fulfillment.allocation.priority_policy` | string | Active AllocationPriorityPolicy name |
| `fulfillment.allocation.allow_dispatcher_override` | bool | Dispatchers may override allocations |
| `fulfillment.allocation.allow_driver_override` | bool | Drivers may override allocations |
| `fulfillment.allocation.allow_partial_allocation` | bool | Partial allocation permitted |

#### `fulfillment.packing`

| Key | Type | Description |
|---|---|---|
| `fulfillment.packing.mode` | enum | `per_order` / `batch` |
| `fulfillment.packing.materials_required` | bool | Track packing material consumption |
| `fulfillment.packing.label_format` | string | Default label template |
| `fulfillment.packing.pack_at_vehicle` | bool | Pack at vehicle side |

#### `fulfillment.delivery`

| Key | Type | Description |
|---|---|---|
| `fulfillment.delivery.require_pod` | bool | Proof of delivery required |
| `fulfillment.delivery.pod_type` | enum | `signature` / `photo` / `otp` / `none` |
| `fulfillment.delivery.max_attempts` | int | Max delivery attempts before escalation |
| `fulfillment.delivery.route_optimization` | bool | Enable route optimization |
| `fulfillment.delivery.sla_hours` | int | Default SLA hours from dispatch |

---

### Category: `packing`
**Purpose:** Packing OS configuration  
**Scope:** Company, Warehouse  
**Ownership:** Warehouse Manager  

| Key | Type | Description |
|---|---|---|
| `packing.station_count` | int | Number of active packing stations |
| `packing.auto_label_print` | bool | Auto-print label on pack completion |
| `packing.require_weight_verification` | bool | Weigh each pack before sealing |

---

### Category: `logistics`
**Purpose:** Logistics and delivery configuration  
**Scope:** Global, Company, Channel  
**Ownership:** Logistics Manager  

| Key | Type | Description |
|---|---|---|
| `logistics.default_route_algorithm` | enum | `manual` / `distance_optimized` / `time_optimized` / `ai` |
| `logistics.allow_same_day_delivery` | bool | Same-day delivery available |
| `logistics.failed_delivery_escalation_hours` | int | Hours before failed delivery escalates |

---

### Category: `crm`
**Purpose:** Customer relationship management rules  
**Scope:** Global, Company  
**Ownership:** CRM Manager  

| Key | Type | Description |
|---|---|---|
| `crm.loyalty_tiers_enabled` | bool | Enable customer tier system |
| `crm.tier_upgrade_lookback_days` | int | Days to evaluate for tier upgrade |
| `crm.gold_tier_threshold_value` | decimal | Minimum spend for Gold tier |
| `crm.platinum_tier_threshold_value` | decimal | Minimum spend for Platinum tier |

---

### Category: `marketing`
**Purpose:** Marketing and promotion rules  
**Scope:** Company, Channel  
**Ownership:** Marketing Manager  

| Key | Type | Description |
|---|---|---|
| `marketing.discount_stacking_allowed` | bool | Multiple discounts on one order |
| `marketing.max_discount_pct` | decimal | Maximum total discount percentage |
| `marketing.auto_apply_promotions` | bool | Auto-apply eligible promotions |

---

### Category: `commerce`
**Purpose:** Commerce and order management settings  
**Scope:** Company, Channel  
**Ownership:** Commerce Manager  

| Key | Type | Description |
|---|---|---|
| `commerce.auto_confirm_orders` | bool | Auto-confirm paid orders |
| `commerce.order_expiry_hours` | int | Unpaid order cancellation window |
| `commerce.allow_partial_shipment` | bool | Ship parts of an order |
| `commerce.require_address_verification` | bool | Verify address before confirming |

---

### Category: `pos`
**Purpose:** Point-of-sale terminal configuration  
**Scope:** Company, Warehouse  
**Ownership:** POS Manager  

| Key | Type | Description |
|---|---|---|
| `pos.require_session_open` | bool | Require cash session before transactions |
| `pos.allow_price_override` | bool | Cashier may override item price |
| `pos.price_override_max_pct` | decimal | Maximum price override % |
| `pos.receipt_print_mode` | enum | `always` / `on_request` / `never` |

---

### Category: `accounting`
**Purpose:** Financial and accounting rules  
**Scope:** Company  
**Ownership:** Finance Manager  

| Key | Type | Description |
|---|---|---|
| `accounting.auto_post_invoices` | bool | Auto-post supplier invoices |
| `accounting.invoice_tolerance_pct` | decimal | Acceptable variance % for invoice matching |
| `accounting.require_approval_above` | decimal | Transactions above this value require approval |
| `accounting.fiscal_year_start_month` | int | Month fiscal year begins (1-12) |

---

### Category: `ai`
**Purpose:** AI integration behavior and governance  
**Scope:** Global, Company  
**Ownership:** System Administrator  

| Key | Type | Description |
|---|---|---|
| `ai.recommendations_enabled` | bool | AI recommendations globally enabled |
| `ai.min_confidence_threshold` | decimal | Minimum confidence for AI to surface a recommendation |
| `ai.require_explanation` | bool | AI must always provide explanation |
| `ai.allow_auto_apply` | bool | AI may apply recommendations without human approval |
| `ai.auto_apply_max_confidence` | decimal | Minimum confidence for auto-apply |
| `ai.audit_all_evaluations` | bool | Log every AI evaluation (high volume) |

---

### Category: `security`
**Purpose:** Access control and security policy  
**Scope:** Global, Company  
**Ownership:** System Administrator  

| Key | Type | Description |
|---|---|---|
| `security.session_timeout_minutes` | int | User session expiry |
| `security.mfa_required` | bool | MFA required for all users |
| `security.password_min_length` | int | Minimum password length |
| `security.password_expiry_days` | int | Password rotation period |
| `security.api_rate_limit_per_minute` | int | API rate limit per token |

---

### Category: `notifications`
**Purpose:** Notification and alert delivery settings  
**Scope:** Company, User  
**Ownership:** Operations Manager  

| Key | Type | Description |
|---|---|---|
| `notifications.email_enabled` | bool | Email notifications active |
| `notifications.push_enabled` | bool | Push notifications active |
| `notifications.sms_enabled` | bool | SMS notifications active |
| `notifications.digest_frequency` | enum | `realtime` / `hourly` / `daily` |

---

### Category: `integrations`
**Purpose:** Third-party integration settings  
**Scope:** Company, Channel  
**Ownership:** Integration Manager  

| Key | Type | Description |
|---|---|---|
| `integrations.woocommerce_sync_enabled` | bool | WooCommerce sync active |
| `integrations.sync_frequency_minutes` | int | How often to poll for new orders |
| `integrations.bosta_api_enabled` | bool | Bosta courier integration active |
| `integrations.aramex_api_enabled` | bool | Aramex courier integration active |

---

### Category: `users`
**Purpose:** User account and preference settings  
**Scope:** Company, User  
**Ownership:** User / HR Manager  

| Key | Type | Description |
|---|---|---|
| `users.default_language` | string | Default UI language |
| `users.default_timezone` | string | Default timezone |
| `users.items_per_page` | int | Default page size for tables |

---

## 5. Scope Resolution Rules

| Setting Category | Allowed Override Scopes |
|---|---|
| `enterprise` | Global, Company |
| `companies` | Company only |
| `channels` | Channel only |
| `inventory` | Global, Company, Warehouse |
| `manufacturing` | Global, Company |
| `preparation` | Global, Company, Warehouse |
| `fulfillment.*` | Global, Company, Channel |
| `packing` | Company, Warehouse |
| `logistics` | Global, Company, Channel |
| `crm` | Global, Company |
| `marketing` | Company, Channel |
| `commerce` | Company, Channel |
| `pos` | Company, Warehouse |
| `accounting` | Company |
| `ai` | Global, Company |
| `security` | Global, Company |
| `notifications` | Company, User |
| `integrations` | Company, Channel |
| `users` | Company, User |

---

## 6. Configuration Resolver

The Configuration Resolver is the service that finds the active ConfigurationVersion for a given (setting, scope).

```php
interface ConfigurationResolverContract
{
    public function resolve(
        string $settingKey,
        string $scopeType,
        ?string $scopeId,
        ?DateTimeImmutable $effectiveAt = null
    ): ConfigurationVersion;

    public function resolveValue(
        string $settingKey,
        string $scopeType,
        ?string $scopeId,
        ?DateTimeImmutable $effectiveAt = null
    ): mixed;
}
```

### Resolution Algorithm

```
function resolve(settingKey, scopeType, scopeId):

    scopes = buildScopeChain(scopeType, scopeId)
    // e.g. [user:u123, warehouse:w1, channel:ch1, company:c1, country:EG, global]

    for scope in scopes:
        version = ConfigurationVersion.where(
            setting_key: settingKey,
            scope_type: scope.type,
            scope_id: scope.id,
            status: 'published',
            effective_from: <= now(),
            effective_to: null OR > now()
        ).first()

        if version:
            return version

    // If nothing found anywhere — use the setting's default_value
    return buildDefaultVersion(settingKey)
```
