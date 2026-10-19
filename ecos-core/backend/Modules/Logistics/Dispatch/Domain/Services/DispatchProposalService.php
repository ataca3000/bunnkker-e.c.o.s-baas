<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Dispatch\Domain\Enums\AssignmentStatus;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchBoardStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ProposalStatus;
use Modules\Logistics\Dispatch\Domain\Events\DispatchBlocked;
use Modules\Logistics\Dispatch\Domain\Events\DispatchBoardOpened;
use Modules\Logistics\Dispatch\Domain\Events\DispatchProposalAccepted;
use Modules\Logistics\Dispatch\Domain\Events\DispatchProposalGenerated;
use Modules\Logistics\Dispatch\Domain\Events\DispatchProposalRejected;
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchException;
use Modules\Logistics\Dispatch\Domain\Models\DispatchAssignmentBlocker;
use Modules\Logistics\Dispatch\Domain\Models\DispatchBoard;
use Modules\Logistics\Dispatch\Domain\Models\DispatchPolicy;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposal;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposedAssignment;
use Modules\Logistics\Distribution\Domain\Models\Trip;

/**
 * Boards and proposals.
 *
 * SNAPSHOT IN, PROPOSAL OUT: generate() takes the resource pool as it is at one
 * moment, records it, and returns assignments. Nothing commits here — that is
 * DispatchReleaseService's job, behind its own permission.
 *
 * Every refusal carries its ordered reasons (the LOG-005 retryBlockers()
 * contract), so a dispatcher never sees a blocked row without knowing why.
 */
class DispatchProposalService
{
    public function __construct(
        private readonly ResourcePoolService $pool,
        private readonly AssignmentScoringService $scoring,
    ) {}

    // ── Boards ────────────────────────────────────────────────────────────────

    /** @param array<string, mixed> $attributes */
    public function openBoard(array $attributes, ?string $actor = null): DispatchBoard
    {
        $exists = DispatchBoard::query()
            ->where('company_id', $attributes['company_id'] ?? null)
            ->where('dispatch_region_id', $attributes['dispatch_region_id'] ?? null)
            ->where('board_date', $attributes['board_date'] ?? null)
            ->exists();

        if ($exists) {
            throw DispatchException::boardAlreadyExists((string) ($attributes['board_date'] ?? ''));
        }

        $board = DB::transaction(fn () => DispatchBoard::create($attributes));

        DispatchBoardOpened::dispatch($board, $actor);

        return $board;
    }

    public function changeBoardStatus(
        DispatchBoard $board,
        DispatchBoardStatus $target,
        ?string $reason = null,
    ): DispatchBoard {
        $current = $board->status;

        if ($current === $target) {
            return $board;
        }

        if (! $current->canTransitionTo($target)) {
            throw DispatchException::invalidBoardTransition($current, $target);
        }

        $stamp = match ($target) {
            DispatchBoardStatus::Planning => ['planned_at' => Carbon::now()],
            DispatchBoardStatus::Released => ['released_at' => Carbon::now()],
            DispatchBoardStatus::Closed => ['closed_at' => Carbon::now()],
            default => [],
        };

        $board->update($stamp + [
            'status' => $target->value,
            'status_reason' => $reason,
        ]);

        return $board->refresh();
    }

    // ── Proposals ─────────────────────────────────────────────────────────────

