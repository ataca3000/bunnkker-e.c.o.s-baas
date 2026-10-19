<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Contracts;

use Modules\Logistics\Fleet\Domain\ValueObjects\FitnessVerdict;

/**
 * The readiness seam — the ONE place Fleet's opinion leaves the module.
 *
 * ┌─ DIRECTIVE 3 — FLEET IS INDEPENDENT OF DELIVERY EXECUTION ──────────────┐
 * │ This interface is DECLARED and IMPLEMENTED by Fleet, and CONSUMED by     │
 * │ Dispatch — the context that assigns resources.                           │
 * │                                                                          │
 * │ Delivery and Distribution do not consume it. They keep using LOG-003's   │
 * │ Vehicle::canBeDispatched() exactly as they do today (D2: that method is  │
 * │ NOT modified).                                                           │
 * │                                                                          │
 * │ Fleet never calls Delivery. When a vehicle becomes unfit, Fleet publishes │
 * │ a fact; Dispatch decides what that fact means operationally, and V1       │
 * │ commits any resulting change.                                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Callers must tolerate a vehicle with no FleetUnit — that returns
 * FitnessVerdict::noOpinion(), never an exception, so a partially onboarded
 * fleet does not block dispatch.
 */
interface FleetReadinessQueryInterface
{
    /** Fitness for one V1 vehicle id. */
    public function verdictFor(int $vehicleId): FitnessVerdict;

    /**
     * Batched fitness — the resource-pool query. Avoids N+1 when a dispatch
     * board evaluates 40 vehicles at once.
     *
     * @param  list<int>  $vehicleIds
     * @return array<int, FitnessVerdict>  Keyed by vehicle id
     */
    public function verdictForMany(array $vehicleIds): array;
}
