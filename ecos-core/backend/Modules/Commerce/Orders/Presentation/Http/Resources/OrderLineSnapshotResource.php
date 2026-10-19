<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class OrderLineSnapshotResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            // Identity
            'id' => $this->id,
            'order_line_id' => $this->order_line_id,
            'product_id' => $this->product_id,
            'product_sku' => $this->product_sku,
            'product_name' => $this->product_name,

            // Sale quantities & prices
            'quantity' => $this->quantity,
            'unit_price_at_sale' => $this->unit_price_at_sale,
            'regular_price_at_sale' => $this->regular_price_at_sale,
            'sale_price_at_sale' => $this->sale_price_at_sale,
            'line_total' => $this->line_total,

            // Cost breakdown
            'raw_material_cost' => $this->raw_material_cost,
            'packaging_cost' => $this->packaging_cost,
            'manufacturing_cost' => $this->manufacturing_cost,
            'other_cost' => $this->other_cost,
            'recipe_cost' => $this->recipe_cost,
            'unit_cost' => $this->unit_cost,
            'line_cost' => $this->line_cost,

            // Margin (PART 7)
            'gross_profit' => $this->gross_profit,
            'margin_percent' => $this->margin_percent,
            'target_margin_percent' => $this->target_margin_percent,
            'margin_status' => $this->margin_status,

            // Recipe provenance (PART 4)
            'bom_id' => $this->bom_id,
            'bom_version_number' => $this->bom_version_number,
            'source_recipe_version' => $this->source_recipe_version,

            // Price review provenance (PART 8)
            'price_review_id' => $this->price_review_id,
            'price_review_approved_at' => $this->price_review_approved_at?->toIso8601String(),
            'price_review_approved_by' => $this->price_review_approved_by,

            // Raw cost data for accounting
            'cost_snapshot' => $this->cost_snapshot,
        ];
    }
}
