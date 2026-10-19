# Organization OS V2.2 — Refactor Plan

**Document:** REFACTOR-PLAN  
**Version:** 2.2  
**Status:** APPROVED FOR IMPLEMENTATION — ADR-011 V2.2  
**Date:** 2026-07-05  
**Supersedes:** V2.1 (WP-ORG-005 through 008 restructured; Commerce + Marketing integration added)

---

## 1. Scope Statement

This plan covers the concrete engineering steps to implement ADR-011 V2.2. Each work package is independently reviewable and mergeable.

**Covers:**
- Module scaffolding (Brand, Business Account)
- Database migrations
- Model updates
- Controller / Request / Resource updates
- Event updates
- Frontend page updates
- Navigation update
- Test updates
- Legacy Branch removal

**Does NOT cover:**
- Full Commerce/CRM/Marketing module rewrites (they get BA/channel references but no deeper changes now)
- Accounting module integration (future)
- AI Platform alignment (future)

---

## 2. Work Packages

### WP-ORG-001: Create Brand Module

*(Unchanged from V2.1)*

**Backend:**
1. Create migration: `create_brands_table` (see MIGRATION-PLAN.md §P0)
2. Create `Brand.php` model with `HasUuids`, `SoftDeletes`, `HasFactory`
3. Create `BrandDTO`, `BrandRepositoryInterface`, `EloquentBrandRepository`
4. Create Actions: `CreateBrandAction`, `UpdateBrandAction`, `DeleteBrandAction`, `ListBrandsAction`, `GetBrandAction`
5. Create `BrandController` with standard CRUD
6. Create `StoreBrandRequest`, `UpdateBrandRequest`, `BrandResource`
7. Create `BrandSeeder` — seed one Brand per Company
8. Register routes: `GET/POST/PUT/DELETE /api/v1/brands`
9. Publish `organization.brand.created` and `organization.brand.updated` events

**Frontend:**
1. Create `brands-page.tsx` — list + inline create/edit drawer
2. Create `brand-form-drawer.tsx` — name, slug (auto-derived), logo, description
3. Add to Organization navigation

**Tests:**
1. `CreateBrandActionTest` — name uniqueness, code auto-gen, slug auto-gen
2. `BrandControllerTest` — CRUD + 422 validation

**Acceptance:** `php artisan test --filter Brand` passes; `npx tsc --noEmit` passes.

---

### WP-ORG-001B: Create Business Account Module

**Must run after WP-ORG-001. Must complete before WP-ORG-002.**

**Backend:**
1. Create migration: `create_business_accounts_table` (see MIGRATION-PLAN.md §P0.5)
   - Includes: `credentials` JSONB, `webhook_config` JSONB, `sync_settings` JSONB, `settings` JSONB
2. Create `BusinessAccount.php` model with `HasUuids`, `SoftDeletes`, `HasFactory`
3. Create `PlatformType` enum: `meta`, `google`, `woocommerce`, `shopify`, `amazon`, `tiktok`, `noon`, `custom`
4. Create `ConnectionStatus` enum: `unconnected`, `connected`, `disconnected`, `error`
5. Create `BusinessAccountDTO`, `BusinessAccountRepositoryInterface`, `EloquentBusinessAccountRepository`
6. Create Actions: `CreateBusinessAccountAction`, `UpdateBusinessAccountAction`, `DeleteBusinessAccountAction`, `ListBusinessAccountsAction`, `GetBusinessAccountAction`, `ConnectBusinessAccountAction`, `DisconnectBusinessAccountAction`
7. Create `BusinessAccountController` with standard CRUD + connect/disconnect endpoints
8. `StoreBusinessAccountRequest`: requires `brand_id`, `name`, `platform_type`; validates brand belongs to actor's company; auto-resolves `company_id` from `brand.company_id`
9. Create `BusinessAccountSeeder` — seed one BA per Brand
10. Register routes:
    - `GET/POST /api/v1/business-accounts`
    - `GET/PUT/DELETE /api/v1/business-accounts/{id}`
    - `POST /api/v1/business-accounts/{id}/connect`
    - `POST /api/v1/business-accounts/{id}/disconnect`
    - `GET /api/v1/business-accounts/{id}/channels`
    - `GET /api/v1/brands/{id}/business-accounts`
