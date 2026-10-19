<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Logistics\Geography\Domain\Models\City;
use Modules\Logistics\Geography\Domain\Models\Governorate;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Brands\Domain\Models\BrandCitySetting;
use Modules\Organization\Brands\Domain\Models\BrandGovernorateSettings;
use Modules\Organization\Brands\Domain\Services\BrandShippingService;
use Modules\Organization\Brands\Presentation\Http\Resources\BrandCitySettingsResource;
use Modules\Organization\Brands\Presentation\Http\Resources\BrandGovernorateSettingsResource;
use Modules\Organization\Brands\Presentation\Http\Resources\BrandShippingSettingsResource;

class BrandShippingController extends Controller
{
    public function __construct(private readonly BrandShippingService $service) {}

    // ── GET /brands/{brand}/shipping-settings ─────────────────────────────────

    public function getSettings(string $brandId): BrandShippingSettingsResource
    {
        $brand = Brand::findOrFail($brandId);
        $settings = $this->service->getOrCreateSettings($brand->id);

        return new BrandShippingSettingsResource($settings);
    }

    // ── PUT /brands/{brand}/shipping-settings ─────────────────────────────────

    public function updateSettings(Request $request, string $brandId): BrandShippingSettingsResource
    {
        $brand = Brand::findOrFail($brandId);

        $data = $request->validate([
            'unsupported_governorate_action' => 'sometimes|string|in:allow,pending_review,reject',
            'unsupported_city_action' => 'sometimes|string|in:allow,pending_review,reject',
            'default_cod_enabled' => 'sometimes|boolean',
            'default_free_shipping_threshold' => 'sometimes|nullable|numeric|min:0',
            'default_shipping_provider' => 'sometimes|nullable|string|max:50',
        ]);

        $settings = $this->service->getOrCreateSettings($brand->id);
        $settings->update($data);

        return new BrandShippingSettingsResource($settings->fresh());
    }

    // ── GET /brands/{brand}/shipping/governorates ─────────────────────────────

    public function listGovernorates(string $brandId): AnonymousResourceCollection
    {
        Brand::findOrFail($brandId);

        // Load all active reference governorates ordered by display_order
        $governorates = Governorate::where('is_active', true)
            ->orderBy('display_order')
            ->orderBy('name_en')
            ->get();

        // Load all brand-level settings for this brand in one query
        $brandSettings = BrandGovernorateSettings::where('brand_id', $brandId)
            ->get()
            ->keyBy('governorate_id');

        // Merge: for each governorate, either return existing settings row or a synthetic default
        $results = $governorates->map(function (Governorate $gov) use ($brandId, $brandSettings): BrandGovernorateSettings {
            if ($brandSettings->has($gov->id)) {
                $row = $brandSettings->get($gov->id);
                $row->setRelation('governorate', $gov);

                return $row;
            }

            // Synthetic default (not persisted) so the frontend can render defaults
            $synthetic = new BrandGovernorateSettings([
                'brand_id' => $brandId,
                'governorate_id' => $gov->id,
                'is_enabled' => true,
                'shipping_price' => null,
                'estimated_delivery_days' => null,
                'same_day_supported' => false,
                'display_order' => $gov->display_order,
            ]);
            $synthetic->id = null;
            $synthetic->setRelation('governorate', $gov);

            return $synthetic;
        });

        return BrandGovernorateSettingsResource::collection($results);
    }

    // ── PUT /brands/{brand}/shipping/governorates/{governorate} ──────────────

    public function updateGovernorate(Request $request, string $brandId, int $governorateId): BrandGovernorateSettingsResource
    {
        Brand::findOrFail($brandId);
        Governorate::findOrFail($governorateId);

        $data = $request->validate([
            'is_enabled' => 'sometimes|boolean',
            'shipping_price' => 'sometimes|nullable|numeric|min:0',
            'estimated_delivery_days' => 'sometimes|nullable|integer|min:1|max:365',
            'same_day_supported' => 'sometimes|boolean',
            'display_order' => 'sometimes|integer|min:0',
            'preferred_provider' => 'sometimes|nullable|string|max:50',
        ]);

        $settings = BrandGovernorateSettings::updateOrCreate(
            ['brand_id' => $brandId, 'governorate_id' => $governorateId],
            $data,
        );

        return new BrandGovernorateSettingsResource($settings->load('governorate'));
    }

    // ── GET /brands/{brand}/shipping/cities ───────────────────────────────────

    public function listCities(Request $request, string $brandId): AnonymousResourceCollection
    {
        Brand::findOrFail($brandId);

        $governorateId = $request->integer('governorate_id');

        $query = City::where('is_active', true)
            ->orderBy('display_order')
            ->orderBy('name_en');

        if ($governorateId) {
            $query->where('governorate_id', $governorateId);
        }

        $cities = $query->get();

        $brandSettings = BrandCitySetting::where('brand_id', $brandId)
            ->when($governorateId, fn ($q) => $q->whereIn('city_id', $cities->pluck('id')),
            )
            ->get()
            ->keyBy('city_id');

        $results = $cities->map(function (City $city) use ($brandId, $brandSettings): BrandCitySetting {
            if ($brandSettings->has($city->id)) {
                $row = $brandSettings->get($city->id);
                $row->setRelation('city', $city);

                return $row;
            }

            $synthetic = new BrandCitySetting([
                'brand_id' => $brandId,
                'city_id' => $city->id,
                'is_enabled' => null,
                'shipping_price' => null,
                'supports_cod' => null,
                'is_remote_override' => null,
            ]);
            $synthetic->id = null;
            $synthetic->setRelation('city', $city);

            return $synthetic;
        });

        return BrandCitySettingsResource::collection($results);
    }

    // ── PUT /brands/{brand}/shipping/cities/{city} ────────────────────────────

    public function updateCity(Request $request, string $brandId, int $cityId): BrandCitySettingsResource
    {
        Brand::findOrFail($brandId);
        City::findOrFail($cityId);

        $data = $request->validate([
            'is_enabled' => 'sometimes|nullable|boolean',
            'shipping_price' => 'sometimes|nullable|numeric|min:0',
            'supports_cod' => 'sometimes|nullable|boolean',
            'is_remote_override' => 'sometimes|nullable|boolean',
        ]);

        $setting = BrandCitySetting::updateOrCreate(
            ['brand_id' => $brandId, 'city_id' => $cityId],
            $data,
        );

        return new BrandCitySettingsResource($setting->load('city'));
    }

    // ── GET /brands/{brand}/shipping/calculate ────────────────────────────────

    public function calculatePrice(Request $request, string $brandId): JsonResponse
    {
        Brand::findOrFail($brandId);

        $data = $request->validate([
            'governorate_id' => 'required|integer|exists:logistics_governorates,id',
            'city_id' => 'nullable|integer|exists:logistics_cities,id',
        ]);

        $price = $this->service->calculateShippingPrice($brandId, $data['governorate_id'], $data['city_id'] ?? null);
        $validation = $this->service->validateShippingArea($brandId, $data['governorate_id'], $data['city_id'] ?? null);

        return response()->json([
            'shipping_price' => $price,
            'validation' => $validation,
        ]);
    }
}
