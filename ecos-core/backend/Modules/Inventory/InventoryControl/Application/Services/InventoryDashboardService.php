<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Application\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\CountSessions\Domain\Enums\CountSessionStatus;

/**
 * Computes KPIs and widget data for the Inventory Control Dashboard.
 */
final class InventoryDashboardService
{
    public function kpis(): array
    {
        $twelveMonthsAgo = Carbon::now()->subYear();
        $monthStart = Carbon::now()->startOfMonth();

        // ── Inventory Accuracy (last 12 months of approved counts) ────────────
        $accuracy = DB::table('inventory_count_lines as icl')
            ->join('inventory_count_sessions as ics', 'ics.id', '=', 'icl.session_id')
            ->where('ics.status', CountSessionStatus::Approved->value)
            ->whereNotNull('icl.counted_qty')
            ->where('ics.completed_at', '>=', $twelveMonthsAgo)
            ->selectRaw('
                COUNT(icl.id) as total_counted,
                SUM(CASE WHEN icl.variance_qty = 0 THEN 1 ELSE 0 END) as matched
            ')
            ->first();

        $totalCounted = (int) ($accuracy?->total_counted ?? 0);
        $matched = (int) ($accuracy?->matched ?? 0);
        $accuracyPct = $totalCounted > 0 ? round($matched / $totalCounted * 100, 2) : null;

        // ── Open Sessions ──────────────────────────────────────────────────────
        $openSessions = DB::table('inventory_count_sessions')
            ->whereIn('status', [CountSessionStatus::Draft->value, CountSessionStatus::InProgress->value])
            ->count();

        // ── Products With Variance (last 30 days) ─────────────────────────────
        $productsWithVariance = DB::table('inventory_count_lines as icl')
            ->join('inventory_count_sessions as ics', 'ics.id', '=', 'icl.session_id')
            ->where('ics.status', CountSessionStatus::Approved->value)
            ->whereRaw('icl.variance_qty != 0')
            ->where('ics.completed_at', '>=', Carbon::now()->subDays(30))
            ->distinct()
            ->count('icl.product_id');

        // ── Adjustment Value & Shrinkage (this calendar month, approved) ───────
        $monthAdj = DB::table('inventory_count_lines as icl')
            ->join('inventory_count_sessions as ics', 'ics.id', '=', 'icl.session_id')
            ->where('ics.status', CountSessionStatus::Approved->value)
            ->where('ics.completed_at', '>=', $monthStart)
            ->whereNotNull('icl.variance_value')
            ->selectRaw('
                COALESCE(SUM(CASE WHEN icl.variance_value > 0 THEN icl.variance_value ELSE 0 END), 0) as adj_in_value,
                COALESCE(SUM(CASE WHEN icl.variance_value < 0 THEN ABS(icl.variance_value) ELSE 0 END), 0) as shrinkage_value
            ')
            ->first();

        $adjustmentValueMonth = round((float) ($monthAdj?->adj_in_value ?? 0), 2);
        $shrinkageValueMonth = round((float) ($monthAdj?->shrinkage_value ?? 0), 2);

        // ── Last Count Date ────────────────────────────────────────────────────
        $lastCountDate = DB::table('inventory_count_sessions')
            ->where('status', CountSessionStatus::Approved->value)
            ->max('completed_at');

        return [
            'accuracy_pct' => $accuracyPct,
            'matched_products' => $matched,
            'total_counted_products' => $totalCounted,
            'open_sessions' => $openSessions,
            'products_with_variance' => $productsWithVariance,
            'adjustment_value_month' => $adjustmentValueMonth,
            'shrinkage_value_month' => $shrinkageValueMonth,
            'last_count_date' => $lastCountDate,
            'health' => $this->healthLabel($accuracyPct),
        ];
    }

    /** @return array<int, array{product_id: string, product_name: string, variance_qty: float, variance_value: float}> */
    public function topNegativeVariances(int $limit = 10): array
    {
        return DB::table('inventory_count_lines as icl')
            ->join('inventory_count_sessions as ics', 'ics.id', '=', 'icl.session_id')
            ->join('products as p', 'p.id', '=', 'icl.product_id')
            ->where('ics.status', CountSessionStatus::Approved->value)
            ->where('ics.completed_at', '>=', Carbon::now()->subYear())
            ->selectRaw('
                icl.product_id,
                p.name as product_name,
                p.sku as product_sku,
                SUM(icl.variance_qty) as total_variance_qty,
                SUM(icl.variance_value) as total_variance_value
            ')
            ->groupBy('icl.product_id', 'p.name', 'p.sku')
            ->havingRaw('SUM(icl.variance_qty) < 0')
            ->orderByRaw('SUM(icl.variance_qty) ASC')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'product_id' => $r->product_id,
                'product_name' => $r->product_name,
                'product_sku' => $r->product_sku,
                'variance_qty' => round((float) $r->total_variance_qty, 4),
                'variance_value' => round((float) $r->total_variance_value, 2),
            ])
            ->all();
    }

    /** @return array<int, array{product_id: string, product_name: string, variance_qty: float, variance_value: float}> */
    public function topPositiveVariances(int $limit = 10): array
    {
        return DB::table('inventory_count_lines as icl')
            ->join('inventory_count_sessions as ics', 'ics.id', '=', 'icl.session_id')
            ->join('products as p', 'p.id', '=', 'icl.product_id')
            ->where('ics.status', CountSessionStatus::Approved->value)
            ->where('ics.completed_at', '>=', Carbon::now()->subYear())
            ->selectRaw('
                icl.product_id,
                p.name as product_name,
                p.sku as product_sku,
                SUM(icl.variance_qty) as total_variance_qty,
                SUM(icl.variance_value) as total_variance_value
            ')
            ->groupBy('icl.product_id', 'p.name', 'p.sku')
            ->havingRaw('SUM(icl.variance_qty) > 0')
            ->orderByRaw('SUM(icl.variance_qty) DESC')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'product_id' => $r->product_id,
                'product_name' => $r->product_name,
                'product_sku' => $r->product_sku,
                'variance_qty' => round((float) $r->total_variance_qty, 4),
                'variance_value' => round((float) $r->total_variance_value, 2),
            ])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    public function recentSessions(int $limit = 5): array
    {
        return DB::table('inventory_count_sessions as ics')
            ->join('warehouses as w', 'w.id', '=', 'ics.warehouse_id')
            ->whereIn('ics.status', [CountSessionStatus::Completed->value, CountSessionStatus::Approved->value])
            ->selectRaw('
                ics.id,
                ics.count_number,
                ics.status,
                ics.completed_at,
                w.name as warehouse_name,
                COUNT(icl.id) as total_lines,
                SUM(CASE WHEN icl.variance_qty = 0 AND icl.counted_qty IS NOT NULL THEN 1 ELSE 0 END) as matched_lines,
                COUNT(CASE WHEN icl.counted_qty IS NOT NULL THEN 1 END) as counted_lines
            ')
            ->leftJoin('inventory_count_lines as icl', 'icl.session_id', '=', 'ics.id')
            ->groupBy('ics.id', 'ics.count_number', 'ics.status', 'ics.completed_at', 'w.name')
            ->orderByDesc('ics.completed_at')
            ->limit($limit)
            ->get()
            ->map(function ($r): array {
                $counted = (int) $r->counted_lines;
                $matched = (int) $r->matched_lines;
                $accuracy = $counted > 0 ? round($matched / $counted * 100, 2) : null;

                return [
                    'id' => $r->id,
                    'count_number' => $r->count_number,
                    'status' => $r->status,
                    'completed_at' => $r->completed_at,
                    'warehouse_name' => $r->warehouse_name,
                    'accuracy_pct' => $accuracy,
                ];
            })
            ->all();
    }

    private function healthLabel(?float $pct): string
    {
        if ($pct === null) {
            return 'unknown';
        }

        return match (true) {
            $pct >= 98 => 'excellent',
            $pct >= 95 => 'good',
            $pct >= 90 => 'warning',
            default => 'critical',
        };
    }
}
