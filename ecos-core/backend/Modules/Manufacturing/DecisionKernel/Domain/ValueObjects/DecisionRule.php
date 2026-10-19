<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\ValueObjects;

use Closure;
use Modules\Manufacturing\DecisionKernel\Domain\Contracts\DecisionRuleInterface;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;

/**
 * Concrete in-memory rule implementation.
 *
 * The `$condition` closure is a pure predicate — it receives the DecisionContext
 * and returns true/false with zero side effects.
 *
 * When future rule sources are needed (database, AI, dynamic builder), implement
 * DecisionRuleInterface directly. The kernel does not depend on this class.
 */
final readonly class DecisionRule implements DecisionRuleInterface
{
    /**
     * @param  Closure(DecisionContext): bool  $condition  Pure predicate.
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        private string $rule_id,
        private string $name,
        private int $priority,
        private DecisionType $decision_type,
        private DecisionReason $reason,
        private Closure $condition,
        private array $metadata = [],
    ) {}

    public function ruleId(): string
    {
        return $this->rule_id;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function priority(): int
    {
        return $this->priority;
    }

    public function decisionType(): DecisionType
    {
        return $this->decision_type;
    }

    public function reason(): DecisionReason
    {
        return $this->reason;
    }

    /** @return array<string, mixed> */
    public function metadata(): array
    {
        return $this->metadata;
    }

    public function matches(DecisionContext $context): bool
    {
        return ($this->condition)($context);
    }
}
