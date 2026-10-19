<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\Services;

use Modules\Manufacturing\DecisionKernel\Domain\Contracts\DecisionRuleInterface;
use Modules\Manufacturing\DecisionKernel\Domain\Contracts\RuleProviderInterface;

/**
 * Rule provider backed by an in-memory list.
 *
 * Current implementation for all rule sets. When a rule source requires
 * persistence or external retrieval, implement RuleProviderInterface directly
 * without touching the kernel or this class.
 *
 * Usage:
 *   $provider = new InMemoryRuleProvider($rule1, $rule2, $rule3);
 *   $kernel->evaluate($trigger, $context, $provider);
 */
final class InMemoryRuleProvider implements RuleProviderInterface
{
    /** @var list<DecisionRuleInterface> */
    private readonly array $rules;

    public function __construct(DecisionRuleInterface ...$rules)
    {
        $this->rules = array_values($rules);
    }

    /** @return list<DecisionRuleInterface> */
    public function rules(): array
    {
        return $this->rules;
    }
}
