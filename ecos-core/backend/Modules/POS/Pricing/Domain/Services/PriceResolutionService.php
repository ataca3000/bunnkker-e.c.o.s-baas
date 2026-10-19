<?php

declare(strict_types=1);

namespace Modules\POS\Pricing\Domain\Services;

use InvalidArgumentException;
use Modules\POS\Pricing\Domain\Contracts\PricingGatewayInterface;
use Modules\POS\Pricing\Domain\Events\PriceResolved;
use Modules\POS\Pricing\Domain\Exceptions\InvalidPriceCurrencyException;
use Modules\POS\Pricing\Domain\Exceptions\PriceResolutionException;
use Modules\POS\Pricing\Domain\ValueObjects\PriceSnapshot;
use Modules\POS\Pricing\Domain\ValueObjects\ResolvedPrice;

/**
 * Orchestrates price resolution:
 *   1. Validates inputs (productId, currency)
 *   2. Delegates to the gateway (source of truth)
 *   3. Validates the result (must be positive)
 *   4. Queues a PriceResolved domain event
 *
 * POS modules must use this service rather than calling the gateway directly
 * so that validation and event emission are never bypassed.
 */
final class PriceResolutionService
{
    /** @var array<object> */
    private array $domainEvents = [];

    public function __construct(
        private readonly PricingGatewayInterface $gateway,
        private readonly PriceValidator $validator,
    ) {}

    /**
     * Resolve the price for a single product.
     *
     * @throws InvalidArgumentException on empty productId
     * @throws InvalidPriceCurrencyException on unsupported / malformed currency
     * @throws PriceResolutionException if the gateway cannot price the product
     */
    public function resolve(string $productId, string $currency): ResolvedPrice
    {
        if (trim($productId) === '') {
            throw new InvalidArgumentException('productId cannot be empty.');
        }
        $this->validator->validateCurrency($currency);

        $resolved = $this->gateway->resolvePrice($productId, $currency);
        $this->validator->validatePrice($resolved->unitPrice);

        $this->domainEvents[] = PriceResolved::now(
            productId: $resolved->productId,
            unitPrice: $resolved->unitPrice,
            source: $resolved->source,
            resolvedAt: $resolved->resolvedAt->format(DATE_ATOM),
        );

        return $resolved;
    }

    /**
     * Resolve prices for multiple products in a single gateway call.
     *
     * @param  string[]  $productIds
     * @return array<string, ResolvedPrice>
     *
     * @throws InvalidPriceCurrencyException
     * @throws PriceResolutionException
     */
    public function resolveAll(array $productIds, string $currency): array
    {
        if (empty($productIds)) {
            return [];
        }
        $this->validator->validateCurrency($currency);

        $results = $this->gateway->resolvePrices($productIds, $currency);

        foreach ($results as $resolved) {
            $this->validator->validatePrice($resolved->unitPrice);

            $this->domainEvents[] = PriceResolved::now(
                productId: $resolved->productId,
                unitPrice: $resolved->unitPrice,
                source: $resolved->source,
                resolvedAt: $resolved->resolvedAt->format(DATE_ATOM),
            );
        }

        return $results;
    }

    /**
     * Resolve and wrap as a PriceSnapshot — the immutable audit record
     * of the price presented to the customer at the moment of item capture.
     *
     * @throws InvalidPriceCurrencyException
     * @throws PriceResolutionException
     */
    public function snapshot(string $productId, string $productName, string $currency): PriceSnapshot
    {
        $resolved = $this->resolve($productId, $currency);

        return PriceSnapshot::fromResolvedPrice($resolved, $productName);
    }

    /** Pull all queued domain events and reset the queue. */
    public function pullDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];

        return $events;
    }
}
