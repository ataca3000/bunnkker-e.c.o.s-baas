<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PreparationWorkerController extends Controller
{
    use HasApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'warehouse_id' => ['required', 'uuid'],
            'planning_date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $companyId = $request->user()->company_id;
        $warehouseId = $request->query('warehouse_id');
        $planningDate = $request->query('planning_date', now()->toDateString());

        $rows = DB::table('preparation_wave_workers as pww')
            ->join('preparation_waves as pw', 'pw.id', '=', 'pww.preparation_wave_id')
            ->join('users as u', 'u.id', '=', 'pww.user_id')
            ->where('pw.company_id', $companyId)
            ->where('pw.warehouse_id', $warehouseId)
            ->whereDate('pw.planning_date', $planningDate)
            ->whereNull('pww.released_at')
            ->select(
                'pww.user_id',
                'u.name as user_name',
                'pww.role',
                'pw.id as wave_id',
                'pw.wave_number',
                'pw.status as wave_status',
                'pww.assigned_at',
            )
            ->get();

        return $this->success($rows->map(fn ($r) => [
            'user_id' => $r->user_id,
            'name' => $r->user_name,
            'role' => $r->role,
            'wave_id' => $r->wave_id,
            'wave_number' => $r->wave_number,
            'wave_status' => $r->wave_status,
            'assigned_at' => $r->assigned_at,
            'status' => 'active',
        ])->values()->all());
    }
}
