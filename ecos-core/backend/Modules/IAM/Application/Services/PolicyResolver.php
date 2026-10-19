<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Modules\IAM\Domain\Contracts\PolicyResolverInterface;
use Modules\IAM\Domain\Policies\PolicyContext;
use Modules\IAM\Domain\Policies\PolicyResult;
use Modules\IAM\Domain\Policies\PolicyRule;

/**
 * PolicyResolver — the Enterprise Policy Engine (TASK-IAM-002 / ADR-038, Part 4).
 *
 * Runs every registered rule that applies to an action against a PolicyContext.
 * Composition is deny-overrides: the first applicable rule that denies wins. When no
 * rule governs an action, the policy layer allows (policies constrain, they do not
 * grant — authorization already decided access).
 *
 * Registered as a singleton so modules register their rules once per request.
 */
final class PolicyResolver implements PolicyResolverInterface
{
    /** @var list<PolicyRule> */
    private array $rules = [];

    public function registerRule(PolicyRule $rule): void
    {
        $this->rules[] = $rule;
    }

    public function hasRulesFor(string $action): bool
    {
        foreach ($this->rules as $rule) {
            if ($rule->appliesTo($action)) {
                return true;
            }
        }

        return false;
    }

    public function evaluate(User $user, string $action, mixed $subject = null, array $attributes = []): PolicyResult
    {
        $context = PolicyContext::for($user, $action, $subject, $attributes);

        foreach ($this->rules as $rule) {
            if (! $rule->appliesTo($action)) {
                continue;
            }

            $result = $rule->evaluate($context);

            // Deny-overrides: the first denial short-circuits.
            if ($result->isDenied()) {
                return PolicyResult::deny($result->reason, $result->rule ?? $rule->key());
            }
        }

        return PolicyResult::allow('no policy rule objected');
    }
}
