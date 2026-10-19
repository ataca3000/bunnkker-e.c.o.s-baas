<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterialLine;

/**
 * @mixin BillOfMaterial
 */
final class BomResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'bom_number' => $this->bom_number,
            'product_id' => $this->product_id,
            'product' => $this->whenLoaded('product', fn (): array => [
                'id' => $this->product->id,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
                'image_url' => $this->product->image_url,
                'category' => $this->product->relationLoaded('category') && $this->product->category !== null
                    ? ['id' => $this->product->category->id, 'name' => $this->product->category->name]
                    : null,
                'channels' => $this->product->relationLoaded('channelMappings')
                    ? $this->product->channelMappings
                        ->filter(fn ($m) => $m->channel !== null)
                        ->map(fn ($m) => [
                            'id' => $m->channel->id,
                            'name' => $m->channel->name,
                            'company_id' => $m->channel->brand?->company_id,
                            'company_name' => $m->channel->brand?->company?->name,
                        ])
                        ->values()
                        ->all()
                    : [],
            ]),
            'lines_count' => (int) ($this->lines_count ?? 0),
            // recipe_cost = rawMaterialCost + packagingCost (MATERIALS ONLY per TASK-RECIPE-COST-CONSISTENCY-001)
            'recipe_cost' => (float) ($this->recipe_cost ?? 0),
            'packaging_cost' => (float) ($this->packaging_cost ?? 0),
            'cost_summary' => $this->cost_summary ?? null,
            'cost_pending' => (bool) ($this->cost_pending ?? false),
            'recipe_cost_updated_at' => $this->recipe_cost_updated_at?->toIso8601String(),
            'total_waste_pct' => round((float) ($this->total_waste_pct ?? 0), 2),
            'version' => $this->version,
            'bom_version_number' => $this->bom_version_number,
            'is_active' => (bool) $this->is_active,
            'notes' => $this->notes,
            'yield_quantity' => (float) ($this->yield_quantity ?? 1),
            'manufacturing_cost' => (float) ($this->manufacturing_cost ?? 0),
            'other_costs' => (float) ($this->other_costs ?? 0),
            'execution_instructions' => $this->execution_instructions,
            'lines' => $this->whenLoaded('lines', fn (): array => $this->lines->map(
                fn (BillOfMaterialLine $line): array => $this->buildLineArray($line),
            )->all()),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    private function buildLineArray(BillOfMaterialLine $line): array
    {
        $material = $line->relationLoaded('rawMaterial') ? $line->rawMaterial : null;
        $hasCost = $material !== null && $material->material_cost !== null;
        $unitCost = $hasCost ? (float) $material->material_cost : null;
        $qty = (float) $line->quantity;
        $waste = (float) ($line->waste_percentage ?? 0.0);
        $effectiveQty = round($qty * (1.0 + $waste / 100.0), 4);
        $lineTotal = ($hasCost && $unitCost !== null) ? round($effectiveQty * $unitCost, 4) : null;

        return [
            'id' => $line->id,
            'raw_material_id' => $line->raw_material_id,
            'raw_material' => $material !== null ? [
                'id' => $material->id,
                'sku' => $material->sku,
                'name' => $material->name,
                'product_type' => $material->product_type,
                'image_url' => $material->image_url,
                'material_cost' => $hasCost ? (float) $material->material_cost : null,
                'current_fifo_cost' => $material->current_fifo_cost !== null ? (float) $material->current_fifo_cost : null,
                'average_cost' => $material->average_cost !== null ? (float) $material->average_cost : null,
                'last_purchase_cost' => $material->last_purchase_cost !== null ? (float) $material->last_purchase_cost : null,
                'unit' => $material->relationLoaded('unit') && $material->unit !== null ? [
                    'id' => $material->unit->id,
                    'name' => $material->unit->name,
                    'symbol' => $material->unit->symbol,
                ] : null,
            ] : null,
            'quantity' => $qty,
            'waste_percentage' => $waste,
            // Engine-computed per-line fields (PART 3)
            'unit_cost' => $unitCost,
            'effective_qty' => $effectiveQty,
            'line_total' => $lineTotal,
            'cost_source' => $this->resolveCostSource($material),
            'cost_status' => $hasCost ? 'available' : 'missing',
        ];
    }

    /**
     * Determine what cost source was used for a material's material_cost.
     * Compares material_cost against FIFO/average/last_purchase to infer origin.
     */
    private function resolveCostSource(?Product $material): string
    {
        if ($material === null || $material->material_cost === null) {
            return 'missing';
        }

        $matCost = (float) $material->material_cost;

        $fifo = $material->current_fifo_cost !== null ? (float) $material->current_fifo_cost : null;
        $avg = $material->average_cost !== null ? (float) $material->average_cost : null;
        $last = $material->last_purchase_cost !== null ? (float) $material->last_purchase_cost : null;

        if ($fifo !== null && abs($fifo - $matCost) < 0.001) {
            return 'fifo';
        }
        if ($avg !== null && abs($avg - $matCost) < 0.001) {
            return 'average';
        }
        if ($last !== null && abs($last - $matCost) < 0.001) {
            return 'last_purchase';
        }

        return 'manual';
    }
}
