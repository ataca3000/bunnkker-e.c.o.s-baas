<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Services;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\DemandAnalysis\Application\DTO\DemandAnalysisResult;
use Modules\Operations\DemandAnalysis\Application\DTO\DemandLine;
use Modules\Operations\DemandAnalysis\Domain\Enums\InventoryStatus;
use Modules\Operations\DemandAnalysis\Events\DemandAnalysisCompleted;
use Modules\Operations\DemandAnalysis\Events\DemandAnalysisFailed;
use Modules\Operations\DemandAnalysis\Events\DemandAnalysisStarted;
use Throwable;

/**
 * Generates the Daily Demand Matrix.
 *
 * All aggregation is pushed to the database via two isolated subqueries
 * (demand + stock) joined together. This avoids Cartesian products and
 * remains performant at 100k+ orders with 1M+ order lines.
 */
final class DemandAnalysisService
{
    /** Orders in these statuses require operational planning. */
    private const OPERATIONAL_STATUSES = [
        OrderStatus::NewOrder->value,
        OrderStatus::InProgress->value,
    ];

    public function analyze(?string $date = null): DemandAnalysisResult
    {
        $operationalDay = $date ?? now()->toDateString();
        $correlationId = Str::uuid()->toString();
        $startedAt = new DateTimeImmutable('now', new DateTimeZone('UTC'));

        event(new DemandAnalysisStarted($operationalDay, $correlationId, $startedAt));

        try {
            $rows = $this->fetchDemandRows();
            $totalOrders = $this->countOperationalOrders();
            $demandLines = $rows->map(fn (object $row) => $this->buildDemandLine($row))->all();

            $result = new DemandAnalysisResult(
                operationalDay: $operationalDay,
                generatedAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
                totalOrders: $totalOrders,
                totalProducts: count($demandLines),
                totalSkus: count($demandLines),
                demandLines: $demandLines,
            );

            event(new DemandAnalysisCompleted(
                $operationalDay,
                $correlationId,
                count($demandLines),
                $totalOrders,
                new DateTimeImmutable('now', new DateTimeZone('UTC')),
            ));

            return $result;
        } catch (Throwable $e) {
            event(new DemandAnalysisFailed(
                $operationalDay,
                $correlationId,
                $e->getMessage(),
                new DateTimeImmutable('now', new DateTimeZone('UTC')),
            ));

            throw $e;
        }
    }

    private function fetchDemandRows(): \Illuminate\Support\Collection
    {
        /*
         * Two separate aggregations joined together.
         * Joining inventory_items directly to order_lines would inflate qty
         * sums by the number of warehouse rows, so we pre-aggregate each
         * side independently and then join on product_id.
         */

        // Side A: demand — what operational orders are asking for.
        $demandSub = DB::table('order_lines as ol')
            ->join('orders as o', 'o.id', '=', 'ol.order_id')
            ->join('products as p', 'p.id', '=', 'ol.product_id')
            ->whereIn('o.status', self::OPERATIONAL_STATUSES)
            ->selectRaw('
                ol.product_id,
                p.sku,
                p.name AS product_name,
                SUM(ol.quantity) AS ordered_qty,
                COUNT(DISTINCT o.id) AS affected_orders_count,
                COUNT(DISTINCT o.channel_id) AS affected_channels_count
            ')
            ->groupBy('ol.product_id', 'p.sku', 'p.name');

        // Side B: stock — what the warehouse currently holds.
        $stockSub = DB::table('inventory_items')
            ->selectRaw('
                product_id,
                SUM(on_hand_qty)  AS on_hand_qty,
                SUM(reserved_qty) AS reserved_qty,
                COUNT(*)          AS warehouse_count
            ')
            ->groupBy('product_id');

        return DB::query()
            ->fromSub($demandSub, 'demand')
            ->leftJoinSub($stockSub, 'stock', 'stock.product_id', '=', 'demand.product_id')
            ->selectRaw('
                demand.product_id,
                demand.sku,
                demand.product_name,
                demand.ordered_qty,
                demand.affected_orders_count,
                demand.affected_channels_count,
                stock.on_hand_qty,
                stock.reserved_qty,
                COALESCE(stock.warehouse_count, 0) AS warehouse_count
            ')
            ->orderByDesc('demand.ordered_qty')
            ->get();
    }

    private function countOperationalOrders(): int
    {
        return DB::table('orders')
            ->whereIn('status', self::OPERATIONAL_STATUSES)
            ->count();
    }

    private function buildDemandLine(object $row): DemandLine
    {
        $orderedQty = (float) $row->ordered_qty;
        $reservedQty = $row->reserved_qty !== null ? (float) $row->reserved_qty : 0.0;
        $availableQty = $row->on_hand_qty !== null ? (float) $row->on_hand_qty : null;

        $inventoryStatus = match (true) {
            $availableQty === null => InventoryStatus::Unknown,
            $availableQty <= 0.0 => InventoryStatus::OutOfStock,
            $availableQty < $orderedQty => InventoryStatus::Shortage,
            default => InventoryStatus::Ready,
        };

        return new DemandLine(
            productId: $row->product_id,
            sku: $row->sku,
            productName: $row->product_name,
            orderedQty: $orderedQty,
            reservedQty: $reservedQty,
            availableQty: $availableQty,
            requiredQty: max(0.0, $orderedQty - $reservedQty),
            affectedOrdersCount: (int) $row->affected_orders_count,
            affectedChannelsCount: (int) $row->affected_channels_count,
            warehouseCount: (int) $row->warehouse_count,
            inventoryStatus: $inventoryStatus,
        );
    }
}
