<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Application\Queries;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\GoodsReceiptStatus;
use Modules\Purchasing\Suppliers\Domain\Exceptions\SupplierNotFoundException;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

/**
 * Per-line purchasing price history for a supplier, ordered by most recent first.
 * Uses a PostgreSQL LAG window function to compute previous price per product.
 */
final class GetSupplierPriceHistoryQuery
{
    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function execute(string $supplierId, int $limit = 200): Collection
    {
        if (Supplier::query()->find($supplierId) === null) {
            throw new SupplierNotFoundException($supplierId);
        }

        $rows = DB::select('
            SELECT
                grl.id,
                gr.receipt_date                                      AS date,
                po.po_number,
                w.name                                               AS warehouse_name,
                p.name                                               AS product_name,
                p.sku                                                AS product_sku,
                grl.product_id,
                COALESCE(grl.net_received_quantity, grl.received_quantity)::float AS quantity,
                grl.unit_price::float                                              AS unit_cost,
                grl.landed_unit_cost::float                                        AS landed_unit_cost,
                LAG(grl.unit_price::float) OVER (
                    PARTITION BY grl.product_id
                    ORDER BY gr.receipt_date, grl.id
                )                                                    AS previous_price
            FROM goods_receipt_lines   grl
            JOIN goods_receipts        gr  ON grl.goods_receipt_id   = gr.id
            JOIN purchase_orders       po  ON gr.purchase_order_id    = po.id
            JOIN warehouses            w   ON gr.warehouse_id         = w.id
            JOIN products              p   ON grl.product_id          = p.id
            WHERE po.supplier_id  = :supplier_id
              AND gr.status       = :posted
              AND gr.deleted_at   IS NULL
              AND po.deleted_at   IS NULL
              AND p.deleted_at    IS NULL
            ORDER BY gr.receipt_date DESC, grl.id DESC
            LIMIT :lim
        ', [
            'supplier_id' => $supplierId,
            'posted' => GoodsReceiptStatus::Posted->value,
            'lim' => $limit,
        ]);

        return collect($rows)->map(function (object $r): array {
            $unitCost = $r->unit_cost !== null ? round((float) $r->unit_cost, 4) : 0.0;
            $prevPrice = $r->previous_price !== null ? round((float) $r->previous_price, 4) : null;
            $diffPct = ($prevPrice !== null && $prevPrice > 0)
                ? round(($unitCost - $prevPrice) / $prevPrice * 100, 2)
                : null;

            return [
                'id' => $r->id,
                'date' => $r->date,
                'po_number' => $r->po_number,
                'warehouse_name' => $r->warehouse_name,
                'product_name' => $r->product_name,
                'product_sku' => $r->product_sku,
                'quantity' => round((float) ($r->quantity ?? 0), 4),
                'unit_cost' => $unitCost,
                'landed_unit_cost' => $r->landed_unit_cost !== null ? round((float) $r->landed_unit_cost, 4) : null,
                'previous_price' => $prevPrice,
                'price_diff_pct' => $diffPct,
            ];
        });
    }
}
