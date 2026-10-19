<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\Services;

use Modules\Manufacturing\DecisionKernel\Domain\Contracts\DecisionRuleInterface;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionContext;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionEvaluation;

/**
 * Evaluates a set of rules against a context and returns matching evaluations
 * sorted by priority (highest first).
 *
 * Tie-breaking strategy:
 *   PHP 8.0+ usort() is stable (timsort). Rules with equal priority resolve
 *   in their registration order — i.e. first-registered wins. This is fully
 *   deterministic as long as RuleProviderInterface::rules() returns a stable list.
 *
 * This class is intentionally separated from DecisionKernel so it can be tested
 * independently and swapped for a streaming or async pipeline in the future.
 */
final class RuleEvaluationPipeline
{
    /**
     * @param  list<DecisionRuleInterface>  $rules
     * @return list<DecisionEvaluation> Matching evaluations, priority desc.
     */
    public function run(array $rules, DecisionContext $context): array
    {
        $matched = [];

        foreach ($rules as $rule) {
            if ($rule->matches($context)) {
                $matched[] = new DecisionEvaluation(
                    rule_id: $rule->ruleId(),
                    rule_name: $rule->name(),
                    priority: $rule->priority(),
                    matched: true,
                    decision_type: $rule->decisionType(),
                    reason: $rule->reason(),
                    metadata: $rule->metadata(),
                );
            }
        }

        // Stable descending sort: highest priority first, registration order on tie.
        usort(
            $matched,
            static fn (DecisionEvaluation $a, DecisionEvaluation $b): int => $b->priority <=> $a->priority,
        );

        return $matched;
    }
}
