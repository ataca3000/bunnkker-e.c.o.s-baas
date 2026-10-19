<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Admin\Configuration\Domain\Models\DeliveryZone;
use Modules\Admin\Configuration\Domain\Models\MasterGovernorate;
use Modules\Admin\Configuration\Domain\Models\MasterZone;

class MasterZoneController extends Controller
{
    public function index(string $govId): JsonResponse
    {
        MasterGovernorate::findOrFail($govId);

        $zones = MasterZone::where('master_governorate_id', $govId)
            ->withCount(['brandZones as dependency_count'])
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $zones]);
    }

    public function store(Request $request, string $govId): JsonResponse
    {
        $gov = MasterGovernorate::findOrFail($govId);

        $validated = $request->validate([
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('master_zones')->where('master_governorate_id', $govId),
            ],
            'estimated_delivery_sla_hours' => 'nullable|integer|min:1|max:168',
            'default_warehouse_id' => 'nullable|uuid',
            'default_logistics_hub' => 'nullable|string|max:100',
            'delivery_difficulty' => 'nullable|in:easy,medium,hard',
            'priority' => 'nullable|integer|min:1|max:10',
            'notes' => 'nullable|string|max:500',
        ]);

        $code = $this->generateCode($gov->code, $validated['name']);

        $zone = MasterZone::create([
            ...$validated,
            'master_governorate_id' => $govId,
            'sort_order' => (int) MasterZone::where('master_governorate_id', $govId)->max('sort_order') + 1,
            'code' => $code,
            'is_active' => true,
            'is_archived' => false,
        ]);

        return response()->json(['data' => $zone], 201);
    }

    public function update(Request $request, string $govId, string $id): JsonResponse
    {
        $zone = MasterZone::where('master_governorate_id', $govId)->findOrFail($id);

        $validated = $request->validate([
            'name' => [
                'sometimes', 'string', 'max:100',
                Rule::unique('master_zones')->where('master_governorate_id', $govId)->ignore($id),
            ],
            'is_active' => 'sometimes|boolean',
            'estimated_delivery_sla_hours' => 'nullable|integer|min:1|max:168',
            'default_warehouse_id' => 'nullable|uuid',
            'default_logistics_hub' => 'nullable|string|max:100',
            'delivery_difficulty' => 'nullable|in:easy,medium,hard',
            'priority' => 'nullable|integer|min:1|max:10',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'polygon_id' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
        ]);

        // code is immutable — never updated
        $zone->update($validated);

        return response()->json(['data' => $zone]);
    }

    public function archive(string $govId, string $id): JsonResponse
    {
        $zone = MasterZone::where('master_governorate_id', $govId)->findOrFail($id);
        $zone->update(['is_archived' => true, 'is_active' => false]);

        return response()->json(['data' => $zone]);
    }

    public function destroy(string $govId, string $id): JsonResponse
    {
        $zone = MasterZone::where('master_governorate_id', $govId)->findOrFail($id);

        $deps = DeliveryZone::where('master_zone_id', $id)->count();
        if ($deps > 0) {
            return response()->json([
                'message' => "Cannot delete: $deps brand zone record(s) reference this zone.",
                'dependency_count' => $deps,
            ], 422);
        }

        $zone->delete();

        return response()->json(null, 204);
    }

    /** Generate a unique zone code from the gov code + zone name. */
    private function generateCode(string $govCode, string $zoneName): string
    {
        $compact = preg_replace('/\s+/', '', strtoupper($zoneName)) ?? strtoupper($zoneName);
        $clean = preg_replace('/[^A-Z0-9]/', '', $compact) ?? $compact;
        $abbr = str_pad(substr($clean, 0, 3), 3, 'X');

        $code = $govCode.'-'.$abbr;
        $n = 2;
        while (MasterZone::where('code', $code)->exists()) {
            $code = $govCode.'-'.substr($abbr, 0, 2).$n;
            $n++;
        }

        return $code;
    }
}
