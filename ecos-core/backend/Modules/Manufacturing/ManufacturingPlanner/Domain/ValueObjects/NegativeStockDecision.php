<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects;

/**
 * An explicit record that a component will go below zero stock during manufacturing.
 *
 * Only produced when:
 *   - missing_qty > 0 (stock does not fully cover the requirement), AND
 *   - allow_negative_stock = true (RC-2 permits it)
 *
 * `projected_balance` is always negative here.
 * The Manufacturing Engine (PKG-05) uses this list to warn operators
 * and to flag the consumed ledger entries for review.
 */
final readonly class NegativeStockDecision
{
    public function __construct(
        public string $component_id,
        public string $sku,
        public string $name,
        public string $unit_symbol,

        /** Current available stock before manufacturing. */
        public float $available_qty,

        /** Quantity that will be consumed. */
        public float $qty_to_consume,

        /**
         * Projected balance after consumption.
         * = available_qty − qty_to_consume (always negative).
         */
        public float $projected_balance,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'component_id' => $this->component_id,
            'sku' => $this->sku,
            'name' => $this->name,
            'unit_symbol' => $this->unit_symbol,
            'available_qty' => $this->available_qty,
            'qty_to_consume' => $this->qty_to_consume,
            'projected_balance' => $this->projected_balance,
        ];
    }
}
