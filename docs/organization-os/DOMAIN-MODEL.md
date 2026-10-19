# Organization OS — Domain Model

**Document:** DOMAIN-MODEL  
**Version:** 2.2  
**Status:** APPROVED FOR IMPLEMENTATION — ADR-011 V2.2  
**Date:** 2026-07-05  
**Supersedes:** V2.1 (Channel → Sales Channel; channel_type added; Product ownership rule; Product Publication reserved)

---

## 1. Core Hierarchy

```
Company (COM-000001)
│
├── Brands (BRD-000001)                          ← Commercial Identity
│      │
│      ├── Business Accounts (BA-000001)          ← Integration Root
│      │        │
│      │        ├── Sales Channels (CH-000001)    ← Operational Selling Endpoint
│      │        ├── Advertising Assets
│      │        ├── Catalogs
│      │        ├── Integrations
│      │        ├── Credentials
│      │        ├── Webhooks
│      │        └── Sync Settings
│      │
│      └── Brand Settings
│
├── Warehouses (WH-000001)                        ← Operational Location (Company-direct)
│
├── Teams (TM-000001)
│
├── Users
│
├── Roles & Permissions
│
└── Organization Settings
```

---

## 2. Entity Definitions

### 2.1 Company

The root aggregate. Every entity in ECOS belongs to exactly one Company.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| code | VARCHAR(20) | Auto: COM-000001 |
| name | VARCHAR(255) | Legal trading name |
| legal_name | VARCHAR(255) | |
| tax_number | VARCHAR(50) | |
| commercial_registration | VARCHAR(50) | |
| email | VARCHAR(255) | |
| phone | VARCHAR(50) | |
| mobile | VARCHAR(50) | |
| website | VARCHAR(255) | |
| currency | CHAR(8) | ISO 4217 |
| timezone | VARCHAR(50) | |
| country | VARCHAR(100) | |
| city | VARCHAR(100) | |
| address | TEXT | |
| postal_code | VARCHAR(20) | |
| logo | VARCHAR(500) | |
| is_active | BOOLEAN | |
| created_at / updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

---

### 2.2 Brand

A Brand is the commercial identity under which a Company goes to market. A Company may operate multiple Brands. A Brand owns one or more Business Accounts.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| company_id | UUID | FK → companies |
| code | VARCHAR(20) | Auto: BRD-000001 |
| name | VARCHAR(255) | e.g. "Honey & Co", "Pure Organic" |
| slug | VARCHAR(255) | URL-safe; unique per company |
| logo | VARCHAR(500) | Brand logo |
| description | TEXT | |
| is_active | BOOLEAN | |
| created_at / updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

**Uniqueness:** `(company_id, code)`, `(company_id, slug)`

---

### 2.3 Business Account *(Integration Root)*

A Business Account represents an external commercial account registered under a Brand on an external platform. It is the central integration hub. **No connector may bypass Business Account.**

**Owns:** OAuth Tokens, API Credentials, Webhooks, Sync Settings, Catalog Connections, Advertising Assets, Connected Sales Channels, External Metadata.

**Platform examples:**

| Platform Provider | Business Account Example |
|---|---|
| Meta | Meta Business Manager (owns Facebook Pages, Instagram, WhatsApp, Ad Accounts) |
| Google | Google Merchant Center (owns Merchant feeds, Ads, Business Profile) |
| WooCommerce | WooCommerce Store Group (owns individual WooCommerce sites) |
| Shopify | Shopify Organization (owns individual stores) |
| Amazon | Amazon Seller Central (owns regional stores: EG, KSA, AE) |
| TikTok | TikTok Business Center (owns TikTok Shop, Ads accounts) |
| Noon | Noon Seller Account (owns Noon storefronts) |
| Custom | Any platform-specific account container |

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| company_id | UUID | FK → companies (denormalized) |
| brand_id | UUID | FK → brands |
| code | VARCHAR(20) | Auto: BA-000001 |
| name | VARCHAR(255) | e.g. "Honey & Co — Meta Business" |
| slug | VARCHAR(255) | URL-safe; unique per brand |
| platform_type | ENUM | meta, google, woocommerce, shopify, amazon, tiktok, noon, custom |
| platform_account_id | VARCHAR(255) | External account ID (nullable; set after connection) |
| connection_status | ENUM | unconnected, connected, disconnected, error |
| credentials | JSON | Encrypted OAuth tokens + API keys (nullable) |
| webhook_config | JSON | Registered webhook URLs + secrets (nullable) |
| sync_settings | JSON | Platform-specific sync configuration (nullable) |
| settings | JSON | General platform settings (nullable) |
| is_active | BOOLEAN | |
| created_at / updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

