# Organization OS V2.2 — Migration Plan

**Document:** MIGRATION-PLAN  
**Version:** 2.2  
**Status:** APPROVED FOR IMPLEMENTATION — ADR-011 V2.2  
**Date:** 2026-07-05  
**Supersedes:** V2.1 (adds channel_type to P1; Teams table in P2.5; aligns phase names with V2.2 WP sequence)

---

## 1. Guiding Principles

1. **No data destruction.** Branch records are preserved and soft-deleted at the end of migration, not dropped.
2. **Zero downtime schema changes.** All column additions before column removals; FK drops before FK additions.
3. **Application-level dual-read.** During the transition window, old columns may coexist with new; application code reads new and falls back to old.
4. **Explicit mapping.** Every Branch and every existing Channel is evaluated individually. No silent auto-coerce.
5. **Backfill first, constrain later.** Every new NOT NULL column is added nullable → backfilled → constrained.

---

## 2. Phase Overview

| Phase | Scope | Duration | Dependency |
|---|---|---|---|
| P0 — Brand entity | New table + module scaffold | 2 days | None |
| P0.5 — Business Account entity | New table + module scaffold | 2 days | P0 |
| P1 — Sales Channels Refactor | Add business_account_id + channel_type; backfill; NOT NULL | 2 days | P0, P0.5 |
| P2 — Warehouse decouple | Remove branch_id from warehouses; add code | 1 day | P0 |
| P2.5 — Teams entity | New table | 1 day | P0 |
| P3 — Migrate consumers (POS, IAM, MFG) | Remove branch_id from 3 other modules | 3 days | P2 |
| P4 — Commerce integration stubs | ProductPublicationServiceInterface | 1 day | P1 |
| P5 — Deprecate Branch | Soft-delete + annotations + navigation | 0.5 days | P3, P4 |
| **Total** | | **~12.5 days** | |

---

## 3. Phase 0 — Create Brand Entity

*(Unchanged from V2.1)*

### 3.1 Migration

```sql
CREATE TABLE brands (
    id          UUID PRIMARY KEY,
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    code        VARCHAR(20) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) NOT NULL,
    logo        VARCHAR(500),
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (company_id, code),
    UNIQUE (company_id, slug)
);
```

### 3.2 Module Scaffold

`Modules\Organization\Brands\` — standard DDD structure (see REFACTOR-PLAN.md §WP-ORG-001).

### 3.3 Seed — One Brand per Company

```php
Brand::create([
    'company_id' => $company->id,
    'code'       => BrandCodeGenerator::next($company->id),
    'name'       => $company->name,
    'slug'       => Str::slug($company->name),
    'is_active'  => true,
]);
```

---

## 4. Phase 0.5 — Create Business Account Entity

*(Updated — V2.2: adds `webhook_config` + `sync_settings` columns)*

### 4.1 Migration

```sql
CREATE TABLE business_accounts (
    id                   UUID PRIMARY KEY,
    company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    brand_id             UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
    code                 VARCHAR(20) NOT NULL,
    name                 VARCHAR(255) NOT NULL,
    slug                 VARCHAR(255) NOT NULL,
    platform_type        VARCHAR(50) NOT NULL,
    platform_account_id  VARCHAR(255),
    connection_status    VARCHAR(20) NOT NULL DEFAULT 'unconnected',
    credentials          JSONB,          -- Encrypted OAuth tokens + API keys
    webhook_config       JSONB,          -- Registered webhook URLs + secrets
    sync_settings        JSONB,          -- Platform-specific sync config
    settings             JSONB,          -- General platform settings
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ,
    UNIQUE (brand_id, code),
    UNIQUE (brand_id, slug)
);

CREATE INDEX idx_business_accounts_brand_id     ON business_accounts(brand_id);
CREATE INDEX idx_business_accounts_company_id   ON business_accounts(company_id);
CREATE INDEX idx_business_accounts_platform     ON business_accounts(platform_type);
```

### 4.2 Module Scaffold

`Modules\Organization\BusinessAccounts\` — standard DDD structure (see REFACTOR-PLAN.md §WP-ORG-001B).

### 4.3 Seed — One Business Account per Brand

```php
$dominantPlatform = DB::table('channels')
    ->where('company_id', $brand->company_id)
    ->select('platform', DB::raw('COUNT(*) as cnt'))
    ->groupBy('platform')
    ->orderByDesc('cnt')
    ->value('platform') ?? 'custom';