    /**
     * Build a proposal for every trip on the board that still needs resources.
     *
     * Trips already carrying an assignment are skipped: Distribution owns the
     * trip and a dispatcher who paired one by hand must not be overruled.
     */
    public function generate(
        DispatchBoard $board,
        ?DispatchPolicy $policy = null,
        ?int $actorId = null,
        ?string $actor = null,
    ): DispatchProposal {
        if ($board->status === DispatchBoardStatus::Open) {
            $this->changeBoardStatus($board, DispatchBoardStatus::Planning);
            $board->refresh();
        }

        $pool = $this->pool->build($board->company_id);
        $trips = $this->candidateTrips($board);

        $proposal = DB::transaction(function () use ($board, $policy, $pool, $trips, $actorId) {
            // Re-running supersedes the previous proposal rather than editing
            // it, so every board decision stays readable after the fact.
            $board->proposals()
                ->where('status', ProposalStatus::Generated->value)
                ->update(['status' => ProposalStatus::Superseded->value]);

            $proposal = $board->proposals()->create([
                'dispatch_policy_id' => $policy?->id,
                'company_id' => $board->company_id,
                'status' => ProposalStatus::Generated->value,
                'pool_snapshot' => $pool,
                'created_by' => $actorId,
            ]);

            $assignmentCount = 0;
            $blockedCount = 0;

            // Vehicles are consumed as they are assigned — one vehicle cannot
            // be proposed for two trips on the same board.
            $availableVehicles = array_values(array_filter(
                $pool['vehicles'],
                static fn (array $v) => $v['is_assignable'],
            ));
            $availableDrivers = array_values(array_filter(
                $pool['drivers'],
                static fn (array $d) => $d['can_start_deliveries'],
            ));

            foreach ($trips as $trip) {
                $pick = $this->scoring->bestFor($trip, $availableVehicles, $policy);

                $assignment = $proposal->assignments()->create([
                    'trip_id' => $trip->id,
                    'vehicle_id' => $pick['vehicle']['vehicle_id'] ?? null,
                    'driver_id' => $availableDrivers[0]['driver_id'] ?? null,
                    'status' => AssignmentStatus::Proposed->value,
                    'score' => $pick['score'],
                    'score_breakdown' => $pick['breakdown'],
                    'fitness_level' => $pick['vehicle']['fitness']['level'] ?? null,
                ]);

                $blockers = $this->collectBlockers($trip, $pick['vehicle'], $availableDrivers);

                if ($blockers !== []) {
                    foreach ($blockers as $blocker) {
                        $assignment->blockers()->create($blocker);
                    }

                    $assignment->update(['status' => AssignmentStatus::Blocked->value]);
                    $blockedCount++;
                    DispatchBlocked::dispatch($assignment->refresh());

                    continue;
                }

                // Consume the chosen resources.
                $availableVehicles = array_values(array_filter(
                    $availableVehicles,
                    static fn (array $v) => $v['vehicle_id'] !== $assignment->vehicle_id,
                ));
                $availableDrivers = array_values(array_filter(
                    $availableDrivers,
                    static fn (array $d) => $d['driver_id'] !== $assignment->driver_id,
                ));

                $assignmentCount++;
            }

            $proposal->update([
                'assignment_count' => $assignmentCount,
                'blocked_count' => $blockedCount,
            ]);

            return $proposal->refresh();
        });

        $this->changeBoardStatus($board->refresh(), DispatchBoardStatus::Proposed);

        DispatchProposalGenerated::dispatch($proposal, $actor);

        return $proposal;
    }

    public function accept(
        DispatchProposal $proposal,
        ?int $actorId = null,
        ?string $actor = null,
    ): DispatchProposal {
        $this->assertProposalTransition($proposal, ProposalStatus::Accepted);

        $proposal->update([
            'status' => ProposalStatus::Accepted->value,
            'decided_at' => Carbon::now(),
            'decided_by' => $actorId,
        ]);

        DispatchProposalAccepted::dispatch($proposal->refresh(), $actor);

        return $proposal->refresh();
    }

    public function reject(
        DispatchProposal $proposal,
        ?string $reason = null,
        ?int $actorId = null,
        ?string $actor = null,
    ): DispatchProposal {
        $this->assertProposalTransition($proposal, ProposalStatus::Rejected);

        $proposal->update([
            'status' => ProposalStatus::Rejected->value,
            'decided_at' => Carbon::now(),
            'decided_by' => $actorId,
            'decision_reason' => $reason,
        ]);

        DispatchProposalRejected::dispatch($proposal->refresh(), $actor);

        return $proposal->refresh();
    }

