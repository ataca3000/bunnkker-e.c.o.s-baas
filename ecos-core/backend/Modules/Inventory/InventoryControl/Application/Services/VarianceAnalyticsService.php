<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Application\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\CountSessions\Domain\Enums\CountSessionStatus;

/**
 * Provides variance analytics for inventory control reporting.
 */
final class VarianceAnalyticsService
{
    /** Most frequently missing products (negative variance count). */
    public function frequentlyMissing(int $limit = 10): array
    {
        return $this->frequentVariance('< 0', $limit, 'variance_count DESC');
    }

    /** Most frequently overcounted products (positive variance count). */
    public function frequentlyOvercounted(int $limit = 10): array
    {
        return $this->frequentVariance('> 0', $limit, 'variance_count DESC');
    }

    private function frequentVariance(string $sign, int $limit, string $order): array
    {
        return DB::table('inventory_count_lines as icl')
            ->join('inventory_count_sessions as ics', 'ics.id', '=', 'icl.session_id')
            ->join('products as p', 'p.id', '=', 'icl.product_id')
            ->where('ics.status', CountSessionStatus::Approved->value)
            ->whereNotNull('icl.variance_qty')
            ->whereRaw("icl.variance_qty {$sign}")
            ->selectRaw('
                icl.product_id,
                p.name as product_name,
                p.sku  as product_sku,
                COUNT(icl.id) as variance_count,
                SUM(icl.variance_qty) as total_variance_qty,
                SUM(icl.variance_value) as total_variance_value
            ')
            ->groupBy('icl.product_id', 'p.name', 'p.sku')
            ->orderByRaw($order)
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'product_id' => $r->product_id,
                'product_name' => $r->product_name,
                'product_sku' => $r->product_sku,
                'variance_count' => (int) $r->variance_count,
                'total_variance_qty' => round((float) $r->total_variance_qty, 4),
                'total_variance_value' => round((float) $r->total_variance_value, 2),
            ])
            ->all();
    }

    /** Variance value broken down by warehouse. */
    public function byWarehouse(): array
    {
        return DB::table('inventory_count_lines as icl')
            ->join('inventory_count_sessions as ics', 'ics.id', '=', 'icl.session_id')
            ->join('warehouses as w', 'w.id', '=', 'ics.warehouse_id')
            ->where('ics.status', CountSessionStatus::Approved->value)
            ->whereNotNull('icl.variance_value')
            ->selectRaw('
                ics.warehouse_id,
                w.name as warehouse_name,
                SUM(CASE WHEN icl.variance_value > 0 THEN icl.variance_value ELSE 0 END) as adj_in_value,
                SUM(CASE WHEN icl.variance_value < 0 THEN ABS(icl.variance_value) ELSE 0 END) as adj_out_value,
                SUM(icl.variance_value) as net_variance_value
            ')
            ->groupBy('ics.warehouse_id', 'w.name')
            ->orderByRaw('SUM(ABS(icl.variance_value)) DESC')
            ->get()
            ->map(fn ($r) => [
                'warehouse_id' => $r->warehouse_id,
                'warehouse_name' => $r->warehouse_name,
                'adj_in_value' => round((float) $r->adj_in_value, 2),
                'adj_out_value' => round((float) $r->adj_out_value, 2),
                'net_variance_value' => round((float) $r->net_variance_value, 2),
            ])
            ->all();
    }

    /** Variance value broken down by product category. */
    public function byCategory(): array
    {
        return DB::table('inventory_count_lines as icl')
            ->join('inventory_count_sessions as ics', 'ics.id', '=', 'icl.session_id')
            ->join('products as p', 'p.id', '=', 'icl.product_id')
            ->join('categories as c', 'c.id', '=', 'p.category_id')
            ->where('ics.status', CountSessionStatus::Approved->value)
            ->whereNotNull('icl.variance_value')
            ->selectRaw('
                p.category_id,
                c.name as category_name,
                SUM(CASE WHEN icl.variance_value > 0 THEN icl.variance_value ELSE 0 END) as adj_in_value,
                SUM(CASE WHEN icl.variance_value < 0 THEN ABS(icl.variance_value) ELSE 0 END) as adj_out_value,
                SUM(icl.variance_value) as net_variance_value
            ')
            ->groupBy('p.category_id', 'c.name')
            ->orderByRaw('SUM(ABS(icl.variance_value)) DESC')
            ->get()
            ->map(fn ($r) => [
                'category_id' => $r->category_id,
                'category_name' => $r->category_name,
                'adj_in_value' => round((float) $r->adj_in_value, 2),
                'adj_out_value' => round((float) $r->adj_out_value, 2),
                'net_variance_value' => round((float) $r->net_variance_value, 2),
            ])
            ->all();
    }

    /**
     * Monthly variance trend — last 12 months.
     *
     * @return array<int, array{month: string, adj_in_value: float, adj_out_value: float, net_variance: float}>
     */
    public function monthlyTrend(): array
    {
        $rows = DB::table('inventory_count_lines as icl')
            ->join('inventory_count_sessions as ics', 'ics.id', '=', 'icl.session_id')
            ->where('ics.status', CountSessionStatus::Approved->value)
            ->where('ics.completed_at', '>=', Carbon::now()->subYear())
            ->whereNotNull('icl.variance_value')
            ->selectRaw("
                DATE_FORMAT(ics.completed_at, '%Y-%m') as month,
                SUM(CASE WHEN icl.variance_value > 0 THEN icl.variance_value ELSE 0 END) as adj_in_value,
                SUM(CASE WHEN icl.variance_value < 0 THEN ABS(icl.variance_value) ELSE 0 END) as adj_out_value,
                SUM(icl.variance_value) as net_variance
            ")
            ->groupByRaw("DATE_FORMAT(ics.completed_at, '%Y-%m')")
            ->orderByRaw("DATE_FORMAT(ics.completed_at, '%Y-%m') ASC")
            ->get()
            ->keyBy('month');

        // Ensure all 12 months appear even if there's no data
        $months = [];
        for ($i = 11; $i >= 0; $i--) {
            $key = Carbon::now()->subMonths($i)->format('Y-m');
            $row = $rows->get($key);
            $months[] = [
                'month' => $key,
                'adj_in_value' => round((float) ($row?->adj_in_value ?? 0), 2),
                'adj_out_value' => round((float) ($row?->adj_out_value ?? 0), 2),
                'net_variance' => round((float) ($row?->net_variance ?? 0), 2),
            ];
        }

        return $months;
    }
}
