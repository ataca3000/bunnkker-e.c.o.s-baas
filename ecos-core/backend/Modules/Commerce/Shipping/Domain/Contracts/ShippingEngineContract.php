<?php

declare(strict_types=1);

namespace Modules\Commerce\Shipping\Domain\Contracts;

use Modules\Commerce\Shipping\Domain\ValueObjects\ShippingValidationResult;

/**
 * Primary entry point for the Shipping Engine.
 *
 * Implementations may use any combination of:
 *   - Brand Shipping Settings (current)
 *   - Weight-based pricing
 *   - COD surcharge
 *   - Express delivery tiers
 *   - Provider-specific pricing
 *   - Free shipping threshold
 */
interface ShippingEngineContract
{
    /**
     * Validate and quote shipping for the given brand + geography.
     *
     * Never throws. Returns a ShippingValidationResult with all context
     * the Order Engine needs to decide how to proceed.
     *
     * @param  bool  $isDeliveryOrder  Walk-in POS → false skips all validation.
     */
    public function evaluate(
        string $brandId,
        int $governorateId,
        ?int $cityId,
        bool $isDeliveryOrder,
    ): ShippingValidationResult;
}
