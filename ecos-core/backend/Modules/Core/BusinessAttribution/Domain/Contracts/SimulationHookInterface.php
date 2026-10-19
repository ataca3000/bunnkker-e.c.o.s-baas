<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

/**
 * Extension point: simulate applying a hypothetical event without persisting.
 * Future simulation engines implement this and register themselves.
 */
interface SimulationHookInterface
{
    /**
     * Project the outcome of applying $hypotheticalEvent to $state.
     * Returns the projected state; nothing is written to the database.
     */
    public function simulate(array $state, BusinessEvent $hypotheticalEvent): array;

    public function getScenarioName(): string;
}
