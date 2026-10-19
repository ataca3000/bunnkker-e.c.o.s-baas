# Marketing Domain

**Document:** Marketing-Domain  
**Version:** 1.0  
**Status:** RESERVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-ORG-ADR-012  
**Parent:** ADR-012-marketing-assets-architecture.md  
**Implementation:** Marketing OS (future — TASK-MARKETING-001)

---

## 1. Purpose

This document defines the Marketing domain for ECOS ERP. The Marketing domain owns all advertising platform accounts, advertising assets, and future campaign management. It is entirely separate from the Commerce domain, which owns Sales Channels and Orders.

> **No implementation yet.** This document reserves the domain model for Marketing OS.

---

## 2. Domain Position in ECOS

```
┌─────────────────────────────────────────────────────┐
│                  ECOS DOMAIN MAP                    │
├───────────────────┬─────────────────────────────────┤
│  ORGANIZATION     │  Company · Brand · Warehouse    │
│                   │  Sales Channel · Mkt Account    │
│                   │  Integration Account · Team     │
├───────────────────┼─────────────────────────────────┤
│  MARKETING        │  Marketing Account              │
│  (this domain)    │  Marketing Asset                │
│                   │  (Future) Campaign              │
│                   │  (Future) Attribution           │
├───────────────────┼─────────────────────────────────┤
│  COMMERCE         │  Order · Sales Channel          │
├───────────────────┼─────────────────────────────────┤
│  CRM              │  Customer · Lead · Opportunity  │
└───────────────────┴─────────────────────────────────┘
```

---

## 3. Aggregate: Marketing Account

### 3.1 Overview

Marketing Account is the root aggregate for marketing platform management. It represents one account on an external marketing platform (Meta Business Manager, Google Merchant Center, TikTok Business Center, etc.).

**Ownership:** Brand → Marketing Account (direct)  
**Company isolation:** `marketing_account.company_id` always equals `brand.company_id`

### 3.2 Fields

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `company_id` | UUID FK | Denormalized; always equals brand.company_id |
| `brand_id` | UUID FK | Direct Brand ownership |
| `provider` | enum | Marketing platform |
| `name` | string(255) | Human-readable account name |
| `code` | string(20) | Auto: `MKT-{6-digit seq per brand}` |
| `status` | enum | `active` \| `inactive` \| `suspended` |
| `external_id` | string(255) | Platform account ID (e.g., Meta Business ID) |
| `credentials` | encrypted JSON | API keys, client secrets |
| `oauth_tokens` | encrypted JSON | Access token, refresh token, expiry timestamp |
| `sync_settings` | JSON | Sync frequency, enabled sync modules |
| `webhook_settings` | JSON | Endpoint URL, events to receive, signing secret |
| `is_active` | boolean | Operational flag |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `deleted_at` | timestamp | Soft-delete |

### 3.3 Provider Enum

| Value | Platform | Region |
|---|---|---|
| `meta` | Meta Business Manager | Global |
| `google` | Google Merchant Center / Google Ads | Global |
| `tiktok` | TikTok Business Center | Global |
| `snapchat` | Snapchat Business | Global |
| `linkedin` | LinkedIn Campaign Manager | Global |
| `twitter` | X (Twitter) Ads | Global |

### 3.4 Relationships

```
Brand (1)
    └──< Marketing Account (N)
                └──< Marketing Asset (N)
                            └──< (Future) Campaign (N)
```

### 3.5 Events (Reserved)

| Event | Trigger |
|---|---|
| `MarketingAccountCreated` | New account connected |
| `MarketingAccountSuspended` | Account suspended by platform |
| `MarketingAccountTokenRefreshed` | OAuth token renewed |
| `MarketingAccountDisconnected` | Account unlinked |

---

## 4. Entity: Marketing Asset

### 4.1 Overview

Marketing Assets are child entities of a Marketing Account. Each asset is a specific object within the marketing platform — a Facebook Page, an Ad Account, a Pixel, etc. — that can serve as a source, destination, or tracking mechanism for marketing campaigns.

### 4.2 Fields

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `marketing_account_id` | UUID FK | Parent Marketing Account |
| `company_id` | UUID FK | Denormalized |
| `brand_id` | UUID FK | Denormalized |
| `asset_type` | enum | See asset type catalog |
| `name` | string(255) | Human-readable asset name |
| `external_id` | string(255) | Platform object ID |
| `status` | enum | `active` \| `inactive` \| `error` |
| `metadata` | JSON | Platform-specific config and properties |
| `is_active` | boolean | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### 4.3 Asset Type Catalog

#### Meta Assets

