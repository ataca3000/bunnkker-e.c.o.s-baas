<?php

declare(strict_types=1);

namespace Modules\Sales\ShippingPricing\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\Sales\ShippingPricing\Application\Actions\CalculateShippingCostAction;
use Modules\Sales\ShippingPricing\Domain\Models\ShippingPricingRule;
use Modules\Sales\ShippingPricing\Domain\Scopes\CompanyScope;

final class ShippingPricingController extends Controller
{
    use HasApiResponse;

    public function index(Request $request): JsonResponse
    {
        // CompanyScope is applied automatically — no manual company_id filter needed.
        $query = ShippingPricingRule::query();

        if ($request->has('governorate')) {
            $query->where('governorate', $request->query('governorate'));
        }
        if ($request->has('active')) {
            $query->where('is_active', (bool) $request->query('active'));
        }

        $rules = $query->orderBy('governorate')->orderBy('city')->orderBy('area')->get();

        return $this->success($rules);
    }

    public function store(Request $request): JsonResponse
    {
        $companyId = Auth::user()?->company_id;

        $validated = $request->validate([
            'governorate' => 'required|string|max:100',
            'city' => 'nullable|string|max:100',
            'area' => 'nullable|string|max:100',
            'standard_cost' => 'required|numeric|min:0',
            'express_cost' => 'nullable|numeric|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $this->assertNoDuplicate(
            companyId: $companyId,
            governorate: $validated['governorate'],
            city: $validated['city'] ?? null,
            area: $validated['area'] ?? null,
        );

        $rule = ShippingPricingRule::create([
            ...$validated,
            'company_id' => $companyId,
        ]);

        return $this->created($rule, 'Shipping pricing rule created.');
    }

    public function show(string $id): JsonResponse
    {
        // findOrFail respects CompanyScope — returns 404 for other companies.
        $rule = ShippingPricingRule::findOrFail($id);

        return $this->success($rule);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $rule = ShippingPricingRule::findOrFail($id);

        $validated = $request->validate([
            'governorate' => 'sometimes|required|string|max:100',
            'city' => 'nullable|string|max:100',
            'area' => 'nullable|string|max:100',
            'standard_cost' => 'sometimes|required|numeric|min:0',
            'express_cost' => 'nullable|numeric|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $governorate = $validated['governorate'] ?? $rule->governorate;
        $city = array_key_exists('city', $validated) ? $validated['city'] : $rule->city;
        $area = array_key_exists('area', $validated) ? $validated['area'] : $rule->area;

        $this->assertNoDuplicate(
            companyId: $rule->company_id,
            governorate: $governorate,
            city: $city,
            area: $area,
            excludeId: $rule->id,
        );

        $rule->update($validated);

        return $this->updated($rule, 'Shipping pricing rule updated.');
    }

    public function destroy(string $id): JsonResponse
    {
        ShippingPricingRule::findOrFail($id)->delete();

        return $this->deleted('Shipping pricing rule deleted.');
    }

    public function calculate(Request $request, CalculateShippingCostAction $action): JsonResponse
    {
        $validated = $request->validate([
            'governorate' => 'required|string|max:100',
            'city' => 'nullable|string|max:100',
            'area' => 'nullable|string|max:100',
        ]);

        // Inject the authenticated company so CalculateShippingCostAction can still
        // apply its own company filter (redundant with scope but harmless).
        $validated['company_id'] = Auth::user()?->company_id;

        $result = $action->execute($validated);

        return $this->success($result->data());
    }

    /**
     * Validates that no active rule with the same geographic scope already exists
     * for this company. Uses withoutGlobalScope to perform a raw company check
     * rather than the "company OR NULL" scope used for reads.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    private function assertNoDuplicate(
        ?string $companyId,
        string $governorate,
        ?string $city,
        ?string $area,
        ?string $excludeId = null,
    ): void {
        $exists = ShippingPricingRule::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->where('governorate', $governorate)
            ->whereRaw("COALESCE(city, '') = ?", [$city ?? ''])
            ->whereRaw("COALESCE(area, '') = ?", [$area ?? ''])
            ->where('is_active', true)
            ->when($excludeId !== null, fn ($q) => $q->where('id', '!=', $excludeId))
            ->exists();

        if ($exists) {
            abort(422, 'A pricing rule already exists for this company + location combination.');
        }
    }
}
