<?php

declare(strict_types=1);

namespace Modules\CostManagement\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\CostManagement\Domain\Models\PricingReview;

/**
 * @mixin PricingReview
 */
class PricingReviewResource extends JsonResource
{
    /** Markup % derived from target margin: markup = margin / (100 - margin) * 100 */
    private function derivedMarkup(float $targetMargin): float
    {
        return $targetMargin < 100
            ? round($targetMargin / (100 - $targetMargin) * 100, 4)
            : 0.0;
    }

    /** Suggested sale price = suggested_regular × (1 − discount_pct / 100) */
    private function suggestedSalePrice(float $suggestedRegular, float $discountPct): float
    {
        return round($suggestedRegular * (1 - $discountPct / 100), 4);
    }

    /** Gross profit % on selling price */
    private function grossProfitPct(float $cost, float $price): ?float
    {
        if ($price <= 0.0) {
            return null;
        }

        return round(($price - $cost) / $price * 100, 2);
    }

    /** Final margin % — uses sale_price if > 0, otherwise selling_price */
    private function finalMarginPct(float $cost, float $sellingPrice, ?float $salePrice): ?float
    {
        $effectivePrice = ($salePrice !== null && $salePrice > 0.0) ? $salePrice : $sellingPrice;
        if ($effectivePrice <= 0.0) {
            return null;
        }

        return round(($effectivePrice - $cost) / $effectivePrice * 100, 2);
    }

    public function toArray(Request $request): array
    {
        /** @var PricingReview $this */
        $product = $this->product;
        $brand = $product?->relationLoaded('brand') ? $product->brand : null;
        $unit = $product?->unit;
        $salePrice = $product?->sale_price;

        $cost = $this->product_cost;
        $targetMargin = $this->target_margin;
        $markup = $this->derivedMarkup($targetMargin);
        $discountPct = $product?->effectiveDiscountPct() ?? 0.0;

        return [
            'id' => $this->id,
            'product' => [
                'id' => $product?->id,
                'name' => $product?->name,
                'sku' => $product?->sku,
                'image_url' => $product?->image_url,
                'unit' => $unit?->symbol ?? $unit?->name,
                'pricing_mode' => $product?->pricing_mode ?? 'brand_policy',
                'custom_target_margin' => $product?->custom_target_margin,
                'custom_markup' => $product?->custom_markup,
                'custom_discount_pct' => $product?->custom_discount_pct,
            ],
            'brand' => $brand !== null ? [
                'id' => $brand->id,
                'name' => $brand->name,
                'default_target_margin' => $brand->default_target_margin,
                'default_markup' => $brand->default_markup,
                'default_discount_pct' => $brand->default_discount_pct,
            ] : null,
            'company' => [
                'id' => $this->company_id,
                'name' => $this->whenLoaded('company', fn () => $this->company?->name),
            ],
            'channel' => [
                'id' => $this->channel_id ?? 'all',
                'name' => $this->channel_id ? 'Channel' : 'All Channels',
            ],

            // Official pricing dictionary
            'product_cost' => $cost,
            'previous_product_cost' => $this->previous_product_cost,
            'cost_difference' => $this->cost_difference,
            'cost_change_pct' => $this->previous_product_cost > 0
                ? round(($this->cost_difference / $this->previous_product_cost) * 100, 2)
                : null,
            'selling_price' => $this->selling_price,
            'sale_price' => $salePrice,
            'suggested_selling_price' => $this->suggested_selling_price,
            'suggested_sale_price' => $this->suggested_sale_price
                ?? $this->suggestedSalePrice($this->suggested_selling_price, $discountPct),
            'discount_pct' => $discountPct,
            'target_margin' => $targetMargin,
            'markup' => $markup,
            'current_margin' => $this->current_margin,
            'gross_profit_pct' => $this->grossProfitPct($cost, $this->selling_price),
            'final_margin_pct' => $this->finalMarginPct($cost, $this->selling_price, $salePrice),

            'impacts' => $this->impacts ?? [],
            'status' => $this->status->value,
            'reviewer' => $this->reviewer_name
                ? ['id' => null, 'name' => $this->reviewer_name]
                : null,
            'snooze_until' => $this->snooze_until?->toDateString(),
            'notes' => $this->notes,
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
        ];
    }
}
