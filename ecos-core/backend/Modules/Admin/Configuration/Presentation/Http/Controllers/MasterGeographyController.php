<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Admin\Configuration\Domain\Models\DeliveryGeography;
use Modules\Admin\Configuration\Domain\Models\MasterGovernorate;

class MasterGeographyController extends Controller
{
    public function index(): JsonResponse
    {
        $govs = MasterGovernorate::withCount('zones')
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $govs]);
    }

    public function show(string $id): JsonResponse
    {
        $gov = MasterGovernorate::withCount(['zones', 'brandGeographies as brand_geo_count'])
            ->findOrFail($id);

        return response()->json(['data' => $gov]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:master_governorates,name',
            'name_ar' => 'nullable|string|max:100',
            'code' => 'required|string|max:10|unique:master_governorates,code',
        ]);

        $gov = MasterGovernorate::create([
            'name' => $validated['name'],
            'name_ar' => $validated['name_ar'] ?? null,
            'code' => strtoupper($validated['code']),
            'sort_order' => (int) MasterGovernorate::max('sort_order') + 1,
            'is_active' => true,
            'is_archived' => false,
        ]);

        return response()->json(['data' => $gov], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gov = MasterGovernorate::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:100', Rule::unique('master_governorates', 'name')->ignore($id)],
            'name_ar' => 'nullable|string|max:100',
            'sort_order' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $gov->update($validated);

        return response()->json(['data' => $gov]);
    }

    public function archive(string $id): JsonResponse
    {
        $gov = MasterGovernorate::findOrFail($id);
        $gov->update(['is_archived' => true, 'is_active' => false]);

        return response()->json(['data' => $gov]);
    }

    public function destroy(string $id): JsonResponse
    {
        $gov = MasterGovernorate::findOrFail($id);

        $deps = DeliveryGeography::where('master_governorate_id', $id)->count();
        if ($deps > 0) {
            return response()->json([
                'message' => "Cannot delete: $deps brand geography record(s) reference this governorate.",
                'dependency_count' => $deps,
            ], 422);
        }

        $gov->delete();

        return response()->json(null, 204);
    }
}
