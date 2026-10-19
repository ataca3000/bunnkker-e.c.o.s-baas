<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\Admin\Configuration\Domain\Models\DeliveryGeography;
use Modules\Admin\Configuration\Domain\Models\DeliveryZone;
use Modules\Admin\Configuration\Domain\Models\MasterZone;
use Modules\Admin\Configuration\Domain\Services\ConfigAuditService;

/**
 * CRUD for Delivery Geographies (Governorates) scoped per brand.
 *
 * GET    /configuration/brands/{brandId}/geographies
 * POST   /configuration/brands/{brandId}/geographies
 * PUT    /configuration/brands/{brandId}/geographies/{id}
 * DELETE /configuration/brands/{brandId}/geographies/{id}
 */
final class DeliveryGeographyController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly ConfigAuditService $audit) {}

    public function index(string $brandId): JsonResponse
    {
        $geographies = DeliveryGeography::where('brand_id', $brandId)
            ->with(['zones' => fn ($q) => $q->with('shippingRule')->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get();

        return $this->success($geographies);
    }

    public function store(Request $request, string $brandId): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'name_ar' => 'nullable|string|max:150',
            'code' => 'nullable|string|max:50',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'default_shipping_cost' => 'nullable|numeric|min:0',
            'master_governorate_id' => 'nullable|uuid|exists:master_governorates,id',
        ]);

        $companyId = Auth::user()?->company_id ?? '';
        $actorId = Auth::id() ?? '';

        $geography = DeliveryGeography::updateOrCreate(
            ['brand_id' => $brandId, 'name' => $validated['name']],
            [...$validated, 'company_id' => $companyId, 'created_by' => $actorId, 'updated_by' => $actorId],
        );

        // Auto-create all master zones when a master-linked governorate is activated
        $isActive = $validated['is_active'] ?? true;
        if (! empty($validated['master_governorate_id']) && $isActive) {
            $masterZones = MasterZone::where('master_governorate_id', $validated['master_governorate_id'])
                ->orderBy('sort_order')
                ->get();

            foreach ($masterZones as $masterZone) {
                DeliveryZone::updateOrCreate(
                    [
                        'delivery_geography_id' => $geography->id,
                        'master_zone_id' => $masterZone->id,
                    ],
                    [
                        'brand_id' => $brandId,
                        'name' => $masterZone->name,
                        'sort_order' => $masterZone->sort_order,
                        'created_by' => $actorId,
                        'updated_by' => $actorId,
                    ],
                );
            }
        }

        $this->audit->record(
            companyId: $companyId,
            module: 'delivery_geography',
            category: 'geography',
            action: $geography->wasRecentlyCreated ? 'create' : 'update',
            oldValue: null,
            newValue: $geography->toArray(),
            brandId: $brandId,
        );

        return $this->created($geography->load('zones'), 'Governorate enabled.');
    }

    public function update(Request $request, string $brandId, string $id): JsonResponse
    {
        $geography = DeliveryGeography::where('brand_id', $brandId)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'name_ar' => 'nullable|string|max:150',
            'code' => 'nullable|string|max:50',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'default_shipping_cost' => 'nullable|numeric|min:0',
        ]);

        $old = $geography->toArray();
        $geography->update([...$validated, 'updated_by' => Auth::id()]);

        $this->audit->record(
            companyId: Auth::user()?->company_id ?? '',
            module: 'delivery_geography',
            category: 'geography',
            action: 'update',
            oldValue: $old,
            newValue: $geography->fresh()?->toArray() ?? [],
            brandId: $brandId,
        );

        return $this->updated($geography->load('zones'), 'Governorate updated.');
    }

    public function destroy(string $brandId, string $id): JsonResponse
    {
        $geography = DeliveryGeography::where('brand_id', $brandId)->findOrFail($id);

        $this->audit->record(
            companyId: Auth::user()?->company_id ?? '',
            module: 'delivery_geography',
            category: 'geography',
            action: 'delete',
            oldValue: $geography->toArray(),
            newValue: null,
            brandId: $brandId,
        );

        $geography->delete();

        return $this->deleted('Governorate deleted.');
    }
}
