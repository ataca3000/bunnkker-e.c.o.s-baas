<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;

/**
 * Contract for pluggable attribution model implementations.
 */
interface AttributionModelContract
{
    /**
     * Calculate credit weights for each touchpoint event UUID.
     *
     * @param  BusinessDna  $dna  The business DNA to attribute.
     * @param  array<int, array{event_id: string, occurred_at: string}>  $touchpoints  Ordered touchpoints (earliest first).
     * @return array<string, float> Map of event_uuid → credit weight (0.0–1.0, sum = 1.0).
     */
    public function calculate(BusinessDna $dna, array $touchpoints): array;
}
