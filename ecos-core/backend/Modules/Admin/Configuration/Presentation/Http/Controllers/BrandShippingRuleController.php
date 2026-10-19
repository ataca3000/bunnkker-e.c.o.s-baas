<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\Admin\Configuration\Domain\Models\BrandShippingRule;
use Modules\Admin\Configuration\Domain\Services\ConfigAuditService;

/**
 * Manages brand-scoped shipping pricing rules per delivery zone.
 *
 * GET    /configuration/brands/{brandId}/shipping-rules
 * POST   /configuration/brands/{brandId}/shipping-rules
 * PUT    /configuration/brands/{brandId}/shipping-rules/{id}
 * DELETE /configuration/brands/{brandId}/shipping-rules/{id}
 */
final class BrandShippingRuleController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly ConfigAuditService $audit) {}

    public function index(string $brandId): JsonResponse
    {
        $rules = BrandShippingRule::where('brand_id', $brandId)
            ->with(['zone.geography'])
            ->orderBy('created_at')
            ->get();

        return $this->success($rules);
    }

    public function store(Request $request, string $brandId): JsonResponse
    {
        $validated = $request->validate([
            'delivery_zone_id' => 'nullable|uuid|exists:config_delivery_zones,id',
            'delivery_geography_id' => 'nullable|uuid|exists:config_delivery_geographies,id',
            'shipping_cost' => 'required|numeric|min:0',
            'is_enabled' => 'nullable|boolean',
            'effective_date' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
            'delivery_window_id' => 'nullable|uuid|exists:config_delivery_windows,id',
        ]);

        $companyId = Auth::user()?->company_id ?? '';
        $actorId = Auth::id() ?? '';

        if (isset($validated['delivery_zone_id'])) {
            $exists = BrandShippingRule::where('brand_id', $brandId)
                ->where('delivery_zone_id', $validated['delivery_zone_id'])
                ->exists();
            abort_if($exists, 422, 'A shipping rule already exists for this zone.');
        }

        $rule = BrandShippingRule::create([
            ...$validated,
            'brand_id' => $brandId,
            'company_id' => $companyId,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        $this->audit->record(
            companyId: $companyId,
            module: 'shipping_pricing',
            category: 'brand_shipping_rule',
            action: 'create',
            oldValue: null,
            newValue: $rule->toArray(),
            brandId: $brandId,
        );

        return $this->created($rule->load(['zone.geography', 'deliveryWindow']), 'Shipping rule created.');
    }

    public function update(Request $request, string $brandId, string $id): JsonResponse
    {
        $rule = BrandShippingRule::where('brand_id', $brandId)->findOrFail($id);

        $validated = $request->validate([
            'shipping_cost' => 'sometimes|required|numeric|min:0',
            'is_enabled' => 'nullable|boolean',
            'effective_date' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
            'delivery_window_id' => 'nullable|uuid|exists:config_delivery_windows,id',
        ]);

        $old = $rule->toArray();
        $rule->update([...$validated, 'updated_by' => Auth::id()]);

        $this->audit->record(
            companyId: Auth::user()?->company_id ?? '',
            module: 'shipping_pricing',
            category: 'brand_shipping_rule',
            action: 'update',
            oldValue: $old,
            newValue: $rule->fresh()?->toArray() ?? [],
            brandId: $brandId,
        );

        return $this->updated($rule->load(['zone.geography', 'deliveryWindow']), 'Shipping rule updated.');
    }

    public function destroy(string $brandId, string $id): JsonResponse
    {
        $rule = BrandShippingRule::where('brand_id', $brandId)->findOrFail($id);

        $this->audit->record(
            companyId: Auth::user()?->company_id ?? '',
            module: 'shipping_pricing',
            category: 'brand_shipping_rule',
            action: 'delete',
            oldValue: $rule->toArray(),
            newValue: null,
            brandId: $brandId,
        );

        $rule->delete();

        return $this->deleted('Shipping rule deleted.');
    }
}
