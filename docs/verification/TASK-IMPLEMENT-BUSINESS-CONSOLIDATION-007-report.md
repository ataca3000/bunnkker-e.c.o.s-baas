# TASK-IMPLEMENT-BUSINESS-CONSOLIDATION-007 — Enterprise Canonical Services Adoption

**Type:** Enterprise Architecture Implementation · **Priority:** P0 (Go-Live Critical) · **Date:** 2026-08-01
**Canonical services:** InventorySummaryService · EnterpriseCostEngine · LedgerCompatibilityReader (Canonical Ledger)

---

## 1. Executive Summary

This wave advances canonical-services adoption using the exact mechanisms the task authorizes (feature flags, compatibility layers, dual-run, additive improvements, post-validation repository cleanup). The delivered increment is **provably safe**: value-neutral consolidations were applied directly, and every **value-changing** cutover is behind a flag that **defaults to legacy**, so shipping this changes zero runtime behaviour until each environment validates the canonical numbers against seeded data and flips the flag.

Two hard constraints shaped scope and are stated plainly so the CTO review is not misled:
1. **This environment has no seeded inventory/receipt-layer/ledger data.** Syntax, types, boot, SQL validity, and API contract were verified; canonical **magnitudes** were **not** (they compute to 0 with no rows). Flipping the flags is therefore gated on seeded validation — this is the pre-existing, CTO-agreed gate, not new debt.
2. **The two remaining `stock_movements` writers cannot be migrated safely yet** — the canonical `stock_ledger_entries` requires `reserved_before/after` and `inventory_item_id` snapshots that neither writer currently captures. Forcing this would corrupt the append-only ledger. It is documented as **BLOCKED**, not attempted.

Delivered: canonical weighted-average unified (2→1), dead `RecipeCostCalculator` removed, and the highest-value inventory consumer (product-list repository — availability + inventory value + manufacturing-availability) rebuilt to the canonical rule behind a default-off flag. Boot healthy; product-list SQL executes under both flag states; TypeScript clean.

## 2. Canonical Services Adopted

| Service | Role | Adoption this wave |
|---------|------|--------------------|
| **EnterpriseCostEngine** | Single cost/valuation authority (FIFO canonical) | New canonical `weightedAverageCost()` — the one definition of the moving-average formula; product-list `inventory_value` now uses the FIFO basis (flag-gated) matching `EnterpriseCostEngine::inventoryValue()` |
| **InventorySummaryService** | Single availability authority (clamp-per-warehouse → sum) | Product-list availability + manufacturing-availability now use the canonical clamp-per-warehouse-then-sum rule (flag-gated) |
| **LedgerCompatibilityReader** | Canonical ledger read behind legacy `/stock-movements` shape | Pre-wired behind `canonical_reads` (unchanged); confirmed intact — no new legacy `stock_movements` reader introduced |
| **Enterprise Query Layer** | De-duplicated read logic | Product-list availability/value SQL centralised into single flag-switched expressions (removes the internal duplicate of the clamp formula within `paginate`) |

## 3. Consumers Migrated

| Consumer | Phase | Change | Value-changing? | Gate |
|----------|-------|--------|-----------------|------|
| `EloquentProductRepository::paginate` — `agg_available_qty` | 1 | sum-then-clamp → **clamp-per-warehouse-then-sum** | Yes (over-reserved warehouses) | `inventory_ledger.canonical_summary` (default OFF) |
| `EloquentProductRepository::paginate` — `inventory_value` | 1/2 | `on_hand × material_cost` → **FIFO** `Σ(remaining_qty × landed_unit_cost)` | Yes | same flag |
| `EloquentProductRepository::paginate` — `manufacturing_availability` component check | 1 | sum-then-clamp → clamp-per-warehouse-then-sum | Yes (edge) | same flag |
| `CreateReceiptLayersAction` (goods-receipt posting) | 2 | inline weighted-average → `EnterpriseCostEngine::weightedAverageCost()` | **No** (identical formula) | direct |
| `PostSupplierInvoiceService` (invoice posting) | 2 | inline weighted-average → `EnterpriseCostEngine::weightedAverageCost()` | **No** (identical formula) | direct |

## 4. Legacy Readers Remaining (precise, for W4)

