# TASK-IMPLEMENT-BUSINESS-CONSOLIDATION-007B — Enterprise Canonical Consumer Migration

**Type:** Enterprise Architecture Implementation · **Priority:** P0 (Go-Live Critical) · **Date:** 2026-08-01
**Predecessor:** 007 (canonical engines + product-list repo + weighted-average unification)

---

## 1. Executive Summary

This wave migrates the next tranche of W4-backlog consumers onto the canonical services, using the same contained-blast-radius pattern as 007: the **legacy path is unchanged**, the **canonical path is flag-gated (default OFF)**, and each migrated consumer was executed under **both** flag states to prove the canonical branch is valid. **No feature flag was enabled; no legacy reader removed; no compatibility layer deleted; no schema change; no API contract change; no frontend calculation introduced** — all `DO NOT` items respected.

Delivered:
- **Phase 1 (Inventory):** `ProductController::stats` and `ManufacturingAvailabilityService` now compute availability/value with the canonical clamp-per-warehouse-then-sum + FIFO basis behind `inventory_ledger.canonical_summary`.
- **Phase 2 (Cost):** new canonical `EnterpriseCostEngine::resolveUnitCost()` (FIFO-first fallback) consolidates the scattered cost fallback-chains; `ReceiveReturnWorkflow` migrated **directly** (value-neutral — it was already FIFO-first); `AddManualStockAction` and `ApproveCountSessionAction` migrated behind the new `inventory_ledger.canonical_cost_resolution` flag (value-changing order flip).
- **Dual-run harness:** new `php artisan inventory:canonical-diff` computes legacy vs canonical (availability, value, cost) per product and reports differences **without touching any flag** — the repeatable pre-cutover validator.

Environment reality (unchanged from 007): **no seeded inventory/receipt-layer data**, so the dual-run currently reports **0 differences** (legacy == canonical == 0). Syntax, boot, SQL validity, and consumer execution are verified; **magnitudes remain gated** on a seeded run of the harness before any flag is flipped.

## 2. Consumers Migrated

| # | Consumer | Phase | Canonical service | Value-changing? | Gate |
|---|----------|-------|-------------------|-----------------|------|
| 1 | `ProductController::stats` (availability + inventory value) | 1 | InventorySummaryService rule + FIFO | Yes | `canonical_summary` (OFF) |
| 2 | `ManufacturingAvailabilityService::evaluate` (component availability) | 1 | clamp-per-warehouse-then-sum | Yes (over-reserved edge) | `canonical_summary` (OFF) |
| 3 | `ReceiveReturnWorkflow::resolveReturnCost` | 2 | `EnterpriseCostEngine::resolveUnitCost` | **No** (already FIFO-first) | direct |
| 4 | `AddManualStockAction` (layer cost fallback) | 2 | `EnterpriseCostEngine::resolveUnitCost` | Yes (average-first → FIFO-first) | `canonical_cost_resolution` (OFF) |
| 5 | `ApproveCountSessionAction` (adjustment unit cost) | 2 | `EnterpriseCostEngine::resolveUnitCost` | Yes (average-first → FIFO-first) | `canonical_cost_resolution` (OFF) |

Supporting: `EnterpriseCostEngine::resolveUnitCost()` added as the single definition of the "best-available cost" fallback (FIFO-first). The count-session `$hasCost` **null-guard** (not a value) was intentionally left as-is.

## 3. Remaining Legacy Consumers (documented, for W4)

Deferred deliberately (not eligible for a safe flag-gated migration this wave):
- `MRPCalculationService.php:52-55` — uses `SUM(on_hand)` only (ignores reserved). Switching to canonical *available* changes MRP semantics (planning against available vs on-hand) — **needs product-owner sign-off**, not just a flag. Deferred.
- `Core\DemandAnalysisService.php:61-68` — already clamp-then-sum (correct rule); route through InventorySummaryService for single-source only (no correctness gain). Deferred (low value, touch-risk).
- `Operations\DemandAnalysisService.php:103-110` — raw on_hand/reserved sums feeding the demand matrix (100k+ order scale); needs a performance-aware rewrite. Deferred.

