<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Fleet\Domain\Contracts\FleetUnitRepositoryInterface;
use Modules\Logistics\Fleet\Domain\Enums\FleetUnitLifecycle;
use Modules\Logistics\Fleet\Domain\Enums\InspectionStatus;
use Modules\Logistics\Fleet\Domain\Events\FleetUnitLifecycleChanged;
use Modules\Logistics\Fleet\Domain\Events\FleetUnitRegistered;
use Modules\Logistics\Fleet\Domain\Events\VehicleBecameFit;
use Modules\Logistics\Fleet\Domain\Events\VehicleBecameUnfit;
use Modules\Logistics\Fleet\Domain\Exceptions\FleetException;
use Modules\Logistics\Fleet\Domain\Models\FleetGroup;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;
use Modules\Logistics\Fleet\Domain\Models\FleetUnitGroupHistory;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * Registration and lifecycle of a vehicle's operational shadow.
 *
 * ┌─ DIRECTIVE 2 — NO DUPLICATE MASTER DATA ────────────────────────────────┐
 * │ register() is the ONE place the V1 → V2 projection happens. It copies no │
 * │ vehicle attribute: plate, VIN, capacity and type stay in                 │
 * │ logistics_vehicles and are read through the relation.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class FleetUnitService
{
    public function __construct(
        private readonly FleetUnitRepositoryInterface $units,
        private readonly FleetReadinessService $readiness,
        private readonly MaintenanceSchedulingService $scheduling,
    ) {}

    /**
     * Create the FleetUnit for an existing V1 vehicle, seeding default
     * maintenance plans from the vehicle's type.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function register(Vehicle $vehicle, array $attributes = [], ?string $actor = null): FleetUnit
    {
        if ($this->units->findByVehicleId($vehicle->id) !== null) {
            throw FleetException::fleetUnitAlreadyExists($vehicle->id);
        }

        $unit = DB::transaction(function () use ($vehicle, $attributes) {
            $unit = $this->units->create($attributes + [
                'vehicle_id' => $vehicle->id,
                // Company is INHERITED from the vehicle, not re-entered — one
                // source of truth for which company owns this asset.
                'company_id' => $vehicle->company_id,
                'lifecycle_state' => FleetUnitLifecycle::Draft->value,
            ]);

            if ($unit->fleet_group_id !== null) {
                $this->recordGroupMembership($unit, $unit->fleet_group_id, 'Initial registration', null);
            }

            $this->scheduling->seedDefaultPlans($unit);

            return $unit->refresh();
        });

        FleetUnitRegistered::dispatch($unit, $actor);

        return $unit;
    }

    /**
     * Move the unit's commercial lifecycle.
     *
     * Publishes VehicleBecameFit / VehicleBecameUnfit when the transition
     * changes the fitness answer — Directive 3: a fact, not an instruction.
     */
    public function changeLifecycle(
        FleetUnit $unit,
        FleetUnitLifecycle $target,
        ?string $reason = null,
        ?string $actor = null,
    ): FleetUnit {
        $current = $unit->lifecycle_state;

        if ($current === $target) {
            return $unit;
        }

        if (! $current->canTransitionTo($target)) {
            throw FleetException::invalidLifecycleTransition($current, $target);
        }

        if ($target->requiresReason() && ($reason === null || trim($reason) === '')) {
            throw FleetException::lifecycleReasonRequired($target);
        }

        if ($target === FleetUnitLifecycle::Active && $current === FleetUnitLifecycle::Commissioning) {
            $this->assertCommissioningComplete($unit);
        }

        if ($target === FleetUnitLifecycle::Retired) {
            $this->assertRetirable($unit);
        }

        $wasAssignable = $this->readiness->verdict($unit)->isAssignable();

        $updated = DB::transaction(function () use ($unit, $target, $reason) {
            $stamp = match ($target) {
                FleetUnitLifecycle::Active => $unit->commissioned_at === null
                    ? ['commissioned_at' => now()]
                    : [],
                FleetUnitLifecycle::Retired => ['retired_at' => now()],
                default => [],
            };

            return $this->units->update($unit, $stamp + [
                'lifecycle_state' => $target->value,
                'lifecycle_reason' => $reason,
            ]);
        });

        FleetUnitLifecycleChanged::dispatch($updated, $actor);
        $this->publishFitnessChange($updated, $wasAssignable, $actor);

        return $updated;
    }

    /** Move a unit between capability cohorts, preserving history. */
    public function moveToGroup(
        FleetUnit $unit,
        FleetGroup $group,
        ?string $reason = null,
        ?int $actorId = null,
    ): FleetUnit {
        if ($unit->fleet_group_id === $group->id) {
            return $unit;
        }

        return DB::transaction(function () use ($unit, $group, $reason, $actorId) {
            FleetUnitGroupHistory::query()
                ->where('fleet_unit_id', $unit->id)
                ->whereNull('effective_to')
                ->update(['effective_to' => now()]);

            $this->recordGroupMembership($unit, $group->id, $reason, $actorId);

            return $this->units->update($unit, ['fleet_group_id' => $group->id]);
        });
    }

    /**
     * Re-evaluate fitness and publish a change if the answer moved.
     *
     * Called by anything that could alter a verdict — a defect resolving, a
     * work order completing, an inspection being approved.
     */
    public function refreshFitness(FleetUnit $unit, bool $wasAssignable, ?string $actor = null): void
    {
        $this->publishFitnessChange($unit->refresh(), $wasAssignable, $actor);
    }

    // ── Guards ────────────────────────────────────────────────────────────────

    private function assertCommissioningComplete(FleetUnit $unit): void
    {
        $hasApprovedInspection = $unit->inspections()
            ->where('status', InspectionStatus::Approved->value)
            ->exists();

        if (! $hasApprovedInspection) {
            throw FleetException::commissioningRequiresPassedInspection();
        }
    }

    private function assertRetirable(FleetUnit $unit): void
    {
        $reasons = [];

        if ($unit->hasOpenWorkOrder()) {
            $reasons[] = 'An open work order must be completed or cancelled first.';
        }

        if ($unit->openDefectCount() > 0) {
            $reasons[] = 'Open defects must be resolved or dismissed first.';
        }

        if ($reasons !== []) {
            throw FleetException::retirementBlocked($reasons);
        }
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function recordGroupMembership(
        FleetUnit $unit,
        int $groupId,
        ?string $reason,
        ?int $actorId,
    ): void {
        FleetUnitGroupHistory::create([
            'fleet_unit_id' => $unit->id,
            'fleet_group_id' => $groupId,
            'effective_from' => now(),
            'reason' => $reason,
            'changed_by' => $actorId,
        ]);
    }

    private function publishFitnessChange(FleetUnit $unit, bool $wasAssignable, ?string $actor): void
    {
        $isAssignable = $this->readiness->verdict($unit)->isAssignable();

        if ($wasAssignable === $isAssignable) {
            return;
        }

        if ($isAssignable) {
            VehicleBecameFit::dispatch($unit, $actor);

            return;
        }

        VehicleBecameUnfit::dispatch($unit, $actor);
    }
}
