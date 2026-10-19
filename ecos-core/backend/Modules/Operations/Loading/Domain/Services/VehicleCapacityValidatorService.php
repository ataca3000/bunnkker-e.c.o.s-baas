<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Services;

use Modules\Operations\Loading\Domain\Models\VehicleAssignment;

final class VehicleCapacityCheckResult
{
    public function __construct(
        public readonly bool $isOverloaded,
        public readonly float $weightUtilizationPct,
        public readonly float $volumeUtilizationPct,
        public readonly float $overallUtilizationPct,
        public readonly ?string $violatedConstraint,
    ) {}

    public function passes(): bool
    {
        return ! $this->isOverloaded;
    }
}

final class VehicleCapacityValidatorService
{
    public function check(
        VehicleAssignment $assignment,
        float $additionalWeightKg = 0.0,
        float $additionalVolumeM3 = 0.0,
        int $additionalOrders = 0,
    ): VehicleCapacityCheckResult {
        $maxWeight = $assignment->capacity_weight_kg_snapshot;
        $maxVolume = $assignment->capacity_volume_m3_snapshot;

        $newWeight = $assignment->loading_weight_kg + $additionalWeightKg;
        $newVolume = $assignment->loading_volume_m3 + $additionalVolumeM3;

        $weightPct = $maxWeight > 0 ? round(($newWeight / $maxWeight) * 100, 2) : 0.0;
        $volumePct = $maxVolume > 0 ? round(($newVolume / $maxVolume) * 100, 2) : 0.0;
        $overallPct = max($weightPct, $volumePct);

        $isOverloaded = false;
        $violatedConstraint = null;

        // 5% tolerance
        if ($weightPct > 105) {
            $isOverloaded = true;
            $violatedConstraint = "Weight capacity exceeded: {$weightPct}% utilization";
        } elseif ($volumePct > 105) {
            $isOverloaded = true;
            $violatedConstraint = "Volume capacity exceeded: {$volumePct}% utilization";
        }

        return new VehicleCapacityCheckResult(
            isOverloaded: $isOverloaded,
            weightUtilizationPct: $weightPct,
            volumeUtilizationPct: $volumePct,
            overallUtilizationPct: $overallPct,
            violatedConstraint: $violatedConstraint,
        );
    }
}