11. Publish: `organization.business_account.created`, `organization.business_account.connected`, `organization.business_account.disconnected`

**Frontend:**
1. Create `business-accounts-page.tsx` — list: Code, Name, Platform, Brand, Connection Status, Channel Count
2. Create `business-account-drawer.tsx` — 4 tabs: Overview, Channels, Credentials, Settings
3. Create `business-account-form.tsx` — brand selector, name, platform type, platform_account_id
4. Update `brand-form-drawer.tsx` — add Business Accounts tab
5. Add to Organization navigation

**Tests:**
1. `CreateBusinessAccountActionTest` — code auto-gen (BA-000001), company_id denorm, brand ownership
2. `BusinessAccountControllerTest` — CRUD + company isolation + 422 validation

**Acceptance:** `php artisan test --filter BusinessAccount` passes; `npx tsc --noEmit` passes.

---

### WP-ORG-002: Sales Channels Refactor *(Updated — V2.2)*

**Renames Channel → Sales Channel structurally; adds `channel_type`; links Channel → Business Account (replaces Channel → Brand).**

**Must run after WP-ORG-001B.**

**Backend:**
1. Migration:
   - Add `business_account_id` nullable → backfill → NOT NULL
   - Add `brand_id` (denorm) nullable → backfill → NOT NULL
   - Add `code` (backfill: CH-000001)
   - Add `channel_type` VARCHAR(50) nullable → backfill (detect from `platform` column; default `website`) → NOT NULL
2. Update `Channel.php` model:
   - Add `business_account_id`, `brand_id`, `channel_type` to `$fillable`
   - Add `businessAccount(): BelongsTo` relation
   - Add `brand(): BelongsTo` relation (denorm, read-only)
   - Add `ChannelType` enum
3. Update `ChannelResource`: add `business_account_id`, `business_account_name`, `brand_id`, `brand_name`, `channel_type`
4. Update `StoreChannelRequest`:
   - Add `business_account_id` required; validate BA belongs to actor's company
   - Add `channel_type` required; validate against enum
   - Remove direct `brand_id` input (resolved from BA)
5. Update `ChannelController::store()`: resolve `brand_id` + `company_id` from BA; store as denorm
6. Update `ChannelController::index()`: add `?business_account_id=`, `?brand_id=`, `?channel_type=` filter options

**Frontend:**
1. Channel creation form: cascade — Company → Brand → Business Account → channel_type + details
2. Channel list: add Business Account column, channel_type badge, BA filter chip
3. Add `channel_type` display badge in all channel references (color-coded by type)

**Tests:**
1. Update channel factory: add `business_account_id`, `brand_id`, `channel_type`
2. `ChannelBusinessAccountTest` — BA FK, brand_id denorm, company isolation, channel_type validation
3. `ChannelTypeEnumTest` — all 6 values validate correctly; invalid value returns 422

**Acceptance:** All existing channel tests pass; `npx tsc --noEmit` passes.

---

### WP-ORG-003: Warehouses Refactor

*(Unchanged from V2.1)*

**Backend:**
1. Migration: drop FK `warehouses_branch_id_foreign`; drop column `branch_id`; add `code` (with backfill WH-000001)
2. Update `Warehouse.php` model: remove `branch_id` from `$fillable`; remove `branch()` relation; add `code`
3. Update `WarehouseResource`: remove `branch_id`; add `code`
4. Update `WarehouseDTO`: remove `branchId`; add `code`
5. Update `StoreWarehouseRequest` / `UpdateWarehouseRequest`: remove `branch_id` validation
6. Update `EloquentWarehouseRepository`: remove `branch_id` filter
7. Update `WarehouseFactory` and `WarehouseSeeder`: remove `branch_id`

**Frontend:**
1. Warehouse form: remove Branch selector
2. Warehouse list: remove Branch column; add Code column

**Tests:** Update warehouse tests and factories.

**Acceptance:** All warehouse tests pass; no `branch_id` reference in Warehouse module.