**Uniqueness:** `(brand_id, code)`, `(brand_id, slug)`

**Invariants:**
- `business_account.company_id` must always equal `business_account.brand.company_id`.
- A Business Account belongs to exactly one Brand.
- A Business Account can own zero or many Sales Channels.

---

### 2.4 Sales Channel *(Updated — V2.2)*

A Sales Channel is a specific operational selling endpoint managed under a Business Account. Each Sales Channel belongs to one Business Account (and by extension, one Brand, one Company).

**Examples:** Website, Facebook Shop, Instagram Shop, TikTok Shop, Amazon Egypt, Amazon KSA, POS, B2B Portal.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| company_id | UUID | FK → companies (denormalized for fast queries) |
| brand_id | UUID | FK → brands (denormalized for fast queries) |
| business_account_id | UUID | FK → business_accounts |
| default_warehouse_id | UUID | FK → warehouses (nullable) |
| name | VARCHAR(255) | e.g. "HealthyFood.com", "Facebook Shop EG" |
| code | VARCHAR(20) | Auto: CH-000001 |
| **channel_type** | ENUM | **website, marketplace, social_commerce, pos, b2b, custom** |
| platform | ENUM | woocommerce, shopify, amazon, tiktok, pos, whatsapp, facebook, instagram, google_shopping, noon, custom |
| store_url | VARCHAR(500) | Applicable for website-type channels |
| is_active | BOOLEAN | |
| sync_products / sync_prices / sync_stock / sync_customers | BOOLEAN | Per-channel sync flags |
| connection_status | ENUM | connected, disconnected, error |
| last_sync_at / last_successful_sync_at / last_error_at | TIMESTAMP | |
| last_error_message | TEXT | |
| created_at / updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

**`channel_type` values:**

| Value | Description | Examples |
|---|---|---|
| `website` | eCommerce website | WooCommerce, Shopify, custom storefront |
| `marketplace` | Third-party marketplace | Amazon, Noon, Jumia, eBay |
| `social_commerce` | Social media store | Facebook Shop, Instagram Shop, TikTok Shop |
| `pos` | Point of Sale terminal | In-store POS, kiosk |
| `b2b` | B2B / wholesale portal | Trade portal, distributor portal |
| `custom` | Non-standard channel | Any other selling endpoint |

**Denormalization contract:** `company_id` must always equal `business_account.brand.company_id`. `brand_id` must always equal `business_account.brand_id`. Both are enforced at the application layer.

---

### 2.5 Warehouse *(Updated — branch_id removed)*

A Warehouse is an operational inventory location that belongs directly to a Company. It is **not** under any Brand or Business Account. A single Warehouse serves all Brands and all Business Accounts of the Company (shared inventory is an architectural requirement).

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| company_id | UUID | FK → companies |
| code | VARCHAR(20) | Auto: WH-000001 |
| name | VARCHAR(255) | |
| address | TEXT | |
| city | VARCHAR(100) | |
| country | VARCHAR(100) | |
| is_active | BOOLEAN | |
| created_at / updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

**Uniqueness:** `(company_id, code)`

---

### 2.6 Team *(V2.2 — added)*

A Team is a named group of Users within a Company, used for role assignment and operational scoping.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| company_id | UUID | FK → companies |
| code | VARCHAR(20) | Auto: TM-000001 |
| name | VARCHAR(255) | |
| description | TEXT | |
| is_active | BOOLEAN | |
| created_at / updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

---

### 2.7 Branch *(DEPRECATED — do not use in new code)*

```php
/** @deprecated Use Brand for commercial identity; Warehouse for operational location. */
```

Branch is kept in the database during the transition period (until WP-ORG-008). No new FK relationships may reference `branches.id`.

---

## 3. Aggregate Relationships

```
Company          1 ──── N  Brands
Brand            1 ──── N  Business Accounts
Business Account 1 ──── N  Sales Channels
Company          1 ──── N  Warehouses
Company          1 ──── N  Teams
Sales Channel    N ──── 1  Warehouse        (default_warehouse_id, nullable)
```