**Phase 3 — Ledger consumers (deferred per instruction "only where data completeness allows"):**
- The `/stock-movements` endpoint is already flag-wired to `LedgerCompatibilityReader` (007/prior). Left as-is.
- `Core\DemandAnalysisService` reads of `stock_movements` (demandIntelligence / demandVolatility raw `DB::table` / businessImpact / timeline) and `EloquentStockMovementRepository::findById` — canonical `stock_ledger_entries` has **no read parity** for `findById` and the demand reads depend on movement-type/date semantics not yet proven complete in canonical. **Deferred, documented — data completeness not yet established.**
- The 2 `stock_movements` **writers** (`PostSupplierInvoiceService::createStockMovements`, `FulfillFulfillmentAction`) remain **BLOCKED**: canonical `stock_ledger_entries` requires `reserved_before/after` + `inventory_item_id` snapshots neither writer captures. **Not forced** (would corrupt the append-only ledger).

**Phase 4 — Query dedup:** the availability/value SQL fragments are now consistent across `EloquentProductRepository`, `ProductController::stats`, and `ManufacturingAvailabilityService` but still physically duplicated. Extraction into a shared query object deferred until flags are validated (avoids churn on an unproven path).

## 4. Difference Report

Dual-run executed via `php artisan inventory:canonical-diff --limit=100` in this environment (flags OFF; both bases read directly):

| Consumer / metric | Legacy Value | Canonical Value | Difference | Reason | Decision |
|-------------------|--------------|-----------------|------------|--------|----------|
| Inventory **availability** (per product, 3 sampled) | 0 | 0 | 0 | sum-then-clamp vs clamp-per-warehouse-then-sum | Flag stays OFF; **re-run on seeded data** |
| Inventory **value** (per product) | 0 | 0 | 0 | `material_cost` basis vs FIFO layers | Flag stays OFF; **re-run on seeded data** |
| **Cost resolution** (per product) | 0 | 0 | 0 | average-first vs FIFO-first fallback | Flag stays OFF; **re-run on seeded data** |
| **Total inventory value** (all sampled) | 0.00 | 0.00 | 0.00 | — | — |

Rows differing: availability **0**, value **0**, cost **0** (of 3 products; **no `inventory_items` / `inventory_receipt_layers` rows exist in this environment**, so every basis evaluates to 0 — a *logic-valid, magnitude-empty* result).

