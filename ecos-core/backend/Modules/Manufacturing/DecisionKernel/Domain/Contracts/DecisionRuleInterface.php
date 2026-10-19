<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\Contracts;

use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionContext;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;

/**
 * Contract for any rule the Decision Kernel can evaluate.
 *
 * Implementations may be:
 *   - In-memory (DecisionRule — current)
 *   - Database-backed (future: DB-loaded rule sets)
 *   - AI-generated (future: LLM rule synthesis)
 *   - Dynamic (future: runtime rule builder)
 *
 * The kernel never assumes a concrete implementation.
 */
interface DecisionRuleInterface
{
    public function ruleId(): string;

    public function name(): string;

    /**
     * Deterministic priority. Higher value wins when multiple rules match.
     * Stable sort ensures first-registered rule wins on exact tie.
     */
    public function priority(): int;

    /** Test whether this rule fires for the given context. Pure — no side effects. */
    public function matches(DecisionContext $context): bool;

    public function decisionType(): DecisionType;

    public function reason(): DecisionReason;

    /** @return array<string, mixed> */
    public function metadata(): array;
}
