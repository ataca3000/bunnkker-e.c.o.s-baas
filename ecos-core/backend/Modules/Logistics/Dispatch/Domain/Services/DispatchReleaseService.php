<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Dispatch\Domain\Enums\AssignmentStatus;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchBoardStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ProposalStatus;
use Modules\Logistics\Dispatch\Domain\Events\DispatchReleased;
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchException;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposal;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposedAssignment;
use Modules\Logistics\Dispatch\Domain\Models\DispatchRelease;
use Modules\Logistics\Distribution\Domain\Services\TripService;
use Modules\Logistics\Drivers\Domain\Services\DriverVehicleAssignmentService;
use Throwable;

/**
 * ┌─ THE V1 BOUNDARY — THE MOST IMPORTANT CLASS IN PHASE 2 ─────────────────┐
 * │                                                                          │
 * │ DIRECTIVE 6: Distribution remains the EXECUTION authority.               │
 * │ DIRECTIVE 11: one writer per table.                                      │
 * │                                                                          │
 * │ This service NEVER writes distribution_trips or                          │
 * │ logistics_driver_vehicle_assignments. It calls:                          │
 * │                                                                          │
 * │   • DriverVehicleAssignmentService::assign()  (LOG-002) — to pair        │
 * │   • TripService::assignDriverVehicle()        (LOG-004B) — to attach     │
 * │                                                                          │
 * │ If either refuses on its own domain rules, the release FAILS and V1's    │
 * │ own message is surfaced. Dispatch does not get a second opinion.         │
 * │                                                                          │
 * │ Every attempt writes a DispatchRelease carrying the ids V1 returned, so  │
 * │ "we went through V1" is auditable in the DATA, not merely a claim about  │
 * │ the code.                                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * PARTIAL SUCCESS IS NORMAL, not an error: on any real morning a few trips are
 * blocked while the rest must go out.
 */
class DispatchReleaseService
{
    public function __construct(
        private readonly DriverVehicleAssignmentService $assignments,
        private readonly TripService $trips,
        private readonly DispatchProposalService $proposals,
    ) {}

    /**
     * Release every releasable assignment on an accepted proposal.
     *
     * @return array{
     *     released: list<array<string, mixed>>,
     *     blocked: list<array<string, mixed>>,
     *     board_status: string
     * }
     */
    public function release(
        DispatchProposal $proposal,
        ?int $actorId = null,
        ?string $actor = null,
    ): array {
        if ($proposal->status !== ProposalStatus::Accepted) {
            throw DispatchException::proposalNotAccepted();
        }

        $candidates = $proposal->assignments()->with('blockers')->get();
        $releasable = $candidates->filter(
            static fn (DispatchProposedAssignment $a) => $a->isReleasable()
        );

        if ($releasable->isEmpty()) {
            throw DispatchException::nothingToRelease();
        }

        $board = $proposal->board;

        if ($board !== null && $board->status->canTransitionTo(DispatchBoardStatus::Releasing)) {
            $this->proposals->changeBoardStatus($board, DispatchBoardStatus::Releasing);
        }

        $released = [];
        $blocked = [];

        foreach ($candidates as $assignment) {
            if (! $assignment->isReleasable()) {
                $blocked[] = [
                    'assignment_id' => $assignment->uuid,
                    'trip_id' => $assignment->trip?->uuid,
                    'blockers' => $assignment->blockerReasons(),
                ];

                continue;
            }

            $outcome = $this->releaseOne($assignment, $actorId);

            if ($outcome['succeeded']) {
                $released[] = $outcome['payload'];

                continue;
            }

            $blocked[] = $outcome['payload'];
        }

        $boardStatus = $this->settleBoard($proposal, $released, $blocked);

        DispatchReleased::dispatch($proposal->refresh(), $actor);

        return [
            'released' => $released,
            'blocked' => $blocked,
            'board_status' => $boardStatus,
        ];
    }

