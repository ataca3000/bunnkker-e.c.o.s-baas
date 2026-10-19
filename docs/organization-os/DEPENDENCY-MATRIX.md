# Organization OS V2.2 — Dependency Matrix

**Document:** DEPENDENCY-MATRIX  
**Version:** 2.2  
**Status:** APPROVED FOR IMPLEMENTATION — ADR-011 V2.2  
**Date:** 2026-07-05  
**Supersedes:** V2.1 (Channel → Sales Channel; channel_type added; Product Publication layer; Teams added)

---

## 1. Entity Dependency Chain

### 1.1 Full Dependency Hierarchy

```
companies
    └── brands
            └── business_accounts          ← Integration Root
                    └── channels (sales_channels)
                            └── (channel_type, sync config)

companies
    └── warehouses
            └── (inventory, preparation waves)

companies
    └── teams
            └── (user memberships)

[Commerce OS — FK targets reserved]
product_publications ─── product_id + business_account_id + channel_id
```

### 1.2 Dependency Rules (V2.2)

| Rule | Description |
|---|---|
| Brand requires Company | `brands.company_id` FK |
| Business Account requires Brand | `business_accounts.brand_id` FK |
| Business Account denormalizes Company | `business_accounts.company_id` kept consistent at app layer |
| Sales Channel requires Business Account | `channels.business_account_id` FK |
| Sales Channel denormalizes Brand | `channels.brand_id` — performance denorm |
| Sales Channel denormalizes Company | `channels.company_id` — tenant isolation |
| Sales Channel requires channel_type | `channels.channel_type` NOT NULL — one of 6 enum values |
| Warehouse requires Company | `warehouses.company_id` FK — direct; no BA/Brand intermediate |
| Team requires Company | `teams.company_id` FK — direct |

---

## 2. Current branch_id Blast Radius

Files and modules with active `branch_id` dependencies that must be migrated.

| Module | File | Usage | Migration Target |
|---|---|---|---|
| MasterData\Warehouses | `Warehouse.php` model | `branch_id` FK field | Remove; make Company-direct |
| MasterData\Warehouses | `WarehouseController.php` | `branch_id` in CRUD | Remove from all CRUD |
| MasterData\Warehouses | `WarehouseResource.php` | Exposes `branch_id` | Remove field |
| MasterData\Warehouses | `WarehouseDTO.php` | `branchId` property | Remove property |
| MasterData\Warehouses | `StoreWarehouseRequest.php` | Validates `branch_id` | Remove validation |
| MasterData\Warehouses | `UpdateWarehouseRequest.php` | Validates `branch_id` | Remove validation |
| MasterData\Warehouses | `EloquentWarehouseRepository.php` | Queries by `branch_id` | Remove filter |
| MasterData\Warehouses | `WarehouseFactory.php` | Seeds `branch_id` | Update factory |
| MasterData\Warehouses | `WarehouseSeeder.php` | Creates with `branch_id` | Update seeder |
| MasterData\Warehouses | `create_warehouses_table.php` | FK column + constraint | Add migration to drop |
| POS\Terminal | `Terminal.php` model | `branch_id` FK field | Replace with `warehouse_id` |
| POS\Terminal | `create_pos_terminals_table.php` | FK column | Add migration to change |
| POS\Terminal | `EloquentTerminalRepository.php` | Queries by `branch_id` | Update to `warehouse_id` |
| POS\Terminal | `TerminalAggregateTest.php` | Test fixture uses `branch_id` | Update test |
| POS\Terminal | `TerminalDomainEventsTest.php` | Event fixture uses `branch_id` | Update test |
| POS\Terminal | `TerminalRegistered.php` event | Payload has `branch_id` | Update event payload |
| IAM | `UserRole.php` model | `branch_id` FK field | Replace with scope_type/scope_id |
| IAM | `user_roles migration` | FK column | Add migration to change |
| IAM | `PermissionServiceInterface.php` | Branch-scoped permission check | Update to scope-based |
| Manufacturing | `ManufacturingContextBuilder.php` | Reads `branch_id` from context | Replace with `warehouse_id` |

---

## 3. Modules NOT Affected by branch_id Removal

