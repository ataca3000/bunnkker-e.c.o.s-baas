<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Dispatch\Domain\Enums\AllocationStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictType;
use Modules\Logistics\Dispatch\Domain\Events\DispatchConflictDetected;
use Modules\Logistics\Dispatch\Domain\Models\AssignmentLock;
use Modules\Logistics\Dispatch\Domain\Models\DispatchConflict;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;
use Modules\Logistics\Dispatch\Domain\Models\ResourceAllocation;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Fleet\Domain\Contracts\FleetReadinessQueryInterface;

/**
 * Finds clashes before a release does.
 *
 * ┌─ DIRECTIVES 4/5/11 — ASKS, NEVER RE-DERIVES ────────────────────────────┐
 * │ Vehicle fitness comes from Fleet's PUBLIC contract. Driver readiness     │
 * │ comes from LOG-002's canStartDeliveries(). Trip state comes from         │
 * │ Distribution. This service asks each authority and RECORDS the answer —  │
 * │ it re-implements none of them.                                           │
 * │                                                                          │
 * │ Where another module objects, its reason is quoted VERBATIM. Dispatch    │
 * │ does not paraphrase the authority that said no.                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class ConflictDetectionService
{
    public function __construct(
        private readonly FleetReadinessQueryInterface $fleetReadiness,
        private readonly AssignmentLockService $locks,
    ) {}

    /**
     * Every clash standing in the way of this allocation.
     *
     * Returns the persisted conflicts, blocking ones first.
     *
     * @return list<DispatchConflict>
     */
    public function detectFor(
        ResourceAllocation $allocation,
        ?DispatchSession $session = null,
    ): array {
        $found = [];

        foreach ([
            $this->checkVehicleFitness($allocation),
            $this->checkDriverReadiness($allocation),
            $this->checkTripAlreadyAssigned($allocation),
        ] as $candidate) {
            if ($candidate !== null) {
                $found[] = $candidate;
            }
        }

        foreach ($this->checkDoubleBooking($allocation) as $candidate) {
            $found[] = $candidate;
        }

        foreach ($this->checkLocks($allocation, $session) as $candidate) {
            $found[] = $candidate;
        }

        $persisted = [];

        foreach ($found as $spec) {
            $persisted[] = $this->persist($allocation, $session, $spec);
        }

        // Blocking first — a dispatcher should see what stops them before what
        // merely warns them.
        usort(
            $persisted,
            static fn (DispatchConflict $a, DispatchConflict $b) => (int) $b->conflict_type->isBlocking()
                <=> (int) $a->conflict_type->isBlocking(),
        );

        return $persisted;
    }

    /**
     * Blocking conflicts still outstanding for an allocation.
     *
     * @return list<DispatchConflict>
     */
    public function outstandingBlockers(ResourceAllocation $allocation): array
    {
        return DispatchConflict::query()
            ->where('allocation_id', $allocation->id)
            ->whereIn('status', [ConflictStatus::Open->value, ConflictStatus::Acknowledged->value])
            ->get()
            ->filter(fn (DispatchConflict $c) => $c->blocksRelease())
            ->values()
            ->all();
    }

    // ── Individual checks ─────────────────────────────────────────────────────

    /** @return array<string, mixed>|null */
    private function checkVehicleFitness(ResourceAllocation $allocation): ?array
    {
        if ($allocation->vehicle_id === null) {
            return null;
        }

        // Fleet is the readiness authority (Directive 5). We ask it.
        $verdict = $this->fleetReadiness->verdictFor((int) $allocation->vehicle_id);

        if ($verdict->isAssignable()) {
            return null;
        }

        return [
            'type' => ConflictType::VehicleUnfit,
            'resource_type' => AssignmentLock::RESOURCE_VEHICLE,
            'resource_id' => $allocation->vehicle_id,
            // Fleet's own words, verbatim.
            'description' => 'Fleet reports this vehicle unfit: '.implode(' ', $verdict->blockers),
            'context' => ['blockers' => $verdict->blockers, 'level' => $verdict->level->value],
        ];
    }

    /** @return array<string, mixed>|null */
    private function checkDriverReadiness(ResourceAllocation $allocation): ?array
    {
        if ($allocation->driver_id === null) {
            return null;
        }

        $driver = Driver::find($allocation->driver_id);

        // LOG-002's own gate. Dispatch does not re-derive licence rules.
        if ($driver === null || $driver->canStartDeliveries()) {
            return null;
        }

        return [
            'type' => ConflictType::DriverUnavailable,
            'resource_type' => AssignmentLock::RESOURCE_DRIVER,
            'resource_id' => $allocation->driver_id,
            'description' => sprintf(
                'Driver %s cannot start deliveries (licence or status).',
                $driver->full_name ?? $driver->driver_code ?? $allocation->driver_id,
            ),
            'context' => ['driver_id' => $allocation->driver_id],
        ];
    }

    /** @return array<string, mixed>|null */
    private function checkTripAlreadyAssigned(ResourceAllocation $allocation): ?array
    {
        if ($allocation->trip_id === null) {
            return null;
        }

        $trip = Trip::find($allocation->trip_id);

        if ($trip === null || $trip->driver_vehicle_assignment_id === null) {
            return null;
        }

        return [
            'type' => ConflictType::TripAlreadyAssigned,
            'resource_type' => AssignmentLock::RESOURCE_TRIP,
            'resource_id' => $allocation->trip_id,
            'description' => sprintf(
                'Trip %s already carries an assignment in Distribution.',
                $trip->trip_number ?? $allocation->trip_id,
            ),
            'context' => ['trip_id' => $allocation->trip_id],
        ];
    }

    /**
     * A vehicle or driver already spoken for by another live allocation.
     *
     * @return list<array<string, mixed>>
     */
    private function checkDoubleBooking(ResourceAllocation $allocation): array
    {
        $found = [];

        foreach ([
            [AssignmentLock::RESOURCE_VEHICLE, 'vehicle_id', ConflictType::VehicleDoubleBooked],
            [AssignmentLock::RESOURCE_DRIVER, 'driver_id', ConflictType::DriverDoubleBooked],
        ] as [$resourceType, $column, $conflictType]) {
            $resourceId = $allocation->{$column};

            if ($resourceId === null) {
                continue;
            }

            $other = ResourceAllocation::query()
                ->where('id', '!=', $allocation->id)
                ->where($column, $resourceId)
                ->whereIn('status', [
                    AllocationStatus::Reserved->value,
                    AllocationStatus::Confirmed->value,
                ])
                ->first();

            if ($other === null) {
                continue;
            }

            $found[] = [
                'type' => $conflictType,
                'resource_type' => $resourceType,
                'resource_id' => $resourceId,
                'conflicting_allocation_id' => $other->id,
                'description' => sprintf(
                    'That %s is already allocated to another trip on this board.',
                    $resourceType,
                ),
                'context' => ['conflicting_allocation' => $other->uuid],
            ];
        }

        return $found;
    }

    /**
     * A resource held by a DIFFERENT session.
     *
     * @return list<array<string, mixed>>
     */
    private function checkLocks(ResourceAllocation $allocation, ?DispatchSession $session): array
    {
        $found = [];

        foreach ([
            [AssignmentLock::RESOURCE_VEHICLE, 'vehicle_id'],
            [AssignmentLock::RESOURCE_DRIVER, 'driver_id'],
        ] as [$resourceType, $column]) {
            $resourceId = $allocation->{$column};

            if ($resourceId === null) {
                continue;
            }

            $holder = $this->locks->currentHolder($resourceType, (int) $resourceId);

            // Our own lock is not a conflict — it is the point.
            if ($holder === null || $holder->dispatch_session_id === $session?->id) {
                continue;
            }

            $found[] = [
                'type' => ConflictType::ResourceLocked,
                'resource_type' => $resourceType,
                'resource_id' => $resourceId,
                'description' => sprintf(
                    'That %s is held by %s for another %d second(s).',
                    $resourceType,
                    $holder->held_by_name ?? 'another session',
                    $holder->remainingSeconds(),
                ),
                'context' => ['lock_uuid' => $holder->uuid],
            ];
        }

        return $found;
    }

    /** @param array<string, mixed> $spec */
    private function persist(
        ResourceAllocation $allocation,
        ?DispatchSession $session,
        array $spec,
    ): DispatchConflict {
        /** @var ConflictType $type */
        $type = $spec['type'];

        $conflict = DispatchConflict::create([
            'company_id' => $allocation->company_id,
            'dispatch_session_id' => $session?->id,
            'assignment_id' => $allocation->assignment_id,
            'allocation_id' => $allocation->id,
            'conflict_type' => $type->value,
            'severity' => $type->severity(),
            'status' => ConflictStatus::Open->value,
            'resource_type' => $spec['resource_type'] ?? null,
            'resource_id' => $spec['resource_id'] ?? null,
            'conflicting_allocation_id' => $spec['conflicting_allocation_id'] ?? null,
            'description' => $spec['description'],
            'context' => $spec['context'] ?? null,
            'detected_at' => Carbon::now(),
        ]);

        // Notification only — one dispatch per persisted conflict, carrying the
        // owning authority so a consumer can route it without re-judging.
        DispatchConflictDetected::dispatch(
            $conflict->uuid,
            $type->value,
            $type->severity(),
            $conflict->authority(),
            $conflict->company_id,
            ($conflict->detected_at ?? Carbon::now())->toIso8601String(),
        );

        return $conflict;
    }
}
