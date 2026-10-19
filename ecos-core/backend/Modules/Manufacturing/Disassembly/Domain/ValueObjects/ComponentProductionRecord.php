<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Domain\ValueObjects;

/**
 * Execution record of what actually happened to one component during disassembly.
 *
 * Immutable. Created by DisassemblyInventoryAdapter::produceComponent().
 */
final readonly class ComponentProductionRecord
{
    public function __construct(
        public string $component_id,
        public string $sku,
        public string $name,
        public string $unit_symbol,
        public float $qty_produced,
        public float $on_hand_before,
        public float $on_hand_after,
        public string $ledger_entry_id,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'component_id' => $this->component_id,
            'sku' => $this->sku,
            'name' => $this->name,
            'unit_symbol' => $this->unit_symbol,
            'qty_produced' => $this->qty_produced,
            'on_hand_before' => $this->on_hand_before,
            'on_hand_after' => $this->on_hand_after,
            'ledger_entry_id' => $this->ledger_entry_id,
        ];
    }
}
