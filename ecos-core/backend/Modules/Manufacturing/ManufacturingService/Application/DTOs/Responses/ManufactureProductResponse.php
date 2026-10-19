<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses;

use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ManufacturingExecutionResult;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\ValueObjects\ManufacturingWorkflowResult;

/**
 * Immutable response from ManufacturingApplicationService::manufactureProduct().
 *
 * Covers all outcomes in a single typed object:
 *
 *   Blocked (is_blocked = true, was_executed = false):
 *     - Decision rejected / deferred / escalated
 *     - No recipe found
 *     - No matching rule
 *     - Cannot manufacture (insufficient components)
 *     - Manufacturing not needed (sufficient finished goods)
 *
 *   Executed (is_blocked = false, was_executed = true):
 *     - First execution: was_idempotent = false, qty_produced > 0
 *     - Replay: was_idempotent = true, consumed_components = []
 *
 * Check was_executed first. If true, check was_idempotent.
 * If false, check blocking_reason and blocking_stage.
 */
final readonly class ManufactureProductResponse
{
    /**
     * @param  list<array<string, mixed>>  $consumed_components  Each element is ComponentConsumptionRecord::toArray()
     * @param  list<string>  $ledger_entry_ids
     */
    public function __construct(
        public string $workflow_id,
        public string $workflow_stage,
        public bool $is_blocked,
        public ?string $blocking_reason,
        public bool $was_executed,
        public bool $was_idempotent,
        public ?string $execution_id,
        public ?string $transaction_id,
        public float $qty_produced,
        public array $consumed_components,
        public array $ledger_entry_ids,
        public int $duration_ms,
        public ?string $executed_at,
        public array $metadata,
    ) {}

    public static function blocked(ManufacturingWorkflowResult $result): self
    {
        return new self(
            workflow_id: $result->workflow_id,
            workflow_stage: $result->stage->value,
            is_blocked: true,
            blocking_reason: $result->blocking_reason?->value,
            was_executed: false,
            was_idempotent: false,
            execution_id: null,
            transaction_id: null,
            qty_produced: 0.0,
            consumed_components: [],
            ledger_entry_ids: [],
            duration_ms: 0,
            executed_at: null,
            metadata: $result->metadata,
        );
    }

    public static function fromExecution(
        ManufacturingWorkflowResult $workflowResult,
        ManufacturingExecutionResult $executionResult,
    ): self {
        return new self(
            workflow_id: $workflowResult->workflow_id,
            workflow_stage: $workflowResult->stage->value,
            is_blocked: false,
            blocking_reason: null,
            was_executed: true,
            was_idempotent: $executionResult->was_idempotent,
            execution_id: $executionResult->execution_id,
            transaction_id: $executionResult->transaction_id,
            qty_produced: $executionResult->qty_produced,
            consumed_components: array_map(
                fn ($r): array => $r->toArray(),
                $executionResult->consumed_components,
            ),
            ledger_entry_ids: $executionResult->ledger_entry_ids,
            duration_ms: $executionResult->duration_ms,
            executed_at: $executionResult->executed_at,
            metadata: $executionResult->metadata,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'workflow_id' => $this->workflow_id,
            'workflow_stage' => $this->workflow_stage,
            'is_blocked' => $this->is_blocked,
            'blocking_reason' => $this->blocking_reason,
            'was_executed' => $this->was_executed,
            'was_idempotent' => $this->was_idempotent,
            'execution_id' => $this->execution_id,
            'transaction_id' => $this->transaction_id,
            'qty_produced' => $this->qty_produced,
            'consumed_components' => $this->consumed_components,
            'ledger_entry_ids' => $this->ledger_entry_ids,
            'duration_ms' => $this->duration_ms,
            'executed_at' => $this->executed_at,
            'metadata' => $this->metadata,
        ];
    }
}