---

### WP-ORG-004: Companies Workspace *(NEW — V2.2)*

Build the Organization module frontend workspace for Company management. Currently Companies have no dedicated workspace.

**Frontend:**
1. Create `companies-page.tsx` — company detail view (single-company mode for now; multi-company admin mode in future)
2. Create `company-form-drawer.tsx` — all company fields: legal name, tax number, commercial registration, currency, timezone, logo, address
3. Create `company-settings-page.tsx` — Organization Settings: default currency, timezone, language, notifications
4. Organization navigation entry: "Company" → shows current company detail
5. Breadcrumb: Company → Brand → Business Account → Sales Channel (clickable hierarchy)

**Backend:**
1. `GET /api/v1/company` — returns current user's company (already exists; verify completeness)
2. `PUT /api/v1/company` — update company settings (verify `UpdateCompanyRequest` covers all fields)
3. `GET /api/v1/company/settings` — organization settings
4. `PUT /api/v1/company/settings` — update organization settings

**Acceptance:** `npx tsc --noEmit` passes; Company workspace renders; all fields editable.

---

### WP-ORG-005: Teams + Users + Permissions

Consolidates Teams module (new), IAM branch_id migration, and POS terminal migration.

**Teams Backend:**
1. Create migration: `create_teams_table` (code TM-000001, company_id, name, description)
2. Create `Team.php` model; `TeamController`; CRUD routes `/api/v1/teams`
3. Create `team_members` pivot table (team_id, user_id, role)
4. Create `TeamSeeder` — seed default team per company

**IAM UserRoles Migration:**
1. Migration: add `scope_type` (nullable VARCHAR 50) + `scope_id` (nullable UUID) to `user_roles`
2. Backfill: `scope_type = 'company'`, `scope_id = company_id` for all existing branch-scoped roles
3. Drop `branch_id` from `user_roles`
4. Update `UserRole.php`, `PermissionServiceInterface`

**POS Terminal Migration:**
1. Migration: add `warehouse_id` nullable → backfill → NOT NULL; drop `branch_id`
2. Update `Terminal.php`, `TerminalRegistered` event payload
3. Update `TerminalAggregateTest`, `TerminalDomainEventsTest`

**Manufacturing Context Builder:**
1. Update `ManufacturingContextBuilder.php`: replace `branch_id` reads with `warehouse_id`

**Frontend:**
1. Create `teams-page.tsx` — list + manage team members
2. Update User management: team assignment UI
3. Update Role assignment: use `scope_type/scope_id` selectors (replaces branch selector)

**Tests:**
1. `TeamControllerTest` — CRUD + company isolation
2. Updated `TerminalAggregateTest`, `TerminalDomainEventsTest`, `PermissionServiceTest`

**Acceptance:** All POS + IAM + Manufacturing tests pass; `npx tsc --noEmit` passes.

---

### WP-ORG-006: Commerce Integration *(NEW — V2.2)*

Prepare Organization OS to support Product Publication relationships from Commerce OS. Organization does not implement Product Publications but must reserve the FK anchors.

**Backend:**
1. Verify `channels` table is ready to be a FK target for Commerce OS's `product_publications` table
2. Verify `business_accounts` table is ready to be a FK target for `product_publications`
3. Create `GET /api/v1/channels/{id}/publication-summary` — returns channel's product publication stats (count, last sync, sync health); delegates to Commerce OS via service interface
4. Update `ChannelResource` to include a `publication_summary` nested object (populated from Commerce OS)
5. Add `ProductPublicationServiceInterface` stub in Organization OS — defines the contract Commerce OS must implement; returns empty/null until Commerce OS is built

**Frontend:**
1. Add "Publications" tab to Sales Channel drawer — shows publication count, last sync, sync health; uses `ProductPublicationServiceInterface` response
2. Tab shows "Commerce OS not yet connected" gracefully when interface returns null

**Acceptance:** Sales Channel drawer has Publications tab; Commerce OS interface stub registered.

---

### WP-ORG-007: Marketing Integration *(NEW — V2.2)*

