<?php

declare(strict_types=1);

namespace Modules\Commerce\Shipping\Domain\Services;

use Modules\Logistics\Geography\Domain\Models\City;
use Modules\Logistics\Geography\Domain\Models\Governorate;
use Modules\Organization\Brands\Domain\Models\BrandCitySetting;
use Modules\Organization\Brands\Domain\Models\BrandGovernorateSettings;
use Modules\Organization\Brands\Domain\Models\BrandShippingSettings;

/**
 * Pure calculation engine — no validation, no exceptions, no side effects.
 *
 * Price cascade:
 *   Brand City Price → Brand Governorate Price → Governorate Default Price
 *
 * Geography tables are NEVER queried directly from Orders.
 * All calculations go through this service.
 */
final class ShippingQuoteService
{
    /**
     * Calculate the effective shipping price.
     *
     * Priority (highest first):
     *   1. brand_city_settings.shipping_price (if city_id provided)
     *   2. brand_governorate_settings.shipping_price
     *   3. logistics_governorates.default_shipping_price
     */
    public function calculatePrice(string $brandId, int $governorateId, ?int $cityId): float
    {
        if ($cityId !== null) {
            $price = BrandCitySetting::where('brand_id', $brandId)
                ->where('city_id', $cityId)
                ->value('shipping_price');
            if ($price !== null) {
                return (float) $price;
            }
        }

        $govPrice = BrandGovernorateSettings::where('brand_id', $brandId)
            ->where('governorate_id', $governorateId)
            ->value('shipping_price');
        if ($govPrice !== null) {
            return (float) $govPrice;
        }

        $defaultPrice = Governorate::where('id', $governorateId)->value('default_shipping_price');

        return $defaultPrice !== null ? (float) $defaultPrice : 0.0;
    }

    /**
     * Resolve estimated delivery days.
     *
     * Priority: brand_governorate_settings.estimated_delivery_days → null
     */
    public function estimateDeliveryDays(string $brandId, int $governorateId): ?int
    {
        return BrandGovernorateSettings::where('brand_id', $brandId)
            ->where('governorate_id', $governorateId)
            ->value('estimated_delivery_days');
    }

    /**
     * Whether same-day delivery is supported.
     *
     * Source: brand_governorate_settings.same_day_supported (default false)
     */
    public function isSameDaySupported(string $brandId, int $governorateId): bool
    {
        return (bool) BrandGovernorateSettings::where('brand_id', $brandId)
            ->where('governorate_id', $governorateId)
            ->value('same_day_supported');
    }

    /**
     * Whether COD is available for this city.
     *
     * Priority: brand_city_settings.supports_cod → brand_shipping_settings.default_cod_enabled → true
     */
    public function isCodAllowed(string $brandId, ?int $cityId): bool
    {
        if ($cityId !== null) {
            $cityCod = BrandCitySetting::where('brand_id', $brandId)
                ->where('city_id', $cityId)
                ->value('supports_cod');
            if ($cityCod !== null) {
                return (bool) $cityCod;
            }
        }

        $default = BrandShippingSettings::where('brand_id', $brandId)->value('default_cod_enabled');

        return $default !== null ? (bool) $default : true;
    }

    /**
     * Resolve the preferred shipping provider for this governorate.
     *
     * Priority: brand_governorate_settings.preferred_provider → brand_shipping_settings.default_shipping_provider → null
     */
    public function resolvePreferredProvider(string $brandId, int $governorateId): ?string
    {
        $govProvider = BrandGovernorateSettings::where('brand_id', $brandId)
            ->where('governorate_id', $governorateId)
            ->value('preferred_provider');
        if ($govProvider !== null) {
            return $govProvider;
        }

        return BrandShippingSettings::where('brand_id', $brandId)->value('default_shipping_provider');
    }

    /**
     * Check whether the free-shipping threshold is met.
     *
     * @param  float  $orderSubtotal  The order's item subtotal (before shipping)
     */
    public function isFreeShippingEligible(string $brandId, float $orderSubtotal): bool
    {
        $threshold = BrandShippingSettings::where('brand_id', $brandId)
            ->value('default_free_shipping_threshold');

        if ($threshold === null) {
            return false;
        }

        return $orderSubtotal >= (float) $threshold;
    }

    /**
     * Full quote for a brand + geography combination.
     *
     * @return array{
     *   price: float,
     *   delivery_days: int|null,
     *   same_day: bool,
     *   cod_allowed: bool,
     *   preferred_provider: string|null
     * }
     */
    public function quote(string $brandId, int $governorateId, ?int $cityId): array
    {
        return [
            'price' => $this->calculatePrice($brandId, $governorateId, $cityId),
            'delivery_days' => $this->estimateDeliveryDays($brandId, $governorateId),
            'same_day' => $this->isSameDaySupported($brandId, $governorateId),
            'cod_allowed' => $this->isCodAllowed($brandId, $cityId),
            'preferred_provider' => $this->resolvePreferredProvider($brandId, $governorateId),
        ];
    }
}
