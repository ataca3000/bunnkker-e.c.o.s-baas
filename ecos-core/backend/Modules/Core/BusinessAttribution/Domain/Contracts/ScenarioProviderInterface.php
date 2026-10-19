<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

/**
 * Contract for Scenario definition and comparison providers.
 *
 * No implementation exists yet.
 */
interface ScenarioProviderInterface
{
    /**
     * Define a named scenario with typed parameters.
     * Returns a normalized scenario descriptor that can be passed to compareScenarios().
     */
    public function defineScenario(string $name, array $parameters): array;

    /**
     * Run multiple scenarios side-by-side and return a structured comparison.
     * Expected keys per scenario: name, outcome, delta, winner (bool).
     *
     * @param  array[]  $scenarios  Each element is the output of defineScenario()
     */
    public function compareScenarios(array $scenarios): array;
}
