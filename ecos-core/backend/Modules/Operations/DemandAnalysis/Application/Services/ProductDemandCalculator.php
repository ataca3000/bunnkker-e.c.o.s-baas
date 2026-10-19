<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Aggregates order-line demand for a wave, grouped by product.
 *
 * Incremental mode: pass $affectedProductIds to recalculate only products
 * touched by a specific order change. All other product rows remain untouched.
 *
 * All aggregation is pushed to the database in a single query to support
 * 1,000,000+ order lines without loading into PHP memory.
 */
final class ProductDemandCalculator
{
    /**
     * @param  list<string>|null  $affectedProductIds  Null = full wave recalculation.
     * @return list<array<string, mixed>>
     */
    public function calculate(PreparationWave $wave, ?array $affectedProductIds = null): array
    {
        $query = DB::table('preparation_wave_orders as pwo')
            ->join('order_lines as ol', 'ol.order_id', '=', 'pwo.order_id')
            ->join('products as p', 'p.id', '=', 'ol.product_id')
            ->where('pwo.preparation_wave_id', $wave->id)
            ->selectRaw('
                ol.product_id,
                p.name       AS product_name,
                p.sku        AS product_sku,
                SUM(ol.quantity)                       AS required_qty,
                SUM(COALESCE(ol.prepared_qty, 0))      AS prepared_qty,
                COUNT(DISTINCT ol.order_id)            AS orders_count
            ')
            ->groupBy('ol.product_id', 'p.name', 'p.sku');

        if ($affectedProductIds !== null && count($affectedProductIds) > 0) {
            $query->whereIn('ol.product_id', $affectedProductIds);
        }

        $now = now()->toDateTimeString();

        return $query->get()->map(function (object $row) use ($wave, $now): array {
            $required = round((float) $row->required_qty, 4);
            $prepared = round((float) $row->prepared_qty, 4);
            $remaining = max(0.0, round($required - $prepared, 4));
            $completionPct = $required > 0.0
                ? round(($prepared / $required) * 100.0, 2)
                : 0.0;

            return [
                'id' => Str::uuid()->toString(),
                'company_id' => $wave->company_id,
                'warehouse_id' => $wave->warehouse_id,
                'preparation_wave_id' => $wave->id,
                'product_id' => $row->product_id,
                'product_name' => $row->product_name,
                'product_sku' => $row->product_sku,
                'required_qty' => $required,
                'prepared_qty' => $prepared,
                'remaining_qty' => $remaining,
                'orders_count' => (int) $row->orders_count,
                'completion_pct' => $completionPct,
                'data_hash' => md5($wave->id.$row->product_id.$required.$prepared),
                'last_calculated_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        })->all();
    }

    /**
     * Derive which product IDs a single order contains.
     *
     * @return list<string>
     */
    public function productIdsForOrder(string $orderId): array
    {
        return DB::table('order_lines')
            ->where('order_id', $orderId)
            ->distinct()
            ->pluck('product_id')
            ->all();
    }

    /**
     * Derive the union of product IDs across multiple orders.
     *
     * @param  list<string>  $orderIds
     * @return list<string>
     */
    public function productIdsForOrders(array $orderIds): array
    {
        if (empty($orderIds)) {
            return [];
        }

        return DB::table('order_lines')
            ->whereIn('order_id', $orderIds)
            ->distinct()
            ->pluck('product_id')
            ->all();
    }
}
