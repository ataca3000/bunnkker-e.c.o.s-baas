<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

/**
 * Contract for Scenario Simulation providers.
 * A provider runs a sequence of hypothetical events against an initial state
 * and returns the projected outcome.
 *
 * No implementation exists yet.
 */
interface SimulationProviderInterface
{
    /**
     * Apply an ordered list of hypothetical event arrays to $initialState
     * and return the final projected state.
     *
     * @param  array  $initialState  Starting reconstructed state
     * @param  array[]  $events  Hypothetical event payloads (not persisted)
     */
    public function runScenario(array $initialState, array $events): array;

    /** Return supported scenario type identifiers. */
    public function getScenarioTypes(): array;
}
