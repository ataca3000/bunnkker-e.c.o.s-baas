<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\ValueObjects;

use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;

/**
 * The outcome of evaluating one rule against a context.
 *
 * Only matched evaluations (where `matched = true`) are included in the list
 * passed to DecisionResult. The pipeline discards non-matching evaluations before
 * priority resolution — they never reach DecisionResult.
 */
final readonly class DecisionEvaluation
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public string $rule_id,
        public string $rule_name,
        public int $priority,

        /** Always true for evaluations stored in a DecisionResult. */
        public bool $matched,

        public DecisionType $decision_type,
        public DecisionReason $reason,
        public array $metadata = [],
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'rule_id' => $this->rule_id,
            'rule_name' => $this->rule_name,
            'priority' => $this->priority,
            'matched' => $this->matched,
            'decision_type' => $this->decision_type->value,
            'reason' => $this->reason->toArray(),
            'metadata' => $this->metadata,
        ];
    }
}