    /**
     * Manually override a blocked assignment. Requires a reason, which is
     * recorded on the blocker trail rather than silently discarded.
     */
    public function override(
        DispatchProposedAssignment $assignment,
        string $reason,
        ?int $vehicleId = null,
        ?int $driverId = null,
    ): DispatchProposedAssignment {
        if (trim($reason) === '') {
            throw DispatchException::overrideReasonRequired();
        }

        if (! $assignment->status->canTransitionTo(AssignmentStatus::Overridden)) {
            throw DispatchException::invalidAssignmentTransition(
                $assignment->status,
                AssignmentStatus::Overridden,
            );
        }

        return DB::transaction(function () use ($assignment, $reason, $vehicleId, $driverId) {
            $assignment->blockers()->create([
                'source' => DispatchAssignmentBlocker::SOURCE_POLICY,
                'reason' => 'Manually overridden: '.$reason,
                'is_hard' => false,
            ]);

            $assignment->update(array_filter([
                'vehicle_id' => $vehicleId,
                'driver_id' => $driverId,
            ], static fn ($v) => $v !== null) + [
                'status' => AssignmentStatus::Overridden->value,
            ]);

            return $assignment->refresh();
        });
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * Trips on this board's date that still need resources.
     *
     * Distribution owns the trip; this is a READ.
     *
     * @return \Illuminate\Support\Collection<int, Trip>
     */
    private function candidateTrips(DispatchBoard $board): \Illuminate\Support\Collection
    {
        return Trip::query()
            ->when($board->company_id !== null, fn ($q) => $q->where('company_id', $board->company_id))
            ->whereNull('driver_vehicle_assignment_id')
            ->whereIn('status', ['planning', 'planned'])
            ->orderBy('id')
            ->get();
    }

    /**
     * @param  array<string, mixed>|null  $vehicle
     * @param  list<array<string, mixed>>  $drivers
     * @return list<array<string, mixed>>
     */
    private function collectBlockers(Trip $trip, ?array $vehicle, array $drivers): array
    {
        $blockers = [];

        if ($vehicle === null) {
            $blockers[] = [
                'source' => DispatchAssignmentBlocker::SOURCE_FLEET,
                'reason' => 'No fit vehicle is available in the pool.',
                'is_hard' => true,
            ];
        } else {
            // Fleet's own reasons, verbatim. Dispatch does not paraphrase the
            // readiness authority.
            foreach ($vehicle['fitness']['blockers'] ?? [] as $reason) {
                $blockers[] = [
                    'source' => DispatchAssignmentBlocker::SOURCE_FLEET,
                    'reason' => $reason,
                    'is_hard' => true,
                ];
            }

            if (($vehicle['v1_dispatchable'] ?? true) === false) {
                $blockers[] = [
                    'source' => DispatchAssignmentBlocker::SOURCE_FLEET,
                    'reason' => 'The vehicle is not dispatchable in its current operational status.',
                    'is_hard' => true,
                ];
            }

            if ($trip->capacity !== null
                && $vehicle['capacity_orders'] !== null
                && (int) $vehicle['capacity_orders'] < (int) $trip->capacity) {
                $blockers[] = [
                    'source' => DispatchAssignmentBlocker::SOURCE_CAPACITY,
                    'reason' => sprintf(
                        'Vehicle capacity (%d orders) is below the trip requirement (%d).',
                        $vehicle['capacity_orders'],
                        $trip->capacity,
                    ),
                    'is_hard' => true,
                ];
            }
        }

        if ($drivers === []) {
            $blockers[] = [
                'source' => DispatchAssignmentBlocker::SOURCE_DRIVER,
                'reason' => 'No driver is available to start deliveries.',
                'is_hard' => true,
            ];
        }

        return $blockers;
    }

    private function assertProposalTransition(DispatchProposal $proposal, ProposalStatus $target): void
    {
        if ($proposal->isDecided()) {
            throw DispatchException::proposalAlreadyDecided();
        }

        if (! $proposal->status->canTransitionTo($target)) {
            throw DispatchException::invalidProposalTransition($proposal->status, $target);
        }
    }
}
