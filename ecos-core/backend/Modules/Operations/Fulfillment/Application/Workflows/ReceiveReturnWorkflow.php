<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Illuminate\Support\Facades\DB;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\CostManagement\Domain\Services\EnterpriseCostEngine;
use Modules\Inventory\InventoryItems\Application\Actions\AdjustmentInAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryLayerConsumption;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\Operations\Fulfillment\Domain\Events\InventoryRestoredEvent;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;
use Modules\Operations\Fulfillment\Domain\Models\CustomerReturn;

/**
 * Processes a warehouse acceptance of returned goods.
 *
 * For each sellable line, issues an AdjustmentIn to restore stock at the
 * order's assigned warehouse. Damaged / destroyed lines do not restore inventory.
 *
 * Closes GAP-05 (warehouse leg): inventory returns to physical on-hand only
 * after warehouse confirmation — not automatically on driver rejection.
 *
 * This is NOT an FulfillmentWorkflowInterface implementor — it operates on a
 * CustomerReturn (not a single workflow-routed Order). Called directly from
 * FulfillmentController.
 */
final class ReceiveReturnWorkflow
{
    public function __construct(
        private readonly AdjustmentInAction $adjustmentIn,
    ) {}

    /**
     * Accept a customer return and restore sellable stock.
     *
     * @param  array<string, string>  $lineConditions  Override line conditions: ['line_id' => 'sellable'|'damaged'|'destroyed']
     */
    public function execute(
        CustomerReturn $customerReturn,
        string $actorId,
        ?string $warehouseNotes = null,
        array $lineConditions = [],
    ): CustomerReturn {
        if (! $customerReturn->isPendingInspection()) {
            throw new WorkflowPreconditionException(
                "CustomerReturn [{$customerReturn->id}] is not pending inspection (status: {$customerReturn->status}).",
            );
        }

        $customerReturn->loadMissing(['lines', 'order']);

        $order = $customerReturn->order;

        if (! $order instanceof Order || $order->assigned_warehouse_id === null) {
            throw new WorkflowPreconditionException(
                "CustomerReturn [{$customerReturn->id}] references an order with no assigned warehouse.",
            );
        }

        $warehouseId = $order->assigned_warehouse_id;
        $companyId = $order->company_id ?? '';
        $linesRestored = 0;

        DB::transaction(function () use ($customerReturn, $order, $warehouseId, $companyId, $actorId, $lineConditions, $warehouseNotes, &$linesRestored): void {
            foreach ($customerReturn->lines as $line) {
                // Allow override of condition during inspection
                $condition = $lineConditions[$line->id] ?? $line->condition;

                if ($condition !== 'sellable') {
                    $line->update(['condition' => $condition]);

                    continue;
                }

                // Restore inventory via AdjustmentIn (updates on_hand_qty + stock ledger).
                $this->adjustmentIn->execute(new StockOperationDTO(
                    warehouse_id: $warehouseId,
                    product_id: $line->product_id,
                    company_id: $companyId,
                    quantity: $line->quantity_returned,
                    reference_type: 'customer_return',
                    reference_id: $customerReturn->id,
                    notes: "Return accepted for order #{$order->order_number}. Condition: sellable.",
                ));

                // CERT-GAP-002: create a new FIFO receipt layer so returned goods
                // can be consumed by future shipments. Without this layer,
                // InventoryLayerConsumptionService cannot allocate the returned
                // units and will throw InsufficientStockException even when
                // on_hand_qty is positive, and COGS for future orders is wrong.
                //
                // Cost resolution (most-accurate → least-accurate):
                //   1. Weighted average cost from the original FIFO consumption records
                //      for this order + product. This traces the exact cost paid when
                //      the goods were first shipped — the highest-fidelity option.
                //   2. Product's current_fifo_cost (oldest open layer's cost).
                //   3. Product's average_cost.
                //   4. Product's last_purchase_cost.
                //   5. 0 (sentinel — prevents a null layer from breaking FIFO math).
                $product = Product::find($line->product_id);

                $returnedUnitCost = $this->resolveReturnCost(
                    $order->id,
                    $line->product_id,
                    $warehouseId,
                    $product,
                );

                InventoryReceiptLayer::create([
                    'supplier_id' => null,
                    'product_id' => $line->product_id,
                    'goods_receipt_id' => null,
                    'goods_receipt_line_id' => null,
                    'warehouse_id' => $warehouseId,
                    'received_qty' => $line->quantity_returned,
                    'remaining_qty' => $line->quantity_returned,
                    'landed_unit_cost' => $returnedUnitCost,
                    'sale_price_snapshot' => $product ? ((float) ($product->sale_price ?? 0)) ?: null : null,
                    'receipt_date' => now()->toDateString(),
                ]);

                $line->update(['condition' => $condition]);
                $linesRestored++;
            }

            $customerReturn->update([
                'status' => 'accepted',
                'accepted_at' => now(),
                'inspector_id' => $actorId,
                'inspected_at' => now(),
                'warehouse_notes' => $warehouseNotes,
                'inventory_restored_at' => $linesRestored > 0 ? now() : null,
            ]);
        });

        $customerReturn->refresh();

        OrderEvent::log(
            orderId: $order->id,
            type: 'return_received',
            description: "CustomerReturn #{$customerReturn->return_number} accepted. {$linesRestored} line(s) restored to inventory.",
            payload: ['customer_return_id' => $customerReturn->id, 'lines_restored' => $linesRestored],
            actorId: $actorId,
        );

        event(new InventoryRestoredEvent(
            orderId: $order->id,
            returnId: $customerReturn->id,
            companyId: $companyId,
            warehouseId: $warehouseId,
            linesRestored: $linesRestored,
            restoredAt: now()->toIso8601String(),
            actorId: $actorId,
        ));

        return $customerReturn;
    }

    /**
     * Resolve the unit cost for a returned FIFO layer.
     *
     * Strategy (highest fidelity first):
     *   1. Weighted average from the original InventoryLayerConsumption records for
     *      this order + product + warehouse. This is the actual cost paid when the
     *      goods were shipped — full traceability, no schema changes required.
     *   2. Product's current_fifo_cost (oldest open layer's landed cost).
     *   3. Product's average_cost.
     *   4. Product's last_purchase_cost.
     *   5. 0 — prevents a null value corrupting FIFO arithmetic.
     */
    private function resolveReturnCost(
        string $orderId,
        string $productId,
        string $warehouseId,
        ?Product $product,
    ): float {
        // 1. Trace original FIFO consumption records for this order + product + warehouse.
        $consumptions = InventoryLayerConsumption::query()
            ->where('order_id', $orderId)
            ->where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->get(['quantity', 'unit_cost', 'total_cost']);

        if ($consumptions->isNotEmpty()) {
            $totalQty = $consumptions->sum(fn ($c) => (float) $c->quantity);
            $totalCost = $consumptions->sum(fn ($c) => (float) $c->total_cost);

            if ($totalQty > 0) {
                return round($totalCost / $totalQty, 4);
            }
        }

        // 2-5. Canonical FIFO-first fallback — single definition on EnterpriseCostEngine
        // (identical order to the previous inline chain; value-neutral migration).
        return $product !== null ? EnterpriseCostEngine::resolveUnitCost($product) : 0.0;
    }
}
