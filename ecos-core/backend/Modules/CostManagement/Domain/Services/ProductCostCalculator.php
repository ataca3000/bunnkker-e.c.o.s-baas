<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Services;

use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;

/**
 * Computes and persists Product Cost and Unit Cost for a manufactured product.
 *
 * Product Cost = Recipe Cost (materials) + Manufacturing Cost + Other Costs
 * Unit Cost    = Product Cost ÷ yield_quantity
 *
 * Only applies to products with can_manufacture=true and an active recipe.
 * Raw materials/consumables are priced via material_cost directly.
 */
final class ProductCostCalculator
{
    /**
     * Recalculate product_cost and unit_cost from the product's active recipe.
     * Returns ['product_cost' => float, 'unit_cost' => float] or null if no active recipe.
     *
     * @return array{product_cost: float, unit_cost: float}|null
     */
    public function recalculate(Product $product): ?array
    {
        $recipe = $product->activeRecipe;

        if ($recipe === null) {
            return null;
        }

        $recipeCost = (float) ($recipe->recipe_cost ?? 0.0);
        $mfgCost = (float) ($recipe->manufacturing_cost ?? 0.0);
        $otherCosts = (float) ($recipe->other_costs ?? 0.0);
        $yieldQty = max((float) $recipe->yield_quantity, 0.0001); // guard division by zero
        $productCost = round($recipeCost + $mfgCost + $otherCosts, 4);
        $unitCost = round($productCost / $yieldQty, 4);

        $product->update([
            'product_cost' => $productCost,
            'unit_cost' => $unitCost,
        ]);

        return [
            'product_cost' => $productCost,
            'unit_cost' => $unitCost,
        ];
    }
}
