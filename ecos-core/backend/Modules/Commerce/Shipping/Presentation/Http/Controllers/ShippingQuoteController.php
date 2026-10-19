<?php

declare(strict_types=1);

namespace Modules\Commerce\Shipping\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Commerce\Shipping\Domain\Services\ShippingValidationService;

/**
 * POST /api/shipping/quote
 *
 * Checkout readiness API — returns a full shipping quote for a
 * brand + geography combination without creating an order.
 *
 * Used by:
 *   - Manual Order form (pre-fill shipping cost)
 *   - WooCommerce checkout validation webhook
 *   - Frontend area-coverage checks
 */
class ShippingQuoteController extends Controller
{
    public function __construct(
        private readonly ShippingValidationService $engine,
    ) {}

    public function quote(Request $request): JsonResponse
    {
        $data = $request->validate([
            'brand_id' => 'required|string|exists:brands,id',
            'governorate_id' => 'required|integer|exists:logistics_governorates,id',
            'city_id' => 'nullable|integer|exists:logistics_cities,id',
        ]);

        $result = $this->engine->evaluate(
            brandId: $data['brand_id'],
            governorateId: (int) $data['governorate_id'],
            cityId: isset($data['city_id']) ? (int) $data['city_id'] : null,
            isDeliveryOrder: true,
        );

        return response()->json([
            'data' => $result->toArray(),
        ]);
    }
}
