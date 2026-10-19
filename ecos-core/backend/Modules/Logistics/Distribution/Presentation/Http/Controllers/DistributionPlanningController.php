<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Distribution\Domain\Models\DistributionZone;
use Modules\Logistics\Distribution\Domain\Models\DistributionZonePlan;

class DistributionPlanningController extends Controller
{
    private const READY_STATUSES = ['confirmed', 'preparing'];

    // ── Stats (KPI header) ────────────────────────────────────────────────────

    public function stats(Request $request): JsonResponse
    {
        $date = $request->input('date');

        $ordersQuery = DB::table('orders')
            ->whereIn('status', self::READY_STATUSES)
            ->whereNull('deleted_at');

        if ($date) {
            $ordersQuery->where('requested_delivery_date', $date);
        }

        $orders = $ordersQuery->select(['id', 'logistics_city_id', 'city', 'customer_id', 'total'])->get();

        [$zoneMap, $nameMap] = $this->buildCityZoneMaps();

        $assigned = 0;
        $unassigned = 0;
        $zoneIds = [];
        $totalValue = 0.0;

        foreach ($orders as $order) {
            $zoneId = $this->resolveZone($order, $zoneMap, $nameMap);
            $totalValue += (float) $order->total;
            if ($zoneId) {
                $assigned++;
                $zoneIds[$zoneId] = true;
            } else {
                $unassigned++;
            }
        }

        // Distinct products across all ready orders
        $productQuery = DB::table('order_lines as ol')
            ->join('orders as o', 'o.id', '=', 'ol.order_id')
            ->whereIn('o.status', self::READY_STATUSES)
            ->whereNull('o.deleted_at');

        if ($date) {
            $productQuery->where('o.requested_delivery_date', $date);
        }

        $distinctProducts = $productQuery->distinct()->count('ol.product_id');

        return response()->json([
            'ready_orders' => $orders->count(),
            'active_zones' => count($zoneIds),
            'unassigned_orders' => $unassigned,
            'total_collection' => round($totalValue, 2),
            'distinct_products' => $distinctProducts,
        ]);
    }

    // ── Zone cards ────────────────────────────────────────────────────────────

