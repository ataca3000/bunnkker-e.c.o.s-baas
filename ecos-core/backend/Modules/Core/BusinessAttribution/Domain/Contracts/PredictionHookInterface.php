<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

/**
 * Extension point: predict future entity state from historical event data.
 * Future AI/ML engines implement this and are injected into the Replay Engine.
 */
interface PredictionHookInterface
{
    /**
     * Return a projected state map.
     * Convention: keys mirror the entity state keys; each value MAY carry a
     * confidence meta-key (e.g. ['status' => 'converted', '_confidence' => 0.82]).
     *
     * @param  array  $currentState  Reconstructed state as of now
     * @param  array  $historicalEvents  Ordered array of past BusinessEvent arrays
     */
    public function predict(array $currentState, array $historicalEvents): array;

    /** Overall model confidence 0.0–1.0 */
    public function getConfidenceScore(): float;
}
