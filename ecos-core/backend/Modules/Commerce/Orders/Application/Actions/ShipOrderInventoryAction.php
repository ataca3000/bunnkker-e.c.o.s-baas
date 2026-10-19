<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Exceptions\OrderAlreadyShippedException;
use Modules\Commerce\Orders\Domain\Exceptions\OrderWarehouseNotAssignedException;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Commerce\Orders\Domain\Models\OrderReservationAudit;
use Modules\Inventory\InventoryItems\Application\Actions\ShipStockAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\ReceiptLayers\Application\Services\InventoryLayerConsumptionService;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

final class ShipOrderInventoryAction
{
    public function __construct(
        private readonly ShipStockAction $shipStock,
        private readonly InventoryLayerConsumptionService $layerConsumption,
        private readonly InventoryItemRepositoryInterface $inventory,
    ) {}

    /**
     * @param  array<string, float>|null  $lineQuantities  Map of order_line_id => qty to ship.
     *                                                     When null, the full reserved_qty per line is used.
     *                                                     Used for split-shipment (P1-001): each vehicle
     *                                                     ships only the quantities allocated to it.
     */
    public function execute(Order $order, ?array $lineQuantities = null): void
    {
        if ($order->inventory_shipped_at !== null) {
            throw new OrderAlreadyShippedException($order->id);
        }

        $previousReservationStatus = $order->reservation_status?->value;

        if ($order->assigned_warehouse_id === null) {
            throw new OrderWarehouseNotAssignedException($order->id);
        }

        if ($order->inventory_reserved_at === null) {
            throw new UnprocessableEntityHttpException(
                "Order [{$order->id}] cannot be shipped: inventory has not been reserved.",
            );
        }

        $order->loadMissing('lines', 'assignedWarehouse');

        $companyId = $order->assignedWarehouse->company_id;
        $warehouseId = $order->assigned_warehouse_id;

        DB::transaction(function () use ($order, $companyId, $warehouseId, $lineQuantities, $previousReservationStatus): void {
            $totalCogs = 0.0;

            foreach ($order->lines as $line) {
                /** @var OrderLine $line */
                // When lineQuantities is provided (split-shipment path), use the quantity
                // allocated to this specific vehicle for this line. Otherwise fall back to
                // the fully-reserved quantity — the standard full-shipment path.
                $qty = $lineQuantities !== null
                    ? (float) ($lineQuantities[$line->id] ?? 0.0)
                    : (float) ($line->reserved_qty ?? 0.0);

                if ($qty <= 0.0) {
                    continue;
                }

                // 1. Move physical stock
                $this->shipStock->execute(new StockOperationDTO(
                    warehouse_id: $warehouseId,
                    product_id: $line->product_id,
                    company_id: $companyId,
                    quantity: $qty,
                    reference_type: 'sales_order',
                    reference_id: $order->id,
                    notes: "Shipped for order #{$order->order_number}",
                ));

                // 2. FIFO layer consumption (within same transaction).
                //    C-002: use company-scoped lookup so the audit record's inventory_item_id
                //    always references this tenant's InventoryItem, not another company's.
                $inventoryItem = $this->inventory->findByWarehouseProductAndCompany($warehouseId, $line->product_id, $companyId);

                if ($inventoryItem !== null) {
                    $result = $this->layerConsumption->consume(
                        inventoryItemId: $inventoryItem->id,
                        productId: $line->product_id,
                        warehouseId: $warehouseId,
                        companyId: $companyId,
                        quantity: $qty,
                        orderId: $order->id,
                        orderLineId: $line->id,
                    );

                    $totalCogs += $result->totalCost;

                    // Update current FIFO cost for the product after consumption
                    $this->refreshFifoCost($line->product_id, $warehouseId);
                }
            }

            // 3. Stamp COGS and margin on the order
            $revenue = (float) $order->total;
            $margin = $revenue - $totalCogs;
            $marginPct = $revenue > 0 ? round($margin / $revenue * 100, 2) : null;

            $order->update([
                'inventory_shipped_at' => now(),
                'actual_cogs_amount' => round($totalCogs, 2),
                'actual_margin_amount' => round($margin, 2),
                'actual_margin_percent' => $marginPct,
                'reservation_status' => ReservationStatus::Transferred->value,
            ]);

            // Audit inside the transaction so the record commits or rolls back
            // atomically with the shipment (F-INV-H6 fix).
            OrderReservationAudit::record(
                orderId: $order->id,
                fromStatus: $previousReservationStatus,
                toStatus: ReservationStatus::Transferred->value,
                reason: 'Inventory transferred to vehicle during loading',
                warehouseId: $order->assigned_warehouse_id,
                meta: ['line_count' => $order->lines->count()],
                actorId: Auth::id(),
                actorType: Auth::check() ? 'user' : 'system',
            );
        });
    }

    private function refreshFifoCost(string $productId, string $warehouseId): void
    {
        // BUG-08 fix: scope to the warehouse that shipped to get the correct per-warehouse
        // FIFO cost. Without this, multi-warehouse deployments use a layer from a different
        // warehouse — producing wrong COGS and pricing review data.
        $oldestLayer = \Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer::query()
            ->where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->where('remaining_qty', '>', 0)
            ->orderBy('created_at')
            ->orderBy('id')
            ->first();

        \Modules\Inventory\Products\Domain\Models\Product::query()
            ->where('id', $productId)
            ->update(['current_fifo_cost' => $oldestLayer?->landed_unit_cost]);
    }
}
