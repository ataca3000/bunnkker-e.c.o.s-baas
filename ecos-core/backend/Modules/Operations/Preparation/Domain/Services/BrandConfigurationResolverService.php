<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Services;

use Modules\Admin\Configuration\Domain\Models\BrandPolicy;
use Modules\Admin\Configuration\Domain\Models\DeliveryGeography;
use Modules\Admin\Configuration\Domain\Models\DeliveryZone;
use Modules\Admin\Configuration\Domain\Models\MasterZone;
use Modules\Operations\Preparation\Domain\Models\PreparationSessionPolicy;

final class BrandConfigurationResolverService
{
    /**
     * Resolve brand preparation config for a given brand.
     *
     * @return array{
     *   preparation_policy: array<string, mixed>,
     *   session_policy: array<string, mixed>|null,
     *   max_wave_size: int,
     *   allow_partial_preparation: bool,
     *   negative_stock_handling: string,
     *   wave_priority: string,
     * }
     */
    public function resolvePreparationConfig(string $companyId, string $brandId): array
    {
        $brandPolicy = BrandPolicy::where('brand_id', $brandId)
            ->where('policy_group', 'preparation')
            ->where('is_active', true)
            ->first();

        $settings = $brandPolicy?->settings
            ?? BrandPolicy::defaultSettings('preparation');

        $sessionPolicy = PreparationSessionPolicy::where('company_id', $companyId)
            ->where('is_active', true)
            ->first();

        return [
            'preparation_policy' => $settings,
            'session_policy' => $sessionPolicy?->toArray(),
            'max_wave_size' => (int) ($settings['batch_size'] ?? 50),
            'allow_partial_preparation' => (bool) ($settings['partial_preparation'] ?? false),
            'negative_stock_handling' => (string) ($settings['negative_stock_handling'] ?? 'block'),
            'wave_priority' => (string) ($settings['wave_priority'] ?? 'fifo'),
        ];
    }

    /**
     * Enrich order delivery intelligence from master geography tables.
     *
     * Given a delivery_zone text snapshot, try to locate the master zone and
     * governorate records so we can store their IDs, codes, and shipping cost.
     *
     * @param  string|null  $zoneText  Raw delivery_zone value from the order
     * @param  string|null  $govText  Raw governorate value from the order (may be null)
     * @param  float|null  $shippingCost  Shipping cost already on the order
     * @return array{
     *   governorate_snapshot: string|null,
     *   master_governorate_id: string|null,
     *   zone_code_snapshot: string|null,
     *   master_zone_id: string|null,
     *   shipping_cost_snapshot: float|null,
     * }
     */
    public function resolveOrderGeography(
        string $brandId,
        ?string $zoneText,
        ?string $govText,
        ?float $shippingCost,
    ): array {
        $result = [
            'governorate_snapshot' => $govText,
            'master_governorate_id' => null,
            'zone_code_snapshot' => null,
            'master_zone_id' => null,
            'shipping_cost_snapshot' => $shippingCost,
        ];

        if ($zoneText === null) {
            return $result;
        }

        // Try to match a brand delivery zone → get master_zone_id
        $brandZone = DeliveryZone::where('brand_id', $brandId)
            ->where('name', $zoneText)
            ->first();

        if ($brandZone?->master_zone_id) {
            $masterZone = MasterZone::find($brandZone->master_zone_id);
            if ($masterZone) {
                $result['zone_code_snapshot'] = $masterZone->code;
                $result['master_zone_id'] = $masterZone->id;
            }

            // Resolve governorate from brand DeliveryGeography
            $brandGeo = DeliveryGeography::find($brandZone->delivery_geography_id);
            if ($brandGeo) {
                $result['governorate_snapshot'] = $brandGeo->name;
                $result['master_governorate_id'] = $brandGeo->master_governorate_id;

                // Prefer custom zone shipping cost, then geography default
                if ($shippingCost === null) {
                    $result['shipping_cost_snapshot'] = $brandZone->custom_shipping_cost
                        ?? $brandGeo->default_shipping_cost;
                }
            }
        } else {
            // Fallback: fuzzy match by zone name in master_zones directly
            $masterZone = MasterZone::where('name', $zoneText)->first();

            if ($masterZone) {
                $result['zone_code_snapshot'] = $masterZone->code;
                $result['master_zone_id'] = $masterZone->id;
            }
        }

        return $result;
    }
}
