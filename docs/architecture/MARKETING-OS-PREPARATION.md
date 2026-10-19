# Marketing OS — Engineering Preparation

**Document:** MARKETING-OS-PREPARATION  
**Version:** 1.0  
**Status:** RESERVED — Architecture Design  
**Date:** 2026-07-05  
**Task:** TASK-ORG-ADR-012  
**ADR:** ADR-012-marketing-assets-architecture.md  
**Domain Model:** docs/domain/Marketing-Domain.md  
**Implementation:** TASK-MARKETING-001 (future)

---

## 1. Purpose

This document prepares the engineering foundation for Marketing OS. It defines the database schema, domain contracts, API surface, and integration patterns that will be implemented when TASK-MARKETING-001 is approved.

> **Nothing in this document is implemented yet.** This document exists to ensure Marketing OS can be built without architectural rework when it is scheduled.

---

## 2. Domain Architecture

### 2.1 Position

```
Organization OS (foundation)
        │
        ├── Commerce OS (Sales Channels, Orders, Products)
        │
        ├── Marketing OS (this document)
        │       ├── Marketing Account
        │       ├── Marketing Asset
        │       └── (Future) Campaign → Attribution → Orders
        │
        └── CRM OS (Customer, Lead, Opportunity)
```

### 2.2 Separation of Concerns

| Layer | Owner | Responsibility |
|---|---|---|
| Sales Execution | Commerce OS | Orders, Products, Pricing, Inventory |
| Marketing Infrastructure | Marketing OS | Platform accounts, assets, campaigns |
| Attribution | Marketing OS + Commerce OS | UTM → Order linkage |
| Customer Intelligence | CRM OS | Lifecycle, acquisition, retention |

---

## 3. Reserved Database Schema

> Tables are not created yet. This is the target schema for TASK-MARKETING-001.

### 3.1 `marketing_accounts`

```sql
CREATE TABLE marketing_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id),
    brand_id        UUID NOT NULL REFERENCES brands(id),
    provider        VARCHAR(50) NOT NULL,          -- meta|google|tiktok|snapchat|linkedin|twitter
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(20) NOT NULL,           -- MKT-000001
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    external_id     VARCHAR(255),
    credentials     TEXT,                          -- encrypted JSON
    oauth_tokens    TEXT,                          -- encrypted JSON
    sync_settings   JSONB,
    webhook_settings JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX marketing_accounts_code_per_brand
    ON marketing_accounts (brand_id, code)
    WHERE deleted_at IS NULL;

CREATE INDEX marketing_accounts_company_id ON marketing_accounts (company_id);
CREATE INDEX marketing_accounts_brand_id ON marketing_accounts (brand_id);
CREATE INDEX marketing_accounts_provider ON marketing_accounts (provider);
```

### 3.2 `marketing_assets`

```sql
CREATE TABLE marketing_assets (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketing_account_id  UUID NOT NULL REFERENCES marketing_accounts(id),
    company_id            UUID NOT NULL REFERENCES companies(id),
    brand_id              UUID NOT NULL REFERENCES brands(id),
    asset_type            VARCHAR(50) NOT NULL,
    name                  VARCHAR(255) NOT NULL,
    external_id           VARCHAR(255),
    status                VARCHAR(20) NOT NULL DEFAULT 'active',
    metadata              JSONB,
    is_active             BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX marketing_assets_account_id ON marketing_assets (marketing_account_id);
CREATE INDEX marketing_assets_company_id ON marketing_assets (company_id);
CREATE INDEX marketing_assets_brand_id ON marketing_assets (brand_id);
CREATE INDEX marketing_assets_asset_type ON marketing_assets (asset_type);
```

### 3.3 Order Attribution (Commerce OS schema extension)

When Marketing OS is implemented, the following columns are added to the `orders` table:

```sql
ALTER TABLE orders ADD COLUMN utm_source    VARCHAR(255);
ALTER TABLE orders ADD COLUMN utm_medium    VARCHAR(255);
ALTER TABLE orders ADD COLUMN utm_campaign  VARCHAR(255);
ALTER TABLE orders ADD COLUMN utm_content   VARCHAR(255);
ALTER TABLE orders ADD COLUMN utm_term      VARCHAR(255);
```

These are populated from URL parameters at Order creation. Attribution reporting joins Orders to Campaigns via UTM fields — no FK required (UTM is a soft link by design).

---

## 4. Module Structure (Reserved)

Following DDD module conventions:

```
backend/Modules/Marketing/
├── MarketingAccounts/
│   ├── Domain/
│   │   ├── Models/
│   │   │   └── MarketingAccount.php
│   │   ├── Contracts/
│   │   │   └── MarketingAccountRepositoryInterface.php
│   │   └── Exceptions/
│   │       └── MarketingAccountNotFoundException.php
│   ├── Application/
│   │   ├── DTO/
│   │   │   └── MarketingAccountDTO.php
│   │   └── Actions/
│   │       ├── CreateMarketingAccountAction.php
│   │       ├── UpdateMarketingAccountAction.php
│   │       └── DeleteMarketingAccountAction.php
│   ├── Infrastructure/
│   │   └── Repositories/
│   │       └── EloquentMarketingAccountRepository.php
│   └── Presentation/
│       └── Http/
│           ├── Controllers/
│           │   └── MarketingAccountController.php
│           ├── Requests/
│           │   ├── StoreMarketingAccountRequest.php
│           │   └── UpdateMarketingAccountRequest.php
│           └── Resources/
│               └── MarketingAccountResource.php
│
└── MarketingAssets/
    └── (same structure)
```

---

## 5. API Contracts (Reserved)

