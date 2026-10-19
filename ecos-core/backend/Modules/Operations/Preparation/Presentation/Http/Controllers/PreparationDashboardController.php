<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

final class PreparationDashboardController extends Controller
{
    use HasApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'warehouse_id' => ['nullable', 'uuid'],
            'planning_date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $companyId = $request->user()->company_id;
        $planningDate = $request->query('planning_date', now()->toDateString());
        $warehouseId = $request->query('warehouse_id');

        $cacheKey = "prep_dashboard_{$companyId}_{$warehouseId}_{$planningDate}";

        $data = Cache::remember($cacheKey, 30, function () use ($companyId, $planningDate, $warehouseId) {
            return $this->buildDashboard($companyId, $planningDate, $warehouseId);
        });

        return $this->success($data);
    }

    /** @return array<string, mixed> */
    private function buildDashboard(string $companyId, string $planningDate, ?string $warehouseId): array
    {
        $waveQuery = PreparationWave::with(['workers' => fn ($q) => $q->whereNull('released_at')])
            ->where('company_id', $companyId)
            ->whereDate('planning_date', $planningDate)
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId));

        $waves = $waveQuery->get();

        $byStatus = $waves->groupBy(fn ($w) => $w->status->value)->map->count();

        $statusKeys = ['draft', 'planning', 'shortage_blocked', 'preparing', 'completed', 'cancelled'];
        $wavesByStatus = collect($statusKeys)->mapWithKeys(
            fn ($s) => [$s => $byStatus->get($s, 0)],
        )->all();

        $ordersInPrep = $waves->whereIn('status.value', ['planning', 'shortage_blocked', 'preparing'])->sum('orders_count');
        $unitsRequired = $waves->sum('total_units_required');
        $unitsPrepared = $waves->sum('total_units_prepared');
        $compPct = $unitsRequired > 0 ? round(($unitsPrepared / $unitsRequired) * 100, 1) : 0.0;

        $openExceptions = DB::table('preparation_exceptions')
            ->where('company_id', $companyId)
            ->where('status', 'open')
            ->whereIn('preparation_wave_id', $waves->pluck('id')->toArray())
            ->count();

        $workersActive = DB::table('preparation_wave_workers')
            ->whereIn('preparation_wave_id', $waves->pluck('id')->toArray())
            ->whereNull('released_at')
            ->distinct('user_id')
            ->count();

        $poolAvailable = DB::table('prepared_products_pool')
            ->where('company_id', $companyId)
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId))
            ->sum('quantity_available');

        $activeWaves = $waves->whereIn('status.value', ['preparing', 'shortage_blocked', 'planning'])
            ->values()
            ->map(fn ($w) => [
                'id' => $w->id,
                'wave_number' => $w->wave_number,
                'status' => $w->status->value,
                'orders_count' => $w->orders_count,
                'completion_pct' => $w->completionPct(),
                'shortage_detected' => $w->shortage_detected,
                'started_at' => $w->started_at?->toIso8601String(),
            ])->all();

        $alerts = $waves->where('shortage_detected', true)
            ->where('status.value', 'shortage_blocked')
            ->map(fn ($w) => [
                'type' => 'shortage',
                'severity' => 'blocking',
                'wave_id' => $w->id,
                'message' => "Wave {$w->wave_number} blocked: material shortage detected",
            ])->values()->all();

        return [
            'planning_date' => $planningDate,
            'kpis' => [
                'waves_total' => $waves->count(),
                'waves_by_status' => $wavesByStatus,
                'orders_in_preparation' => (int) $ordersInPrep,
                'products_required' => (int) $waves->sum('products_count'),
                'units_required' => $unitsRequired,
                'units_prepared' => $unitsPrepared,
                'completion_pct' => $compPct,
                'open_exceptions' => $openExceptions,
                'pool_available_units' => (float) $poolAvailable,
                'workers_active' => $workersActive,
            ],
            'active_waves' => $activeWaves,
            'alerts' => $alerts,
        ];
    }
}
