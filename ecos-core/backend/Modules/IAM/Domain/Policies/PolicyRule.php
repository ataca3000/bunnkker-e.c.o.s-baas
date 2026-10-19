<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Policies;

/**
 * PolicyRule — a single composable business rule (TASK-IAM-002 / ADR-038, Part 4).
 *
 * Modules register rules against an action (e.g. "commerce.orders.cancel"). The
 * PolicyResolver runs every rule that `appliesTo` the action; a single deny wins
 * (deny-by-default composition). Rules are pure functions of the PolicyContext, so
 * they are trivially testable and future AI rules slot in as just another rule.
 */
interface PolicyRule
{
    /**
     * Stable identifier, e.g. "order.cancellation-window".
     */
    public function key(): string;

    /**
     * Does this rule govern the given action?
     */
    public function appliesTo(string $action): bool;

    /**
     * Evaluate the rule against the context.
     */
    public function evaluate(PolicyContext $context): PolicyResult;
}
