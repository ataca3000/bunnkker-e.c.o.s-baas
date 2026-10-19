<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Distribution\Domain\Models\DistributionZone;
use Modules\Logistics\Distribution\Presentation\Http\Resources\DistributionZoneResource;
use Modules\Logistics\Geography\Domain\Models\City;

class DistributionZoneController extends Controller
{
    public function stats(): JsonResponse
    {
        $totalZones = DistributionZone::count();
        $activeZones = DistributionZone::where('is_active', true)->count();
        $assignedAreas = City::whereNotNull('distribution_zone_id')->count();
        $totalAreas = City::count();

        return response()->json([
            'total_zones' => $totalZones,
            'active_zones' => $activeZones,
            'assigned_areas' => $assignedAreas,
            'unassigned_areas' => max(0, $totalAreas - $assignedAreas),
        ]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = DistributionZone::withCount('areas')->orderBy('code');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name_ar', 'like', "%{$search}%")
                    ->orWhere('name_en', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('is_active', $request->input('status') === 'active');
        }

        $perPage = min((int) $request->input('per_page', 20), 100);

        return DistributionZoneResource::collection($query->paginate($perPage));
    }

    public function show(int $id): DistributionZoneResource
    {
        $zone = DistributionZone::withCount('areas')
            ->with(['areas.governorate'])
            ->findOrFail($id);

        return new DistributionZoneResource($zone);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = Auth::user()?->name ?? 'System';
        $forcedMove = $request->boolean('force_move', false);

        $validated = $request->validate([
            'name_ar' => 'required|string|max:100|unique:distribution_zones,name_ar',
            'name_en' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:1000',
            'color' => 'nullable|string|max:20',
            'is_active' => 'sometimes|boolean',
            'area_ids' => 'required|array|min:1',
            'area_ids.*' => 'required|integer|exists:logistics_cities,id',
            'force_move' => 'sometimes|boolean',
        ]);

        $areaIds = $validated['area_ids'];

        $conflicts = City::whereIn('id', $areaIds)
            ->whereNotNull('distribution_zone_id')
            ->pluck('name_ar', 'id');

        if ($conflicts->isNotEmpty() && ! $forcedMove) {
            return response()->json([
                'message' => 'Some areas are already assigned to another distribution zone.',
                'errors' => ['area_ids' => ['Areas already assigned: '.$conflicts->values()->implode(', ')]],
            ], 422);
        }

        $zone = DB::transaction(function () use ($validated, $areaIds, $forcedMove, $actor) {
            if ($forcedMove) {
                City::whereIn('id', $areaIds)
                    ->whereNotNull('distribution_zone_id')
                    ->update(['distribution_zone_id' => null]);
            }

            $zone = DistributionZone::create([
                'code' => $this->generateNextCode(),
                'name_ar' => $validated['name_ar'],
                'name_en' => $validated['name_en'] ?? null,
                'description' => $validated['description'] ?? null,
                'color' => $validated['color'] ?? null,
                'is_active' => $validated['is_active'] ?? true,
                'created_by' => $actor,
                'updated_by' => $actor,
            ]);

            City::whereIn('id', $areaIds)->update(['distribution_zone_id' => $zone->id]);

            return $zone;
        });

        $zone->loadCount('areas');

        return response()->json(new DistributionZoneResource($zone), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $zone = DistributionZone::findOrFail($id);
        $actor = Auth::user()?->name ?? 'System';
        $forcedMove = $request->boolean('force_move', false);

        $validated = $request->validate([
            'code' => "sometimes|string|max:50|unique:distribution_zones,code,{$id}",
            'name_ar' => "sometimes|string|max:100|unique:distribution_zones,name_ar,{$id}",
            'name_en' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:1000',
            'color' => 'nullable|string|max:20',
            'is_active' => 'sometimes|boolean',
            'area_ids' => 'required|array|min:1',
            'area_ids.*' => 'required|integer|exists:logistics_cities,id',
            'force_move' => 'sometimes|boolean',
        ]);

        $areaIds = $validated['area_ids'];

        $conflicts = City::whereIn('id', $areaIds)
            ->whereNotNull('distribution_zone_id')
            ->where('distribution_zone_id', '!=', $zone->id)
            ->pluck('name_ar', 'id');

        if ($conflicts->isNotEmpty() && ! $forcedMove) {
            return response()->json([
                'message' => 'Some areas are already assigned to another distribution zone.',
                'errors' => ['area_ids' => ['Areas already assigned: '.$conflicts->values()->implode(', ')]],
            ], 422);
        }

        DB::transaction(function () use ($zone, $validated, $areaIds, $forcedMove, $actor) {
            $updates = ['is_active' => $validated['is_active'] ?? $zone->is_active, 'updated_by' => $actor];

            foreach (['code', 'name_ar', 'name_en', 'description', 'color'] as $field) {
                if (array_key_exists($field, $validated)) {
                    $updates[$field] = $validated[$field];
                }
            }

            $zone->update($updates);

            City::where('distribution_zone_id', $zone->id)->update(['distribution_zone_id' => null]);

            if ($forcedMove) {
                City::whereIn('id', $areaIds)
                    ->whereNotNull('distribution_zone_id')
                    ->where('distribution_zone_id', '!=', $zone->id)
                    ->update(['distribution_zone_id' => null]);
            }

            City::whereIn('id', $areaIds)->update(['distribution_zone_id' => $zone->id]);
        });

        $zone->refresh()->loadCount('areas');

        return response()->json(new DistributionZoneResource($zone));
    }

    public function destroy(int $id): JsonResponse
    {
        $zone = DistributionZone::withCount('areas')->findOrFail($id);

        DB::transaction(function () use ($zone) {
            City::where('distribution_zone_id', $zone->id)->update(['distribution_zone_id' => null]);
            $zone->delete();
        });

        return response()->json(null, 204);
    }

    public function toggleStatus(int $id): JsonResponse
    {
        $zone = DistributionZone::findOrFail($id);
        $actor = Auth::user()?->name ?? 'System';

        $zone->update([
            'is_active' => ! $zone->is_active,
            'updated_by' => $actor,
        ]);

        $zone->loadCount('areas');

        return response()->json(new DistributionZoneResource($zone));
    }

    /**
     * Return the next auto-generated zone code (preview only).
     * Format: DZ-0001, DZ-0002, …
     */
    public function nextCode(): JsonResponse
    {
        $next = $this->generateNextCode();

        return response()->json(['code' => $next]);
    }

    /**
     * Return cities available for zone assignment.
     *
     * By default: unassigned + cities that already belong to zone_id.
     * With include_all=true: ALL cities, including those in other zones
     * (each city carries distribution_zone_name so the frontend can show a
     * Smart Move dialog before force-assigning).
     *
     * Query params:
     *   zone_id      (int, optional)  — include this zone's cities in default mode
     *   include_all  (bool, optional) — override filter; return every city
     */
    public function areas(Request $request): JsonResponse
    {
        $zoneId = $request->input('zone_id') ? (int) $request->input('zone_id') : null;
        $includeAll = $request->boolean('include_all', false);

        // logistics_cities has no soft deletes — do NOT add whereNull('c.deleted_at')
        $query = DB::table('logistics_cities as c')
            ->leftJoin('logistics_governorates as g', 'g.id', '=', 'c.governorate_id')
            ->leftJoin('distribution_zones as dz', function ($join) {
                $join->on('dz.id', '=', 'c.distribution_zone_id')
                    ->whereNull('dz.deleted_at');
            })
            ->select([
                'c.id',
                'c.name_ar',
                'c.name_en',
                'c.governorate_id',
                'c.is_active',
                'c.distribution_zone_id',
                'g.name_ar as governorate_name_ar',
                'g.name_en as governorate_name_en',
                'dz.name_ar as distribution_zone_name',
            ])
            ->orderBy('c.governorate_id')
            ->orderBy('c.name_ar');

        if (! $includeAll) {
            $query->where(function ($q) use ($zoneId) {
                $q->whereNull('c.distribution_zone_id');
                if ($zoneId) {
                    $q->orWhere('c.distribution_zone_id', $zoneId);
                }
            });
        }

        $cities = $query->get();

        $grouped = [];
        foreach ($cities as $city) {
            $govId = $city->governorate_id;
            if (! isset($grouped[$govId])) {
                $grouped[$govId] = [
                    'governorate_id' => $govId,
                    'governorate_name_ar' => $city->governorate_name_ar,
                    'governorate_name_en' => $city->governorate_name_en,
                    'cities' => [],
                ];
            }
            $grouped[$govId]['cities'][] = [
                'id' => $city->id,
                'name_ar' => $city->name_ar,
                'name_en' => $city->name_en,
                'governorate_id' => $city->governorate_id,
                'governorate_name_ar' => $city->governorate_name_ar,
                'governorate_name_en' => $city->governorate_name_en,
                'is_active' => (bool) $city->is_active,
                'distribution_zone_id' => $city->distribution_zone_id ? (int) $city->distribution_zone_id : null,
                'distribution_zone_name' => $city->distribution_zone_name,
            ];
        }

        return response()->json([
            'data' => array_values($grouped),
            'total' => $cities->count(),
        ]);
    }

    /** Generate the next unique zone code in DZ-NNNN format. */
    private function generateNextCode(): string
    {
        $max = DistributionZone::withTrashed()->max('id') ?? 0;
        $n = $max + 1;

        do {
            $code = 'DZ-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
            $n++;
        } while (DistributionZone::withTrashed()->where('code', $code)->exists());

        return $code;
    }
}