**Full path:**
```
Company → Brand → Business Account → Sales Channel
Company → Warehouse
Company → Team
```

---

## 4. Entity Responsibilities

| Entity | Owns | Does NOT Own |
|---|---|---|
| Company | Brands, Warehouses, Teams, Users | Individual channels, credentials |
| Brand | Business Accounts, Brand Settings | Warehouses, individual credentials |
| Business Account | Sales Channels, Integrations, Credentials, Webhooks, Sync Settings, Advertising Assets, Catalogs | Warehouses, other brands' channels |
| Sales Channel | Sync config, channel_type, Product Mappings, Webhook endpoints | Other channels, warehouses |
| Warehouse | Inventory, Preparation waves, Delivery zones | Channels, brands |
| Team | Users membership | Products, channels, inventory |

---

## 5. Product Ownership Rule

**Products belong only to Company.** Never to Brand, Business Account, or Sales Channel.

Publishing is handled separately by Commerce OS via Product Publications:

```
Product (Company-owned)
        ↓
Product Publication (Commerce OS)
        ↓
Business Account
        ↓
Sales Channel
```

Product Publication owns: Channel SKU, Channel Price, Sale Price, Publication Status, Visibility, Sync Status, Last Sync, Channel Images, Channel Description, External Product ID.

Organization OS reserves the relationship (Sales Channel and Business Account exist as FK targets) but does not own, create, or manage Product Publications.

---

## 6. Module Alignment

| Module | Organizational Anchor | Rationale |
|---|---|---|
| Products | Company | Products are company assets |
| Product Publication | Business Account → Sales Channel | Publishing is BA/Channel-scoped |
| Inventory | Company → Warehouse | Inventory lives in warehouses |
| Procurement | Company → Warehouse | Purchasing feeds warehouses |
| Commerce Sync | Business Account | Sync credentials live on Business Account |
| Marketing | Brand → Business Account | Ad spend, campaigns are BA-scoped |
| CRM | Brand → Sales Channel | Customer relationships are channel-specific |
| Preparation OS | Warehouse | Operational function |
| Logistics | Warehouse | Delivery originates from warehouses |
| POS | Business Account → Sales Channel (channel_type=pos) | POS is a Sales Channel under a Business Account |
| Accounting | Company | Financials roll up to company level |

---

## 7. Code Auto-Generation Rules

| Entity | Pattern | Example |
|---|---|---|
| Company | COM-{6-digit seq} | COM-000001 |
| Brand | BRD-{6-digit seq per company} | BRD-000001 |
| Business Account | BA-{6-digit seq per brand} | BA-000001 |
| Sales Channel | CH-{6-digit seq per company} | CH-000001 |
| Warehouse | WH-{6-digit seq per company} | WH-000001 |
| Team | TM-{6-digit seq per company} | TM-000001 |

Sequences reset per company (or per brand for Business Account). Manual override allowed by providing a non-null `code` at creation.

---

## 8. Invariants

1. Every Brand must belong to an active Company.
2. Every Business Account must belong to an active Brand.
3. `business_account.company_id` must always equal `business_account.brand.company_id`.
4. Every Sales Channel must belong to an active Business Account.
5. `channel.company_id` must always equal `channel.business_account.brand.company_id`.
6. `channel.brand_id` must always equal `channel.business_account.brand_id`.
7. A Warehouse belongs to a Company; it does NOT belong to any Brand or Business Account.
8. Products belong to Company only — never directly to a Brand, Business Account, or Sales Channel.
9. No new code may introduce a FK to `branches.id`.
10. Branch records must not be deleted during transition — soft-delete only.

---

## 9. ERD

```
companies
    │ 1
    │ N
brands ───────────────────────────── company_id FK
    │ 1
    │ N
business_accounts ────────────────── brand_id FK, company_id FK (denorm)
    │ 1
    │ N
channels (sales_channels) ────────── business_account_id FK, brand_id FK (denorm), company_id FK (denorm)
    │ N
    │ 1
warehouses ───────────────────────── company_id FK (direct, NOT brand or BA)

teams ────────────────────────────── company_id FK (direct)

branches  ← DEPRECATED (no new FKs; removed in WP-ORG-008)

[Commerce OS]
product_publications ─────────────── product_id, business_account_id FK, channel_id FK
```
