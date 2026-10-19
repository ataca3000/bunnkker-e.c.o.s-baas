# ADR-012 — Marketing Assets Architecture

**ADR Number:** ADR-012  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-ORG-ADR-012  
**CTO Sign-Off:** Approved — definitive separation of Sales Execution and Marketing Infrastructure  
**Supersedes:** Business Account as unified integration root (ADR-011 V2.2)

---

## 1. Context

ADR-011 V2.2 placed Business Account as the parent of Sales Channels:

```
Company → Brand → Business Account → Sales Channel
```

During the final Organization OS review, it was identified that this model mixes two fundamentally different responsibilities inside Business Account:

| Responsibility | Type |
|---|---|
| Where orders are created | Sales Execution |
| Where advertising runs | Marketing Infrastructure |
| OAuth credentials | Technical Integration |
| API keys and secrets | Technical Integration |
| Facebook Pages, Ad Accounts, Pixels | Marketing Infrastructure |
| WooCommerce stores, POS terminals | Sales Execution |

These are separate concerns with different lifecycles, different data, different ownership, and different downstream consumers. Merging them into a single aggregate introduces architectural debt that becomes costly when Marketing OS and CRM are implemented.

---

## 2. Decision

**Separate Sales Channels from Marketing Accounts.** Both now belong directly to Brand.

```
Company
└── Brand
    ├── Sales Channels          (Commerce Execution)
    └── Marketing Accounts      (Marketing Infrastructure)
        └── Marketing Assets
```

Integration Account (formerly Business Account) retains its technical role as credential storage — it no longer acts as the parent of Sales Channels.

---

## 3. Architecture

### 3.1 Updated Hierarchy

```
Company (COM-000001)
│
├── Brands (BRD-000001)
│      │
│      ├── Sales Channels (CH-000001)
│      │        Purpose: Commerce execution — orders, products, pricing, stock
│      │
│      ├── Marketing Accounts (MKT-000001)
│      │        Purpose: Marketing platform accounts — Meta, Google, TikTok
│      │        └── Marketing Assets
│      │                 Purpose: Platform sub-entities (Pages, Ad Accounts, Pixels)
│      │                 └── (Future) Campaigns
│      │                          └── (Future) Attribution → Orders
│      │
│      └── Integration Accounts (IA-000001)   [formerly Business Account]
│               Purpose: Technical integration — OAuth, API keys, webhooks
│
├── Warehouses (WH-000001)
├── Teams (TM-000001)
└── Users
```

### 3.2 Commerce Ownership (PART 7)

Commerce execution follows a clean, dedicated chain:

```
Company
    └── Brand
            └── Sales Channel
                    ├── Products
                    ├── Pricing
                    ├── Inventory Allocation
                    ├── Customer Attribution
                    ├── Orders
                    └── Commerce Analytics
```

Sales Channels never store advertising information.

### 3.3 Marketing Ownership (PART 6)

Marketing infrastructure follows a separate chain:

```
Company
    └── Brand
            └── Marketing Account
                    └── Marketing Assets
                            └── (Future) Campaigns
                                        └── (Future) Orders (via Attribution)
```

Marketing Accounts never create orders directly. Attribution links a Campaign to a Sales Channel via UTM parameters.

---

## 4. Entity Definitions

### 4.1 Sales Channel (PART 1)

Represents where orders are created. Each Sales Channel belongs directly to a Brand.

**Responsibilities:**
- Order creation and management
- Product catalog publication
- Pricing per channel
- Inventory allocation
- Customer attribution
- Commerce analytics

**Examples:**

| Channel | Type |
|---|---|
| WooCommerce Store | `website` |
| Shopify Store | `website` |
| Amazon Egypt | `marketplace` |
| Amazon KSA | `marketplace` |
| Noon | `marketplace` |
| TikTok Shop | `social_commerce` |
| Facebook Shop | `social_commerce` |
| Instagram Shop | `social_commerce` |
| POS Terminal | `pos` |
| Retail Store | `pos` |
| B2B Portal | `b2b` |

Sales Channels never store advertising credentials, pixel IDs, or campaign data.

**Code pattern:** `CH-{6-digit seq per company}` → `CH-000001`

---

### 4.2 Marketing Account (PART 2)

