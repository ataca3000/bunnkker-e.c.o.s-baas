<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Operations\Loading\Domain\Models\LoadingSession;

final class LoadingDashboardController extends Controller
{
    use HasApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'warehouse_id' => ['nullable', 'uuid'],
            'operational_date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $companyId = $request->user()->company_id;
        $date = $request->query('operational_date', now()->toDateString());
        $warehouseId = $request->query('warehouse_id');

        $sessions = LoadingSession::where('company_id', $companyId)
            ->whereDate('operational_date', $date)
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId))
            ->get();

        $byStatus = $sessions->groupBy(fn ($s) => is_string($s->status) ? $s->status : $s->status->value)->map->count();

        return $this->success([
            'operational_date' => $date,
            'kpis' => [
                'sessions_total' => $sessions->count(),
                'sessions_by_status' => $byStatus->all(),
                'vehicles_dispatched' => $sessions->sum('vehicles_count'),
                'orders_covered' => $sessions->sum('orders_count'),
                'total_units_to_load' => (float) $sessions->sum('total_units_to_load'),
                'total_units_loaded' => (float) $sessions->sum('total_units_loaded'),
            ],
            'active_sessions' => $sessions->whereNotIn(
                'status',
                ['closed', 'cancelled'],
            )->values()->map(fn ($s) => [
                'id' => $s->id,
                'session_number' => $s->session_number,
                'status' => is_string($s->status) ? $s->status : $s->status->value,
                'vehicles_count' => $s->vehicles_count,
                'orders_count' => $s->orders_count,
            ])->all(),
        ]);
    }
}
