<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Domain\Services;

use Modules\Logistics\Geography\Domain\Models\City;
use Modules\Logistics\Geography\Domain\Models\Governorate;
use Modules\Organization\Brands\Domain\Models\BrandCitySetting;
use Modules\Organization\Brands\Domain\Models\BrandGovernorateSettings;
use Modules\Organization\Brands\Domain\Models\BrandShippingSettings;

final class BrandShippingService
{
    /**
     * Retrieve or lazily create the brand-level shipping settings row.
     */
    public function getOrCreateSettings(string $brandId): BrandShippingSettings
    {
        return BrandShippingSettings::firstOrCreate(
            ['brand_id' => $brandId],
            [
                'unsupported_governorate_action' => 'allow',
                'unsupported_city_action' => 'allow',
                'default_cod_enabled' => true,
                'default_free_shipping_threshold' => null,
                'default_shipping_provider' => null,
            ],
        );
    }

    /**
     * Calculate the effective shipping price for a brand + geography combination.
     *
     * Priority chain:
     *   Brand City Price → Brand Governorate Price → Governorate Default Price
     */
    public function calculateShippingPrice(string $brandId, int $governorateId, ?int $cityId): float
    {
        // Brand-level city override
        if ($cityId !== null) {
            $citySetting = BrandCitySetting::where('brand_id', $brandId)
                ->where('city_id', $cityId)
                ->first();
            if ($citySetting?->shipping_price !== null) {
                return (float) $citySetting->shipping_price;
            }
        }

        // Brand-level governorate override
        $govSetting = BrandGovernorateSettings::where('brand_id', $brandId)
            ->where('governorate_id', $governorateId)
            ->first();
        if ($govSetting?->shipping_price !== null) {
            return (float) $govSetting->shipping_price;
        }

        // Reference data fallback
        $gov = Governorate::find($governorateId);

        return $gov ? (float) $gov->default_shipping_price : 0.0;
    }

    /**
     * Validate whether this brand can ship to the specified area.
     *
     * Returns an array with:
     *   allowed  bool   — whether to proceed
     *   action   string — 'allow' | 'pending_review' | 'reject'
     *   reason   string — human-readable explanation
     */
    public function validateShippingArea(string $brandId, int $governorateId, ?int $cityId): array
    {
        $settings = $this->getOrCreateSettings($brandId);

        // Governorate check
        $govSetting = BrandGovernorateSettings::where('brand_id', $brandId)
            ->where('governorate_id', $governorateId)
            ->first();

        if ($govSetting !== null && ! $govSetting->is_enabled) {
            $action = $settings->unsupported_governorate_action;

            return [
                'allowed' => $action === 'allow',
                'action' => $action,
                'reason' => 'Governorate is disabled for this brand.',
            ];
        }

        // Reference governorate check (if Geography itself marks it inactive)
        $gov = Governorate::find($governorateId);
        if ($gov && ! $gov->is_active) {
            $action = $settings->unsupported_governorate_action;

            return [
                'allowed' => $action === 'allow',
                'action' => $action,
                'reason' => 'Governorate is inactive in the system.',
            ];
        }

        // City check
        if ($cityId !== null) {
            $citySetting = BrandCitySetting::where('brand_id', $brandId)
                ->where('city_id', $cityId)
                ->first();

            if ($citySetting !== null && $citySetting->is_enabled === false) {
                $action = $settings->unsupported_city_action;

                return [
                    'allowed' => $action === 'allow',
                    'action' => $action,
                    'reason' => 'City is disabled for this brand.',
                ];
            }

            $city = City::find($cityId);
            if ($city && ! $city->is_active) {
                $action = $settings->unsupported_city_action;

                return [
                    'allowed' => $action === 'allow',
                    'action' => $action,
                    'reason' => 'City is inactive in the system.',
                ];
            }
        }

        return ['allowed' => true, 'action' => 'allow', 'reason' => ''];
    }

    /**
     * Resolve governorate settings for a brand, creating a default row if absent.
     */
    public function getOrCreateGovernorateSettings(string $brandId, int $governorateId): BrandGovernorateSettings
    {
        return BrandGovernorateSettings::firstOrCreate(
            ['brand_id' => $brandId, 'governorate_id' => $governorateId],
            [
                'is_enabled' => true,
                'shipping_price' => null,
                'estimated_delivery_days' => null,
                'same_day_supported' => false,
                'display_order' => 0,
            ],
        );
    }
}