BusinessAccount::create([
    'company_id'   => $brand->company_id,
    'brand_id'     => $brand->id,
    'code'         => BusinessAccountCodeGenerator::next($brand->id),
    'name'         => $brand->name . ' — ' . ucfirst($dominantPlatform),
    'slug'         => Str::slug($brand->name . '-' . $dominantPlatform),
    'platform_type'=> $dominantPlatform,
    'is_active'    => true,
]);
```

---

## 5. Phase 1 — Sales Channels Refactor *(Updated — V2.2)*

**V2.2 adds `channel_type` to this migration. Previously this only added `business_account_id`.**

### 5.1 Migration Steps

**Step 1:** Add nullable columns:
```sql
ALTER TABLE channels
    ADD COLUMN business_account_id UUID REFERENCES business_accounts(id) ON DELETE RESTRICT,
    ADD COLUMN brand_id            UUID REFERENCES brands(id) ON DELETE RESTRICT,
    ADD COLUMN code                VARCHAR(20),
    ADD COLUMN channel_type        VARCHAR(50);
```

**Step 2:** Backfill — assign all existing Channels to the default Business Account, and derive `channel_type` from existing `platform`:
```sql
UPDATE channels c
SET
    business_account_id = (
        SELECT ba.id FROM business_accounts ba
        WHERE ba.company_id = c.company_id AND ba.is_active = TRUE
        ORDER BY ba.created_at ASC LIMIT 1
    ),
    brand_id = (
        SELECT ba.brand_id FROM business_accounts ba
        WHERE ba.company_id = c.company_id AND ba.is_active = TRUE
        ORDER BY ba.created_at ASC LIMIT 1
    ),
    code = 'CH-' || LPAD(
        ROW_NUMBER() OVER (PARTITION BY c.company_id ORDER BY c.created_at)::TEXT,
        6, '0'
    ),
    channel_type = CASE c.platform
        WHEN 'woocommerce' THEN 'website'
        WHEN 'shopify'     THEN 'website'
        WHEN 'amazon'      THEN 'marketplace'
        WHEN 'noon'        THEN 'marketplace'
        WHEN 'jumia'       THEN 'marketplace'
        WHEN 'facebook'    THEN 'social_commerce'
        WHEN 'instagram'   THEN 'social_commerce'
        WHEN 'tiktok'      THEN 'social_commerce'
        WHEN 'pos'         THEN 'pos'
        ELSE 'website'
    END
WHERE c.business_account_id IS NULL;
```

**Step 3:** Pre-constraint verification:
```sql
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM channels
        WHERE business_account_id IS NULL OR channel_type IS NULL
    ) THEN
        RAISE EXCEPTION 'Backfill incomplete — abort P1';
    END IF;
END $$;
```

**Step 4:** Apply NOT NULL constraints:
```sql
ALTER TABLE channels
    ALTER COLUMN business_account_id SET NOT NULL,
    ALTER COLUMN brand_id            SET NOT NULL,
    ALTER COLUMN channel_type        SET NOT NULL;

CREATE INDEX idx_channels_business_account ON channels(business_account_id);
CREATE INDEX idx_channels_brand_id         ON channels(brand_id);
CREATE INDEX idx_channels_channel_type     ON channels(channel_type);
```

### 5.2 Application Changes

- `Channel::$fillable` — add `business_account_id`, `brand_id`, `code`, `channel_type`
- `Channel::businessAccount()` — add `belongsTo(BusinessAccount::class)` relation
- `Channel::brand()` — add `belongsTo(Brand::class)` (denormalized)
- `ChannelType` enum — create with 6 values: `website`, `marketplace`, `social_commerce`, `pos`, `b2b`, `custom`
- `ChannelController` — require `business_account_id` + `channel_type` in `StoreChannelRequest`
- `ChannelResource` — expose `business_account_id`, `business_account_name`, `brand_id`, `brand_name`, `channel_type`

### 5.3 Rollback

Drop `business_account_id`, `brand_id`, `code`, `channel_type` columns; no data lost.

---

## 6. Phase 2 — Decouple Warehouse from Branch

*(Unchanged from V2.1)*

```sql
-- Step 1: Add code column
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS code VARCHAR(20);

