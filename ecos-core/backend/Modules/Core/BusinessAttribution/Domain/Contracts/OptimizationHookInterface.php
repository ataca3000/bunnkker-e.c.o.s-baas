<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

/**
 * Extension point: optimization engines that suggest better-state paths
 * given the current entity state and a set of constraints.
 */
interface OptimizationHookInterface
{
    /**
     * Return a recommended target state and an ordered list of suggested actions.
     * Expected keys: recommended_state, actions (array), expected_improvement.
     *
     * @param  array  $currentState  Current reconstructed entity state
     * @param  array  $constraints  Business constraints (budget, time, capacity, etc.)
     */
    public function optimize(array $currentState, array $constraints): array;

    public function getOptimizationType(): string;
}
