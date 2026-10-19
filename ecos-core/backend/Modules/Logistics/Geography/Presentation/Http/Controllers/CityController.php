<?php

declare(strict_types=1);

namespace Modules\Logistics\Geography\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Logistics\Geography\Domain\Models\City;
use Modules\Logistics\Geography\Domain\Models\Governorate;
use Modules\Logistics\Geography\Presentation\Http\Resources\CityResource;

class CityController extends Controller
{
    public function index(Request $request, int $govId): AnonymousResourceCollection
    {
        $gov = Governorate::findOrFail($govId);

        $query = City::with('aliases')
            ->withCount('aliases')
            ->where('governorate_id', $gov->id)
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

        $perPage = min((int) $request->input('per_page', 100), 200);
        $paginated = $query->paginate($perPage);

        // Inject governorate so effectiveShippingPrice works without extra queries
        $paginated->each(fn (City $c) => $c->setRelation('governorate', $gov));

        return CityResource::collection($paginated);
    }

    public function show(int $govId, int $id): CityResource
    {
        $gov = Governorate::findOrFail($govId);
        $city = City::with('aliases')
            ->withCount('aliases')
            ->where('governorate_id', $govId)
            ->findOrFail($id);

        $city->setRelation('governorate', $gov);

        return new CityResource($city);
    }

    public function store(Request $request, int $govId): JsonResponse
    {
        Governorate::findOrFail($govId);

        $validated = $request->validate([
            'name_ar' => 'required|string|max:100',
            'name_en' => 'required|string|max:100',
            'shipping_price' => 'nullable|numeric|min:0',
            'display_order' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $city = City::create(array_merge($validated, [
            'governorate_id' => $govId,
            'is_system' => false,
        ]));

        $city->load('governorate');

        return response()->json(new CityResource($city->loadCount('aliases')), 201);
    }

    public function update(Request $request, int $govId, int $id): CityResource
    {
        $gov = Governorate::findOrFail($govId);
        $city = City::where('governorate_id', $govId)->findOrFail($id);

        $rules = [
            'shipping_price' => 'nullable|numeric|min:0',
            'display_order' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
        ];

        // Non-system cities can also have name edits
        if (! $city->is_system) {
            $rules['name_ar'] = 'sometimes|string|max:100';
            $rules['name_en'] = 'sometimes|string|max:100';
        }

        $validated = $request->validate($rules);
        $city->update($validated);
        $city->setRelation('governorate', $gov);

        return new CityResource($city->loadCount('aliases'));
    }

    public function destroy(int $govId, int $id): JsonResponse
    {
        $city = City::where('governorate_id', $govId)->findOrFail($id);

        if ($city->is_system) {
            return response()->json(['message' => 'System cities cannot be deleted.'], 422);
        }

        $city->delete();

        return response()->json(null, 204);
    }

    public function toggleStatus(int $govId, int $id): CityResource
    {
        $gov = Governorate::findOrFail($govId);
        $city = City::where('governorate_id', $govId)->findOrFail($id);

        $city->update(['is_active' => ! $city->is_active]);
        $city->setRelation('governorate', $gov);

        return new CityResource($city->loadCount('aliases'));
    }
}
