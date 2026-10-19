<?php

declare(strict_types=1);

namespace Modules\POS\Pricing\Domain\Contracts;

use Modules\POS\Pricing\Domain\Exceptions\PriceResolutionException;
use Modules\POS\Pricing\Domain\ValueObjects\ResolvedPrice;

/**
 * Boundary between the POS and the pricing source of truth.
 *
 * Concrete implementations may read from the Product catalogue, an external
 * pricing service, or any other authoritative source — the domain never knows.
 */
interface PricingGatewayInterface
{
    /**
     * Resolve the current unit price for a single product.
     *
     * @throws PriceResolutionException if the product cannot be found or has no price
     */
    public function resolvePrice(string $productId, string $currency): ResolvedPrice;

    /**
     * Resolve prices for multiple products in a single call.
     *
     * @param  string[]  $productIds
     * @return array<string, ResolvedPrice> keyed by productId, same order as input
     *
     * @throws PriceResolutionException if any product cannot be priced
     */
    public function resolvePrices(array $productIds, string $currency): array;
}
