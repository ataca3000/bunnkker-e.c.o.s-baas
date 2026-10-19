<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\Services;

use DateTimeImmutable;
use DateTimeInterface;
use Modules\Manufacturing\DecisionKernel\Domain\Contracts\RuleProviderInterface;
use Modules\Manufacturing\DecisionKernel\Domain\Exceptions\NoMatchingRuleException;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionContext;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionResult;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionTrigger;

/**
 * Decision Kernel — the heart of ECOS ERP.
 *
 * Pure domain service. Zero side effects. Zero infrastructure dependencies.
 *
 * The kernel:
 *   1. Accepts a trigger, a context, and a rule provider.
 *   2. Delegates rule evaluation to RuleEvaluationPipeline.
 *   3. Selects the highest-priority matching rule.
 *   4. Returns an immutable DecisionResult.
 *
 * The kernel MUST NOT:
 *   - Consume inventory
 *   - Calculate cost
 *   - Execute manufacturing
 *   - Create transactions
 *   - Update the database
 *   - Dispatch events or jobs
 *   - Know which module is calling it
 *
 * Execution of the returned decision belongs to the calling Engine.
 *
 * Callers: ManufacturingEngine, DecisionEngine, CostEngine,
 *          SimulationEngine, AIEngine, ProcurementScheduler, CLI, API.
 */
final class DecisionKernel
{
    public function __construct(
        private readonly RuleEvaluationPipeline $pipeline,
    ) {}

    /**
     * Evaluate the rule provider's rules against the given context.
     *
     * @throws NoMatchingRuleException when no rule matches.
     */
    public function evaluate(
        DecisionTrigger $trigger,
        DecisionContext $context,
        RuleProviderInterface $rules,
    ): DecisionResult {
        $evaluations = $this->pipeline->run($rules->rules(), $context);

        if ($evaluations === []) {
            throw NoMatchingRuleException::forContext($context->context_type);
        }

        // First element is the winner — highest priority, first-registered on tie.
        $winner = $evaluations[0];

        return new DecisionResult(
            decision: $winner->decision_type,
            reason: $winner->reason,
            matched_rule: $winner,
            context: $context,
            trigger: $trigger,
            decided_at: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
        );
    }
}
