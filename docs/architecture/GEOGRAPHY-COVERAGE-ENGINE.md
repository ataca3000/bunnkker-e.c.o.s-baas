# Geography & Coverage Engine — Specification

**Document:** GEOGRAPHY-COVERAGE-ENGINE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-FULFILLMENT-ARCH-002  
**ADR Reference:** ADR-015  
**Position in Platform:** Before Vehicle Planning — runs at order grouping time

---

## 1. Mission

> Automatically organize all fulfillment operations geographically before any vehicle planning begins.

The Geography & Coverage Engine is the first decision layer in the Enterprise Fulfillment Platform. It answers three questions before a single vehicle is assigned:

1. **Where are the orders going?** — geographic grouping by governorate and zone
2. **Which shipping companies can serve those zones?** — coverage map matching
3. **Which shipping company should serve each order?** — channel rule enforcement + auto-selection

No vehicle planning may begin until the Geography Engine has assigned every order to a shipping company and zone group.

---

## 2. Geographic Hierarchy

ECOS organizes delivery geography in a strict hierarchy. Every order must resolve to a position in this hierarchy before it enters the fulfillment pipeline.

```
Country
└── Governorate
    └── Zone
        └── Sub-Zone (optional)
            └── Orders
```

### Hierarchy Rules

| Level | Description | Example (Egypt) |
|---|---|---|
| **Country** | Top-level geographic boundary | Egypt |
| **Governorate** | Administrative division (محافظة) | Cairo, Giza, Alexandria |
| **Zone** | Planning subdivision within a governorate | Nasr City, Heliopolis, October City |
| **Sub-Zone** | Optional fine-grained area within a zone | Sector A, North District |
| **Orders** | Leaf node — actual delivery addresses resolve to a zone | 145 Mohamed Naguib St → Nasr City |

### Governorate Entity

```
Governorate
├── id                    uuid
├── country_id            → Country
├── name_en               string
├── name_ar               string
├── code                  string        — short code (e.g. "CAI", "GIZ")
├── is_active             bool
└── zones[]               → Zone[]
```

### Zone Entity

```
Zone
├── id                    uuid
├── governorate_id        → Governorate
├── name_en               string
├── name_ar               string
├── code                  string        — short code (e.g. "NASR", "HELM")
├── sub_zones[]           → SubZone[] (optional)
├── is_active             bool
└── polygon               JSONB (optional — GeoJSON polygon for map rendering)
```

### Address → Zone Resolution

When an order is placed, its delivery address must resolve to a `zone_id`. Resolution options:

1. **Customer-provided zone** — customer selected zone during checkout (preferred)
2. **Auto-geocode** — delivery address geocoded to zone via address matching table
3. **Manual assignment** — operator assigns zone for edge cases

An order with an unresolvable zone is flagged as `geography_unresolved` and blocked from entering vehicle planning until resolved.

---

## 3. Shipping Company Coverage Map

Each Shipping Company (whether internal fleet or third-party carrier) defines a Coverage Map: the exact set of zones it can serve.

### ShippingCompany Entity

```
ShippingCompany
├── id                    uuid
├── company_id            → Company
├── name                  string        — e.g. "Bosta", "Aramex", "My Fleet"
├── type                  enum:
│                           internal_fleet  — company's own vehicles
│                           third_party     — external carrier
├── max_orders_per_vehicle int           — default limit for vehicle planning
├── max_weight_per_vehicle decimal(10,2) — kg
├── max_volume_per_vehicle decimal(10,4) — m³
├── max_stops_per_vehicle  int
├── max_working_hours      decimal(4,2)  — hours per shift
├── priority               int           — lower = higher priority in auto-selection
├── is_active             bool
└── coverage[]            → ShippingCoverage[]
```

### ShippingCoverage Entity

```
ShippingCoverage
├── id                    uuid
├── shipping_company_id   → ShippingCompany
├── zone_id               → Zone
├── is_active             bool
├── estimated_transit_hours int
└── notes                 string (nullable)
```

### Coverage Map Example

