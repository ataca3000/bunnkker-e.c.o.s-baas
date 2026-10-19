<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Application\Queries;

use Illuminate\Support\Collection;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\Purchasing\Suppliers\Domain\Exceptions\SupplierNotFoundException;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

final class GetSupplierInventoryBreakdownQuery
{
    /**
     * Per-product inventory breakdown for a supplier (only layers with remaining_qty > 0).
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function execute(string $supplierId): Collection
    {
        if (Supplier::query()->find($supplierId) === null) {
            throw new SupplierNotFoundException($supplierId);
        }

        $rows = InventoryReceiptLayer::query()
            ->join('products', 'inventory_receipt_layers.product_id', '=', 'products.id')
            ->where('inventory_receipt_layers.supplier_id', $supplierId)
            ->where('inventory_receipt_layers.remaining_qty', '>', 0)
            ->whereNull('products.deleted_at')
            ->groupBy('inventory_receipt_layers.product_id', 'products.sku', 'products.name', 'products.average_cost', 'products.sale_price')
            ->selectRaw('
                inventory_receipt_layers.product_id,
                products.sku as product_sku,
                products.name as product_name,
                products.average_cost,
                products.sale_price,
                COALESCE(SUM(inventory_receipt_layers.remaining_qty), 0) as remaining_quantity,
                COALESCE(SUM(inventory_receipt_layers.remaining_qty * inventory_receipt_layers.landed_unit_cost), 0) as cost_value,
                COALESCE(SUM(CASE WHEN inventory_receipt_layers.sale_price_snapshot IS NOT NULL THEN inventory_receipt_layers.remaining_qty * inventory_receipt_layers.sale_price_snapshot ELSE 0 END), 0) as sale_value,
                MIN(inventory_receipt_layers.receipt_date) as oldest_receipt_date,
                MAX(inventory_receipt_layers.receipt_date) as latest_receipt_date,
                COUNT(DISTINCT inventory_receipt_layers.goods_receipt_id) as receipt_count
            ')
            ->orderByDesc('cost_value')
            ->get();

        return $rows->map(function (object $row): array {
            $costValue = (float) $row->cost_value;
            $saleValue = (float) $row->sale_value;

            return [
                'product_id' => $row->product_id,
                'product_sku' => $row->product_sku,
                'product_name' => $row->product_name,
                'average_cost' => $row->average_cost !== null ? round((float) $row->average_cost, 4) : null,
                'sale_price' => $row->sale_price !== null ? round((float) $row->sale_price, 2) : null,
                'remaining_quantity' => round((float) $row->remaining_quantity, 4),
                'cost_value' => round($costValue, 2),
                'sale_value' => round($saleValue, 2),
                'gross_profit' => round(max(0.0, $saleValue - $costValue), 2),
                'oldest_receipt_date' => $row->oldest_receipt_date,
                'latest_receipt_date' => $row->latest_receipt_date,
                'receipt_count' => (int) $row->receipt_count,
            ];
        });
    }
}