| asset_type | Description | Key Metadata |
|---|---|---|
| `facebook_page` | Facebook Business Page | `page_id`, `page_name`, `follower_count` |
| `instagram_account` | Instagram Business Account | `instagram_id`, `username` |
| `meta_ad_account` | Meta Ads Manager account | `ad_account_id`, `currency`, `timezone` |
| `meta_pixel` | Meta Pixel (browser-side tracking) | `pixel_id`, `events_matched` |
| `meta_conversions_api` | Server-side Conversions API | `dataset_id`, `access_token` |
| `meta_catalog` | Meta Product Catalog | `catalog_id`, `product_count` |

#### Google Assets

| asset_type | Description | Key Metadata |
|---|---|---|
| `google_merchant_center` | Google Merchant Center account | `merchant_id`, `country`, `currency` |
| `google_ads_account` | Google Ads account | `customer_id`, `currency`, `timezone` |
| `google_conversion_tag` | Google conversion tracking | `conversion_id`, `conversion_label` |

#### TikTok Assets

| asset_type | Description | Key Metadata |
|---|---|---|
| `tiktok_ads_account` | TikTok Ads account | `advertiser_id`, `currency` |
| `tiktok_pixel` | TikTok Pixel | `pixel_id`, `pixel_code` |
| `tiktok_catalog` | TikTok Product Catalog | `catalog_id`, `product_count` |

#### Snapchat Assets

| asset_type | Description | Key Metadata |
|---|---|---|
| `snap_pixel` | Snap Pixel | `pixel_id`, `snap_app_id` |
| `snap_catalog` | Snapchat Product Catalog | `catalog_id` |

### 4.4 Events (Reserved)

| Event | Trigger |
|---|---|
| `MarketingAssetCreated` | Asset connected |
| `MarketingAssetSynced` | Asset data refreshed |
| `MarketingAssetErrored` | Platform error detected |
| `MarketingAssetDeactivated` | Asset disconnected |

---

## 5. Future: Campaign (Reserved)

> Not implemented. Reserved for Marketing OS.

A Campaign is owned by a Marketing Account (specifically, an Ad Account asset). Campaigns span multiple ad sets, each targeting a specific audience with a creative.

### 5.1 Planned Hierarchy

```
Marketing Account
    └── Marketing Asset: Ad Account
            └── Campaign
                    └── Ad Set
                            └── Ad Creative
```

### 5.2 Attribution Chain (Reserved)

```
Campaign
    └── Landing URL / UTM Parameters
            └── Sales Channel
                    └── Order
                            └── Customer
```

Attribution metadata on Orders:
- `utm_source` (e.g., `facebook`)
- `utm_medium` (e.g., `paid_social`)
- `utm_campaign` (campaign name / ID)
- `utm_content` (ad creative ID)
- `utm_term` (audience segment)

### 5.3 KPIs Enabled by Attribution

| KPI | Formula |
|---|---|
| ROAS | Revenue ÷ Ad Spend |
| CPA | Ad Spend ÷ Orders |
| CAC | Ad Spend ÷ New Customers |
| Campaign Revenue | Sum(attributed order revenue) |
| Campaign Profitability | Revenue − Ad Spend − COGS |
| Attribution Window | Orders within N days of ad click/view |

---

## 6. Domain Rules (Invariants)

1. Every Marketing Account belongs to exactly one Brand.
2. `marketing_account.company_id` equals `marketing_account.brand.company_id` always.
3. Every Marketing Asset belongs to exactly one Marketing Account.
4. Marketing Accounts and Marketing Assets **never** create or own Orders.
5. Attribution links a Campaign to an Order via UTM metadata on the Order — not via a direct FK.
6. Sales Channels never store `pixel_id`, `ad_account_id`, or other marketing identifiers.
7. A Marketing Account may be connected without any Marketing Assets (account added but not yet configured).
8. An `asset_type` must be valid for the parent Marketing Account's `provider`.

---

## 7. Domain Boundary

**Marketing domain consumes (reads only):**
- Organization: Company, Brand (IDs for isolation)
- Commerce: Order (reads attribution metadata for reporting)
- CRM: Customer (reads for CAC calculation)

**Marketing domain is consumed by:**
- AI Platform (for ROAS/CPA recommendations)
- Finance (for campaign cost allocation)

**Marketing domain does NOT:**
- Create Orders
- Modify Products
- Manage Inventory
- Own Customers

---

## 8. Glossary

| Term | Definition |
|---|---|
| Marketing Account | An account on an advertising platform (Meta Business Manager, Google Ads, etc.) |
| Marketing Asset | A sub-entity of a Marketing Account — Facebook Page, Ad Account, Pixel, Catalog, etc. |
| Integration Account | Technical credential store (OAuth, API keys) — formerly called Business Account |
| Attribution | The process of connecting a marketing touchpoint to a downstream Order |
| ROAS | Return on Ad Spend — Revenue ÷ Ad Spend |
| CPA | Cost per Acquisition — Ad Spend ÷ Orders acquired |
| CAC | Customer Acquisition Cost — Ad Spend ÷ New Customers |
| UTM | Urchin Tracking Module — URL parameters used to identify traffic source |