```
Bosta
├── Cairo
│   ├── Nasr City       ✓ (2h transit)
│   ├── Heliopolis      ✓ (2h transit)
│   ├── New Cairo       ✓ (3h transit)
│   └── Zamalek         ✓ (1h transit)
└── Giza
    ├── October City    ✓ (4h transit)
    └── Sheikh Zayed    ✓ (3h transit)

My Fleet (Internal)
├── Cairo
│   ├── Nasr City       ✓ (1h transit)
│   ├── Heliopolis      ✓ (1h transit)
│   └── Maadi           ✓ (2h transit)
└── Giza
    └── Dokki           ✓ (2h transit)

Aramex
└── Egypt (all governorates) ✓ (24h transit)
```

---

## 4. Channel Coverage Rules

Every Channel defines which Shipping Companies are allowed to serve its orders.

### ChannelShippingRule Entity

```
ChannelShippingRule
├── id                    uuid
├── channel_id            → Channel
├── shipping_company_id   → ShippingCompany
├── priority              int         — lower = preferred; used in auto-selection tie-breaking
├── max_orders_per_day    int (nullable) — optional daily cap for this company on this channel
└── is_active             bool
```

### Channel Rule Example

```
Website A (WooCommerce)
├── Allowed Shipping Companies:
│   ├── My Fleet          (priority: 1)
│   ├── Bosta             (priority: 2)
│   └── Aramex            (priority: 3 — fallback for unserved zones)

Retail Stores Channel
├── Allowed Shipping Companies:
│   └── My Fleet          (priority: 1 — internal only)

Wholesale Channel
├── Allowed Shipping Companies:
│   ├── My Fleet          (priority: 1)
│   └── Aramex            (priority: 2)
```

---

## 5. Automatic Shipping Company Selection

The Geography Engine selects a Shipping Company for each zone group using a deterministic algorithm.

### Selection Algorithm

```
function selectShippingCompany(order, channel, zone):

    // Step 1: Get shipping companies allowed for this channel
    allowed = ChannelShippingRule
        .where(channel_id = order.channel_id)
        .where(is_active = true)
        .orderBy(priority ASC)

    // Step 2: Filter by geographic coverage
    covering = allowed.filter(company => company.covers(zone))

    // Step 3: Filter by daily capacity
    available = covering.filter(company =>
        company.daily_orders_today(channel) < company.max_orders_per_day
    )

    // Step 4: Select by priority (lowest number wins)
    selected = available.first()

    // Step 5: If no company found → raise exception
    if selected is null:
        raise GeographyException(type: 'no_coverage', zone: zone, channel: channel)

    return selected
```

### Selection Factors (in priority order)

| Factor | Description |
|---|---|
| Channel Rules | Only companies allowed by the channel are considered |
| Coverage Map | Only companies that serve the delivery zone are considered |
| Availability | Companies at their daily cap are excluded |
| Priority | Among remaining candidates, the lowest-priority-number wins |
| Future: AI | AI can override priority based on predicted performance (see EP-G1) |

### Selection Outcome

When a company is selected, the order is stamped:

```
Order (fulfillment extension)
├── geography_zone_id             → Zone
├── geography_governorate_id      → Governorate
├── shipping_company_id           → ShippingCompany  (auto-selected)
├── shipping_company_selection_reason  string  (e.g. "auto: priority 1, coverage match")
└── geography_resolved_at         timestamp
```

---

## 6. Geographic Grouping Output

After the Geography Engine processes all orders for a planning session, it produces geographic groups that become the input to Vehicle Planning.

```
GeographyGroup
├── id
├── planning_session_id       → OperationalDay
├── governorate_id            → Governorate
├── zone_id                   → Zone
├── shipping_company_id       → ShippingCompany
├── orders[]                  → Order[]
├── total_order_count         int
├── total_weight_kg           decimal(10,2)
├── total_volume_m3           decimal(10,4)
└── created_at                timestamp
```

One GeographyGroup = one (zone, shipping_company) pair with all orders assigned to it.

Vehicle Planning operates on GeographyGroups, not on raw orders.

---

## 7. Geography Exceptions

