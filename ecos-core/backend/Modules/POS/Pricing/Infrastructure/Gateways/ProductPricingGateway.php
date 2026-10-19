<?php

declare(strict_types=1);

namespace Modules\POS\Pricing\Infrastructure\Gateways;

use Modules\Inventory\Products\Domain\Models\Product;
use Modules\POS\Pricing\Domain\Contracts\PricingGatewayInterface;
use Modules\POS\Pricing\Domain\Enums\PriceSource;
use Modules\POS\Pricing\Domain\Exceptions\PriceResolutionException;
use Modules\POS\Pricing\Domain\ValueObjects\ResolvedPrice;
use Modules\POS\Shared\Domain\ValueObjects\Money;

/**
 * Adapter that bridges the POS Pricing Domain to the Inventory Product catalogue.
 *
 * Resolution rules (in priority order):
 *   1. sale_price — used when set and positive (promotional / active sale)
 *   2. regular_price — used as the standard base price
 *   3. Neither set → PriceResolutionException::noPriceSet()
 *
 * float → Money conversion: number_format(…, 2, '.', '') ensures a clean
 * 2-decimal string regardless of PHP's float-to-string representation.
 * No arithmetic is performed on the floats — they are read-only data.
 *
 * Currency is supplied by the caller (the POS terminal's configured currency).
 * Product prices in the current schema carry no explicit currency denomination;
 * the POS installation is expected to operate in a single functional currency.
 */
final class ProductPricingGateway implements PricingGatewayInterface
{
    public function resolvePrice(string $productId, string $currency): ResolvedPrice
    {
        /** @var Product|null $product */
        $product = Product::find($productId);

        if ($product === null) {
            throw PriceResolutionException::productNotFound($productId);
        }
        if (! $product->is_active) {
            throw PriceResolutionException::productInactive($productId);
        }

        return $this->toResolvedPrice($product, $currency);
    }

    public function resolvePrices(array $productIds, string $currency): array
    {
        if (empty($productIds)) {
            return [];
        }

        /** @var \Illuminate\Database\Eloquent\Collection<int, Product> $products */
        $products = Product::whereIn('id', $productIds)->get()->keyBy('id');
        $resolved = [];

        foreach ($productIds as $productId) {
            /** @var Product|null $product */
            $product = $products->get($productId);

            if ($product === null) {
                throw PriceResolutionException::productNotFound($productId);
            }
            if (! $product->is_active) {
                throw PriceResolutionException::productInactive($productId);
            }

            $resolved[$productId] = $this->toResolvedPrice($product, $currency);
        }

        return $resolved;
    }

    private function toResolvedPrice(Product $product, string $currency): ResolvedPrice
    {
        $salePrice = $product->sale_price;
        $regularPrice = $product->regular_price;

        if ($salePrice !== null && $salePrice > 0) {
            return ResolvedPrice::of(
                productId: (string) $product->id,
                unitPrice: Money::of(number_format($salePrice, 2, '.', ''), $currency),
                source: PriceSource::SalePrice,
            );
        }

        if ($regularPrice !== null && $regularPrice > 0) {
            return ResolvedPrice::of(
                productId: (string) $product->id,
                unitPrice: Money::of(number_format($regularPrice, 2, '.', ''), $currency),
                source: PriceSource::RegularPrice,
            );
        }

        throw PriceResolutionException::noPriceSet((string) $product->id);
    }
}
