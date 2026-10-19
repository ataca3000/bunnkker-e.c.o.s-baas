# Organization OS V2.2 — Risk Assessment

**Document:** RISK-ASSESSMENT  
**Version:** 2.2  
**Status:** APPROVED FOR IMPLEMENTATION — ADR-011 V2.2  
**Date:** 2026-07-05  
**Supersedes:** V2.1 (12 risks; adds R-013 for channel_type backfill)

---

## 1. Risk Matrix

| Risk | Probability | Impact | Severity | Mitigation |
|---|---|---|---|---|
| R-001 Data loss during branch→brand migration | Low | Critical | HIGH | Soft-delete only; no DROP TABLE; explicit backfill script with dry-run mode |
| R-002 Permission regression (IAM scope change) | Medium | High | HIGH | Full permission test suite before + after; staged rollout per company |
| R-003 POS Terminal downtime during warehouse remapping | Low | High | MEDIUM | Dual-column period: keep branch_id + add warehouse_id; switch atomically |
| R-004 Sales Channel sync breaks when business_account_id added | Medium | High | MEDIUM | business_account_id nullable first; backfill; then enforce NOT NULL |
| R-005 Missing warehouse mapping for POS branch | Low | Medium | MEDIUM | Explicit mapping report before migration; admin UI for manual resolution |
| R-006 Slug collision on Brand/BA creation | Low | Low | LOW | Append code suffix on collision; unique constraint catches it |
| R-007 Manufacturing context builder test regression | Low | Low | LOW | Run manufacturing test suite after WP-ORG-005; 1-day fix window |
| R-008 Frontend branch references not fully removed | Medium | Low | LOW | TypeScript search for "branch" in component files; ESLint rule |
| R-009 Third-party webhook consumers expect brand_id | Very Low | Medium | LOW | No external consumers of brand_id identified; document if discovered |
| R-010 Old API consumers (mobile, integrations) break | Low | Medium | MEDIUM | Version header deprecation; maintain read-only branch endpoint for 90 days |
| R-011 Business Account intermediate layer adds migration complexity | Medium | Medium | MEDIUM | P0.5 seeder must complete before P1; verify seed count; abort guard in migration |
| R-012 Channel sync webhooks fail to resolve business_account_id | Low | High | MEDIUM | Dual-path credential resolver; fallback + alert; remove fallback after 30 days |
| R-013 channel_type backfill incorrect for edge-case platforms | Low | Low | LOW | Backfill uses CASE on known platform values; unknown → default 'website'; manual correction UI available |

---

## 2. Critical Risks Detail

### R-001 — Data Loss During Migration

**Scenario:** Branch records or their associated data destroyed prematurely.

**Controls:**
- All migrations use soft-delete for Branch: `UPDATE branches SET deleted_at = NOW()`
- No `DROP TABLE branches` in any migration (WP-ORG-008 only soft-deletes)
- All FK drops are preceded by data backfills
- Mandatory backup snapshot before P3 (multi-module consumer migration)

---

### R-002 — IAM Permission Regression

**Scenario:** After replacing `branch_id` with `scope_type/scope_id`, users lose or gain unintended access.

**Controls:**
- Backfill maps all branch-scoped roles to `scope_type='company'` — conservative (keeps access)
- Run permission matrix comparison test before and after migration
- Deploy to staging first; validate with a real company's role setup
- Keep `branch_id` column as nullable read-only field during WP-ORG-005 transition window

---

### R-003 — POS Terminal Downtime

**Scenario:** A terminal cannot find its operating context because `branch_id` is removed before `warehouse_id` is set.

**Controls:**
- Add `warehouse_id` column and backfill before dropping `branch_id`
- Dual-read period: terminal code checks `warehouse_id ?? branch.warehouse` fallback
- Atomic switch: after all terminals have a valid `warehouse_id`, drop `branch_id` in a single migration

---

### R-004 — Sales Channel Sync Break

**Scenario (V2.2):** Adding `business_account_id NOT NULL` and `channel_type NOT NULL` to channels breaks existing sync processors.

**Controls:**
- P1 adds columns as nullable; backfill assigns all existing channels to default BA and derives channel_type from platform
- Commerce Sync module updated to resolve credentials via `channel.businessAccount.credentials` before NOT NULL enforced
- Rollback: drop `business_account_id`, `brand_id`, `code`, `channel_type` columns; no data lost

---

### R-011 — Business Account Migration Complexity

**Scenario:** P0.5 seeder fails; P1 Channel backfill finds no BA → `business_account_id` stays NULL → NOT NULL constraint fails.