| Module | Current Org Anchor | V2.2 Status |
|---|---|---|
| Commerce\Channels | `company_id` | **Needs business_account_id + channel_type** |
| Inventory\Products | `company_id` | Clean — Products anchor to Company only |
| Inventory\StockLedger | `warehouse_id` | Clean — warehouse-based |
| Inventory\ReceiptLayers | `warehouse_id` | Clean |
| CostManagement | `company_id` | Clean |
| Operations\Preparation | `warehouse_id` | Clean |
| Operations\Loading | `warehouse_id` | Clean |
| MasterData\Categories | `company_id` | Clean |
| MasterData\Suppliers | `company_id` | Clean |
| Manufacturing\BOM | `company_id` | Clean |
| Procurement\MaterialRequests | `company_id` | Clean |
| Procurement\PurchaseOrders | `company_id` + `warehouse_id` | Clean |
| Procurement\GoodsReceipts | `warehouse_id` | Clean |

---

## 4. New Dependencies Introduced by V2.2

| Module | New Dependency | Reason |
|---|---|---|
| Commerce\Channels | → `business_accounts` table | Channel now under BA |
| Commerce\Channels | → `brands` table (denorm) | brand_id kept as performance denorm |
| Commerce\Channels | `channel_type` enum required | V2.2 mandatory field |
| Commerce Sync | → `business_accounts` (credentials + webhooks + sync_settings) | All integration config lives on BA |
| Product Publications (future) | → `business_accounts` table | BA is the publication target |
| Product Publications (future) | → `channels` (sales_channels) table | Channel is the specific publication target |
| Marketing | → `business_accounts.advertising_assets` | Ad spend is BA-scoped |
| POS\Terminal | → `warehouses` table | Replacing branch with warehouse |
| IAM | → scope_type/scope_id pattern | Replacing hard branch-scope |
| Teams | → `companies` table | New entity; direct company FK |

---

## 5. Module → Organizational Anchor (V2.2)

| Module | V2.1 Anchor | V2.2 Anchor | Changed? |
|---|---|---|---|
| Commerce Sync | Business Account | Business Account (+ webhooks + sync_settings) | Extended |
| Marketing | Brand → Business Account | Brand → Business Account (+ advertising_assets) | Extended |
| CRM | Channel | Sales Channel (channel_type-aware) | **Name** |
| POS | Business Account → Channel | Business Account → Sales Channel (channel_type=pos) | **Explicit type** |
| Products | Company | Company (ownership rule now explicit) | Clarified |
| Product Publication | Not yet defined | Business Account → Sales Channel (Commerce OS) | **NEW** |
| Inventory | Company → Warehouse | Company → Warehouse | No |
| Procurement | Company → Warehouse | Company → Warehouse | No |
| Preparation OS | Warehouse | Warehouse | No |
| Logistics | Warehouse | Warehouse | No |
| Accounting | Company | Company | No |
| IAM | Branch → Company | Company (scope_type/scope_id) | No (Branch removed) |
| Manufacturing | Company → Warehouse | Company → Warehouse | No |

---

## 6. Database Table Dependencies (V2.2)

### 6.1 `channels` Table — Dependency Changes

| Column | V2.1 Role | V2.2 Change |
|---|---|---|
| `brand_id` | Performance denorm FK | Unchanged — still denorm |
| `business_account_id` | Primary FK | Unchanged |
| `channel_type` | Did not exist | **NEW — required, 6-value enum** |
| `company_id` | Denorm FK | Unchanged |

### 6.2 `business_accounts` Table — V2.2 Additions

| Column | V2.1 | V2.2 |
|---|---|---|
| `credentials` | JSONB | Unchanged |
| `webhook_config` | Did not exist | **NEW JSONB** |
| `sync_settings` | Did not exist | **NEW JSONB** |
| `settings` | JSONB | Unchanged |

### 6.3 `teams` Table — NEW (V2.2)

| Column | FK Target | Notes |
|---|---|---|
| `company_id` | `companies.id` | Direct FK |

---

## 7. API Endpoint Changes

### 7.1 Existing APIs — Impact of V2.2

| Endpoint | Change Required | Notes |
|---|---|---|
| `POST /api/v1/channels` | `channel_type` becomes required | Breaking for existing clients |
| `PUT /api/v1/channels/{id}` | `channel_type` updatable | Non-breaking (additive) |
| `GET /api/v1/channels` | Response adds `channel_type` | Non-breaking (additive) |
| `GET /api/v1/channels/{id}` | Response adds `channel_type` | Non-breaking (additive) |
| `POST /api/v1/business-accounts` | `webhook_config` + `sync_settings` fields available | Non-breaking (optional) |
| `PUT /api/v1/business-accounts/{id}` | `webhook_config` + `sync_settings` updatable | Non-breaking |

