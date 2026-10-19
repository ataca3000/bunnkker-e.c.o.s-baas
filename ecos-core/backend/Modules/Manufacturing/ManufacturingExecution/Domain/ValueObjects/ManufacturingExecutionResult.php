<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects;

/**
 * Immutable output of the ManufacturingExecutor.
 *
 * `was_idempotent = true` when the plan_id had already been executed.
 * In that case, consumed_components and ledger_entry_ids are empty
 * (the original execution's data lives in the transaction and ledger).
 *
 * @property list<ComponentConsumptionRecord> $consumed_components
 * @property list<string> $ledger_entry_ids
 */
final readonly class ManufacturingExecutionResult
{
    /**
     * @param  list<ComponentConsumptionRecord>  $consumed_components
     * @param  list<string>  $ledger_entry_ids
     */
    public function __construct(
        /** UUID generated at execution call time (unique per call, even for idempotent replays). */
        public string $execution_id,

        /** ID of the ManufacturingTransaction record. */
        public string $transaction_id,

        public bool $success,

        /** True when this plan_id was already executed and no new work was done. */
        public bool $was_idempotent,

        public float $qty_produced,

        public array $consumed_components,

        /** UUIDs of all StockLedgerEntry records created (consumption + production). */
        public array $ledger_entry_ids,

        public int $duration_ms,
        public string $executed_at,
        public array $metadata,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'execution_id' => $this->execution_id,
            'transaction_id' => $this->transaction_id,
            'success' => $this->success,
            'was_idempotent' => $this->was_idempotent,
            'qty_produced' => $this->qty_produced,
            'consumed_components' => array_map(
                fn (ComponentConsumptionRecord $r): array => $r->toArray(),
                $this->consumed_components,
            ),
            'ledger_entry_ids' => $this->ledger_entry_ids,
            'duration_ms' => $this->duration_ms,
            'executed_at' => $this->executed_at,
            'metadata' => $this->metadata,
        ];
    }
}