    /**
     * Release ONE assignment through V1.
     *
     * Each assignment is its own transaction: one V1 refusal must not roll back
     * the trips that already went out.
     *
     * @return array{succeeded: bool, payload: array<string, mixed>}
     */
    public function releaseOne(
        DispatchProposedAssignment $assignment,
        ?int $actorId = null,
    ): array {
        $assignment->loadMissing(['trip', 'vehicle', 'driver', 'blockers']);

        $trip = $assignment->trip;
        $vehicle = $assignment->vehicle;
        $driver = $assignment->driver;

        if ($trip === null || $vehicle === null || $driver === null) {
            return $this->fail(
                $assignment,
                'The assignment is missing a trip, vehicle or driver.',
                $actorId,
            );
        }

        try {
            return DB::transaction(function () use ($assignment, $trip, $vehicle, $driver, $actorId) {
                // ── 1. Drivers (LOG-002) owns the pairing ────────────────────
                $v1Assignment = $this->assignments->assign(
                    $driver,
                    $vehicle,
                    notes: 'Released from dispatch proposal '.$assignment->proposal?->uuid,
                );

                // ── 2. Distribution (LOG-004B) owns the trip ─────────────────
                $updatedTrip = $this->trips->assignDriverVehicle($trip, $v1Assignment->id);

                $assignment->update(['status' => AssignmentStatus::Released->value]);

                DispatchRelease::create([
                    'dispatch_proposal_id' => $assignment->dispatch_proposal_id,
                    'assignment_id' => $assignment->id,
                    'succeeded' => true,
                    // The receipts.
                    'v1_trip_id' => $updatedTrip->id,
                    'v1_assignment_id' => $v1Assignment->id,
                    'released_by' => $actorId,
                ]);

                return [
                    'succeeded' => true,
                    'payload' => [
                        'assignment_id' => $assignment->uuid,
                        'trip_id' => $trip->uuid,
                        'v1_trip_id' => $updatedTrip->id,
                        'v1_assignment_id' => $v1Assignment->id,
                    ],
                ];
            });
        } catch (Throwable $e) {
            // V1 refused on its own rules. Surface ITS message — Dispatch does
            // not reinterpret the owning module's decision.
            return $this->fail($assignment, $e->getMessage(), $actorId);
        }
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @return array{succeeded: false, payload: array<string, mixed>} */
    private function fail(
        DispatchProposedAssignment $assignment,
        string $reason,
        ?int $actorId,
    ): array {
        DB::transaction(function () use ($assignment, $reason, $actorId) {
            if ($assignment->status->canTransitionTo(AssignmentStatus::Failed)) {
                $assignment->update(['status' => AssignmentStatus::Failed->value]);
            }

            DispatchRelease::create([
                'dispatch_proposal_id' => $assignment->dispatch_proposal_id,
                'assignment_id' => $assignment->id,
                'succeeded' => false,
                'failure_reason' => $reason,
                'released_by' => $actorId,
            ]);
        });

        return [
            'succeeded' => false,
            'payload' => [
                'assignment_id' => $assignment->uuid,
                'trip_id' => $assignment->trip?->uuid,
                'blockers' => array_merge($assignment->blockerReasons(), [$reason]),
            ],
        ];
    }

    /**
     * `partially_released` is a first-class outcome — see DispatchBoardStatus.
     *
     * @param  list<array<string, mixed>>  $released
     * @param  list<array<string, mixed>>  $blocked
     */
    private function settleBoard(DispatchProposal $proposal, array $released, array $blocked): string
    {
        $board = $proposal->board;

        if ($board === null) {
            return DispatchBoardStatus::Released->value;
        }

        $target = $blocked === []
            ? DispatchBoardStatus::Released
            : DispatchBoardStatus::PartiallyReleased;

        if ($released === [] && $blocked !== []) {
            // Nothing went out; the board stays where a dispatcher can retry.
            $target = DispatchBoardStatus::PartiallyReleased;
        }

        if ($board->status->canTransitionTo($target)) {
            $this->proposals->changeBoardStatus($board, $target);
        }

        return $board->refresh()->status->value;
    }
}
