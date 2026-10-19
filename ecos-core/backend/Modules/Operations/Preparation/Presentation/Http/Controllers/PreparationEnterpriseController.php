<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Configuration\Domain\Models\BrandPolicy;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveOrder;
use Modules\Operations\Preparation\Domain\Services\EnterpriseQueueSorterService;

/**
 * Enterprise Preparation endpoints (Phases 6, 8, 9, 13, 14).
 *
 * All endpoints are read-only. No mutations happen here.
 */
final class PreparationEnterpriseController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly EnterpriseQueueSorterService $sorter,
    ) {}

    /**
     * Phase 6 — Enterprise Queue
     * GET /preparation/enterprise/queue
     *
     * Returns all open wave orders across active waves, sorted by the
     * 7-criteria enterprise priority:
     * window → prep_priority → zone → date → paid → value → number
     */
    public function queue(Request $request): JsonResponse
    {
        $request->validate([
            'warehouse_id' => ['nullable', 'uuid'],
            'planning_date' => ['nullable', 'date_format:Y-m-d'],
            'wave_id' => ['nullable', 'uuid'],
        ]);

        $companyId = $request->user()->company_id;
        $planningDate = $request->query('planning_date', now()->toDateString());

        $waveIds = PreparationWave::where('company_id', $companyId)
            ->whereDate('planning_date', $planningDate)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->when($request->query('warehouse_id'), fn ($q, $v) => $q->where('warehouse_id', $v))
            ->when($request->query('wave_id'), fn ($q, $v) => $q->where('id', $v))
            ->pluck('id');

        if ($waveIds->isEmpty()) {
            return $this->success(['data' => [], 'total' => 0]);
        }

        $orders = PreparationWaveOrder::whereIn('preparation_wave_id', $waveIds)
            ->where('company_id', $companyId)
            ->get();

        $sorted = $this->sorter->sort($orders);

        return $this->success([
            'data' => $sorted->map(fn ($o) => [
                'id' => $o->id,
                'order_id' => $o->order_id,
                'order_number' => $o->order_number,
                'preparation_wave_id' => $o->preparation_wave_id,
                'delivery_window_label' => $o->delivery_window_label,
                'delivery_window_starts_at' => $o->delivery_window_starts_at,
                'delivery_window_ends_at' => $o->delivery_window_ends_at,
                'governorate_snapshot' => $o->governorate_snapshot,
                'zone_code_snapshot' => $o->zone_code_snapshot,
                'shipping_cost_snapshot' => $o->shipping_cost_snapshot,
                'preparation_priority' => $o->preparation_priority,
                'is_paid' => $o->is_paid,
            ])->all(),
            'total' => $sorted->count(),
        ]);
    }

    /**
     * Phase 8 — Capacity Planning
     * GET /preparation/enterprise/capacity
     *
     * Returns header KPIs for the planning date.
     */
    public function capacity(Request $request): JsonResponse
    {
        $request->validate([
            'warehouse_id' => ['nullable', 'uuid'],
            'planning_date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $companyId = $request->user()->company_id;
        $planningDate = $request->query('planning_date', now()->toDateString());
        $warehouseId = $request->query('warehouse_id');

        $waves = PreparationWave::where('company_id', $companyId)
            ->whereDate('planning_date', $planningDate)
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId))
            ->get(['id', 'status', 'orders_count', 'total_units_required',
                'total_units_prepared', 'started_at', 'completed_at']);

        $totalOrders = $waves->sum('orders_count');
        $preparingCount = $waves->where('status.value', 'preparing')->count();
        $completedCount = $waves->where('status.value', 'completed')->count();
        $waitingCount = $waves->whereIn('status.value', ['draft', 'planning', 'shortage_blocked'])->count();
        $totalUnits = $waves->sum('total_units_required');
        $preparedUnits = $waves->sum('total_units_prepared');

        $avgPrepMinutes = $waves
            ->filter(fn ($w) => $w->started_at && $w->completed_at)
            ->map(fn ($w) => $w->started_at->diffInMinutes($w->completed_at))
            ->avg() ?? 0;

        return $this->success([
            'planning_date' => $planningDate,
            'total_orders' => (int) $totalOrders,
            'waves_preparing' => $preparingCount,
            'waves_completed' => $completedCount,
            'waves_waiting' => $waitingCount,
            'total_units_required' => (float) $totalUnits,
            'total_units_prepared' => (float) $preparedUnits,
            'overall_completion_pct' => $totalUnits > 0
                ? round(($preparedUnits / $totalUnits) * 100, 1) : 0.0,
            'avg_preparation_minutes' => round((float) $avgPrepMinutes, 1),
            'estimated_dispatch_time' => null, // requires delivery window config
        ]);
    }

    /**
     * Phase 9 — Wave Optimization Suggestions
     * GET /preparation/enterprise/optimization
     *
     * Groups pending orders by brand → channel → governorate → zone → window
     * to suggest optimal wave groupings that minimise picker travel.
     */
    public function optimization(Request $request): JsonResponse
    {
        $request->validate([
            'planning_date' => ['nullable', 'date_format:Y-m-d'],
            'warehouse_id' => ['nullable', 'uuid'],
        ]);

        $companyId = $request->user()->company_id;
        $planningDate = $request->query('planning_date', now()->toDateString());
        $warehouseId = $request->query('warehouse_id');

        // Only draft/planning waves — these are candidates for optimisation
        $waveIds = PreparationWave::where('company_id', $companyId)
            ->whereDate('planning_date', $planningDate)
            ->whereIn('status', ['draft', 'planning'])
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId))
            ->pluck('id');

        if ($waveIds->isEmpty()) {
            return $this->success(['suggestions' => [], 'message' => 'No waves in draft/planning status.']);
        }

        $orders = PreparationWaveOrder::whereIn('preparation_wave_id', $waveIds)
            ->where('company_id', $companyId)
            ->get();

        // Group by governorate → zone to create picking clusters
        $clusters = $orders
            ->groupBy(fn ($o) => ($o->governorate_snapshot ?? 'Unknown').'|'.($o->zone_code_snapshot ?? 'Unknown'))
            ->map(fn ($group, $key) => [
                'cluster_key' => $key,
                'governorate' => $group->first()->governorate_snapshot ?? 'Unknown',
                'zone_code' => $group->first()->zone_code_snapshot ?? 'Unknown',
                'order_count' => $group->count(),
                'wave_ids' => $group->pluck('preparation_wave_id')->unique()->values()->all(),
                'suggestion' => $group->count() >= 5
                    ? 'Merge into dedicated zone wave'
                    : 'Can be grouped with adjacent zone',
            ])
            ->sortByDesc('order_count')
            ->values();

        return $this->success([
            'planning_date' => $planningDate,
            'total_orders' => $orders->count(),
            'clusters_detected' => $clusters->count(),
            'suggestions' => $clusters->all(),
        ]);
    }

    /**
     * Phase 13 — Live Dashboard (enhanced with delivery windows + geography)
     * GET /preparation/enterprise/dashboard
     */
    public function dashboard(Request $request): JsonResponse
    {
        $request->validate([
            'warehouse_id' => ['nullable', 'uuid'],
            'planning_date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $companyId = $request->user()->company_id;
        $planningDate = $request->query('planning_date', now()->toDateString());
        $warehouseId = $request->query('warehouse_id');

        $waves = PreparationWave::with(['waveOrders'])
            ->where('company_id', $companyId)
            ->whereDate('planning_date', $planningDate)
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId))
            ->get();

        $allOrders = $waves->flatMap(fn ($w) => $w->waveOrders);

        // Delivery window breakdown
        $windowBreakdown = $allOrders
            ->groupBy(fn ($o) => $o->delivery_window_label ?? 'No Window')
            ->map(fn ($orders, $label) => [
                'label' => $label,
                'order_count' => $orders->count(),
                'wave_count' => $orders->pluck('preparation_wave_id')->unique()->count(),
                'starts_at' => $orders->first()->delivery_window_starts_at,
            ])
            ->sortBy('starts_at')
            ->values();

        // Geography distribution
        $geoDistribution = $allOrders
            ->groupBy(fn ($o) => $o->governorate_snapshot ?? 'Unknown')
            ->map(fn ($govOrders, $gov) => [
                'governorate' => $gov,
                'order_count' => $govOrders->count(),
                'zones' => $govOrders
                    ->groupBy(fn ($o) => $o->zone_code_snapshot ?? 'Unknown')
                    ->map(fn ($zo, $zone) => ['zone_code' => $zone, 'order_count' => $zo->count()])
                    ->values(),
            ])
            ->sortByDesc('order_count')
            ->values();

        // SLA status
        $totalOrders = $allOrders->count();
        $paidOrders = $allOrders->where('is_paid', true)->count();

        return $this->success([
            'planning_date' => $planningDate,
            'total_orders' => $totalOrders,
            'paid_orders' => $paidOrders,
            'unpaid_orders' => $totalOrders - $paidOrders,
            'waves_count' => $waves->count(),
            'window_breakdown' => $windowBreakdown->all(),
            'geography_distribution' => $geoDistribution->all(),
        ]);
    }

    /**
     * Phase 14 — AI Context Endpoint
     * GET /preparation/enterprise/ai-context
     *
     * Returns full operational context for AI wave optimization suggestions.
     */
    public function aiContext(Request $request): JsonResponse
    {
        $request->validate([
            'planning_date' => ['nullable', 'date_format:Y-m-d'],
            'warehouse_id' => ['nullable', 'uuid'],
            'brand_id' => ['nullable', 'uuid'],
        ]);

        $companyId = $request->user()->company_id;
        $planningDate = $request->query('planning_date', now()->toDateString());
        $brandId = $request->query('brand_id');

        $waves = PreparationWave::with(['waveOrders'])
            ->where('company_id', $companyId)
            ->whereDate('planning_date', $planningDate)
            ->when($request->query('warehouse_id'), fn ($q, $v) => $q->where('warehouse_id', $v))
            ->when($brandId, fn ($q, $v) => $q->where('brand_id', $v))
            ->get();

        $allOrders = $waves->flatMap(fn ($w) => $w->waveOrders);

        // Brand preparation policy for AI
        $brandPolicy = $brandId
            ? (BrandPolicy::where('brand_id', $brandId)
                ->where('policy_group', 'preparation')
                ->where('is_active', true)
                ->first()?->settings
                ?? BrandPolicy::defaultSettings('preparation'))
            : null;

        return $this->success([
            'planning_date' => $planningDate,
            'brand_id' => $brandId,
            'context' => [
                'total_waves' => $waves->count(),
                'total_orders' => $allOrders->count(),
                'brand_policy' => $brandPolicy,
                'geography' => [
                    'governorates' => $allOrders
                        ->groupBy('governorate_snapshot')
                        ->map(fn ($g, $gov) => [
                            'governorate' => $gov,
                            'order_count' => $g->count(),
                            'zone_codes' => $g->pluck('zone_code_snapshot')->unique()->filter()->values()->all(),
                        ])
                        ->values()->all(),
                ],
                'delivery_windows' => $allOrders
                    ->groupBy('delivery_window_label')
                    ->map(fn ($g, $lbl) => [
                        'label' => $lbl,
                        'order_count' => $g->count(),
                        'starts_at' => $g->first()->delivery_window_starts_at,
                        'ends_at' => $g->first()->delivery_window_ends_at,
                    ])
                    ->sortBy('starts_at')
                    ->values()->all(),
                'urgency_signals' => [
                    'paid_orders' => $allOrders->where('is_paid', true)->count(),
                    'high_priority_orders' => $allOrders->where('preparation_priority', '<', 3)->count(),
                ],
            ],
        ]);
    }
}
