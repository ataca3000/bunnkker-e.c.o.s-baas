<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Network\Domain\Enums\CapacityUnit;
use Modules\Logistics\Network\Domain\Exceptions\NetworkException;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;
use Modules\Logistics\Network\Domain\Services\CapacityLedgerService;
use Modules\Logistics\Operations\Domain\Enums\ReservationStatus;
use Modules\Logistics\Operations\Domain\Exceptions\OperationsException;
use Modules\Logistics\Operations\Domain\Models\CapacityReservation;
use Modules\Logistics\Operations\Domain\Models\ReservationAuditEntry;
use Modules\Logistics\Operations\Domain\Models\ResourcePool;

/**
 * The reservation lifecycle — request, hold, confirm, release.
 *
 * ┌─ EVERY CAPACITY DECISION IS NETWORK'S ──────────────────────────────────┐
 * │ This service performs no capacity arithmetic whatsoever. It does not     │
 * │ compare a request against a slot, does not compute a shortfall, and does │
 * │ not touch committed_*. It calls CapacityLedgerService and records what   │
 * │ the ledger said.                                                         │
 * │                                                                          │
 * │ When the ledger refuses, its message is stored VERBATIM. Paraphrasing a  │
 * │ refusal is how the reason a zone is full gets lost between two screens.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class CapacityReservationService
{
    public function __construct(
        private readonly CapacityLedgerService $ledger,
        private readonly ReservationAuditService $audit,
    ) {}

    /**
     * Ask the ledger for a hold, and record the answer either way.
     *
     * A refusal produces a Failed reservation rather than an exception with no
     * trace: operations needs the evidence that the ask was made and turned
     * down, not just an error in someone's browser.
     *
     * @param  array<string, float>  $quantities
     */
    public function request(
        CapacitySlot $slot,
        array $quantities,
        ?ResourcePool $pool = null,
        ?string $referenceType = null,
        ?string $referenceId = null,
        ?string $purpose = null,
        ?int $ttlMinutes = null,
        ?int $actorId = null,
        ?string $actorName = null,
    ): CapacityReservation {
        $reservation = CapacityReservation::create([
            'company_id' => $slot->plan?->company_id,
            'capacity_slot_id' => $slot->id,
            'resource_pool_id' => $pool?->id,
            'status' => ReservationStatus::Pending->value,
            'requested_orders' => (int) ($quantities[CapacityUnit::Orders->value] ?? 0),
            'requested_stops' => (int) ($quantities[CapacityUnit::Stops->value] ?? 0),
            'requested_weight_kg' => (float) ($quantities[CapacityUnit::WeightKg->value] ?? 0),
            'requested_volume_m3' => (float) ($quantities[CapacityUnit::VolumeM3->value] ?? 0),
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'purpose' => $purpose,
            'requested_at' => Carbon::now(),
            'requested_by' => $actorId,
        ]);

        if (! $reservation->hasAnyQuantity()) {
            $this->fail($reservation, 'A reservation must ask for at least one unit of something.', $actorId, $actorName);

            throw OperationsException::reservationQuantitiesRequired();
        }

        $this->audit->record(
            $reservation,
            ReservationAuditEntry::ACTION_REQUESTED,
            context: ['quantities' => $reservation->requestedQuantities()],
            actorId: $actorId,
            actorName: $actorName,
        );

        try {
            $commitment = $this->ledger->reserve(
                $slot,
                $reservation->requestedQuantities(),
                $referenceType,
                $referenceId,
                $ttlMinutes,
                $actorId,
            );
        } catch (NetworkException $e) {
            // The authority's own words, kept whole.
            $this->fail($reservation, $e->getMessage(), $actorId, $actorName);

            throw OperationsException::ledgerRefused($e->getMessage());
        }

        $reservation->update([
            'status' => ReservationStatus::Held->value,
            'capacity_commitment_id' => $commitment->id,
        ]);

        $this->audit->record(
            $reservation,
            ReservationAuditEntry::ACTION_HELD,
            outcome: 'Network is holding the requested capacity.',
            context: ['commitment_id' => $commitment->uuid],
            actorId: $actorId,
            actorName: $actorName,
        );

        return $reservation->refresh();
    }

    /** Turn a soft hold into a firm one. The ledger already deducted it. */
    public function confirm(
        CapacityReservation $reservation,
        ?int $actorId = null,
        ?string $actorName = null,
    ): CapacityReservation {
        $this->assertTransition($reservation, ReservationStatus::Confirmed);

        $commitment = $reservation->commitment;

        if ($commitment !== null) {
            $this->ledger->commit($commitment, $actorName);
        }

        $reservation->update([
            'status' => ReservationStatus::Confirmed->value,
            'confirmed_at' => Carbon::now(),
        ]);

        $this->audit->record(
            $reservation,
            ReservationAuditEntry::ACTION_CONFIRMED,
            actorId: $actorId,
            actorName: $actorName,
        );

        return $reservation->refresh();
    }

    /**
     * Give the capacity back.
     *
     * The reason requirement mirrors the ledger's own: releasing a confirmed
     * commitment is a business decision someone must own. Enforced here as well
     * so the refusal arrives before anything has moved.
     */
    public function release(
        CapacityReservation $reservation,
        ?string $reason = null,
        ?int $actorId = null,
        ?string $actorName = null,
    ): CapacityReservation {
        $this->assertTransition($reservation, ReservationStatus::Released);

        if ($reservation->status === ReservationStatus::Confirmed
            && ($reason === null || trim($reason) === '')) {
            throw OperationsException::releaseReasonRequired();
        }

        $commitment = $reservation->commitment;

        if ($commitment !== null) {
            try {
                $this->ledger->release($commitment, $reason, $actorName);
            } catch (NetworkException $e) {
                // The ledger already let it go — an expired hold, most likely.
                // Recording our side as released keeps the two in agreement
                // instead of stranding a reservation nobody can close.
                $this->audit->record(
                    $reservation,
                    ReservationAuditEntry::ACTION_EXPIRED,
                    outcome: $e->getMessage(),
                    actorId: $actorId,
                    actorName: $actorName,
                );
            }
        }

        $reservation->update([
            'status' => ReservationStatus::Released->value,
            'released_at' => Carbon::now(),
            'release_reason' => $reason,
        ]);

        $this->audit->record(
            $reservation,
            ReservationAuditEntry::ACTION_RELEASED,
            reason: $reason,
            actorId: $actorId,
            actorName: $actorName,
        );

        return $reservation->refresh();
    }

    /**
     * Reclaim reservations whose ledger hold has lapsed.
     *
     * The ledger's own sweep is the authority on expiry; this only brings the
     * operational record into line with it, so the two never disagree about
     * what is held.
     */
    public function reconcileExpired(?Carbon $at = null): int
    {
        $at ??= Carbon::now();

        $swept = $this->ledger->sweepExpired($at);

        $stranded = CapacityReservation::query()
            ->where('status', ReservationStatus::Held->value)
            ->whereHas('commitment', fn ($q) => $q->whereIn('status', ['expired', 'released']))
            ->with('commitment')
            ->get();

        foreach ($stranded as $reservation) {
            $reservation->update([
                'status' => ReservationStatus::Released->value,
                'released_at' => Carbon::now(),
                'release_reason' => 'The hold lapsed before it was confirmed.',
            ]);

            $this->audit->record(
                $reservation,
                ReservationAuditEntry::ACTION_EXPIRED,
                outcome: 'Network reclaimed the hold; the operational record was brought into line.',
            );
        }

        return $swept;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function fail(
        CapacityReservation $reservation,
        string $message,
        ?int $actorId,
        ?string $actorName,
    ): void {
        $reservation->update([
            'status' => ReservationStatus::Failed->value,
            'failure_reason' => $message,
        ]);

        $this->audit->record(
            $reservation,
            ReservationAuditEntry::ACTION_FAILED,
            outcome: $message,
            actorId: $actorId,
            actorName: $actorName,
        );
    }

    private function assertTransition(CapacityReservation $reservation, ReservationStatus $target): void
    {
        if (! $reservation->status->canTransitionTo($target)) {
            throw OperationsException::invalidReservationTransition($reservation->status, $target);
        }
    }
}
