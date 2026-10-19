<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use Modules\CostManagement\Domain\Enums\PricingReviewStatus;
use Modules\CostManagement\Domain\Models\PricingReview;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Returns the current approved selling price for a product plus a flag
 * indicating whether a pricing review is pending for this company.
 *
 * Price resolution mirrors ProductPricingGateway (the POS source of truth):
 *   1. sale_price  — used when set and > 0
 *   2. regular_price — otherwise
 *   3. null        — neither set (product has not been priced)
 *
 * The action is intentionally currency-agnostic: it returns raw float values
 * so the Orders module does not need to couple to the POS currency system.
 */
final class ResolveProductPricingAction
{
    /**
     * @return array{
     *   product_id: string,
     *   regular_price: float|null,
     *   sale_price: float|null,
     *   resolved_price: float|null,
     *   source: string|null,
     *   has_pending_review: bool,
     * }
     */
    public function execute(string $productId, ?string $companyId): array
    {
        /** @var Product $product */
        $product = Product::findOrFail($productId);

        $regularPrice = $product->regular_price !== null ? (float) $product->regular_price : null;
        $salePrice = $product->sale_price !== null ? (float) $product->sale_price : null;

        // Mirror ProductPricingGateway priority: sale_price → regular_price
        if ($salePrice !== null && $salePrice > 0.0) {
            $resolvedPrice = $salePrice;
            $source = 'sale_price';
        } elseif ($regularPrice !== null && $regularPrice > 0.0) {
            $resolvedPrice = $regularPrice;
            $source = 'regular_price';
        } else {
            $resolvedPrice = null;
            $source = null;
        }

        $hasPendingReview = $companyId !== null && PricingReview::where('product_id', $productId)
            ->where('company_id', $companyId)
            ->where('status', PricingReviewStatus::Pending->value)
            ->exists();

        return [
            'product_id' => $productId,
            'regular_price' => $regularPrice,
            'sale_price' => $salePrice,
            'resolved_price' => $resolvedPrice,
            'approved_price' => $resolvedPrice, // alias consumed by the manual-order form
            'source' => $source,
            'has_pending_review' => $hasPendingReview,
        ];
    }
}