Prepare Organization OS for Marketing module integration via Advertising Assets on Business Account.

**Backend:**
1. Add `advertising_assets` JSONB column to `business_accounts` (if not already in initial migration)
2. Create `GET /api/v1/business-accounts/{id}/advertising-assets` — returns advertising asset summary (ad accounts, campaigns count, spend) via `AdvertisingAssetServiceInterface` stub
3. Create `AdvertisingAssetServiceInterface` stub — defines contract Marketing OS must implement

**Frontend:**
1. Add "Advertising" tab to Business Account drawer — shows ad accounts, active campaigns count, last 30-day spend (from Marketing OS stub)
2. Tab shows "Marketing OS not yet connected" when stub returns null

**Acceptance:** BA drawer has Advertising tab; Marketing OS interface stub registered.

---

### WP-ORG-008: Legacy Branch Removal *(Final)*

**Runs only after all other WPs complete. Verify zero active branch_id FKs before executing.**

**Backend:**
1. Pre-flight verification queries:
   ```sql
   SELECT COUNT(*) FROM warehouses     WHERE branch_id IS NOT NULL;  -- must be 0 (WP-003)
   SELECT COUNT(*) FROM pos_terminals  WHERE branch_id IS NOT NULL;  -- must be 0 (WP-005)
   SELECT COUNT(*) FROM user_roles     WHERE branch_id IS NOT NULL;  -- must be 0 (WP-005)
   SELECT COUNT(*) FROM channels       WHERE brand_id IS NULL;       -- must be 0 (WP-002)
   ```
2. Soft-delete all Branch records: `UPDATE branches SET deleted_at = NOW() WHERE deleted_at IS NULL`
3. Add `@deprecated` docblock to all Branch classes
4. Mark `/api/v1/branches` routes with `X-Deprecated: true` response header
5. DO NOT drop `branches` table — kept for historical audit

**Frontend:**
1. Remove Branches from Organization navigation
2. Add deprecation banner to branches-page.tsx
3. Remove all branch selectors from all forms

**Tests:** Full test suite run — all passing; zero `branch_id` references in any non-deprecated code

**Acceptance:** `php artisan test` — all tests pass; `grep -r "branch_id" app/ Modules/ --include="*.php"` returns only deprecated Branch classes.

---

## 3. Work Package Sequencing

```
WP-ORG-001 (Brand Module)
    ↓
WP-ORG-001B (Business Account Module)
    ↓
WP-ORG-002 (Sales Channels Refactor)    ←── parallel with WP-ORG-003
WP-ORG-003 (Warehouses Refactor)
    ↓
WP-ORG-004 (Companies Workspace)        ←── parallel with WP-ORG-005
WP-ORG-005 (Teams + Users + Permissions)
    ↓
WP-ORG-006 (Commerce Integration)       ←── parallel with WP-ORG-007
WP-ORG-007 (Marketing Integration)
    ↓
WP-ORG-008 (Legacy Branch Removal)
```

WP-002 and WP-003 can run in parallel after WP-001B. WP-004 and WP-005 can run in parallel after WP-002/003. WP-006 and WP-007 can run in parallel after WP-004/005.

---

## 4. Definition of Done for the Full Refactor

- [ ] `brands` table exists with full CRUD API
- [ ] `business_accounts` table exists with full CRUD API (including connect/disconnect)
- [ ] All channels have non-null `business_account_id`, `brand_id`, `channel_type`
- [ ] No `branch_id` column exists in `warehouses`, `pos_terminals`, or `user_roles`
- [ ] `teams` table exists with CRUD API + member management
- [ ] `ManufacturingContextBuilder` uses `warehouse_id`
- [ ] All Branch classes annotated `@deprecated`
- [ ] Organization navigation: Company → Brands → Business Accounts → Sales Channels + Warehouses
- [ ] Companies Workspace fully functional
- [ ] Commerce OS stub (`ProductPublicationServiceInterface`) registered
- [ ] Marketing OS stub (`AdvertisingAssetServiceInterface`) registered
- [ ] `php artisan test` — all tests passing
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] No new code introduces a FK to `branches.id`
