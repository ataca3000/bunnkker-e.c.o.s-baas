<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\DTO;

use Modules\Operations\DemandAnalysis\Domain\Enums\InventoryStatus;

/**
 * Single product row in the Daily Demand Matrix.
 *
 * Immutable value object — created by DemandAnalysisService, consumed by
 * the Planning Engine and the read-only Demand Analysis API.
 */
final class DemandLine
{
    public function __construct(
        /** UUID of the product. */
        public readonly string $productId,

        /** Unique product code (stock-keeping unit). */
        public readonly string $sku,

        /** Display name of the product. */
        public readonly string $productName,

        /** Total units demanded across all eligible operational orders. */
        public readonly float $orderedQty,

        /**
         * Units already reserved in inventory for existing orders.
         * Sourced from SUM(inventory_items.reserved_qty) across all warehouses.
         */
        public readonly float $reservedQty,

        /**
         * Total on-hand physical stock across all warehouses.
         * Sourced from SUM(inventory_items.on_hand_qty).
         * NULL means the product has no inventory record (status = UNKNOWN).
         */
        public readonly ?float $availableQty,

        /**
         * Units that still need to be planned: MAX(0, ordered - reserved).
         * This is the primary input signal for the Planning Engine.
         */
        public readonly float $requiredQty,

        /** Number of distinct operational orders containing this product. */
        public readonly int $affectedOrdersCount,

        /** Number of distinct sales channels represented in those orders. */
        public readonly int $affectedChannelsCount,

        /** Number of warehouses holding stock for this product. */
        public readonly int $warehouseCount,

        /** Computed fulfillability status based on on-hand stock vs demand. */
        public readonly InventoryStatus $inventoryStatus,
    ) {}

    /**
     * Units that cannot be fulfilled from current on-hand stock.
     * MAX(0, orderedQty - availableQty)
     */
    public function shortageQty(): float
    {
        if ($this->availableQty === null) {
            return $this->orderedQty;
        }

        return max(0.0, $this->orderedQty - $this->availableQty);
    }
}
