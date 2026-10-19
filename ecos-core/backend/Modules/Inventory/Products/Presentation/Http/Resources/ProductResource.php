<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * @mixin Product
 */
final class ProductResource extends JsonResource
{
    /**
     * The canonical cost for this product used for all margin calculations.
     *   Finished goods: product_cost (recipe-based) → material_cost → last_purchase_cost
     *   Materials:      material_cost → last_purchase_cost → product_cost
     */
    private function computeEffectiveCost(): ?float
    {
        if ($this->product_type === Product::TYPE_FINISHED_GOOD) {
            return $this->product_cost ?? $this->material_cost ?? $this->last_purchase_cost ?? null;
        }

        return $this->material_cost ?? $this->last_purchase_cost ?? $this->product_cost ?? null;
    }

    /** Markup % = (regular_price − cost) / cost × 100 */
    private function computeMarkupPct(): ?float
    {
        $cost = $this->computeEffectiveCost();
        if ($cost === null || $cost <= 0.0 || $this->regular_price === null) {
            return null;
        }

        return round(($this->regular_price - $cost) / $cost * 100, 1);
    }

    /** Gross Profit % = (regular_price − cost) / regular_price × 100 */
    private function computeGrossProfitPct(): ?float
    {
        $cost = $this->computeEffectiveCost();
        if ($cost === null || $this->regular_price === null || $this->regular_price <= 0.0) {
            return null;
        }

        return round(($this->regular_price - $cost) / $this->regular_price * 100, 1);
    }

    /** Final Margin % — uses sale_price when set and > 0, otherwise regular_price */
    private function computeFinalMarginPct(): ?float
    {
        $cost = $this->computeEffectiveCost();
        $price = ($this->sale_price !== null && $this->sale_price > 0.0)
            ? $this->sale_price
            : $this->regular_price;

        if ($cost === null || $price === null || $price <= 0.0) {
            return null;
        }

        return round(($price - $cost) / $price * 100, 1);
    }

    /**
     * Convert the stored image_url to a renderable URL.
     * - Full http(s) URL → returned as-is (remote images, CDN)
     * - Relative storage path → converted via Storage::url()
     * - Legacy data: URI (base64) → discarded, returns null
     */
    private function resolveImageUrl(): ?string
    {
        $raw = $this->image_url;
        if ($raw === null || $raw === '') {
            return null;
        }
        if (str_starts_with($raw, 'http://') || str_starts_with($raw, 'https://')) {
            return $raw;
        }
        if (str_starts_with($raw, 'data:')) {
            return null;
        }

        return Storage::disk('public')->url($raw);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'brand_id' => $this->brand_id,
            'brand' => $this->whenLoaded('brand', fn (): array => [
                'id' => $this->brand->id,
                'code' => $this->brand->code,
                'name' => $this->brand->name,
                'company_id' => $this->brand->company_id,
                'default_target_margin' => $this->brand->default_target_margin,
                'default_markup' => $this->brand->default_markup,
                'default_discount_pct' => $this->brand->default_discount_pct,
                'company' => $this->brand->relationLoaded('company') && $this->brand->company !== null
                    ? ['id' => $this->brand->company->id, 'name' => $this->brand->company->name]
                    : null,
            ]),
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'description' => $this->description,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', fn (): array => [
                'id' => $this->category->id,
                'code' => $this->category->code,
                'name' => $this->category->name,
            ]),
            'unit_id' => $this->unit_id,
            'unit' => $this->whenLoaded('unit', fn (): array => [
                'id' => $this->unit->id,
                'code' => $this->unit->code,
                'name' => $this->unit->name,
                'symbol' => $this->unit->symbol,
            ]),
            'product_type' => $this->product_type,
            'is_active' => (bool) $this->is_active,
            'image_url' => $this->resolveImageUrl(),
            'regular_price' => $this->regular_price,
            'sale_price' => $this->sale_price,
            'pricing_mode' => $this->pricing_mode ?? 'brand_policy',
            'custom_target_margin' => $this->custom_target_margin,
            'custom_markup' => $this->custom_markup,
            'custom_discount_pct' => $this->custom_discount_pct,
            'short_description' => $this->short_description,
            'long_description' => $this->long_description,
            'stock_status' => $this->stock_status?->value,
            'material_cost' => $this->material_cost,
            'last_purchase_cost' => $this->last_purchase_cost,
            'average_cost' => $this->average_cost,
            'current_fifo_cost' => $this->current_fifo_cost,
            'last_purchase_date' => $this->last_purchase_date?->toDateString(),
            'last_supplier_id' => $this->last_supplier_id,
            'cost_source' => $this->cost_source?->value,
            'product_cost' => $this->product_cost,
            'effective_cost' => $this->computeEffectiveCost(),
            'markup_pct' => $this->computeMarkupPct(),
            'gross_profit_pct' => $this->computeGrossProfitPct(),
            'final_margin_pct' => $this->computeFinalMarginPct(),
            'can_manufacture' => (bool) $this->can_manufacture,
            'can_disassemble' => (bool) $this->can_disassemble,
            'allow_negative_stock' => (bool) $this->allow_negative_stock,
            'on_hand_qty' => isset($this->on_hand_qty) ? (float) $this->on_hand_qty : null,
            'reserved_qty' => isset($this->reserved_qty) ? (float) $this->reserved_qty : null,
            'available_qty' => isset($this->agg_available_qty) ? (float) $this->agg_available_qty : null,
            'inventory_value' => isset($this->inventory_value) ? (float) $this->inventory_value : null,
            'has_recipe' => $this->relationLoaded('activeRecipe') ? ($this->activeRecipe !== null) : ($this->has_recipe ?? null),
            'pending_review' => isset($this->has_pending_review) ? (bool) $this->has_pending_review : null,
            'manufacturing_availability' => $this->product_type === Product::TYPE_FINISHED_GOOD
                ? ($this->manufacturing_availability ?? null)
                : null,
            'blocking_materials' => $this->product_type === Product::TYPE_FINISHED_GOOD
                ? ($this->blocking_materials ?? null)
                : null,
            'recipe_components' => $this->product_type === Product::TYPE_FINISHED_GOOD
                ? ($this->recipe_components ?? null)
                : null,
            'active_recipe' => $this->whenLoaded('activeRecipe', function (): ?array {
                $recipe = $this->activeRecipe;
                if ($recipe === null) {
                    return null;
                }

                return [
                    'id' => $recipe->id,
                    'bom_number' => $recipe->bom_number,
                    'version' => $recipe->version,
                    'recipe_cost' => $recipe->recipe_cost,
                    'manufacturing_cost' => $recipe->manufacturing_cost,
                    'other_costs' => $recipe->other_costs,
                    'yield_quantity' => $recipe->yield_quantity,
                    'component_count' => $recipe->relationLoaded('components')
                        ? $recipe->components->count()
                        : 0,
                    'notes' => $recipe->notes,
                    'updated_at' => $recipe->updated_at?->toIso8601String(),
                ];
            }),
            'channels' => $this->whenLoaded('channelMappings', function (): array {
                return $this->channelMappings
                    ->filter(fn ($m) => $m->channel !== null)
                    ->map(fn ($m): array => [
                        'id' => $m->channel->id,
                        'name' => $m->channel->name,
                        'platform' => $m->channel->platform?->value ?? 'woocommerce',
                        'company_id' => $m->channel->brand?->company_id,
                        'company_name' => $m->channel->brand?->company?->name,
                        'is_synced' => $m->sync_status?->value === 'synced',
                        'last_synced_at' => $m->last_sync_at?->toIso8601String(),
                    ])
                    ->values()
                    ->toArray();
            }),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