-- Step 2: Backfill codes
UPDATE warehouses w
SET code = 'WH-' || LPAD(
    ROW_NUMBER() OVER (PARTITION BY w.company_id ORDER BY w.created_at)::TEXT, 6, '0'
)
WHERE w.code IS NULL;

-- Step 3: Drop FK and column
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_branch_id_foreign;
ALTER TABLE warehouses DROP COLUMN IF EXISTS branch_id;
```

---

## 7. Phase 2.5 — Teams Entity *(NEW — V2.2)*

```sql
CREATE TABLE teams (
    id          UUID PRIMARY KEY,
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    code        VARCHAR(20) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (company_id, code)
);

CREATE TABLE team_members (
    id         UUID PRIMARY KEY,
    team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL,
    role       VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, user_id)
);

CREATE INDEX idx_teams_company_id ON teams(company_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
```

---

## 8. Phase 3 — Migrate branch_id Consumers

*(Unchanged from V2.1)*

### 8.1 POS Terminal

```sql
ALTER TABLE pos_terminals ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);

UPDATE pos_terminals t
SET warehouse_id = (
    SELECT w.id FROM warehouses w
    WHERE w.company_id = t.company_id AND w.is_active = TRUE
    ORDER BY w.created_at ASC LIMIT 1
)
WHERE t.warehouse_id IS NULL;

ALTER TABLE pos_terminals DROP CONSTRAINT IF EXISTS pos_terminals_branch_id_foreign;
ALTER TABLE pos_terminals DROP COLUMN branch_id;
```

### 8.2 IAM UserRoles

```sql
ALTER TABLE user_roles
    ADD COLUMN scope_type VARCHAR(50),
    ADD COLUMN scope_id   UUID;

UPDATE user_roles
SET scope_type = 'company', scope_id = company_id
WHERE branch_id IS NOT NULL;

ALTER TABLE user_roles DROP COLUMN branch_id;
```

### 8.3 Manufacturing Context Builder

Update `ManufacturingContextBuilder` to read `warehouse_id` from context instead of `branch_id`.

---

## 9. Phase 4 — Commerce Integration Stubs

```php
// Organization\Contracts\ProductPublicationServiceInterface.php
interface ProductPublicationServiceInterface
{
    public function getSummaryForChannel(string $channelId): ?array;
}

// Default null implementation (until Commerce OS is built)
class NullProductPublicationService implements ProductPublicationServiceInterface
{
    public function getSummaryForChannel(string $channelId): ?array
    {
        return null;
    }
}
```

Register `ProductPublicationServiceInterface` → `NullProductPublicationService` in the Organization service provider. Commerce OS will rebind this with a real implementation.

---

## 10. Phase 5 — Branch Soft-Delete

```sql
-- Pre-flight verification
SELECT COUNT(*) FROM warehouses     WHERE branch_id IS NOT NULL;  -- must be 0
SELECT COUNT(*) FROM pos_terminals  WHERE branch_id IS NOT NULL;  -- must be 0
SELECT COUNT(*) FROM user_roles     WHERE branch_id IS NOT NULL;  -- must be 0

-- Soft-delete
UPDATE branches SET deleted_at = NOW() WHERE deleted_at IS NULL;
```

DO NOT run `DROP TABLE branches`. Kept for historical audit.

---

## 11. Branch → Brand Mapping Rules

| Branch Type | Mapping |
|---|---|
| Single branch company | One Brand + one default Business Account using the company name |
| Multi-branch, same brand | All branches → one Brand → one Business Account per platform |
| Multi-branch, different brands | Each branch → its own Brand + default Business Account |
| Head office branch | Maps to primary Brand; is_active = true |
| Inactive branch | Map to Brand with is_active = false |

---

## 12. Timeline Estimate

| Phase | Effort | Dependency |
|---|---|---|
| P0 — Brand entity | 2 days | None |
| P0.5 — Business Account entity | 2 days | P0 |
| P1 — Sales Channels Refactor | 2 days | P0.5 |
| P2 — Warehouse decouple | 1 day | P0 |
| P2.5 — Teams entity | 1 day | P0 |
| P3 — POS, IAM, MFG | 3 days | P2 |
| P4 — Commerce stubs | 1 day | P1 |
| P5 — Branch soft-delete | 0.5 days | P3, P4 |
| **Total** | **~12.5 days** | |