### 5.1 Marketing Accounts

```
GET    /marketing-accounts              List (filter: brand_id, provider, status)
POST   /marketing-accounts              Create
GET    /marketing-accounts/{id}         Show
PUT    /marketing-accounts/{id}         Update
DELETE /marketing-accounts/{id}         Soft-delete
```

### 5.2 Marketing Assets

```
GET    /marketing-accounts/{id}/assets  List assets for account
POST   /marketing-accounts/{id}/assets  Add asset
GET    /marketing-assets/{id}           Show asset
PUT    /marketing-assets/{id}           Update asset
DELETE /marketing-assets/{id}           Remove asset
POST   /marketing-assets/{id}/sync      Trigger asset sync from platform
```

---

## 6. Integration Patterns

### 6.1 OAuth Flow (Reserved)

```
User → ECOS UI
    → Redirect to Platform OAuth URL
    → Platform → callback URL with auth_code
    → ECOS → exchange code for tokens
    → Store tokens in marketing_accounts.oauth_tokens (encrypted)
    → Fire MarketingAccountConnected event
```

Token refresh is handled by a scheduled job:
```
MarketingTokenRefreshJob (scheduled: every 6 hours)
    → Find accounts with token expiry < 24 hours
    → Refresh via platform refresh_token
    → Update marketing_accounts.oauth_tokens
    → Fire MarketingAccountTokenRefreshed event
```

### 6.2 Asset Discovery (Reserved)

After OAuth, assets are discovered by querying the platform API:

```
MarketingAssetDiscoveryJob
    → Receive marketing_account_id
    → Query platform for available assets (pages, ad accounts, pixels, catalogs)
    → For each asset: create or update marketing_assets row
    → Fire MarketingAssetCreated / MarketingAssetSynced events
```

---

## 7. Sales Attribution (Reserved)

### 7.1 Attribution Architecture

```
Ad (Marketing Asset: Ad Account)
        │
        ↓ click (UTM parameters appended to landing URL)
Sales Channel URL
        │
        ↓ Order created
Order.utm_campaign = "summer_promo_2026"
Order.utm_source   = "facebook"
Order.utm_medium   = "paid_social"
        │
        ↓ Attribution reporting query
Campaign Revenue   = SUM(orders.subtotal) WHERE utm_campaign = ?
Ad Spend           = (from marketing API)
ROAS               = Campaign Revenue / Ad Spend
```

### 7.2 Attribution Window

Standard attribution windows to be configured per Marketing Account:
- Click-through: 7 days (default)
- View-through: 1 day (default)

Window configuration stored in `marketing_accounts.sync_settings`.

### 7.3 KPI Definitions

| KPI | Calculation | Source |
|---|---|---|
| ROAS | Order Revenue ÷ Ad Spend | Orders + Marketing API |
| CPA | Ad Spend ÷ Order Count | Orders + Marketing API |
| CAC | Ad Spend ÷ New Customer Count | Orders + CRM + Marketing API |
| Revenue by Campaign | SUM(orders.subtotal) GROUP BY utm_campaign | Orders |
| Profitability | Revenue − Ad Spend − SUM(order_lines.cost_price) | Orders + Marketing API |

---

## 8. AI Platform Integration (Reserved)

The AI Platform will consume Marketing data for:

| AI Capability | Data Required |
|---|---|
| Channel ROAS ranking | Campaign spend + attributed revenue |
| Budget reallocation | ROAS by campaign, by asset type |
| CAC prediction | Historical CAC by channel, audience, creative |
| Creative performance | Order count + revenue by utm_content |
| Audience profitability | Customer LTV segment × acquisition channel |

AI recommendations will be surfaced via the existing `AIRecommendation` entity in Platform OS.

---

## 9. Frontend Preparation (Reserved)

When implemented, Marketing OS requires the following new pages in the Organization OS section:

```
/organization/marketing                  Marketing accounts list
/organization/marketing/:id              Marketing account detail (drawer)
/organization/marketing/:id/assets       Asset management within account
```

And in a future Marketing Hub:
```
/marketing/hub                           Marketing command center
/marketing/campaigns                     Campaign list
/marketing/attribution                   Attribution dashboard
/marketing/analytics                     Performance analytics
```

---

## 10. Migration from Business Account

The existing `business_accounts` table is **not renamed** in Phase 1. The migration plan is:

| Phase | Scope | Trigger |
|---|---|---|
| Phase 1 (current) | Architecture update only. Term "Integration Account" used in docs. `BA-` code prefix in DB. | ADR-012 approval |
| Phase 2 (future) | Create `marketing_accounts` + `marketing_assets` tables. Remove `business_account_id` FK from `channels`. Channels become direct Brand children in DB. | TASK-MARKETING-001 |
| Phase 3 (future) | Rename `business_accounts` to `integration_accounts`. Update code prefix `BA-` → `IA-`. | TASK-ORG-INT-001 |

No Phase 2 or Phase 3 migrations are written until the corresponding tasks are approved.

---

## 11. Work Package

**Future task:** `TASK-MARKETING-001 — Marketing OS Phase 1`

Scope when approved:
- [ ] `marketing_accounts` migration + model + repository + controller + resource
- [ ] `marketing_assets` migration + model + repository + controller + resource
- [ ] Marketing Accounts page + detail drawer in Organization section
- [ ] OAuth connection flow (Meta first, then Google, then TikTok)
- [ ] Asset discovery job
- [ ] Token refresh job
- [ ] Order UTM fields migration
- [ ] Attribution reporting API endpoint
- [ ] ROAS/CPA/CAC dashboard

Does NOT include: campaign management, ad creation, creative management.
