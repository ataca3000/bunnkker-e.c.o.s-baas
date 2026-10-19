# ADR-016: Enterprise Cost Intelligence Platform

**Status:** APPROVED — ACTIVE  
**Date:** 2026-07-06  
**Task:** TASK-COST-ARCH-002  
**Supersedes:** None (extends ADR-011 event-driven principles)

---

## Context

Before this ADR, cost calculations were scattered across multiple layers:

- `RecipeCostCalculator` computed recipe cost in a legacy cascade chain
- `ProductCostCalculator` propagated changes through the product hierarchy
- Frontend components (`calcRecipeCost`, `calcRecipeCostFromFormLines`) duplicated cost formulas in React
- `packaging_cost` was never separated from raw material cost — both were lumped together
- `PricingReview.trigger_reason` stored arbitrary strings with no validation
- `FinishedProductCostChanged` event did not exist; instead `ProductCostChanged` carried incomplete data
- No immutable cost snapshots were stored with pricing decisions

This produced divergence between UI-displayed costs and persisted costs, made debugging pricing decisions difficult, and made it impossible to trace "why did this price review appear?"

---

## Decision

### 1. CostCalculationEngine — Single Source of Truth

`Modules\CostManagement\Application\Services\CostCalculationEngine` is the **only** permitted location for finished-product cost formulas. No other class may compute recipe cost, packaging cost, or product cost from components.

- `calculate(BillOfMaterial): RecipeCostSummaryDTO` — pure, reads DB, no writes
- `calculateAndPersist(BillOfMaterial): RecipeCostSummaryDTO` — calculates then saves `recipe_cost`, `packaging_cost`, and `cost_summary` JSON to the BOM record

The engine separates materials by `product_type`:
- `raw_material` → contributes to `raw_material_cost`
- `packaging_material` → contributes to `packaging_cost`

Effective quantity is always `qty × (1 + waste% / 100)`, computed server-side.

### 2. RecipeCostSummaryDTO — Immutable Value Object

`Modules\CostManagement\Application\DTO\RecipeCostSummaryDTO` is a read-only, serializable cost snapshot:

```
raw_material_cost, packaging_cost, manufacturing_cost, other_cost,
recipe_cost, finished_product_cost, suggested_selling_price,
current_selling_price, margin_amount, margin_percent, last_calculated_at
```

The DTO is serialized as JSON and stored in `bills_of_materials.cost_summary`. Frontend reads this field as the authoritative breakdown — no local recalculation.

### 3. PricingTriggerReason Enum

`Modules\CostManagement\Domain\Enums\PricingTriggerReason` replaces all string literals for trigger reasons. The enum is the contract; `fromLegacyString()` handles backward compatibility for stored strings.

### 4. FinishedProductCostChanged Event

`Modules\CostManagement\Domain\Events\FinishedProductCostChanged` is the **canonical cost-change event**. It carries:
- `productId`, `companyId`
- `oldCost`, `newCost`, `difference`, `differencePercent`
- `triggerReason` (enum), `triggerSource`
- `occurredAt` (ISO 8601)
- Optional: `costSnapshot` (RecipeCostSummaryDTO::toArray()), `costHistoryId`

`ProductCostChanged` is deprecated. All new code dispatches `FinishedProductCostChanged`.

### 5. CostImpactEngine — Listener

`Modules\CostManagement\Application\Services\CostImpactEngine` listens to `FinishedProductCostChanged` via the service provider event map. It:
1. Loads the product with brand
2. Builds an immutable cost snapshot
3. Generates a human-readable explanation (e.g., "Recipe cost increased 18.3% — trigger: recipe_updated")
4. Calls `PricingReviewService::upsertForProduct()` with the snapshot and explanation

This ensures **one pending review per product** is maintained, never duplicated.

### 6. Cost Snapshots in PricingReview

`pricing_reviews.cost_snapshot` stores the RecipeCostSummaryDTO at the moment the review was triggered. `pricing_reviews.explanation` stores the human-readable change description. Both are **immutable** once written — they document why the review exists, not the current state.

### 7. RecalculateProductCostJob — Queue Strategy

Heavy recalculations triggered by material cost changes use `RecalculateProductCostJob` (implements `ShouldQueue`). The job:
1. Loads the BOM
2. Calls `CostCalculationEngine::calculateAndPersist()`
3. Updates `product_cost` and `unit_cost`
4. Dispatches `FinishedProductCostChanged`

Configuration: `tries=3`, `timeout=60s`. Synchronous mass recalculation is forbidden.

### 8. Frontend Architecture

The frontend is a **presentation layer only**:

- `recipe.cost_summary` (from `RecipeCostSummaryDTO`) is used directly in `ViewWorkspace`
- `calcRecipeCost()` is retained **only** as a fallback for legacy recipes that predate the engine (cost_summary = null)
- `calcRecipeCostFromFormLines()` remains in `FormWorkspace` for live-editing UI feedback only — it is never persisted
- `packaging_cost` is never a manual input; it is always auto-calculated from recipe materials
- `useCompany()` is called once in `RecipeWorkspacePage` (highest feature container) and passed as props

---

## Consequences

**Positive:**
- Cost calculations are auditable — every pricing review contains a frozen snapshot explaining the change
- Packaging cost is always accurate; it is never guessed or manually entered
- Frontend and backend will never diverge on cost values for saved recipes
- Pricing review deduplication is enforced at the service layer

**Negative / Trade-offs:**
- Legacy recipes (saved before this ADR) will have `cost_summary = null` until they are next edited/saved
- `RecipeCostCalculator` (legacy) is kept alive for the `MaterialCostService` cascade chain; full migration to `CostCalculationEngine` is deferred to a future sprint
- Sub-components within the recipe picker dialog (`MaterialRow`) still call `useCompany()` directly — lifting further would require prop-drilling through `MaterialPicker`

---

## Migration Notes

1. `bills_of_materials.packaging_cost` and `bills_of_materials.cost_summary` columns added via migration `2026_07_06_150001`.
2. `pricing_reviews.cost_snapshot` and `pricing_reviews.explanation` added via migration `2026_07_06_150002`.
3. All new BOM creates/updates go through `CostCalculationEngine`. Existing recipes get `cost_summary` populated on next save.
4. No data backfill required — the frontend gracefully falls back to `calcRecipeCost()` when `cost_summary` is null.
