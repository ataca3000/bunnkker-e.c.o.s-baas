<?php

declare(strict_types=1);

namespace Modules\Inventory\ReceiptLayers\Application\Actions;

use Modules\CostManagement\Domain\Enums\CostUpdateSource;
use Modules\CostManagement\Domain\Services\EnterpriseCostEngine;
use Modules\CostManagement\Domain\Services\MaterialCostService;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;

/**
 * Creates inventory receipt layers and updates product cost intelligence
 * when a Goods Receipt is posted.
 *
 * Must be called INSIDE an existing DB transaction, after inventory quantities
 * have been updated by ReceiveStockAction.
 */
final class CreateReceiptLayersAction
{
    public function __construct(
        private readonly MaterialCostService $materialCostService,
    ) {}

    /**
     * @param  array<string, float>  $preReceiptQtys  Map of product_id → on_hand_qty BEFORE this receipt
     */
    public function execute(GoodsReceipt $receipt, array $preReceiptQtys): void
    {
        $po = $receipt->purchaseOrder;
        $supplierId = $po->supplier_id;
        $companyId = $po->company_id ?? $receipt->warehouse?->company_id;
        $receiptDate = $receipt->receipt_date->toDateString();

        // M-02 fix: include zero-cost lines so every received quantity has a FIFO layer.
        // Filtering by landed_unit_cost > 0 left on_hand_qty inflated with no backing
        // layer, causing subsequent FIFO consumption to fail with InsufficientStockException.
        // Zero-cost stock (free samples, internal allocations) is valid inventory.
        $activeLines = $receipt->lines->filter(
            fn (GoodsReceiptLine $l) => $l->effectiveReceivedQty() > 0,
        );

        if ($activeLines->isEmpty()) {
            return;
        }

        // Batch-load products to avoid N queries inside the loop
        $productIds = $activeLines->pluck('product_id')->unique()->values()->all();
        $products = Product::query()
            ->whereIn('id', $productIds)
            ->get()
            ->keyBy('id');

        // Batch-fetch oldest open FIFO layer per product — 1 query replaces N
        $oldestLayers = InventoryReceiptLayer::query()
            ->whereIn('product_id', $productIds)
            ->where('remaining_qty', '>', 0)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->groupBy('product_id')
            ->map(fn ($layers) => $layers->first());

        foreach ($activeLines as $line) {
            /** @var GoodsReceiptLine $line */
            $netQty = $line->effectiveReceivedQty();
            $landedUnitCost = (float) ($line->landed_unit_cost ?? 0);
            $product = $products->get($line->product_id);

            $salePriceSnapshot = $product ? (float) ($product->sale_price ?? 0) : null;

            // ── Create receipt layer ──────────────────────────────────────────
            InventoryReceiptLayer::query()->create([
                'company_id' => $companyId,
                'supplier_id' => $supplierId,
                'product_id' => $line->product_id,
                'goods_receipt_id' => $receipt->id,
                'goods_receipt_line_id' => $line->id,
                'warehouse_id' => $receipt->warehouse_id,
                'received_qty' => $netQty,
                'remaining_qty' => $netQty,
                'landed_unit_cost' => $landedUnitCost,
                'sale_price_snapshot' => $salePriceSnapshot > 0 ? $salePriceSnapshot : null,
                'receipt_date' => $receiptDate,
            ]);

            if ($product === null) {
                continue;
            }

            // ── Update product cost intelligence ─────────────────────────────
            $oldQty = $preReceiptQtys[$line->product_id] ?? 0.0;
            $oldAvg = (float) ($product->average_cost ?? $landedUnitCost);
            // Canonical weighted-average — single definition on EnterpriseCostEngine.
            $newAvgCost = EnterpriseCostEngine::weightedAverageCost($oldQty, $oldAvg, $netQty, $landedUnitCost);

            $oldestLayer = $oldestLayers->get($line->product_id);

            $product->update([
                'last_purchase_cost' => $landedUnitCost,
                'average_cost' => $newAvgCost,
                'last_purchase_date' => $receiptDate,
                'last_supplier_id' => $supplierId,
                'current_fifo_cost' => $oldestLayer?->landed_unit_cost ?? $landedUnitCost,
            ]);

            // Update official Material Cost and trigger full cascade to pricing reviews
            $this->materialCostService->update(
                material: $product,
                newCost: $landedUnitCost,
                source: CostUpdateSource::PurchaseInvoice,
                meta: [
                    'goods_receipt_id' => $receipt->id,
                    'company_id' => $companyId,
                ],
            );
        }
    }
}
