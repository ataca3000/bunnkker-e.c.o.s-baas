<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

/**
 * Contract for Journey Prediction providers.
 * A provider forecasts the next likely journey stage and its probability.
 *
 * No implementation exists yet.
 */
interface PredictionProviderInterface
{
    /**
     * Given the current journey state, forecast the next stage.
     * Expected keys: next_stage, probability, estimated_days, confidence.
     */
    public function forecastNextStage(array $journeyState): array;

    /** Forecast horizon in days. */
    public function getHorizon(): int;
}
