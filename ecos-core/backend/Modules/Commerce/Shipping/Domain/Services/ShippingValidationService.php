<?php

declare(strict_types=1);

namespace Modules\Commerce\Shipping\Domain\Services;

use Modules\Commerce\Shipping\Domain\Contracts\ShippingEngineContract;
use Modules\Commerce\Shipping\Domain\ValueObjects\ShippingValidationResult;
use Modules\Logistics\Geography\Domain\Models\City;
use Modules\Logistics\Geography\Domain\Models\Governorate;
use Modules\Organization\Brands\Domain\Models\BrandCitySetting;
use Modules\Organization\Brands\Domain\Models\BrandGovernorateSettings;
use Modules\Organization\Brands\Domain\Models\BrandShippingSettings;

/**
 * Primary implementation of ShippingEngineContract.
 *
 * Pure validation — never throws, never creates orders.
 * Returns an immutable ShippingValidationResult with all context
 * the Order Engine needs to make its decision.
 *
 * Validation order:
 *   1. Walk-in check (bypass all validation for non-delivery orders)
 *   2. Governorate enabled (brand_governorate_settings)
 *   3. Reference governorate active (logistics_governorates)
 *   4. City enabled (brand_city_settings)
 *   5. Reference city active (logistics_cities)
 *   6. Apply brand policy action (allow / pending_review / reject)
 */
final class ShippingValidationService implements ShippingEngineContract
{
    public function __construct(
        private readonly ShippingQuoteService $quote,
    ) {}

    /**
     * Evaluate a shipping request for a brand + geography combination.
     *
     * @param  bool  $isDeliveryOrder  Pass false for walk-in POS (skips all checks).
     */
    public function evaluate(
        string $brandId,
        int $governorateId,
        ?int $cityId,
        bool $isDeliveryOrder = true,
    ): ShippingValidationResult {
        // Walk-in POS — bypass everything
        if (! $isDeliveryOrder) {
            return ShippingValidationResult::walkIn();
        }

        // Fetch policy settings once (lazy-create defaults via firstOrNew for read-only)
        $settings = BrandShippingSettings::where('brand_id', $brandId)->first();

        $govAction = $settings?->unsupported_governorate_action ?? 'allow';
        $cityAction = $settings?->unsupported_city_action ?? 'allow';

        // ── Build the quote upfront (reused for all non-reject paths) ─────────
        $q = $this->quote->quote($brandId, $governorateId, $cityId);

        // ── Governorate validation ────────────────────────────────────────────

        $govSetting = BrandGovernorateSettings::where('brand_id', $brandId)
            ->where('governorate_id', $governorateId)
            ->first();

        if ($govSetting !== null && ! $govSetting->is_enabled) {
            return $this->applyAreaAction(
                $govAction,
                'Governorate is disabled for this brand.',
                $q,
                $governorateId,
                $cityId,
            );
        }

        $gov = Governorate::find($governorateId);
        if ($gov === null) {
            return ShippingValidationResult::reject(
                'Governorate not found in reference data.',
                $governorateId,
                $cityId,
            );
        }

        if (! $gov->is_active) {
            return $this->applyAreaAction(
                $govAction,
                'Governorate is inactive in the system.',
                $q,
                $governorateId,
                $cityId,
            );
        }

        // ── City validation ───────────────────────────────────────────────────

        if ($cityId !== null) {
            $citySetting = BrandCitySetting::where('brand_id', $brandId)
                ->where('city_id', $cityId)
                ->first();

            if ($citySetting !== null && $citySetting->is_enabled === false) {
                return $this->applyAreaAction(
                    $cityAction,
                    'City is disabled for this brand.',
                    $q,
                    $governorateId,
                    $cityId,
                );
            }

            $city = City::find($cityId);
            if ($city !== null && ! $city->is_active) {
                return $this->applyAreaAction(
                    $cityAction,
                    'City is inactive in the system.',
                    $q,
                    $governorateId,
                    $cityId,
                );
            }
        }

        // ── All checks passed ─────────────────────────────────────────────────

        return ShippingValidationResult::allow(
            shippingPrice: $q['price'],
            deliveryDays: $q['delivery_days'],
            sameDay: $q['same_day'],
            codAllowed: $q['cod_allowed'],
            preferredProvider: $q['preferred_provider'],
            resolvedGovernorateId: $governorateId,
            resolvedCityId: $cityId,
        );
    }

    /**
     * Apply the brand's configured action for an unsupported area.
     *
     * @param  array<string, mixed>  $q  Pre-computed quote
     */
    private function applyAreaAction(
        string $action,
        string $reason,
        array $q,
        int $governorateId,
        ?int $cityId,
    ): ShippingValidationResult {
        return match ($action) {
            'reject' => ShippingValidationResult::reject($reason, $governorateId, $cityId),

            'pending_review' => ShippingValidationResult::pendingReview(
                reason: $reason,
                shippingPrice: $q['price'],
                deliveryDays: $q['delivery_days'],
                sameDay: $q['same_day'],
                codAllowed: $q['cod_allowed'],
                preferredProvider: $q['preferred_provider'],
                resolvedGovernorateId: $governorateId,
                resolvedCityId: $cityId,
            ),

            default => ShippingValidationResult::allow(
                shippingPrice: $q['price'],
                deliveryDays: $q['delivery_days'],
                sameDay: $q['same_day'],
                codAllowed: $q['cod_allowed'],
                preferredProvider: $q['preferred_provider'],
                resolvedGovernorateId: $governorateId,
                resolvedCityId: $cityId,
            ),
        };
    }
}