New aggregate. Represents an external marketing platform account owned by a Brand.

**Purpose:** Owns all marketing platform credentials, tokens, and asset hierarchies.

**Fields:**

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `company_id` | UUID FK | Denormalized for isolation |
| `brand_id` | UUID FK | Direct Brand ownership |
| `provider` | enum | See provider enum below |
| `name` | string | Human-readable name |
| `code` | string | Auto: `MKT-{6-digit seq per brand}` |
| `status` | enum | `active`, `inactive`, `suspended` |
| `external_id` | string | Platform account ID |
| `credentials` | encrypted JSON | API keys, secrets |
| `oauth_tokens` | encrypted JSON | Access token, refresh token, expiry |
| `sync_settings` | JSON | Sync frequency, enabled syncs |
| `webhook_settings` | JSON | Endpoint URL, events, secret |

**Provider enum:**

| Value | Platform |
|---|---|
| `meta` | Meta Business Manager |
| `google` | Google Merchant Center / Google Ads |
| `tiktok` | TikTok Business Center |
| `snapchat` | Snapchat Business |
| `linkedin` | LinkedIn Campaign Manager |
| `twitter` | X / Twitter Ads |

**Code pattern:** `MKT-{6-digit seq per brand}` → `MKT-000001`

---

### 4.3 Marketing Assets (PART 3)

Marketing Assets are sub-entities that belong to a Marketing Account. Each asset is a specific platform object that can serve as a creative, tracking, or distribution unit.

**Structure by provider:**

#### Meta (Meta Business Manager)

```
Meta Marketing Account (MKT-000001)
├── Facebook Page
├── Instagram Account
├── Ad Account
├── Pixel
├── Conversions API
└── Catalog
```

#### Google

```
Google Marketing Account (MKT-000002)
├── Merchant Center
├── Google Ads Account
└── Conversion Tag
```

#### TikTok

```
TikTok Marketing Account (MKT-000003)
├── TikTok Ads Account
├── TikTok Pixel
└── TikTok Catalog
```

#### Snapchat

```
Snapchat Marketing Account (MKT-000004)
├── Snap Business
├── Snap Pixel
└── Snap Catalog
```

**Marketing Asset Fields:**

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `marketing_account_id` | UUID FK | |
| `company_id` | UUID FK | Denormalized |
| `brand_id` | UUID FK | Denormalized |
| `asset_type` | enum | See asset type enum |
| `name` | string | Human-readable name |
| `external_id` | string | Platform asset ID |
| `status` | enum | `active`, `inactive`, `error` |
| `metadata` | JSON | Platform-specific config |

**Asset type enum:**

| Value | Provider | Description |
|---|---|---|
| `facebook_page` | Meta | Facebook Business Page |
| `instagram_account` | Meta | Instagram Business Account |
| `meta_ad_account` | Meta | Meta Ad Account |
| `meta_pixel` | Meta | Meta Pixel (browser) |
| `meta_conversions_api` | Meta | Server-side Conversions API |
| `meta_catalog` | Meta | Meta Product Catalog |
| `google_merchant_center` | Google | Google Merchant Center account |
| `google_ads_account` | Google | Google Ads account |
| `google_conversion_tag` | Google | Google conversion tracking tag |
| `tiktok_ads_account` | TikTok | TikTok Ads account |
| `tiktok_pixel` | TikTok | TikTok Pixel |
| `tiktok_catalog` | TikTok | TikTok Product Catalog |
| `snap_pixel` | Snapchat | Snap Pixel |
| `snap_catalog` | Snapchat | Snapchat Catalog |

Marketing Assets are **not** Sales Channels. They are marketing infrastructure only.

---

### 4.4 Integration Account — formerly Business Account (PART 5)

The concept previously called "Business Account" is renamed **Integration Account** in this architecture to clarify its true purpose.

**Purpose:** Owns technical integration between ECOS and an external platform.

**Responsibilities:**
- OAuth token storage and refresh
- API credential management (keys, secrets)
- Webhook endpoint registration
- Sync settings (frequency, enabled modules)

**What it does NOT own:**
- Sales Channels
- Marketing Assets
- Campaigns
- Advertising data

