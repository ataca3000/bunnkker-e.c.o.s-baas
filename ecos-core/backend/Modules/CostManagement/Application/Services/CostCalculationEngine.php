<?php

declare(strict_types=1);

namespace Modules\CostManagement\Application\Services;

use Modules\CostManagement\Application\DTO\RecipeCostSummaryDTO;
use Modules\CostManagement\Domain\Models\RecipeCostHistory;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;

/**
 * Enterprise Cost Calculation Engine — single source of truth for recipe costing.
 *
 * Semantic contract (TASK-RECIPE-COST-CONSISTENCY-001):
 *   bills_of_materials.recipe_cost    = rawMaterialCost + packagingCost  (MATERIALS ONLY)
 *   bills_of_materials.packaging_cost = packagingCost
 *   bills_of_materials.cost_summary   = full RecipeCostSummaryDTO as JSON (includes total)
 *   RecipeCostSummaryDTO.recipeCost   = rawMaterialCost + packagingCost + mfg + other (TOTAL)
 *
 * ProductCostCalculator reads recipe.recipe_cost (materials only) and adds mfg+other → correct.
 * No other module may implement cost formulas.
 */
final class CostCalculationEngine
{
    /**
     * Calculate the full cost breakdown for a BOM without persisting anything.
     */
    public function calculate(BillOfMaterial $bom): RecipeCostSummaryDTO
    {
        $bom->loadMissing(['lines.rawMaterial', 'product.brand']);

        $rawMaterialCost = 0.0;
        $packagingCost = 0.0;
        $missingMaterialCount = 0;

        foreach ($bom->lines as $line) {
            $material = $line->rawMaterial;
            if ($material === null) {
                continue;
            }

            if ($material->material_cost === null) {
                $missingMaterialCount++;

                continue;
            }

            $unitCost = (float) $material->material_cost;
            $qty = (float) $line->quantity;
            $waste = (float) ($line->waste_percentage ?? 0.0);
            $effectiveQty = $qty * (1.0 + $waste / 100.0);
            $lineTotal = $effectiveQty * $unitCost;

            if ($material->product_type === 'packaging_material') {
                $packagingCost += $lineTotal;
            } else {
                $rawMaterialCost += $lineTotal;
            }
        }

        $manufacturingCost = (float) ($bom->manufacturing_cost ?? 0.0);
        $otherCost = (float) ($bom->other_costs ?? 0.0);
        $materialsCost = $rawMaterialCost + $packagingCost;
        $recipeCost = $materialsCost + $manufacturingCost + $otherCost;
        $finishedProductCost = $recipeCost;

        $product = $bom->product;
        $currentSellingPrice = null;
        $suggestedPrice = null;
        $marginAmount = null;
        $marginPercent = null;

        if ($product !== null) {
            $currentSellingPrice = (float) ($product->regular_price ?? 0.0) ?: null;
            $targetMargin = $product->effectiveTargetMargin();

            if ($targetMargin < 100.0 && $finishedProductCost > 0.0) {
                $suggestedPrice = round($finishedProductCost / (1.0 - $targetMargin / 100.0), 4);
            }

            if ($currentSellingPrice !== null && $currentSellingPrice > 0.0 && $finishedProductCost > 0.0) {
                $marginAmount = $currentSellingPrice - $finishedProductCost;
                $marginPercent = ($marginAmount / $currentSellingPrice) * 100.0;
            }
        }

        return new RecipeCostSummaryDTO(
            rawMaterialCost: round($rawMaterialCost, 4),
            packagingCost: round($packagingCost, 4),
            manufacturingCost: round($manufacturingCost, 4),
            otherCost: round($otherCost, 4),
            recipeCost: round($recipeCost, 4),
            finishedProductCost: round($finishedProductCost, 4),
            suggestedSellingPrice: $suggestedPrice,
            currentSellingPrice: $currentSellingPrice,
            marginAmount: $marginAmount !== null ? round($marginAmount, 4) : null,
            marginPercent: $marginPercent !== null ? round($marginPercent, 4) : null,
            lastCalculatedAt: now()->toIso8601String(),
            hasMissingCosts: $missingMaterialCount > 0,
            missingMaterialCount: $missingMaterialCount,
        );
    }

    /**
     * Calculate and persist cost columns on the BOM, then record a cost history entry.
     *
     * Persists:
     *   recipe_cost            = rawMaterialCost + packagingCost  (MATERIALS ONLY)
     *   packaging_cost         = packagingCost
     *   cost_summary           = full DTO as JSON (includes total in recipe_cost key)
     *   cost_pending           = true when any component has no material_cost
     *   recipe_cost_updated_at = now()
     *
     * Does NOT cascade to product_cost — callers are responsible for that.
     */
    public function calculateAndPersist(
        BillOfMaterial $bom,
        string $triggerType = 'recipe_edit',
        ?string $triggerSource = null,
        ?string $triggeredBy = null,
    ): RecipeCostSummaryDTO {
        $previousMaterialsCost = (float) ($bom->recipe_cost ?? 0.0);

        $summary = $this->calculate($bom);
        $newMaterialsCost = round($summary->rawMaterialCost + $summary->packagingCost, 4);

        $bom->recipe_cost = $newMaterialsCost;
        $bom->packaging_cost = $summary->packagingCost;
        $bom->cost_summary = $summary->toArray();
        $bom->cost_pending = $summary->hasMissingCosts;
        $bom->recipe_cost_updated_at = now();
        $bom->saveQuietly();

        RecipeCostHistory::query()->create([
            'bom_id' => $bom->id,
            'previous_materials_cost' => $previousMaterialsCost > 0 ? $previousMaterialsCost : null,
            'new_materials_cost' => $newMaterialsCost,
            'difference' => round($newMaterialsCost - $previousMaterialsCost, 4),
            'trigger_type' => $triggerType,
            'trigger_source' => $triggerSource,
            'triggered_by' => $triggeredBy,
            'cost_snapshot' => $summary->toArray(),
            'occurred_at' => now(),
        ]);

        return $summary;
    }
}
