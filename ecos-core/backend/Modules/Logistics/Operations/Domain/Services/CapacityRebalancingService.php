<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Network\Domain\Exceptions\NetworkException;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;
use Modules\Logistics\Network\Domain\Services\CapacityLedgerService;
use Modules\Logistics\Operations\Domain\Enums\ReservationStatus;
use Modules\Logistics\Operations\Domain\Exceptions\OperationsException;
use Modules\Logistics\Operations\Domain\Models\CapacityReservation;
use Modules\Logistics\Operations\Domain\Models\ReservationAuditEntry;

/**
 * Move a reservation from a full slot to one that can take it.
 *
 * ┌─ REBALANCING IS RELEASE-THEN-RESERVE, NOTHING CLEVERER ─────────────────┐
 * │ Both halves go through CapacityLedgerService, so the ledger stays the    │
 * │ only writer of committed_* and the destination is checked by the same    │
 * │ code that checks every other reservation.                                │
 * │                                                                          │
 * │ ORDER MATTERS: reserve the destination FIRST, release the origin second. │
 * │ Releasing first would briefly hand the origin's capacity to whoever is    │
 * │ next in line, and a rebalance that can lose the capacity it was moving   │
 * │ is worse than no rebalance.                                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The suggestion side never moves anything. It reports where a reservation
 * WOULD fit and leaves the decision to a person — Network advises, operations
 * decides, the same stance the ledger itself takes.
 */
class CapacityRebalancingService
{
    public function __construct(
        private readonly CapacityLedgerService $ledger,
        private readonly ReservationAuditService $audit,
    ) {}

    /**
     * Slots that could take this reservation, best fit first.
     *
     * Advisory only. Nothing is held, so two operators can be shown the same
     * candidate — whichever acts first gets it, and the second is refused by
     * the ledger with a reason.
     *
     * @return list<array<string, mixed>>
     */
    public function candidatesFor(CapacityReservation $reservation, int $limit = 5): array
    {
        if (! $reservation->holdsCapacity()) {
            throw OperationsException::nothingToRebalance();
        }

        $slot = $reservation->slot;

        if ($slot === null) {
            return [];
        }

        $quantities = $reservation->requestedQuantities();

        $candidates = CapacitySlot::query()
            ->where('id', '!=', $slot->id)
            ->whereHas('plan', function ($q) use ($slot) {
                $q->where('service_area_id', $slot->plan?->service_area_id)
                    ->where('is_published', true);
            })
            ->with('plan')
            ->get()
            // canAccommodate() is the slot's own judgement, not a
            // reimplementation of it.
            ->filter(fn (CapacitySlot $candidate) => $candidate->canAccommodate($quantities))
            ->sortBy(fn (CapacitySlot $candidate) => $candidate->utilisation() ?? 0)
            ->take($limit);

        return $candidates->map(fn (CapacitySlot $candidate) => [
            'slot_id' => $candidate->uuid,
            'window_start' => $candidate->window_start,
            'window_end' => $candidate->window_end,
            'utilisation' => $candidate->utilisation(),
            'remaining' => $candidate->remaining(),
            'binding_unit' => $candidate->bindingUnit()?->value,
        ])->values()->all();
    }

    /**
     * Actually move it.
     *
     * If the destination refuses, the origin hold is untouched and the caller
     * gets the ledger's reason — a failed rebalance must never cost the
     * reservation it was trying to help.
     */
    public function rebalance(
        CapacityReservation $reservation,
        CapacitySlot $destination,
        ?string $reason = null,
        ?int $actorId = null,
        ?string $actorName = null,
    ): CapacityReservation {
        if (! $reservation->holdsCapacity()) {
            throw OperationsException::nothingToRebalance();
        }

        if ((int) $reservation->capacity_slot_id === (int) $destination->id) {
            throw OperationsException::rebalanceToSameSlot();
        }

        $originSlotId = (int) $reservation->capacity_slot_id;
        $originCommitment = $reservation->commitment;
        $quantities = $reservation->requestedQuantities();

        // Destination first. If this throws, nothing has changed.
        //
        // The ledger's refusal is translated here for the same reason
        // CapacityReservationService translates it: NetworkException carries no
        // render(), so left alone it reaches the operator as a 500 with no
        // explanation of why the slot would not take the move.
        try {
            $newCommitment = $this->ledger->reserve(
                $destination,
                $quantities,
                $reservation->reference_type,
                $reservation->reference_id,
                null,
                $actorId,
            );
        } catch (NetworkException $e) {
            $this->audit->record(
                $reservation,
                ReservationAuditEntry::ACTION_FAILED,
                outcome: $e->getMessage(),
                reason: $reason,
                context: ['attempted_slot_id' => $destination->id],
                actorId: $actorId,
                actorName: $actorName,
            );

            throw OperationsException::ledgerRefused($e->getMessage());
        }

        DB::transaction(function () use (
            $reservation, $destination, $newCommitment, $originCommitment, $originSlotId, $reason, $actorName
        ) {
            if ($originCommitment !== null) {
                $this->ledger->release(
                    $originCommitment,
                    $reason ?? 'Rebalanced to another slot.',
                    $actorName,
                );
            }

            $reservation->update([
                'capacity_slot_id' => $destination->id,
                'capacity_commitment_id' => $newCommitment->id,
                'rebalanced_from_slot_id' => $originSlotId,
                // A rebalance re-opens the hold: the destination has not been
                // confirmed by anyone yet, whatever the origin's state was.
                'status' => ReservationStatus::Held->value,
                'confirmed_at' => null,
            ]);
        });

        $this->audit->record(
            $reservation,
            ReservationAuditEntry::ACTION_REBALANCED,
            outcome: 'Moved to another slot; the destination hold is unconfirmed.',
            reason: $reason,
            context: [
                'from_slot_id' => $originSlotId,
                'to_slot_id' => $destination->id,
                'moved_at' => Carbon::now()->toIso8601String(),
            ],
            actorId: $actorId,
            actorName: $actorName,
        );

        return $reservation->refresh();
    }
}