| Exception Type | Severity | Description | Required Action |
|---|---|---|---|
| `address_unresolvable` | Blocking | Delivery address cannot be mapped to any zone | Manual zone assignment |
| `no_coverage` | Blocking | No allowed shipping company serves this zone | Add coverage or reassign channel rule |
| `company_at_capacity` | Warning | Preferred company is at daily cap | Use next-priority company |
| `zone_inactive` | Blocking | Zone is marked inactive in master data | Reactivate zone or rezone order |
| `company_inactive` | Warning | Selected shipping company is inactive | Skip to next priority |

---

## 8. Manual Overrides

Dispatchers may override the auto-selected shipping company for any order or geography group.

**Override rules:**
- Override company must still be in the channel's allowed list
- Override company must still have coverage for the order's zone
- Reason is required
- Override is recorded as `ShippingCompanyOverride` with: order_id, original_company_id, override_company_id, reason, overridden_by, overridden_at

---

## 9. Master Data Administration

| Entity | Admin Role | Actions |
|---|---|---|
| Country | System Admin | Create, activate/deactivate |
| Governorate | Operations Manager | Create, activate/deactivate |
| Zone | Operations Manager | Create, assign to governorate, activate/deactivate |
| Sub-Zone | Operations Manager | Create, assign to zone |
| Shipping Company | Operations Manager | Create, configure limits, activate/deactivate |
| Shipping Coverage | Operations Manager | Map company to zones |
| Channel Rules | Operations Manager | Assign companies to channels with priority |

---

## 10. Integration with Other Engines

| Module | Interaction |
|---|---|
| **Commerce** | Orders arrive with delivery address → resolved to zone_id |
| **Vehicle Planning Engine** | Consumes GeographyGroups as input |
| **Loading & Allocation OS** | Vehicle assignments are zone-scoped |
| **Logistics OS** | Route planning respects zone boundaries |
| **Channel Fulfillment Engine** | Profile execution is triggered per geography group |

---

## 10B. Configuration Platform Dependency (TASK-CONFIGURATION-ARCH-001)

The Geography & Coverage Engine does not contain hardcoded business rules. All decisions are governed by `GeographyPolicy`.

### Policy Consumed: `GeographyPolicy`

```php
$policy = $policyEngine->resolve(GeographyPolicy::class, 'channel', $channelId);
$result = $ruleEngine->evaluate($policy, [
    'order'   => $order,
    'zone'    => $zone,
    'channel' => $channel,
], 'shipping_company_selection');
```

### Configuration Settings Governing This Engine

| Setting Key | Description |
|---|---|
| `fulfillment.geography.coverage_mode` | `exact_zone` or `governorate_fallback` |
| `fulfillment.geography.on_no_coverage` | `block` / `escalate` / `use_fallback` |
| `fulfillment.geography.address_resolution_mode` | How to resolve ambiguous addresses |

### Feature Flag

```
modules.geography_coverage   — must be enabled for this engine to run
```

### Audit

Every auto-selection decision produces a `PolicyEvaluationAudit` record with `policy_type = 'GeographyPolicy'`. Manual overrides produce both a `PolicyEvaluationAudit` (manual_override rule) and a `ConfigurationChangeAudit` entry.

---

## 11. DDD Module Structure

```
Modules/
└── Operations/
    └── GeographyCoverage/
        ├── Domain/
        │   ├── Models/
        │   │   ├── Governorate.php
        │   │   ├── Zone.php
        │   │   ├── SubZone.php
        │   │   ├── ShippingCompany.php
        │   │   ├── ShippingCoverage.php
        │   │   ├── ChannelShippingRule.php
        │   │   └── GeographyGroup.php
        │   ├── Services/
        │   │   └── ShippingCompanySelectionService.php
        │   ├── Enums/
        │   │   ├── ShippingCompanyType.php
        │   │   └── GeographyExceptionType.php
        │   └── Exceptions/
        │       ├── AddressUnresolvableException.php
        │       └── NoCoverageException.php
        ├── Application/
        │   ├── Services/
        │   │   ├── GroupOrdersByGeographyService.php
        │   │   └── ResolveOrderGeographyService.php
        │   └── Queries/
        │       ├── GetCoverageMapQuery.php
        │       └── GetChannelShippingRulesQuery.php
        ├── Infrastructure/
        └── Presentation/
```
