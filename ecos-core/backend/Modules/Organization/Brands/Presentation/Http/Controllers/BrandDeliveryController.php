<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Configuration\Domain\Models\BrandShippingRule;
use Modules\Admin\Configuration\Domain\Models\DeliveryGeography;
use Modules\Admin\Configuration\Domain\Models\DeliveryZone;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Brands\Domain\Models\BrandDeliveryTimeSlot;

final class BrandDeliveryController extends Controller
{
    use HasApiResponse;

    /**
     * Returns the full geography tree for a brand (active governorates + active zones + shipping costs).
     * Used by the manual order form to populate the governorate and zone dropdowns in a single request.
     */
    public function geography(string $brandId): JsonResponse
    {
        $geographies = DeliveryGeography::where('brand_id', $brandId)
            ->where('is_active', true)
            ->with([
                'zones' => fn ($q) => $q
                    ->where('is_active', true)
                    ->orderBy('sort_order')
                    ->orderBy('name'),
            ])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        // Load zone-level shipping rules (override prices) keyed by zone id
        $zoneRules = BrandShippingRule::where('brand_id', $brandId)
            ->where('is_enabled', true)
            ->whereNotNull('delivery_zone_id')
            ->get()
            ->keyBy('delivery_zone_id');

        $governorates = $geographies->map(function (DeliveryGeography $geo) use ($zoneRules) {
            return [
                'id' => $geo->id,
                'name' => $geo->name,
                'default_shipping_cost' => $geo->default_shipping_cost,
                'zones' => $geo->zones->map(function (DeliveryZone $zone) use ($zoneRules, $geo) {
                    $override = $zoneRules->get($zone->id);
                    // PART 5: effective = zone override ?? governorate default
                    $effective = $override?->shipping_cost ?? $geo->default_shipping_cost;

                    return [
                        'id' => $zone->id,
                        'name' => $zone->name,
                        'shipping_cost_override' => $override?->shipping_cost,
                        'shipping_cost' => $effective, // legacy field — keeps order form working
                    ];
                })->values(),
            ];
        })->values();

        return $this->success(['governorates' => $governorates]);
    }

    /**
     * Returns a configuration health report for a brand.
     * Used by the manual order form to gate order creation on complete setup.
     */
    public function health(string $brandId): JsonResponse
    {
        Brand::findOrFail($brandId);

        $channelsOk = Channel::where('brand_id', $brandId)->where('is_active', true)->exists();
        $geoOk = DeliveryGeography::where('brand_id', $brandId)->where('is_active', true)->exists();
        $zonesOk = DeliveryZone::where('brand_id', $brandId)->where('is_active', true)->exists();
        $windowsOk = BrandDeliveryTimeSlot::where('brand_id', $brandId)->where('is_active', true)->exists();
        $shippingOk = BrandShippingRule::where('brand_id', $brandId)->where('is_enabled', true)->exists();

        return $this->success([
            'is_ready' => $channelsOk && $geoOk && $zonesOk && $windowsOk && $shippingOk,
            'checks' => [
                'channels' => $channelsOk,
                'delivery_geography' => $geoOk,
                'delivery_zones' => $zonesOk,
                'delivery_windows' => $windowsOk,
                'shipping_rules' => $shippingOk,
            ],
        ]);
    }

    /**
     * Returns the enabled delivery windows for a brand.
     * Used by the manual order form delivery window selector.
     */
    public function windows(string $brandId): JsonResponse
    {
        $windows = BrandDeliveryTimeSlot::where('brand_id', $brandId)
            ->where('is_active', true)
            ->orderBy('display_order')
            ->orderBy('start_time')
            ->get()
            ->map(fn (BrandDeliveryTimeSlot $w) => [
                'id' => $w->id,
                'label' => $w->name,
                'starts_at' => $w->start_time,
                'ends_at' => $w->end_time,
            ])
            ->values();

        return $this->success($windows);
    }
}