**Migration note:** The existing `business_accounts` database table is preserved in Phase 1. No physical table rename or migration will be performed until TASK-ORG-INT-001 explicitly authorizes it. The architectural term is updated in all documentation immediately. Code variable names and UI labels may continue using "business account" until the rename migration is scheduled.

**Code pattern:** `IA-{6-digit seq per brand}` → `IA-000001` *(target; current table uses `BA-` prefix)*

---

## 5. Sales Attribution (PART 4)

Reserved for future implementation. No implementation in this ADR.

The attribution chain links marketing spend to revenue:

```
Marketing Campaign
        │
        ↓ (UTM parameters)
Marketing Asset (Ad Account, Pixel)
        │
        ↓ (landing URL)
Sales Channel
        │
        ↓
Order
        │
        ↓
Customer
```

This enables the following KPIs:

| KPI | Formula |
|---|---|
| ROAS (Return on Ad Spend) | Revenue ÷ Ad Spend |
| CPA (Cost per Acquisition) | Ad Spend ÷ Orders |
| CAC (Customer Acquisition Cost) | Ad Spend ÷ New Customers |
| Campaign Revenue | Attributed Order Revenue |
| Campaign Profitability | Campaign Revenue − Campaign Cost − COGS |

Attribution will be implemented in Marketing OS. No implementation in this ADR.

---

## 6. AI Readiness (PART 8)

Reserved for future implementation. No implementation in this ADR.

```
Marketing Account
        ↓
Campaign Performance
        ↓
Customer Acquisition
        ↓
Order Attribution
        ↓
Profitability
```

The AI platform will use this chain to:
- Recommend budget reallocation across channels
- Predict CAC by channel and audience
- Identify best-performing creatives by revenue contribution
- Flag underperforming campaigns relative to COGS

---

## 7. Invariants

1. Every Marketing Account belongs to exactly one active Brand.
2. `marketing_account.company_id` always equals `marketing_account.brand.company_id`.
3. Every Marketing Asset belongs to exactly one Marketing Account.
4. `marketing_asset.company_id` equals `marketing_asset.marketing_account.company_id`.
5. Marketing Accounts and Marketing Assets never own Orders.
6. Sales Channels never store advertising credentials, pixel IDs, or campaign data.
7. An Integration Account may exist with zero Marketing Accounts (technical-only integration).
8. A Marketing Account may exist without a corresponding Integration Account.

---

## 8. Separation of Concerns Matrix

| Entity | Creates Orders | Runs Ads | Stores Credentials | Platform |
|---|---|---|---|---|
| Sales Channel | ✓ | ✗ | ✗ | WooCommerce, Amazon, POS |
| Marketing Account | ✗ | ✓ | ✓ | Meta, Google, TikTok |
| Marketing Asset | ✗ | ✓ (runs) | ✗ | Pages, Ad Accounts, Pixels |
| Integration Account | ✗ | ✗ | ✓ | Any platform OAuth |

---

## 9. What Is NOT Implemented (PART 10)

This ADR is an architectural update only. The following must NOT be implemented as part of this task:

- Campaign management
- Ad creation or scheduling
- Meta Ads API integration
- Google Ads API integration
- TikTok Ads API integration
- Pixel event tracking
- Conversion API implementation
- Attribution calculation
- ROAS / CPA / CAC dashboards

These belong to **Marketing OS** (future work package: TASK-MARKETING-001).

Database tables for `marketing_accounts` and `marketing_assets` are reserved for Marketing OS. No migration files should be created as part of this ADR.

---

## 10. Document Updates Required (PART 9)

| Document | Change |
|---|---|
| `ADR-011-V2.2-organization-os.md` | Update to V2.3: reflect new hierarchy, add Marketing Account + Integration Account definitions |
| `docs/domain/ENTERPRISE-DOMAIN-MODEL.md` | Add Marketing domain row to domain map |
| `docs/domain/AGGREGATE-CATALOG.md` | Add AGG-16: Marketing Account |
| `docs/domain/OWNERSHIP-MODEL.md` | Add Brand owns: Marketing Accounts section |
| `docs/domain/Marketing-Domain.md` | New document — full Marketing domain model |
| `docs/architecture/MARKETING-OS-PREPARATION.md` | New document — Marketing OS engineering prep |

---

## 11. Supersession Record

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-05 | Initial: Sales Execution / Marketing Infrastructure separation |
