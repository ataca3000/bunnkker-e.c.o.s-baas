<?php

declare(strict_types=1);

namespace Modules\Inventory\ReceiptLayers\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Inventory\InventoryItems\Domain\Services\InventorySummaryService;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryLayerConsumption;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;

final class InventoryLayerController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly InventorySummaryService $summaryService,
    ) {}

    /**
     * GET /inventory/layers
     *
     * Filters: product_id, warehouse_id, supplier_id, open_only, date_from, date_to
     */
    public function index(Request $request): JsonResponse
    {
        $query = InventoryReceiptLayer::query()
            ->with(['product', 'supplier', 'warehouse', 'goodsReceipt'])
            ->orderBy('created_at');

        if ($productId = $request->query('product_id')) {
            $query->where('product_id', $productId);
        }

        if ($warehouseId = $request->query('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        if ($supplierId = $request->query('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }

        if ($request->boolean('open_only')) {
            $query->where('remaining_qty', '>', 0);
        }

        if ($dateFrom = $request->query('date_from')) {
            $query->where('receipt_date', '>=', $dateFrom);
        }

        if ($dateTo = $request->query('date_to')) {
            $query->where('receipt_date', '<=', $dateTo);
        }

        $perPage = min((int) $request->query('per_page', 25), 100);
        $layers = $query->paginate($perPage);

        $now = now();

        $items = collect($layers->items())->map(function (InventoryReceiptLayer $layer) use ($now): array {
            $receivedQty = (float) $layer->received_qty;
            $remainingQty = (float) $layer->remaining_qty;
            $consumedQty = round($receivedQty - $remainingQty, 4);

            return [
                'id' => $layer->id,
                'receipt_date' => $layer->receipt_date?->toDateString(),
                'product_id' => $layer->product_id,
                'product' => $layer->product ? ['id' => $layer->product->id, 'sku' => $layer->product->sku, 'name' => $layer->product->name] : null,
                'supplier_id' => $layer->supplier_id,
                'supplier' => $layer->supplier ? ['id' => $layer->supplier->id, 'name' => $layer->supplier->name] : null,
                'warehouse_id' => $layer->warehouse_id,
                'warehouse' => $layer->warehouse ? ['id' => $layer->warehouse->id, 'name' => $layer->warehouse->name] : null,
                'goods_receipt_id' => $layer->goods_receipt_id,
                'goods_receipt' => $layer->goodsReceipt ? ['id' => $layer->goodsReceipt->id, 'receipt_number' => $layer->goodsReceipt->receipt_number] : null,
                'received_qty' => $receivedQty,
                'remaining_qty' => $remainingQty,
                'consumed_qty' => $consumedQty,
                'unit_cost' => (float) $layer->landed_unit_cost,
                'layer_value' => round($remainingQty * (float) $layer->landed_unit_cost, 2),
                'age_days' => $layer->receipt_date ? (int) $layer->receipt_date->diffInDays($now) : null,
                'status' => $remainingQty > 0 ? 'open' : 'consumed',
            ];
        });

        return $this->success([
            'data' => $items->toArray(),
            'meta' => [
                'current_page' => $layers->currentPage(),
                'per_page' => $layers->perPage(),
                'total' => $layers->total(),
                'last_page' => $layers->lastPage(),
            ],
        ]);
    }

    /**
     * GET /products/{product}/cost-history
     */
    /**
     * GET /products/{product}/warehouse-distribution
     *
     * Per-warehouse stock distribution for a product. Reference consumer of the
     * canonical InventorySummaryService (EPIC-DATA-CONSOLIDATION-001, Phase B/D):
     * the controller does NO derivation — availability (clamp-per-warehouse then
     * sum) and FIFO inventory value are owned entirely by the canonical engine.
     */
    public function warehouseDistribution(string $productId): JsonResponse
    {
        $product = Product::query()->find($productId);

        if ($product === null) {
            return $this->error('Product not found.', 404);
        }

        return $this->success($this->summaryService->summarize($productId)->toArray());
    }

    public function costHistory(string $productId): JsonResponse
    {
        $product = Product::query()->find($productId);

        if ($product === null) {
            return $this->error('Product not found.', 404);
        }

        $layers = InventoryReceiptLayer::query()
            ->where('product_id', $productId)
            ->with(['supplier', 'goodsReceipt'])
            ->orderBy('created_at')
            ->get();

        $consumptions = InventoryLayerConsumption::query()
            ->where('product_id', $productId)
            ->orderBy('created_at')
            ->get();

        $now = now();

        return $this->success([
            'product_id' => $product->id,
            'product_sku' => $product->sku,
            'product_name' => $product->name,
            'current_fifo_cost' => $product->current_fifo_cost,
            'average_cost' => $product->average_cost,
            'last_purchase_cost' => $product->last_purchase_cost,
            'inventory_value' => $layers->sum(fn ($l) => round((float) $l->remaining_qty * (float) $l->landed_unit_cost, 4)),
            'total_consumed_value' => $consumptions->sum(fn ($c) => (float) $c->total_cost),

            'receipt_layers' => $layers->map(fn (InventoryReceiptLayer $l) => [
                'id' => $l->id,
                'receipt_date' => $l->receipt_date?->toDateString(),
                'supplier' => $l->supplier ? ['id' => $l->supplier->id, 'name' => $l->supplier->name] : null,
                'goods_receipt' => $l->goodsReceipt ? ['id' => $l->goodsReceipt->id, 'receipt_number' => $l->goodsReceipt->receipt_number] : null,
                'received_qty' => (float) $l->received_qty,
                'remaining_qty' => (float) $l->remaining_qty,
                'unit_cost' => (float) $l->landed_unit_cost,
                'layer_value' => round((float) $l->remaining_qty * (float) $l->landed_unit_cost, 2),
                'age_days' => $l->receipt_date ? (int) $l->receipt_date->diffInDays($now) : null,
                'status' => (float) $l->remaining_qty > 0 ? 'open' : 'consumed',
            ])->values(),

            'consumptions' => $consumptions->map(fn (InventoryLayerConsumption $c) => [
                'id' => $c->id,
                'order_id' => $c->order_id,
                'order_line_id' => $c->order_line_id,
                'layer_id' => $c->inventory_receipt_layer_id,
                'quantity' => (float) $c->quantity,
                'unit_cost' => (float) $c->unit_cost,
                'total_cost' => (float) $c->total_cost,
                'created_at' => $c->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }
}
