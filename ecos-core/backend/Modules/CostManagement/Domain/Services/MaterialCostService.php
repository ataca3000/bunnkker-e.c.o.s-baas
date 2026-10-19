<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Services;

use Modules\CostManagement\Domain\Enums\CostUpdateSource;
use Modules\CostManagement\Domain\Enums\PricingTriggerReason;
use Modules\CostManagement\Domain\Events\FinishedProductCostChanged;
use Modules\CostManagement\Domain\Models\MaterialCostHistory;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Updates a material's official Material Cost and triggers the full cascade:
 *
 *   material_cost → recipe_cost → product_cost → pricing_review (Pending)
 *
 * Side effects (in sequence):
 *  1. Update products.material_cost
 *  2. Run cascade: recipe_cost → product_cost for all affected downstream products
 *  3. Create material_cost_history audit record
 *  4. Upsert PricingReview for every affected finished product (no duplicates)
 */
final class MaterialCostService
{
    public function __construct(
        private readonly CostCascadeService $cascade,
        private readonly PricingReviewService $pricingReviews,
    ) {}

    /**
     * Update material cost and cascade.
     *
     * @param  array{
     *   goods_receipt_id?: string|null,
     *   updated_by?: string|null,
     * } $meta
     */
    public function update(
        Product $material,
        float $newCost,
        CostUpdateSource $source,
        array $meta = [],
    ): MaterialCostHistory {
        $previousCost = (float) ($material->material_cost ?? $material->last_purchase_cost ?? 0.0);
        $difference = round($newCost - $previousCost, 4);
        $changePct = $previousCost > 0
            ? round(($difference / $previousCost) * 100, 4)
            : null;

        // Step 1: Update the material's cost
        $material->update(['material_cost' => round($newCost, 4)]);

        // Step 2: Run cascade — updates recipe_cost, product_cost, unit_cost downstream
        $cascadeResult = $this->cascade->cascadeFromMaterial($material);

        // Step 3: Create audit record
        $history = MaterialCostHistory::query()->create([
            'product_id' => $material->id,
            'previous_cost' => $previousCost > 0 ? $previousCost : null,
            'new_cost' => round($newCost, 4),
            'difference' => $difference,
            'change_pct' => $changePct,
            'source' => $source->value,
            'goods_receipt_id' => $meta['goods_receipt_id'] ?? null,
            'updated_by' => $meta['updated_by'] ?? null,
            'reason' => $meta['reason'] ?? null,
            'affected_recipe_ids' => $cascadeResult['affected_recipe_ids'],
            'affected_product_ids' => $cascadeResult['affected_product_ids'],
            'occurred_at' => now(),
            'created_at' => now(),
        ]);

        // Step 4: Upsert Pricing Reviews for every affected finished product
        if (! empty($cascadeResult['affected_products'])) {
            $companyId = $meta['company_id']
                ?? Company::query()->orderBy('created_at')->value('id');

            if ($companyId !== null) {
                foreach ($cascadeResult['affected_products'] as $entry) {
                    $this->pricingReviews->upsertForProduct(
                        product: $entry['product'],
                        newProductCost: $entry['new_cost'],
                        previousProductCost: $entry['previous_cost'],
                        companyId: (string) $companyId,
                        historyId: $history->id,
                        triggerReason: 'material_cost_changed',
                        triggerSource: $material->sku ?? $material->id,
                    );

                    $entryDiff = round($entry['new_cost'] - $entry['previous_cost'], 4);
                    $entryDiffPct = $entry['previous_cost'] > 0
                        ? round(($entryDiff / $entry['previous_cost']) * 100, 4)
                        : 0.0;

                    FinishedProductCostChanged::dispatch(
                        productId: $entry['product']->id,
                        companyId: (string) $companyId,
                        oldCost: $entry['previous_cost'],
                        newCost: $entry['new_cost'],
                        difference: $entryDiff,
                        differencePercent: $entryDiffPct,
                        triggerReason: PricingTriggerReason::MaterialCostChanged,
                        triggerSource: $material->sku ?? $material->id,
                        occurredAt: now()->toIso8601String(),
                        costHistoryId: $history->id,
                    );
                }
            }
        }

        return $history;
    }
}