**Controls:**
1. Pre-P1 verification: `SELECT COUNT(*) FROM business_accounts WHERE company_id IN (SELECT id FROM companies WHERE is_active = TRUE)` — must be ≥ number of active companies
2. P1 migration includes abort guard (see MIGRATION-PLAN.md §5.1 Step 3)
3. Rollback: drop new columns from channels; no data lost

---

### R-012 — Commerce Sync Webhooks Cannot Resolve business_account_id

**Scenario:** During transition, webhook handlers resolve credentials via Channel directly instead of via Business Account.

**Controls:**
1. Deploy Commerce Sync handler update in the same release as P1 Channel migration
2. Dual-path resolver with fallback: `$credentials = $businessAccount->credentials ?? $channel->credentials ?? throw new CredentialsNotFoundException`
3. Alert on `CredentialsNotFoundException`; remove legacy fallback after 30 days of clean operation

---

### R-013 — channel_type Backfill Incorrect *(NEW — V2.2)*

**Scenario:** The `CASE c.platform WHEN ... END` backfill in P1 assigns the wrong `channel_type` to an existing channel (e.g., a custom WooCommerce install is labelled `marketplace` incorrectly).

**Probability:** Low — the CASE statement covers the 9 most common platform values; edge cases default to `website`.

**Impact:** Low — `channel_type` is primarily a UI/routing concern. Incorrect type does not break sync or ordering. Easily corrected by editing the channel.

**Controls:**
1. Post-migration channel audit report: `SELECT platform, channel_type, COUNT(*) FROM channels GROUP BY 1, 2` — review with dispatchers before deploying P1 to production
2. `channel_type` is editable via `PUT /api/v1/channels/{id}` — incorrect values correctable without a migration
3. Unknown platforms default to `'website'` — the safest fallback (most channels are websites)

---

## 3. Rollback Plan

| WP | Rollback Action |
|---|---|
| WP-001 (Brand module) | Drop `brands` table; remove Brand module files |
| WP-001B (Business Account module) | Drop `business_accounts` table; remove BusinessAccount module files |
| WP-002 (Sales Channels Refactor) | Drop `business_account_id`, `brand_id`, `code`, `channel_type` columns; restore old ChannelController |
| WP-003 (Warehouse) | Add `branch_id` nullable back; restore model/controller/resource |
| WP-004 (Companies Workspace) | Remove frontend pages only; no DB change |
| WP-005 (Teams + Users + Permissions) | Drop `teams`, `team_members`; add `branch_id` back to user_roles + terminals; restore services |
| WP-006 (Commerce Integration) | Remove stub interface registrations; remove Publications tab |
| WP-007 (Marketing Integration) | Remove stub interface registrations; remove Advertising tab |
| WP-008 (Branch soft-delete) | `UPDATE branches SET deleted_at = NULL` — fully reversible |

All rollbacks achievable in < 2 hours per WP. No permanent data destruction at any phase.

---

## 4. Testing Gates Before Production

| Gate | Requirement |
|---|---|
| Before P0.5 (BA migration) | `BrandSeeder` completes without error |
| Before P1 (Sales Channels) | `SELECT COUNT(*) FROM business_accounts` ≥ number of active companies |
| Before P1 | `php artisan test --filter Channel` — 100% pass |
| Before P2 (Warehouse) | `php artisan test --filter Warehouse` — 100% pass |
| Before P3 (POS/IAM) | `php artisan test --filter Terminal` — 100% pass |
| Before P3 (IAM) | `php artisan test --filter Permission` — 100% pass |
| After all phases | Full test suite — 100% pass |
| After all phases | `npx tsc --noEmit` — 0 errors |
| After all phases | Manual smoke test: Company → Brand → Business Account → Sales Channel (each type) |
| After all phases | Manual smoke test: Create Warehouse; verify no brand/BA dependency |
| After all phases | Post-migration channel_type audit report reviewed |

---

## 5. Non-Risks (Explicitly Ruled Out)

- **Inventory data**: Already warehouse-based. Zero risk.
- **Preparation OS**: Already uses `warehouse_id`. Zero risk.
- **Procurement**: Company-scoped. Zero risk.
- **Recipe / BOM**: Company-scoped. Zero risk.
- **Cost Management**: Company-scoped. Zero risk.
- **Loading OS**: Warehouse-based. Zero risk.
- **BA credentials exposure**: `credentials` JSONB is encrypted at application layer; never returned in API responses without explicit permission. Zero additional risk from BA layer.
- **channel_type breaking allocation**: Allocation and loading logic use `warehouse_id`, not `channel_type`. Zero risk.