    public function zones(Request $request): JsonResponse
    {
        $date = $request->input('date');
        $statusFilter = $request->input('status');
        $search = $request->input('search');
        $showEmpty = filter_var($request->input('show_empty', false), FILTER_VALIDATE_BOOLEAN);

        $ordersQuery = DB::table('orders')
            ->whereIn('status', self::READY_STATUSES)
            ->whereNull('deleted_at');

        if ($date) {
            $ordersQuery->where('requested_delivery_date', $date);
        }

        $orders = $ordersQuery->select(['id', 'logistics_city_id', 'city', 'customer_id', 'total'])->get();

        [$zoneMap, $nameMap] = $this->buildCityZoneMaps();

        // Aggregate orders per zone
        $zoneAggregates = [];
        foreach ($orders as $order) {
            $zoneId = $this->resolveZone($order, $zoneMap, $nameMap);
            if (! $zoneId) {
                continue;
            }
            if (! isset($zoneAggregates[$zoneId])) {
                $zoneAggregates[$zoneId] = [
                    'order_ids' => [],
                    'customer_ids' => [],
                    'total' => 0.0,
                ];
            }
            $zoneAggregates[$zoneId]['order_ids'][] = $order->id;
            $zoneAggregates[$zoneId]['customer_ids'][$order->customer_id] = true;
            $zoneAggregates[$zoneId]['total'] += (float) $order->total;
        }

        // Product / qty counts
        $allOrderIds = empty($zoneAggregates)
            ? []
            : array_merge(...array_values(array_map(fn ($a) => $a['order_ids'], $zoneAggregates)));

        $productsByOrder = $allOrderIds
            ? DB::table('order_lines')
                ->whereIn('order_id', $allOrderIds)
                ->select(['order_id', 'product_id', DB::raw('SUM(quantity) as qty')])
                ->groupBy(['order_id', 'product_id'])
                ->get()
                ->groupBy('order_id')
            : collect();

        // Load planning statuses (not date-scoped so empty zones still get their status)
        $planningStatuses = [];
        $planQuery = DistributionZonePlan::query();
        if ($date) {
            $planQuery->where('planning_date', $date);
        }
        $planQuery->get()->each(function ($plan) use (&$planningStatuses): void {
            $planningStatuses[$plan->zone_id] = $plan->status;
        });

        // Load all active zones (for show_empty support)
        $zonesQuery = DistributionZone::where('is_active', true)->orderBy('code');
        if ($search) {
            $zonesQuery->where(function ($q) use ($search): void {
                $q->where('name_ar', 'like', '%'.$search.'%')
                    ->orWhere('name_en', 'like', '%'.$search.'%')
                    ->orWhere('code', 'like', '%'.$search.'%');
            });
        }
        $allZones = $zonesQuery->get()->keyBy('id');

        $result = [];

        foreach ($allZones as $zoneId => $zone) {
            $agg = $zoneAggregates[$zoneId] ?? null;

            if (! $agg && ! $showEmpty) {
                continue;
            }

            $productSet = [];
            $totalItems = 0.0;

            if ($agg) {
                foreach ($agg['order_ids'] as $orderId) {
                    foreach ($productsByOrder->get($orderId, collect()) as $line) {
                        $productSet[$line->product_id] = true;
                        $totalItems += (float) $line->qty;
                    }
                }
            }

            $planningStatus = $planningStatuses[$zoneId] ?? 'ready';

            if ($statusFilter && $planningStatus !== $statusFilter) {
                continue;
            }

            $result[] = [
                'zone_id' => $zoneId,
                'code' => $zone->code,
                'name_ar' => $zone->name_ar,
                'name_en' => $zone->name_en,
                'color' => $zone->color,
                'orders_count' => $agg ? count($agg['order_ids']) : 0,
                'customers_count' => $agg ? count($agg['customer_ids']) : 0,
                'estimated_stops' => $agg ? count($agg['customer_ids']) : 0,
                'distinct_products' => count($productSet),
                'total_qty' => round($totalItems, 2),
                'total_collection' => round($agg['total'] ?? 0.0, 2),
                'planning_status' => $planningStatus,
            ];
        }

        usort($result, function ($a, $b): int {
            if ($a['orders_count'] === 0 && $b['orders_count'] > 0) {
                return 1;
            }
            if ($b['orders_count'] === 0 && $a['orders_count'] > 0) {
                return -1;
            }

            return $b['orders_count'] <=> $a['orders_count'];
        });

        return response()->json(['data' => $result]);
    }

    // ── Unassigned orders ─────────────────────────────────────────────────────

    public function unassigned(Request $request): JsonResponse
    {
        $date = $request->input('date');
        $search = $request->input('search');

        $ordersQuery = DB::table('orders as o')
            ->whereIn('o.status', self::READY_STATUSES)
            ->whereNull('o.deleted_at');

        if ($date) {
            $ordersQuery->where('o.requested_delivery_date', $date);
        }

        if ($search) {
            $ordersQuery->where(function ($q) use ($search): void {
                $q->where('o.order_number', 'like', '%'.$search.'%')
                    ->orWhere('o.customer_name', 'like', '%'.$search.'%')
                    ->orWhere('o.city', 'like', '%'.$search.'%');
            });
        }

        $orders = $ordersQuery
            ->select([
                'o.id', 'o.logistics_city_id', 'o.city', 'o.governorate',
                'o.customer_name', 'o.customer_id', 'o.total', 'o.status',
                'o.order_number', 'o.requested_delivery_date', 'o.payment_method',
                'o.billing_phone',
            ])
            ->get();

        [$zoneMap, $nameMap, $cityHasZone] = $this->buildCityZoneMaps(true);

        $unassigned = $orders
            ->filter(fn ($o) => $this->resolveZone($o, $zoneMap, $nameMap) === null)
            ->map(function ($o) use ($zoneMap, $nameMap, $cityHasZone) {
                $reason = $this->resolveMissingReason($o, $zoneMap, $nameMap, $cityHasZone);

                return array_merge((array) $o, ['missing_reason' => $reason]);
            })
            ->values();

        return response()->json([
            'data' => $unassigned,
            'total' => $unassigned->count(),
        ]);
    }

