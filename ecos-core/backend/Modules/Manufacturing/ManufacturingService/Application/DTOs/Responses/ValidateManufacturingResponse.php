<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses;

use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ManufacturingExecutionContext;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ValidationFailure;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\ValueObjects\ManufacturingWorkflowResult;

/**
 * Immutable response from ManufacturingApplicationService::validateManufacturing().
 *
 * Combines two validation layers:
 *
 *   is_workflow_valid         — Manufacturing Workflow ran without blocking
 *   is_plan_valid_for_execution — Execution Pipeline accepted the resulting plan
 *
 * Both must be true for execution to succeed.
 *
 * pipeline_failures lists typed failure codes from the Pipeline validators.
 * These are returned as typed strings (ValidationFailureCode values) so callers
 * can display precise reasons without parsing free-text messages.
 *
 * decision_key is included so callers can use it for their own idempotency checks
 * before calling manufactureProduct().
 */
final readonly class ValidateManufacturingResponse
{
    /**
     * @param  list<array<string, mixed>>  $pipeline_failures  Each element is ValidationFailure::toArray()
     */
    public function __construct(
        public string $workflow_id,
        public bool $is_workflow_valid,
        public ?string $blocking_reason,
        public bool $is_plan_valid_for_execution,
        public array $pipeline_failures,
        public ?string $plan_id,
        public ?string $decision_key,
        public array $metadata,
    ) {}

    public static function blocked(ManufacturingWorkflowResult $result): self
    {
        return new self(
            workflow_id: $result->workflow_id,
            is_workflow_valid: false,
            blocking_reason: $result->blocking_reason?->value,
            is_plan_valid_for_execution: false,
            pipeline_failures: [],
            plan_id: null,
            decision_key: null,
            metadata: $result->metadata,
        );
    }

    public static function fromPipeline(
        ManufacturingWorkflowResult $workflowResult,
        ManufacturingExecutionContext $context,
    ): self {
        return new self(
            workflow_id: $workflowResult->workflow_id,
            is_workflow_valid: true,
            blocking_reason: $workflowResult->blocking_reason?->value,
            is_plan_valid_for_execution: $context->isValid(),
            pipeline_failures: array_map(
                fn (ValidationFailure $f): array => $f->toArray(),
                $context->validation_result->failures,
            ),
            plan_id: $context->plan->plan_id,
            decision_key: $context->decision_key,
            metadata: $workflowResult->metadata,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'workflow_id' => $this->workflow_id,
            'is_workflow_valid' => $this->is_workflow_valid,
            'blocking_reason' => $this->blocking_reason,
            'is_plan_valid_for_execution' => $this->is_plan_valid_for_execution,
            'pipeline_failures' => $this->pipeline_failures,
            'plan_id' => $this->plan_id,
            'decision_key' => $this->decision_key,
            'metadata' => $this->metadata,
        ];
    }
}
