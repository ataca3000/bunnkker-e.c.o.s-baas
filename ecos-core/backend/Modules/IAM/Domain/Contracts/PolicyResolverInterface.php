<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Contracts;

use App\Models\User;
use Modules\IAM\Domain\Policies\PolicyResult;
use Modules\IAM\Domain\Policies\PolicyRule;

/**
 * PolicyResolverInterface — the Policy Engine (TASK-IAM-002 / ADR-038, Part 4).
 *
 * Evaluates the composable business rules registered for an action. Deny-by-default
 * composition: any applicable rule that denies makes the whole result a deny.
 */
interface PolicyResolverInterface
{
    /**
     * Register a business rule.
     */
    public function registerRule(PolicyRule $rule): void;

    /**
     * Evaluate every rule that applies to $action against the subject/context.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function evaluate(User $user, string $action, mixed $subject = null, array $attributes = []): PolicyResult;

    /**
     * Are there any rules registered for this action?
     */
    public function hasRulesFor(string $action): bool;
}
