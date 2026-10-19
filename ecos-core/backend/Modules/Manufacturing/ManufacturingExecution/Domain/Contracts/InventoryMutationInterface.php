<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\Contracts;

use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ComponentConsumptionRecord;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ComponentConsumptionPlan;

/**
 * Application contract for inventory mutations during manufacturing execution.
 *
 * The ManufacturingExecutor talks exclusively to this interface.
 * Implementations internally reuse InventoryItemRepository,
 * InventoryLayerConsumptionService, and ledger services.
 *
 * Future modules (Disassembly, Stock Adjustments, Transfers) will implement
 * this interface to share the mutation contract without duplicating logic.
 *
 * CONTRACT — implementations MUST:
 *   - Be called inside an existing DB::transaction()
 *   - Acquire pessimistic write locks on InventoryItem rows
 *   - Create immutable StockLedgerEntry records for every mutation
 *   - Track FIFO layers via InventoryLayerConsumptionService
 *   - Handle negative-stock components by consuming all available FIFO layers
 *     and allowing on_hand_qty to drop below zero when allow_negative_stock = true
 */
interface InventoryMutationInterface
{
    /**
     * Consume a raw material component from warehouse inventory.
     *
     * Acquires a pessimistic write lock, decrements on_hand_qty, creates an
     * immutable ProductionConsumption ledger entry, and consumes FIFO layers.
     *
     * When allow_negative_stock = true and on-hand is insufficient:
     *   - on_hand_qty is decremented below zero (RC-2)
     *   - FIFO layers are consumed up to what is available (partial)
     *   - ComponentConsumptionRecord.went_negative = true
     *
     * MUST be called inside an existing DB::transaction().
     */
    public function consumeComponent(
        ComponentConsumptionPlan $component,
        string $warehouseId,
        string $planId,
        string $companyId,
        string $executionUuid,
    ): ComponentConsumptionRecord;

    /**
     * Produce finished goods into warehouse inventory.
     *
     * Acquires a pessimistic write lock, increments on_hand_qty, creates an
     * immutable ProductionOutput ledger entry, and creates an InventoryReceiptLayer
     * so that the FIFO invariant (on_hand_qty == Σ remaining_qty) is preserved.
     * Creates the InventoryItem row if it does not already exist.
     *
     * $unitCost is the weighted-average component FIFO cost per finished-goods unit,
     * derived from the sum of ComponentConsumptionRecord::fifo_cost values divided by
     * qty_to_manufacture. Pass 0.0 when no component FIFO layers were available (all
     * raw materials went negative). The receipt layer is always created regardless of cost.
     *
     * MUST be called inside an existing DB::transaction().
     *
     * @return string The StockLedgerEntry UUID created for this production.
     */
    public function produceFinishedGoods(
        string $productId,
        float $qty,
        string $warehouseId,
        string $planId,
        string $companyId,
        string $executionUuid,
        float $unitCost,
    ): string;
}
