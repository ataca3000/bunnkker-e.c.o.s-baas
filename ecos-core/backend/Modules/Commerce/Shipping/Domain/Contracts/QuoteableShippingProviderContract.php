<?php

declare(strict_types=1);

namespace Modules\Commerce\Shipping\Domain\Contracts;

/**
 * Future interface for provider-specific shipping quotes.
 *
 * Intended extension points (not yet implemented):
 *   - Weight-based pricing (price per kg above threshold)
 *   - COD surcharge (flat or percentage on top of base price)
 *   - Express delivery tier (premium pricing for same-day)
 *   - Brand-specific negotiated rates per provider
 *   - Provider-specific area coverage verification
 *
 * When a provider implements this, it registers itself via the
 * ProviderRegistry (to be built in Phase 2 of Logistics OS).
 */
interface QuoteableShippingProviderContract
{
    /**
     * Return the provider's identifier (e.g. 'bosta', 'mylerz', 'aramex').
     */
    public function getProviderId(): string;

    /**
     * Quote a shipping price for the given area.
     *
     * Returns null if the provider does not cover this area
     * or cannot provide a quote (fall back to next provider).
     */
    public function quotePrice(int $governorateId, ?int $cityId): ?float;

    /**
     * Return estimated delivery days for this area, or null if unknown.
     */
    public function estimateDeliveryDays(int $governorateId, ?int $cityId): ?int;

    /**
     * Whether this provider supports same-day delivery to this area.
     */
    public function supportsSameDay(int $governorateId, ?int $cityId): bool;

    /**
     * Whether this provider accepts COD for this area.
     */
    public function supportsCod(int $governorateId, ?int $cityId): bool;
}
