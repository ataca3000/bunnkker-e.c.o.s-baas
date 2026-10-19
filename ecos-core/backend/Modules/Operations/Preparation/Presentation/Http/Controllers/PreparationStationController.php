<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Domain\Models\PreparationStation;

final class PreparationStationController extends Controller
{
    use HasApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'warehouse_id' => ['required', 'uuid'],
            'status' => ['nullable', 'string', 'in:active,inactive,maintenance'],
        ]);

        $companyId = $request->user()->company_id;
        $warehouseId = $request->query('warehouse_id');

        $stations = PreparationStation::where('company_id', $companyId)
            ->where('warehouse_id', $warehouseId)
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->get();

        $workerCountsByStation = DB::table('preparation_wave_workers as pww')
            ->join('preparation_waves as pw', 'pw.id', '=', 'pww.preparation_wave_id')
            ->where('pw.company_id', $companyId)
            ->where('pw.status', 'preparing')
            ->whereNull('pww.released_at')
            ->selectRaw('COUNT(DISTINCT pww.user_id) as worker_count')
            ->value('worker_count') ?? 0;

        return $this->success($stations->map(fn ($s) => [
            'id' => $s->id,
            'name' => $s->name,
            'name_ar' => $s->name_ar,
            'station_type' => $s->station_type?->value,
            'zone' => $s->zone,
            'capacity' => $s->capacity,
            'status' => $s->status?->value,
            'current_workers' => 0,
        ])->values()->all());
    }
}
