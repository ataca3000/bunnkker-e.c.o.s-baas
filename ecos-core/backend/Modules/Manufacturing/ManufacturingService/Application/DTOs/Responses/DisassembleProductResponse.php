<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses;

use Modules\Manufacturing\Disassembly\Domain\ValueObjects\DisassemblyExecutionResult;
use Modules\Manufacturing\Disassembly\Domain\ValueObjects\DisassemblyWorkflowResult;

/**
 * Typed response from ManufacturingApplicationService::disassembleProduct().
 *
 * Outcomes:
 *   blocked       — workflow blocked (recipe missing, insufficient FG stock, etc.)
 *   success       — disassembly executed; inventory updated; transaction recorded
 *   was_idempotent — trigger already disassembled; returns original transaction_id
 *
 * Callers check is_blocked first, then inspect execution details.
 */
final readonly class DisassembleProductResponse
{
    /**
     * @param  list<array<string, mixed>>  $produced_components
     * @param  list<string>  $ledger_entry_ids
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public bool $success,
        public bool $is_blocked,
        public ?string $blocking_reason,
        public bool $was_idempotent,
        public ?string $execution_id,
        public ?string $transaction_id,
        public ?string $product_id,
        public ?float $qty_disassembled,
        public array $produced_components,
        public array $ledger_entry_ids,
        public array $metadata = [],
    ) {}

    public static function blocked(DisassemblyWorkflowResult $result): self
    {
        return new self(
            success: false,
            is_blocked: true,
            blocking_reason: $result->blocking_reason,
            was_idempotent: false,
            execution_id: null,
            transaction_id: null,
            product_id: null,
            qty_disassembled: null,
            produced_components: [],
            ledger_entry_ids: [],
            metadata: $result->metadata,
        );
    }

    public static function fromExecution(
        DisassemblyWorkflowResult $workflowResult,
        DisassemblyExecutionResult $execResult,
    ): self {
        return new self(
            success: $execResult->success,
            is_blocked: false,
            blocking_reason: null,
            was_idempotent: $execResult->was_idempotent,
            execution_id: $execResult->execution_id,
            transaction_id: $execResult->transaction_id,
            product_id: $workflowResult->plan?->product_id,
            qty_disassembled: $execResult->qty_disassembled,
            produced_components: array_map(
                fn ($r) => $r->toArray(),
                $execResult->produced_components,
            ),
            ledger_entry_ids: $execResult->ledger_entry_ids,
            metadata: $execResult->metadata,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'is_blocked' => $this->is_blocked,
            'blocking_reason' => $this->blocking_reason,
            'was_idempotent' => $this->was_idempotent,
            'execution_id' => $this->execution_id,
            'transaction_id' => $this->transaction_id,
            'product_id' => $this->product_id,
            'qty_disassembled' => $this->qty_disassembled,
            'produced_components' => $this->produced_components,
            'ledger_entry_ids' => $this->ledger_entry_ids,
            'metadata' => $this->metadata,
        ];
    }
}
