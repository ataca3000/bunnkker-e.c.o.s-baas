<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Domain\ValueObjects;

/**
 * Immutable result from DisassemblyExecutor::execute().
 */
final readonly class DisassemblyExecutionResult
{
    /**
     * @param  list<ComponentProductionRecord>  $produced_components
     * @param  list<string>  $ledger_entry_ids
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public string $execution_id,
        public string $transaction_id,
        public bool $success,
        public bool $was_idempotent,
        public float $qty_disassembled,
        public array $produced_components,
        public array $ledger_entry_ids,
        public int $duration_ms,
        public string $executed_at,
        public array $metadata = [],
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'execution_id' => $this->execution_id,
            'transaction_id' => $this->transaction_id,
            'success' => $this->success,
            'was_idempotent' => $this->was_idempotent,
            'qty_disassembled' => $this->qty_disassembled,
            'produced_components' => array_map(
                fn (ComponentProductionRecord $r): array => $r->toArray(),
                $this->produced_components,
            ),
            'ledger_entry_ids' => $this->ledger_entry_ids,
            'duration_ms' => $this->duration_ms,
            'executed_at' => $this->executed_at,
            'metadata' => $this->metadata,
        ];
    }
}
