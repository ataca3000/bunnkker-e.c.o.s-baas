<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects;

/**
 * The manufacturing plan for a single raw material component.
 *
 * `qty_to_consume` is already scaled by qty_to_manufacture (inherits the
 * RC-1 partial-manufacturing adjustment from AvailabilityResult).
 *
 * `will_go_negative` and `is_blocked` are mutually exclusive:
 *   - will_go_negative: missing stock but allow_negative_stock = true (RC-2 accepted risk)
 *   - is_blocked:       missing stock and allow_negative_stock = false (hard blocker)
 */
final readonly class ComponentConsumptionPlan
{
    public function __construct(
        public string $component_id,
        public string $sku,
        public string $name,
        public string $unit_symbol,

        /** Absolute quantity to consume in this manufacturing run. */
        public float $qty_to_consume,

        /** Available at the target warehouse. */
        public float $available_qty,

        /** max(0, qty_to_consume − available_qty). Zero means fully covered. */
        public float $missing_qty,

        /** Forwarded from Product.allow_negative_stock (RC-2). */
        public bool $allow_negative_stock,

        /**
         * True when stock is short but negative stock is permitted (RC-2).
         * Manufacturing can proceed — the stock position will go negative.
         */
        public bool $will_go_negative,

        /**
         * True when stock is short and negative stock is NOT permitted.
         * This component hard-blocks manufacturing.
         */
        public bool $is_blocked,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'component_id' => $this->component_id,
            'sku' => $this->sku,
            'name' => $this->name,
            'unit_symbol' => $this->unit_symbol,
            'qty_to_consume' => $this->qty_to_consume,
            'available_qty' => $this->available_qty,
            'missing_qty' => $this->missing_qty,
            'allow_negative_stock' => $this->allow_negative_stock,
            'will_go_negative' => $this->will_go_negative,
            'is_blocked' => $this->is_blocked,
        ];
    }
}