Backend availability/value still computed locally (not yet on the engines):
- `Modules/Inventory/Products/.../ProductController.php:251-267` — stats endpoint: sum-then-clamp + `material_cost` value.
- `Modules/Manufacturing/BillsOfMaterials/Domain/Services/ManufacturingAvailabilityService.php:55-62` — sum-then-clamp.
- `Modules/Operations/Preparation/Application/Services/MRPCalculationService.php:52-55` — `SUM(on_hand)` only, ignores `reserved`.
- `Modules/Operations/DemandAnalysis/.../DemandAnalysisService.php:103-110` — raw on_hand/reserved sums.
- `Modules/Core/DemandAnalysis/.../DemandAnalysisService.php:61-68` — already clamp-then-sum (correct rule; route through service for single-source, not correctness).

Cost fallback-chains (`average_cost ?? last_purchase_cost ?? current_fifo_cost`) not yet routed through the engine — **note:** these encode a fallback the engine's single-strategy `unitCost()` does not, so migration needs a canonical `resolveUnitCost()` with-fallback method (value-neutral only if the order matches). W4:
- `Modules/Inventory/CountSessions/.../ApproveCountSessionAction.php:72-74, 105-110`
- `Modules/Inventory/StockLedger/.../AddManualStockAction.php:65-69`
- `Modules/Operations/Fulfillment/.../ReceiveReturnWorkflow.php:199-204`

Ledger (`stock_movements`) readers — endpoint already flag-wired via `LedgerCompatibilityReader`; still-legacy reads:
- `EloquentStockMovementRepository::findById` (show endpoint — no canonical equivalent yet).
- `Core\DemandAnalysisService` demandIntelligence/demandVolatility(raw `DB::table`)/businessImpact/timeline (4 read sites).
- `StockLedgerSeeder` existence check; `StockMovementObserver` (WooCommerce sync — Phase C retire).

## 5. Duplicate Calculations Removed
- **Weighted-average cost formula** — was duplicated verbatim in `CreateReceiptLayersAction` and `PostSupplierInvoiceService`; now a single definition `EnterpriseCostEngine::weightedAverageCost()`.
- **Dead `RecipeCostCalculator`** — confirmed zero references (only self-definition); **deleted**; Composer classmap re-dumped (10140 → 10139 classes; `class_exists` → false).
- **Product-list availability clamp** — the clamp expression was written twice inside `paginate` (aggregate + manufacturing CASE); both now derive from the same flag-switched expressions.

## 6. Repository Changes
`EloquentProductRepository::paginate` only. The `inventory_items` aggregate subquery gained an **additive** `SUM(GREATEST(on_hand_qty - reserved_qty, 0)) as inv_available` column (harmless when unused). Availability, value, and component-availability are now single flag-switched SQL expressions. **No schema change, no new table, no alias change** (`agg_available_qty`, `inventory_value`, `manufacturing_availability` preserved → API contract intact).

## 7. Compatibility Layers
- `LedgerCompatibilityReader` (pre-existing) — canonical ledger behind byte-identical `/stock-movements` JSON, flag `canonical_reads`. Unchanged, confirmed intact.
- **Dual-basis product repository** — legacy and canonical availability/value coexist behind `canonical_summary`; the legacy branch is byte-identical to prior output, enabling per-environment dual-run comparison before cutover.

## 8. Feature Flags

| Flag (env) | Config key | Default | Effect when ON |
|------------|------------|---------|----------------|
| `INVENTORY_CANONICAL_LEDGER_READS` | `inventory_ledger.canonical_reads` | **false** | `/stock-movements` served from canonical ledger (pre-existing) |
| `INVENTORY_CANONICAL_SUMMARY` | `inventory_ledger.canonical_summary` | **false** | Product-list availability = clamp-per-warehouse-then-sum; inventory value = FIFO |

## 9. Files Changed
1. `backend/config/inventory_ledger.php` — add `canonical_summary` flag (+ doc).
2. `backend/Modules/CostManagement/Domain/Services/EnterpriseCostEngine.php` — add `weightedAverageCost()` (pure static).
3. `backend/Modules/Inventory/ReceiptLayers/Application/Actions/CreateReceiptLayersAction.php` — route WA through engine (+ import).
4. `backend/Modules/Purchasing/SupplierInvoices/Application/Services/PostSupplierInvoiceService.php` — route WA through engine (+ import).
5. `backend/Modules/Inventory/Products/Infrastructure/Repositories/EloquentProductRepository.php` — flag-gated canonical availability + FIFO value + component availability.
6. **Deleted** `backend/Modules/CostManagement/Domain/Services/RecipeCostCalculator.php` (dead).

## 10. Architecture Compliance
- **No new business concepts / tables / API breaks / duplicated services** — respected. `weightedAverageCost` consolidates an existing formula; the FIFO/clamp SQL mirrors the existing engines; no aliases/contracts changed.
- **No business logic moved to frontend** — all changes are backend; frontend untouched.
- **No temporary workarounds** — flags are the sanctioned dual-run mechanism, not a hack.
- Aligns with [[data-platform-engines]] Phase D intent and [[ledger-consolidation-status]] (writers deferred until snapshot capture exists).

