<?php

declare(strict_types=1);

namespace Modules\Inventory\ReceiptLayers\Application\Services;

use Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException;
use Modules\Inventory\ReceiptLayers\Application\DTO\ConsumedLayerDTO;
use Modules\Inventory\ReceiptLayers\Application\DTO\ConsumptionResult;
use Modules\Inventory\ReceiptLayers\Domain\Contracts\InventoryLayerConsumptionRepositoryInterface;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;

/**
 * FIFO layer consumption engine.
 *
 * Consumes receipt layers in chronological order (oldest first) until the
 * requested quantity is satisfied. Creates an immutable audit record for
 * each layer slice consumed.
 *
 * MUST be called inside an existing DB::transaction() — it does not open one.
 */
final class InventoryLayerConsumptionService
{
    public function __construct(
        private readonly InventoryLayerConsumptionRepositoryInterface $repo,
    ) {}

    /**
     * @throws InsufficientStockException when open layers cannot cover the quantity
     */
    public function consume(
        string $inventoryItemId,
        string $productId,
        string $warehouseId,
        string $companyId,
        float $quantity,
        ?string $orderId = null,
        ?string $orderLineId = null,
    ): ConsumptionResult {
        // Load open layers for this product+warehouse+company in FIFO order (oldest first).
        // BUG-08 fix: company_id filter enforces tenant isolation — without it, a layer
        // belonging to Company A can be consumed for a Company B shipment in shared warehouses.
        $layers = InventoryReceiptLayer::query()
            ->where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->where('company_id', $companyId)
            ->where('remaining_qty', '>', 0)
            ->lockForUpdate()
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $available = $layers->sum(fn ($l) => (float) $l->remaining_qty);

        if ($available < $quantity) {
            throw new InsufficientStockException($productId, $warehouseId, $quantity, $available);
        }

        $remaining = (string) $quantity;
        $consumedLayers = [];
        $totalCost = '0';

        foreach ($layers as $layer) {
            if (bccomp($remaining, '0', 4) <= 0) {
                break;
            }

            $layerRemaining = (string) $layer->remaining_qty;
            $consume = bccomp($remaining, $layerRemaining, 4) <= 0
                ? $remaining
                : $layerRemaining;
            $unitCost = (string) $layer->landed_unit_cost;
            $sliceCost = bcmul($consume, $unitCost, 4);

            // Decrement the layer
            $layer->remaining_qty = bcsub($layerRemaining, $consume, 4);
            $layer->save();

            // Audit record
            $this->repo->create([
                'order_id' => $orderId,
                'order_line_id' => $orderLineId,
                'inventory_item_id' => $inventoryItemId,
                'inventory_receipt_layer_id' => $layer->id,
                'product_id' => $productId,
                'warehouse_id' => $warehouseId,
                'company_id' => $companyId,
                'quantity' => $consume,
                'unit_cost' => $unitCost,
                'total_cost' => $sliceCost,
            ]);

            $consumedLayers[] = new ConsumedLayerDTO(
                layerId: $layer->id,
                quantity: (float) $consume,
                unitCost: (float) $unitCost,
                totalCost: (float) $sliceCost,
            );

            $totalCost = bcadd($totalCost, $sliceCost, 4);
            $remaining = bcsub($remaining, $consume, 4);
        }

        $weightedCost = $quantity > 0
            ? bcdiv($totalCost, (string) $quantity, 4)
            : '0.0000';

        return new ConsumptionResult(
            totalQuantity: $quantity,
            totalCost: (float) $totalCost,
            weightedCost: (float) $weightedCost,
            consumedLayers: $consumedLayers,
        );
    }
}
