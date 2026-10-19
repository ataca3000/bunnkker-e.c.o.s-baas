<?php

declare(strict_types=1);

namespace Modules\Logistics\Geography\Presentation\Http\Controllers;

use DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Logistics\Geography\Domain\Models\City;
use Modules\Logistics\Geography\Domain\Models\Governorate;
use Modules\Logistics\Geography\Presentation\Http\Resources\GovernorateResource;

class GovernorateController extends Controller
{
    public function stats(): JsonResponse
    {
        $totalGovs = Governorate::count();
        $activeGovs = Governorate::where('is_active', true)->count();
        $totalCities = City::count();
        $activeCities = City::where('is_active', true)->count();
        $avgPrice = Governorate::where('default_shipping_price', '>', 0)->avg('default_shipping_price');
        $providers = DB::table('logistics_city_aliases')
            ->whereNotNull('provider')
            ->distinct('provider')
            ->count('provider');

        return response()->json([
            'total_governorates' => $totalGovs,
            'active_governorates' => $activeGovs,
            'total_cities' => $totalCities,
            'active_cities' => $activeCities,
            'avg_shipping_price' => $avgPrice ? round((float) $avgPrice, 2) : 0,
            'shipping_providers' => $providers,
        ]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Governorate::withCount('cities')
            ->orderBy('display_order')
            ->orderBy('name_en');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name_en', 'like', "%{$search}%")
                    ->orWhere('name_ar', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('is_active', $request->input('status') === 'active');
        }

        if ($request->filled('price_min')) {
            $query->where('default_shipping_price', '>=', (float) $request->input('price_min'));
        }

        if ($request->filled('price_max')) {
            $query->where('default_shipping_price', '<=', (float) $request->input('price_max'));
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        $paginated = $query->paginate($perPage);

        return GovernorateResource::collection($paginated);
    }

    public function show(int $id): GovernorateResource
    {
        $gov = Governorate::withCount('cities')
            ->with('activeCities')
            ->findOrFail($id);

        return new GovernorateResource($gov);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name_ar' => 'required|string|max:100',
            'name_en' => 'required|string|max:100',
            'default_shipping_price' => 'required|numeric|min:0',
            'display_order' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $gov = Governorate::create(array_merge($validated, ['country_id' => 1, 'is_system' => false]));

        return response()->json(new GovernorateResource($gov->loadCount('cities')), 201);
    }

    public function update(Request $request, int $id): GovernorateResource
    {
        $gov = Governorate::findOrFail($id);

        $validated = $request->validate([
            'name_ar' => 'sometimes|string|max:100',
            'name_en' => 'sometimes|string|max:100',
            'default_shipping_price' => 'sometimes|numeric|min:0',
            'display_order' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $gov->update($validated);

        return new GovernorateResource($gov->loadCount('cities'));
    }

    public function destroy(int $id): JsonResponse
    {
        $gov = Governorate::findOrFail($id);

        if ($gov->is_system) {
            return response()->json(['message' => 'System governorates cannot be deleted.'], 422);
        }

        $gov->delete();

        return response()->json(null, 204);
    }

    public function toggleStatus(int $id): GovernorateResource
    {
        $gov = Governorate::findOrFail($id);
        $newActive = ! $gov->is_active;

        $gov->update(['is_active' => $newActive]);

        // Cascade deactivation to all child cities.
        // On reactivation we do NOT auto-reactivate cities — explicit city state is preserved.
        if (! $newActive) {
            City::where('governorate_id', $gov->id)->update(['is_active' => false]);
        }

        return new GovernorateResource($gov->loadCount('cities'));
    }

    /**
     * Bulk-update display_order for a set of governorates.
     * Body: [{ id: 1, display_order: 1 }, ...]
     */
    public function reorder(Request $request): JsonResponse
    {
        $items = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|integer|exists:logistics_governorates,id',
            'items.*.display_order' => 'required|integer|min:0',
        ])['items'];

        foreach ($items as $item) {
            Governorate::where('id', $item['id'])->update(['display_order' => $item['display_order']]);
        }

        return response()->json(['message' => 'Reordered successfully.']);
    }
}