    // ── Start planning ────────────────────────────────────────────────────────

    public function startPlanning(Request $request, int $zoneId): JsonResponse
    {
        DistributionZone::where('is_active', true)->findOrFail($zoneId);

        $date = $request->input('date', today()->toDateString());
        $actor = Auth::user()?->name ?? 'System';

        $plan = DistributionZonePlan::updateOrCreate(
            ['zone_id' => $zoneId, 'planning_date' => $date],
            [
                'status' => 'in_planning',
                'planned_by' => $actor,
                'updated_by' => $actor,
            ],
        );

        return response()->json([
            'zone_id' => $zoneId,
            'planning_date' => $date,
            'planning_status' => $plan->status,
        ]);
    }

    // ── Mark zone as planned ──────────────────────────────────────────────────

    public function markPlanned(Request $request, int $zoneId): JsonResponse
    {
        DistributionZone::where('is_active', true)->findOrFail($zoneId);

        $date = $request->input('date', today()->toDateString());
        $actor = Auth::user()?->name ?? 'System';

        $plan = DistributionZonePlan::updateOrCreate(
            ['zone_id' => $zoneId, 'planning_date' => $date],
            [
                'status' => 'planned',
                'planned_by' => $actor,
                'planned_at' => now(),
                'updated_by' => $actor,
            ],
        );

        return response()->json([
            'zone_id' => $zoneId,
            'planning_date' => $date,
            'planning_status' => $plan->status,
        ]);
    }

    // ── Zone detail (orders / products / customers) ───────────────────────────