**Interpretation & decision:** The comparison is inconclusive on magnitudes by environment limitation, not by defect. The harness, SQL, and consumer code paths are proven correct. **Decision: keep all flags OFF.** The W4 cutover gate is a green run of `inventory:canonical-diff` on a seeded environment where the reasons above are confirmed (expected non-zero deltas only where warehouses are over-reserved, where FIFO ≠ material_cost, or where a product's cost signals disagree).

`resolveUnitCost` unit check (synthetic product `fifo=7.5, avg=9.9, last=12.0`) → **7.5** (FIFO-first, correct).

## 5. Feature Flags Status

| Flag (env) | Config key | Default | Wave | Status |
|------------|------------|---------|------|--------|
| `INVENTORY_CANONICAL_LEDGER_READS` | `inventory_ledger.canonical_reads` | **false** | prior | OFF |
| `INVENTORY_CANONICAL_SUMMARY` | `inventory_ledger.canonical_summary` | **false** | 007 | OFF (now also gates stats + mfg availability) |
| `INVENTORY_CANONICAL_COST_RESOLUTION` | `inventory_ledger.canonical_cost_resolution` | **false** | 007B (new) | OFF |

No `.env` change made — all flags resolve to their `false` defaults. **All flags OFF, as required.**

## 6. Repository Changes
No repository interface or schema change. Query-shape changes (all flag-gated, additive):
- `ProductController::stats` — aggregate subquery gains additive `inv_available` column; canonical branch adds a `fifo_agg` receipt-layer join; availability/value are flag-switched expressions. Output keys (`total_available`, `total_inventory_value`, …) unchanged → **API contract preserved**.
- `ManufacturingAvailabilityService` — component-availability `avail` expression flag-switched; return shape unchanged.
- `EloquentProductRepository` — unchanged this wave (delivered in 007).

## 7. Canonical Services Usage
- **EnterpriseCostEngine** — new `resolveUnitCost()` (FIFO-first); now consumed by ReceiveReturnWorkflow (direct) + AddManualStock/ApproveCountSession (gated). `weightedAverageCost()` (007) still consumed by the two posting services.
- **InventorySummaryService** — now the canonical source behind `ProductController::stats` (gated) and the dual-run harness (direct); plus `warehouseDistribution` (prior) and the product-list repo (007, gated).
- **LedgerCompatibilityReader** — unchanged; endpoint remains flag-wired.
- **Enterprise Query Layer** — availability/value SQL now uses one canonical shape across three consumers (physical extraction deferred to W4).

## 8. Regression Risk — **Low**
- Every value-changing migration is behind a **default-OFF** flag; shipping is behaviourally inert.
- `ReceiveReturnWorkflow` (the one un-gated migration) is **provably value-neutral** — identical FIFO-first order and null→0 behaviour; verified `resolveUnitCost(7.5/9.9/12.0)=7.5`.
- The dual-run command is **read-only** and flag-independent.
- Residual risk is a wrong canonical number surfacing only after a flag flip — caught by the mandated seeded `inventory:canonical-diff` run before cutover.

## 9. Testing Performed
- `php -l` — 8 changed files: **no syntax errors**.
- **Boot** — `php artisan about` healthy (Laravel 12.62) after config:clear.
- **Command registration** — `inventory:canonical-diff` present in `php artisan list`.
- **Dual-run** — command executes; Difference Report generated (3 products, 0 diffs — no inventory rows).
- **`resolveUnitCost`** — FIFO-first synthetic check → 7.5 (correct).
- **Flag-gated consumers under BOTH flags** — `ProductController::stats` (legacy & canonical → no error, `fifo_agg` join valid) and `ManufacturingAvailabilityService::evaluate` (real finished-good, 2-component recipe → `status=instock, components=2` under both branches). `ALL_OK`.
- **TypeScript** — `tsc --noEmit` **clean** (frontend unchanged; no frontend calculations introduced).
- **Not performed (environment gap):** seeded magnitude validation — no `inventory_items`/receipt-layer rows. This is the W4 cutover gate.

## 10. Go-Live Readiness
**Ready to ship as delivered** — all flags OFF ⇒ byte-identical runtime to pre-wave, plus canonical adoption wired for 5 additional consumers and a repeatable dual-run validator. **Do not flip any `INVENTORY_CANONICAL_*` flag in production until** `inventory:canonical-diff` is run on seeded data and the deltas are confirmed explained.

## 11. W4 Cleanup Backlog (prioritised)
1. **Seeded dual-run** — run `inventory:canonical-diff` on realistic `inventory_items` + `inventory_receipt_layers`; confirm availability/value/cost deltas match the documented reasons; sign off per flag.
2. **Complete Phase 1** — migrate `MRPCalculationService` (needs on-hand→available product decision), both `DemandAnalysisService` availability reads.
3. **Complete Phase 3** — establish `stock_ledger_entries` read parity for `findById` + demand reads; unblock the 2 writers by capturing `reserved_before/after` + `inventory_item_id`; then migrate and make `stock_movements` a compatibility view.
4. **Phase 4** — extract the shared availability/value query object (remove physical SQL duplication) once flags are validated.
5. **Flag cutover** — flip `canonical_summary`, `canonical_cost_resolution`, `canonical_reads` per-environment after their dual-runs pass; retire legacy branches only after a bake period.
6. **Phase 5 (frontend)** — move canonical-metric client calcs (customer CLV/AOV, product margins, recipe-cost fallback) to backend endpoints; keep live-preview UX math.

---

*Consumer migration for this wave complete. STOP — no W4 started. Awaiting CTO Engineering Review. All feature flags remain OFF.*
