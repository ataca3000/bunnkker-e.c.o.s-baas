<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modules\CostManagement\Application\Services\CostCalculationEngine;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterialLine;
use Throwable;

/**
 * Orchestrates the full cost cascade chain:
 *
 *   Material Cost → Recipe Cost (materials only) → Product Cost → Unit Cost
 *
 * Uses CostCalculationEngine as the single cost engine (TASK-RECIPE-COST-CONSISTENCY-001).
 */
final class CostCascadeService
{
    public function __construct(
        private readonly CostCalculationEngine $costEngine,
        private readonly ProductCostCalculator $productCostCalculator,
    ) {}

    /**
     * Run the cascade for one material product.
     *
     * @return array{
     *   affected_recipe_ids:  list<string>,
     *   affected_product_ids: list<string>,
     *   affected_products:    list<array{product: Product, previous_cost: float, new_cost: float}>,
     * }
     */
    public function cascadeFromMaterial(Product $material): array
    {
        $affectedRecipeIds = [];
        $affectedProductIds = [];
        $affectedProducts = [];

        DB::transaction(function () use ($material, &$affectedRecipeIds, &$affectedProductIds, &$affectedProducts): void {
            $bomIds = BillOfMaterialLine::query()
                ->where('raw_material_id', $material->id)
                ->pluck('bom_id')
                ->unique()
                ->values()
                ->all();

            if (empty($bomIds)) {
                return;
            }

            $boms = BillOfMaterial::query()
                ->whereIn('id', $bomIds)
                ->where('is_active', true)
                ->with(['lines.rawMaterial', 'product.activeRecipe'])
                ->get();

            $processedProductIds = [];

            foreach ($boms as $bom) {
                /** @var BillOfMaterial $bom */
                try {
                    $this->costEngine->calculateAndPersist(
                        $bom,
                        triggerType: 'material_cost_update',
                        triggerSource: $material->sku ?? $material->id,
                    );
                    $affectedRecipeIds[] = $bom->id;

                    $product = $bom->product;
                    if ($product !== null && ! in_array($product->id, $processedProductIds, true)) {
                        $previousCost = (float) ($product->product_cost ?? 0.0);

                        $result = $this->productCostCalculator->recalculate($product);
                        $newCost = $result !== null ? $result['product_cost'] : $previousCost;

                        $affectedProductIds[] = $product->id;
                        $processedProductIds[] = $product->id;
                        $affectedProducts[] = [
                            'product' => $product,
                            'previous_cost' => $previousCost,
                            'new_cost' => $newCost,
                        ];
                    }
                } catch (Throwable $e) {
                    Log::channel('daily')->error(
                        'CostCascadeService: failed to cascade bom',
                        [
                            'bom_id' => $bom->id,
                            'material_id' => $material->id,
                            'error' => $e->getMessage(),
                        ],
                    );
                }
            }
        });

        return [
            'affected_recipe_ids' => array_values(array_unique($affectedRecipeIds)),
            'affected_product_ids' => array_values(array_unique($affectedProductIds)),
            'affected_products' => $affectedProducts,
        ];
    }
}
