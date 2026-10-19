# TASK-IMPLEMENT-BUSINESS-CONSOLIDATION-008 — Enterprise Legacy Cleanup & Final Consolidation

**Type:** Enterprise Architecture Implementation · **Priority:** P0 (Pre-Go-Live) · **Date:** 2026-08-01

---

## 1. Executive Summary

This wave performs the safe subset of pre-go-live cleanup and **documents** the rest, because a governing fact constrains what may be removed: **the canonical migration is deliberately NOT complete.** In 007/007B every canonical flag was left **OFF and unvalidated** (no seeded dual-run has been run). Therefore:

- The **legacy readers/calculations are the ACTIVE production path** — they are not dead code.
- The **three canonical flags are "awaiting production activation."**
- The **flag-gated legacy branches and `LedgerCompatibilityReader` are compatibility layers still protecting production**, and are required for **rollback**.

The task's own `DO NOT REMOVE` section forbids removing anything needed for rollback, flags awaiting activation, or compat layers protecting production, and gates "Dead Feature Flags" on *"ONLY if migration is complete."* Consequently, the bulk of "remove legacy readers / flags / compatibility code" is **correctly deferred** to a post-cutover cleanup, not executed now. Doing otherwise would either delete the live path or force an unvalidated cutover — a P0 hazard.

What was safely actioned: removal of **provably-dead, consumer-less, migration-adjacent** code only — orphan i18n keys left by the 007 tab removal, and a dead frontend demand-analysis service + its types. A conservative project-wide dead-code scan was run; its unrelated platform-wide candidates are **documented, not deleted** (out of scope for a canonical-services cleanup and carrying false-positive risk — see §11). Frontend `tsc` clean; backend boots; routes load; canonical services resolve.

## 2. Legacy Code Removed (this wave)

| Item | Kind | Why safe |
|------|------|----------|
| `frontend/src/features/operations/services/demand-analysis-service.ts` | Dead service | Zero importers (only self-referenced its own type); the `use-purchase-materials` "demand-analysis" hit is an unrelated queryKey string. `tsc` clean after removal. |
| `frontend/src/features/operations/types/demand-analysis.ts` | Dead types | Consumed only by the dead service above. |
| `en/recipes.json` + `ar/recipes.json` — `drawer.tabs.productionHistory` and `productionHistory.comingSoon` | Orphan i18n keys (×4) | Orphaned by the 007 removal of the "Coming Soon" Production History tab; grep proves zero code references. JSON re-validated. |

Carried from 007 (already removed): `backend/.../RecipeCostCalculator.php` (dead; classmap re-dumped; `class_exists` → false, re-confirmed this wave).

## 3. Compatibility Layers Retained (required — documented per instruction)

| Layer | Protects | Retain reason |
|-------|----------|---------------|
| `LedgerCompatibilityReader` (behind `canonical_reads`) | `GET /stock-movements` contract | Canonical ledger read path; **retain permanently** as the compatibility shim once cutover happens, and **for rollback** until then. |
| Legacy branch in `EloquentProductRepository::paginate` (behind `canonical_summary`) | Product-list availability/value | Active production path; **retain until** seeded dual-run validates canonical, **+ rollback**. |
| Legacy branch in `ProductController::stats` (behind `canonical_summary`) | Inventory stats KPIs | Same as above. |
| Legacy branch in `ManufacturingAvailabilityService` (behind `canonical_summary`) | Manufacturing availability | Same as above. |
| Legacy average-first branches in `AddManualStockAction`, `ApproveCountSessionAction` (behind `canonical_cost_resolution`) | Cost-valued records | Active path; **retain until** cost dual-run validated, **+ rollback**. |
| Legacy `stock_movements` table/model/repository + 2 writers (`PostSupplierInvoiceService`, `FulfillFulfillmentAction`) + `DemandAnalysisService` reads | Ledger data of record | **Retain** — writers are BLOCKED (canonical needs `reserved_before/after` + `inventory_item_id` snapshots); this is the source of truth until Phase 3 completes. |

## 4. Feature Flags Status

Every enterprise consolidation flag reviewed. **All three: Retain until Go-Live (post-validation), do NOT remove now.**

| Flag | Config key | Default | Decision | Reason |
|------|------------|---------|----------|--------|
| `INVENTORY_CANONICAL_LEDGER_READS` | `inventory_ledger.canonical_reads` | OFF | **Retain until Go-Live** | Migration not validated; flip only after canonical ledger read parity confirmed. Needed for rollback. |
| `INVENTORY_CANONICAL_SUMMARY` | `inventory_ledger.canonical_summary` | OFF | **Retain until Go-Live** | Gates 3 consumers (repo list, stats, mfg availability); flip only after seeded `inventory:canonical-diff` passes. Rollback. |
| `INVENTORY_CANONICAL_COST_RESOLUTION` | `inventory_ledger.canonical_cost_resolution` | OFF | **Retain until Go-Live** | Gates cost-valued records (count/manual-stock); flip only after cost dual-run passes. Rollback. |

No flag is "dead" (migration incomplete → the removal precondition is unmet). No `.env` change made — **all flags remain OFF.**