### 7.2 New APIs Required by V2.2

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/business-accounts` | GET | List all BAs for current company |
| `/api/v1/business-accounts` | POST | Create a new Business Account |
| `/api/v1/business-accounts/{id}` | GET/PUT/DELETE | CRUD |
| `/api/v1/business-accounts/{id}/connect` | POST | Initiate OAuth / API connection |
| `/api/v1/business-accounts/{id}/disconnect` | POST | Revoke credentials |
| `/api/v1/business-accounts/{id}/channels` | GET | List Sales Channels under a BA |
| `/api/v1/business-accounts/{id}/advertising-assets` | GET | Advertising asset summary (stub) |
| `/api/v1/brands/{id}/business-accounts` | GET | List BAs under a Brand |
| `/api/v1/channels/{id}/publication-summary` | GET | Product publication stats (stub) |
| `/api/v1/teams` | GET/POST | Teams CRUD |
| `/api/v1/teams/{id}` | GET/PUT/DELETE | Team detail |
| `/api/v1/teams/{id}/members` | GET/POST/DELETE | Team member management |

---

## 8. Frontend Dependency Map

| Frontend Feature | V2.1 | V2.2 |
|---|---|---|
| Organization workspace | Brands + Business Accounts + Channels + Warehouses | **+ Teams + Companies Workspace** |
| `/organization/brands` | Full CRUD, shows BA tab | Unchanged |
| `/organization/business-accounts` | Full CRUD, Channels tab | **+ Advertising tab (stub)** |
| `/organization/channels` | Channel list | **channel_type badge; BA filter** |
| `/organization/channels/new` | BA selection step | **+ channel_type selection step** |
| `/organization/warehouses` | No branch selector | Unchanged |
| `/organization/companies` | Not implemented | **NEW — Companies Workspace** |
| `/organization/teams` | Not implemented | **NEW — Teams Workspace** |

### 8.1 React Components Affected by V2.2

| Component | Impact |
|---|---|
| `ChannelForm` | Add `channel_type` select (required) |
| `ChannelListRow` | Add `channel_type` badge (color-coded) |
| `BusinessAccountForm` | No change to structure; webhook_config + sync_settings are advanced JSON fields |
| `BusinessAccountDrawer` | Add Advertising tab (stub) |
| `ChannelDrawer` | Add Publications tab (stub) |
| `OrganizationNavigation` | Add Teams + Companies entries |

---

## 9. Event Payload Changes (V2.2)

| Event | V2.1 Payload | V2.2 Addition |
|---|---|---|
| `organization.channel.created` | `channel_id`, `business_account_id`, `brand_id` | Add `channel_type` |
| `organization.channel.updated` | `channel_id` | Add `channel_type` if changed |
| `organization.business_account.created` | `ba_id`, `brand_id`, `company_id`, `platform_type` | Unchanged |

### New Events (V2.2)

| Event | When |
|---|---|
| `organization.team.created` | After POST /teams |
| `organization.business_account.credentials_updated` | After connect or credential refresh |
| `organization.business_account.webhook_configured` | After webhook_config updated |

---

## 10. Test Impact

| Test Suite | Affected | Change Required |
|---|---|---|
| `TerminalAggregateTest` | YES | Replace `branch_id` fixture with `warehouse_id` |
| `TerminalDomainEventsTest` | YES | Update event payload assertion |
| `ChannelTest` (existing) | YES | Add `business_account_id` + `channel_type` to fixtures |
| `WarehouseTest` (if exists) | YES | Remove `branch_id` from test data |
| New `ChannelTypeEnumTest` | NEW | Validate all 6 channel_type values |
| New `TeamControllerTest` | NEW | CRUD + company isolation |
| `BranchTest` | Partial | Keep existing; add deprecation note |

---

## 11. Ownership Matrix (Golden Rule)

Every Aggregate has exactly one owner. Other modules consume via APIs/events only.

| Entity | Owner | No Other Module May |
|---|---|---|
| Company | Organization OS | Redefine Company |
| Brand | Organization OS | Create shadow brand tables |
| Business Account | Organization OS | Duplicate BA credentials |
| Sales Channel | Organization OS | Create shadow channel tables |
| Warehouse | Organization OS | Reassign warehouse to brand/BA |
| Team | Organization OS | Create alternative team models |
| Product | Commerce OS | Move product ownership to Brand/BA/Channel |
| Inventory | Inventory OS | Store stock counts outside inventory tables |
| Supplier | Procurement OS | Create shadow supplier tables |
| Customer | CRM OS | Duplicate customer records |
