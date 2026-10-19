<?php

declare(strict_types=1);

namespace Modules\CostManagement\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\CostManagement\Domain\Models\MaterialCostHistory;

/**
 * @mixin MaterialCostHistory
 */
class MaterialCostHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var MaterialCostHistory $this */
        $product = $this->product;

        return [
            'id' => $this->id,
            'product' => [
                'id' => $product?->id,
                'name' => $product?->name,
                'sku' => $product?->sku,
            ],
            'previous_cost' => $this->previous_cost,
            'new_cost' => $this->new_cost,
            'difference' => $this->difference,
            'change_pct' => $this->change_pct,
            'source' => $this->source?->value ?? $this->source,
            'goods_receipt_id' => $this->goods_receipt_id,
            'updated_by' => $this->updated_by,
            'reason' => $this->reason,
            'affected_recipe_count' => count((array) ($this->affected_recipe_ids ?? [])),
            'affected_product_count' => count((array) ($this->affected_product_ids ?? [])),
            'affected_recipe_ids' => $this->affected_recipe_ids ?? [],
            'affected_product_ids' => $this->affected_product_ids ?? [],
            'occurred_at' => $this->occurred_at?->toIso8601String(),
        ];
    }
}