## 5. Dead Files Removed
3 files total across the consolidation series: `RecipeCostCalculator.php` (007), `demand-analysis-service.ts`, `demand-analysis.ts` (008). Plus 4 orphan i18n keys (2 en + 2 ar). No folders removed.

## 6. Duplicate Logic Removed (consolidated to one canonical)
- **Weighted-average cost** — was ×2 (receipt + invoice posting); now one `EnterpriseCostEngine::weightedAverageCost()` (007). Re-verified this wave: single definition + 2 callers, no third copy.
- **Cost fallback chain** — the scattered `?? ??` cost resolvers now route through one `EnterpriseCostEngine::resolveUnitCost()` (007B), gated where value-changing.
- **Availability clamp SQL** — one canonical shape (`SUM(GREATEST(on_hand−reserved,0))`) used across repo/stats/mfg (physical extraction to a shared query object is W4 — see §11).

## 7. Canonical Validation — one canonical implementation per capability

| Capability | Canonical implementation (single) | Legacy still present? |
|------------|-----------------------------------|-----------------------|
| Inventory availability | `InventorySummaryService` (clamp-per-warehouse-then-sum) | Yes — behind OFF flags, retained for rollback (by design) |
| Inventory value | `EnterpriseCostEngine::inventoryValue` (FIFO) | Yes — flag-gated |
| Unit cost / valuation basis | `EnterpriseCostEngine::unitCost` / `resolveUnitCost` / `weightedAverageCost` | Yes — flag-gated cost resolution |
| Ledger read | `LedgerCompatibilityReader` → `stock_ledger_entries` | Yes — `stock_movements` (active default) |
| Inventory summary DTO | `InventorySummary` (one shape) | — |
| Warehouse distribution | `InventoryLayerController::warehouseDistribution` → `InventorySummaryService` | — |
| Manufacturing availability | `ManufacturingAvailabilityService` (canonical branch) | Yes — flag-gated |
| Order totals | Backend order snapshot/resource (unchanged; single source) | — |

**Conclusion:** exactly one **canonical** implementation exists per capability. Legacy implementations remain **intentionally** as flag-gated compatibility/rollback paths — their removal is a post-cutover step, not a pre-validation one.

## 8. Regression Risk — **Very Low**
- Only provably-dead, zero-reference code removed; `tsc` clean confirms no broken imports; backend boot + `route:list` succeed; canonical services resolve.
- No flag flipped, no active legacy path touched, no schema/API change, no compat layer removed.

## 9. Performance Impact
None. Removals are dead code / unused i18n keys. No query, request, or bundle hot-path changed. (Frontend bundle marginally smaller — 2 files + 4 keys.)

## 10. Codebase Size Reduction
Modest by design: 3 source files + 4 i18n keys removed across the series (2 files + 4 keys this wave). A large reduction is **not** appropriate pre-validation — the legacy paths that would yield real reduction are still load-bearing.

## 11. Technical Debt Remaining
1. **Post-cutover legacy removal (the big one)** — after each `INVENTORY_CANONICAL_*` flag is validated (seeded `inventory:canonical-diff`) and flipped + baked, remove the corresponding legacy branch and, for the ledger, migrate the 2 blocked writers and demote `stock_movements` to a view. This is where most debt is retired — **blocked on validation, not on effort.**
2. **Phase 4 SQL extraction** — collapse the duplicated (but now identical) availability/value SQL into a shared query object post-validation.
3. **Separate dead-code audit (OUT OF SCOPE here, documented)** — a conservative scan surfaced ~25 platform-wide zero-reference candidates **unrelated to the canonical migration**: BusinessAttribution/Engineering extension-point interfaces, ClaudeBridge DTOs/Resources, several Admin/Configuration controllers, Logistics carrier events, duplicate Marketing `ProviderConnectorInterface`. **Not deleted** because (a) they are outside a *canonical-services* cleanup's scope, and (b) **controller candidates are a false-positive risk** — e.g. `BrandCoverageController` greps to "definition only" yet corresponds to shipped Branch-Coverage routes (module route registration/dynamic binding not captured by a name grep). These warrant a dedicated, individually-verified dead-code task with boot/route/test guards — not a blanket pre-go-live purge.
4. **Frontend Phase 5** — canonical-metric client calcs (customer CLV/AOV, product margins) still pending backend endpoints.

## 12. Pre-Go-Live Readiness
- **Compiles clean:** frontend `tsc --noEmit` clean; backend `php -l` clean (unchanged files); classmap consistent.
- **Boots clean:** `php artisan about` healthy; `route:list` loads (no missing-controller errors); canonical services resolve.
- **One canonical implementation per capability** confirmed (§7).
- **Honest gating statement:** the platform is structurally ready, but **true go-live readiness still depends on the deferred validation** — a seeded `inventory:canonical-diff` run and per-flag cutover decision. This cleanup did not, and should not, pre-empt that gate. Legacy/flag/compat removal is a **post-cutover** wave.

---

*Cleanup wave complete. STOP — no testing, no go-live started. All feature flags remain OFF; all compatibility/rollback layers retained and documented. Awaiting CTO Engineering Review.*