    public function zoneDetail(Request $request, int $zoneId): JsonResponse
    {
        DistributionZone::where('is_active', true)->findOrFail($zoneId);

        $date = $request->input('date');
        $tab = $request->input('tab', 'orders');
        $search = $request->input('search');

        $orderIds = $this->getOrderIdsForZone($zoneId, $date);

        if ($orderIds->isEmpty()) {
            return response()->json(['data' => [], 'tab' => $tab, 'total' => 0]);
        }

        switch ($tab) {
            case 'products':
                $query = DB::table('order_lines as ol')
                    ->join('products as p', 'p.id', '=', 'ol.product_id')
                    ->whereIn('ol.order_id', $orderIds)
                    ->select([
                        'p.id as product_id',
                        'p.name',
                        DB::raw('SUM(ol.quantity) as total_qty'),
                        DB::raw('COUNT(DISTINCT ol.order_id) as order_count'),
                        DB::raw('SUM(ol.line_total) as total_value'),
                    ])
                    ->groupBy(['p.id', 'p.name']);

                if ($search) {
                    $query->where('p.name', 'like', '%'.$search.'%');
                }

                $data = $query->orderByDesc(DB::raw('SUM(ol.quantity)'))->get();
                break;

            case 'customers':
                $query = DB::table('orders')
                    ->whereIn('id', $orderIds)
                    ->select([
                        'customer_id',
                        'customer_name',
                        DB::raw('COUNT(id) as order_count'),
                        DB::raw('SUM(total) as total_value'),
                        DB::raw('MAX(city) as city'),
                        DB::raw('MAX(billing_phone) as billing_phone'),
                    ])
                    ->groupBy(['customer_id', 'customer_name']);

                if ($search) {
                    $query->where(function ($q) use ($search): void {
                        $q->where('customer_name', 'like', '%'.$search.'%')
                            ->orWhere('billing_phone', 'like', '%'.$search.'%');
                    });
                }

                $data = $query->orderByDesc(DB::raw('COUNT(id)'))->get();
                break;

            default: // orders
                $query = DB::table('orders')
                    ->whereIn('id', $orderIds)
                    ->select([
                        'id', 'order_number', 'customer_name', 'customer_id',
                        'city', 'governorate', 'status', 'total',
                        'requested_delivery_date', 'payment_method', 'billing_phone',
                    ]);

                if ($search) {
                    $query->where(function ($q) use ($search): void {
                        $q->where('order_number', 'like', '%'.$search.'%')
                            ->orWhere('customer_name', 'like', '%'.$search.'%')
                            ->orWhere('billing_phone', 'like', '%'.$search.'%');
                    });
                }

                $data = $query->orderBy('order_number')->get();
                break;
        }

        return response()->json([
            'data' => $data,
            'tab' => $tab,
            'total' => $data->count(),
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Build city lookup maps.
     * Returns [id→zoneId, lowercaseName→zoneId, (optional) lowercaseName→hasZone].
     *
     * @return array{0: array<int,int|null>, 1: array<string,int|null>, 2?: array<string,bool>}
     */
    private function buildCityZoneMaps(bool $includeZoneFlag = false): array
    {
        $cities = DB::table('logistics_cities')
            ->whereNull('deleted_at')
            ->select(['id', 'name_en', 'distribution_zone_id'])
            ->get();

        $zoneMap = [];
        $nameMap = [];
        $cityHasZone = [];

        foreach ($cities as $city) {
            $zoneId = $city->distribution_zone_id ? (int) $city->distribution_zone_id : null;
            $zoneMap[(int) $city->id] = $zoneId;

            if ($city->name_en) {
                $key = strtolower($city->name_en);
                $nameMap[$key] = $zoneId;
                $cityHasZone[$key] = $zoneId !== null;
            }
        }

        return $includeZoneFlag ? [$zoneMap, $nameMap, $cityHasZone] : [$zoneMap, $nameMap];
    }

    /** Resolve which distribution zone an order belongs to (FK first, text fallback). */
    private function resolveZone(object $order, array $zoneMap, array $nameMap): ?int
    {
        if ($order->logistics_city_id && isset($zoneMap[(int) $order->logistics_city_id])) {
            return $zoneMap[(int) $order->logistics_city_id];
        }

        if ($order->city) {
            return $nameMap[strtolower($order->city)] ?? null;
        }

        return null;
    }

    /** Human-readable explanation for why an order has no distribution zone. */
    private function resolveMissingReason(
        object $order,
        array $zoneMap,
        array $nameMap,
        array $cityHasZone,
    ): string {
        // FK path — city exists but has no zone
        if ($order->logistics_city_id) {
            $zoneId = $zoneMap[(int) $order->logistics_city_id] ?? null;
            if ($zoneId === null) {
                return 'City not assigned to a zone';
            }
        }

        if (empty($order->city)) {
            return 'Missing city';
        }

        $key = strtolower($order->city);

        if (! array_key_exists($key, $nameMap)) {
            return 'Unknown city';
        }

        if (! ($cityHasZone[$key] ?? false)) {
            return 'City not assigned to a zone';
        }

        return 'Unresolved';
    }

    /** Get all order IDs for a zone, optionally filtered by date. */
    private function getOrderIdsForZone(int $zoneId, ?string $date): \Illuminate\Support\Collection
    {
        [$zoneMap, $nameMap] = $this->buildCityZoneMaps();

        $query = DB::table('orders')
            ->whereIn('status', self::READY_STATUSES)
            ->whereNull('deleted_at');

        if ($date) {
            $query->where('requested_delivery_date', $date);
        }

        $orders = $query->select(['id', 'logistics_city_id', 'city'])->get();

        return $orders
            ->filter(fn ($o) => $this->resolveZone($o, $zoneMap, $nameMap) === $zoneId)
            ->pluck('id');
    }
}