## 11. Regression Risk — **Low**
- Both value-changing flags default **OFF** → shipping this is behaviourally inert for every existing environment.
- Weighted-average change is **provably identical** (same formula; `2,10,2,20 → 15` verified) and both call sites are container-resolved (no manual instantiation; safe to add the import).
- Dead-code deletion has zero references; boot + autoload verified after removal.
- Residual risk is confined to a **wrong canonical number** surfacing only after the flag is flipped — caught by the mandated seeded dual-run before cutover.

## 12. Performance Impact
- Flag **OFF**: identical query plan to today (one extra additive `SUM(GREATEST(...))` column on an already-grouped subquery — negligible).
- Flag **ON**: `inventory_value` becomes a correlated FIFO subquery over `inventory_receipt_layers` per product row on the list. Indexed on `product_id`; acceptable at page sizes (≤100) but **should be validated under load** and considered for a joined-aggregate rewrite in W4 if the list is very wide. Availability stays a single grouped subquery (no added cost).

## 13. Testing Performed
- `php -l` — all 5 changed files: **no syntax errors**.
- **Boot** — `php artisan about` healthy (Laravel 12.62, PHP 8.4.23) after config:clear + autoload dump.
- **Canonical WA** — `EnterpriseCostEngine::weightedAverageCost(2,10,2,20)` → **15** (correct).
- **Dead class** — `class_exists(RecipeCostCalculator)` → **false**; classmap 10140→10139.
- **Product-list SQL (decisive)** — `paginate([])` executes with **no exception** under `canonical_summary` **false** (`total=3`) and **true** (`total=3`); both branches valid MySQL.
- **DI** — `InventorySummaryService` and `EnterpriseCostEngine` resolve from the container.
- **TypeScript** — `tsc --noEmit` **clean** (frontend unchanged).
- **Not performed (environment gap):** seeded magnitude validation — no `inventory_items`/receipt-layer rows exist, so canonical values compute to 0. This is the explicit gate for flipping either flag.

## 14. Go-Live Readiness
**Ready to ship as delivered** — with both flags OFF the platform is byte-identical to pre-wave behaviour, plus real duplication removed (WA unified, dead code gone). **Do not flip `INVENTORY_CANONICAL_SUMMARY` or `INVENTORY_CANONICAL_LEDGER_READS` in production until** a seeded environment confirms canonical availability/value/ledger numbers match expectations via dual-run. That validation is the W4 entry criterion.

## 15. Remaining W4 Cleanup Backlog (prioritised)
1. **Seeded dual-run validation harness** (PHPUnit with `inventory_items` + `inventory_receipt_layers`) — prerequisite to flipping any flag. Prove clamp-then-sum vs sum-then-clamp and FIFO vs material_cost on real magnitudes.
2. **Phase 1 completion** — route `ProductController::stats`, `ManufacturingAvailabilityService`, `MRPCalculationService`, both `DemandAnalysisService`s through InventorySummaryService (same flag), removing the remaining sum-then-clamp/on-hand-only sites.
3. **Phase 2 completion** — add canonical `EnterpriseCostEngine::resolveUnitCost()` (documented fallback order) and route the 3 cost fallback-chain valuation sites (ApproveCountSession ×2, AddManualStock, ReceiveReturn) through it.
4. **Phase 3 (BLOCKED → unblock)** — extend the 2 `stock_movements` writers (`PostSupplierInvoiceService`, `FulfillFulfillmentAction`) to capture `reserved_before/after` + `inventory_item_id`, then migrate to `recordEntry()`; repoint `DemandAnalysisService` reads + `findById` to canonical; retire `StockMovementObserver`; make `stock_movements` a compatibility view.
5. **Phase 4** — cross-file de-duplication of the availability/value SQL into a shared query object once flags are proven.
6. **Phase 5 (frontend)** — move canonical-metric client calcs to backend endpoints: customer CLV/AOV (`use-orders.ts` `useCustomerOrderStats`, 200-row client aggregation → C5 intelligence endpoint), product margin/price-health (`products/lib/pricing-utils.ts`), recipe-cost client fallback (`recipe-detail-drawer.tsx`). **Keep** live-preview UX math (order-form running total, inline validation) — that is presentation, not business-of-record.

---

*Implementation complete for this wave. STOP — awaiting CTO Engineering Review and Approval before W4. No W4 work started.*
