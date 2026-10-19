<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\Admin\Configuration\Domain\Models\DeliveryZone;
use Modules\Admin\Configuration\Domain\Services\ConfigAuditService;

/**
 * CRUD for Delivery Zones within a Governorate.
 *
 * GET    /configuration/brands/{brandId}/geographies/{geoId}/zones
 * POST   /configuration/brands/{brandId}/geographies/{geoId}/zones
 * PUT    /configuration/brands/{brandId}/geographies/{geoId}/zones/{id}
 * DELETE /configuration/brands/{brandId}/geographies/{geoId}/zones/{id}
 */
final class DeliveryZoneController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly ConfigAuditService $audit) {}

    public function index(string $brandId, string $geoId): JsonResponse
    {
        $zones = DeliveryZone::where('delivery_geography_id', $geoId)
            ->where('brand_id', $brandId)
            ->with('shippingRule')
            ->orderBy('sort_order')
            ->get();

        return $this->success($zones);
    }

    public function store(Request $request, string $brandId, string $geoId): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'name_ar' => 'nullable|string|max:150',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $actorId = Auth::id() ?? '';

        $zone = DeliveryZone::create([
            ...$validated,
            'delivery_geography_id' => $geoId,
            'brand_id' => $brandId,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        $this->audit->record(
            companyId: Auth::user()?->company_id ?? '',
            module: 'delivery_geography',
            category: 'zone',
            action: 'create',
            oldValue: null,
            newValue: $zone->toArray(),
            brandId: $brandId,
        );

        return $this->created($zone->load('shippingRule'), 'Zone created.');
    }

    public function update(Request $request, string $brandId, string $geoId, string $id): JsonResponse
    {
        $zone = DeliveryZone::where('delivery_geography_id', $geoId)
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'name_ar' => 'nullable|string|max:150',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'custom_shipping_cost' => 'nullable|numeric|min:0',
        ]);

        $old = $zone->toArray();
        $zone->update([...$validated, 'updated_by' => Auth::id()]);

        $this->audit->record(
            companyId: Auth::user()?->company_id ?? '',
            module: 'delivery_geography',
            category: 'zone',
            action: 'update',
            oldValue: $old,
            newValue: $zone->fresh()?->toArray() ?? [],
            brandId: $brandId,
        );

        return $this->updated($zone->load('shippingRule'), 'Zone updated.');
    }

    public function destroy(string $brandId, string $geoId, string $id): JsonResponse
    {
        $zone = DeliveryZone::where('delivery_geography_id', $geoId)
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        $this->audit->record(
            companyId: Auth::user()?->company_id ?? '',
            module: 'delivery_geography',
            category: 'zone',
            action: 'delete',
            oldValue: $zone->toArray(),
            newValue: null,
            brandId: $brandId,
        );

        $zone->delete();

        return $this->deleted('Zone deleted.');
    }
}
