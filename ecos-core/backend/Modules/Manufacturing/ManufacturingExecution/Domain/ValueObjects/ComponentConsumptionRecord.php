<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects;

/**
 * Immutable record of what actually happened to one raw material during execution.
 *
 * `went_negative` is true when on_hand_after < 0 (RC-2 negative stock materialized).
 * `ledger_entry_id` links back to the StockLedgerEntry created during this execution.
 * `fifo_cost` is the total FIFO cost consumed from receipt layers for this component;
 *   used by ManufacturingExecutor to derive the weighted-average unit cost of finished goods.
 */
final readonly class ComponentConsumptionRecord
{
    public function __construct(
        public string $component_id,
        public string $sku,
        public string $name,
        public string $unit_symbol,
        public float $qty_consumed,
        public float $on_hand_before,
        public float $on_hand_after,
        public bool $went_negative,
        public string $ledger_entry_id,
        public float $fifo_cost,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'component_id' => $this->component_id,
            'sku' => $this->sku,
            'name' => $this->name,
            'unit_symbol' => $this->unit_symbol,
            'qty_consumed' => $this->qty_consumed,
            'on_hand_before' => $this->on_hand_before,
            'on_hand_after' => $this->on_hand_after,
            'went_negative' => $this->went_negative,
            'ledger_entry_id' => $this->ledger_entry_id,
            'fifo_cost' => $this->fifo_cost,
        ];
    }
}
