<?php

declare(strict_types=1);

namespace Modules\Logistics\Geography\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Logistics\Geography\Domain\Models\City;
use Modules\Logistics\Geography\Domain\Models\CityAlias;
use Modules\Logistics\Geography\Presentation\Http\Resources\CityAliasResource;

class CityAliasController extends Controller
{
    public function index(int $cityId): AnonymousResourceCollection
    {
        City::findOrFail($cityId);

        $aliases = CityAlias::where('city_id', $cityId)
            ->orderBy('provider')
            ->orderBy('alias')
            ->get();

        return CityAliasResource::collection($aliases);
    }

    public function store(Request $request, int $cityId): JsonResponse
    {
        City::findOrFail($cityId);

        $validated = $request->validate([
            'provider' => 'nullable|string|max:50',
            'alias' => [
                'required', 'string', 'max:200',
                \Illuminate\Validation\Rule::unique('logistics_city_aliases')
                    ->where('city_id', $cityId)
                    ->where(fn ($q) => $request->filled('provider')
                        ? $q->where('provider', $request->input('provider'))
                        : $q->whereNull('provider')),
            ],
            'code' => 'nullable|string|max:50',
        ]);

        $alias = CityAlias::create(array_merge($validated, ['city_id' => $cityId]));

        return response()->json(new CityAliasResource($alias), 201);
    }

    public function update(Request $request, int $cityId, int $id): CityAliasResource
    {
        $alias = CityAlias::where('city_id', $cityId)->findOrFail($id);

        $validated = $request->validate([
            'provider' => 'nullable|string|max:50',
            'alias' => 'sometimes|string|max:200',
            'code' => 'nullable|string|max:50',
        ]);

        $alias->update($validated);

        return new CityAliasResource($alias);
    }

    public function destroy(int $cityId, int $id): JsonResponse
    {
        $alias = CityAlias::where('city_id', $cityId)->findOrFail($id);
        $alias->delete();

        return response()->json(null, 204);
    }
}
