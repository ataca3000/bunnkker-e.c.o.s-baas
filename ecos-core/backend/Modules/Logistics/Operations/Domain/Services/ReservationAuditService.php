<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Operations\Domain\Models\CapacityReservation;
use Modules\Logistics\Operations\Domain\Models\ReservationAuditEntry;

/**
 * The only writer of ops_reservation_audit_entries.
 *
 * Every capacity movement lands here, including the ones that failed — a
 * refusal is often the more interesting record, because it is the evidence that
 * a zone was already full when someone insists it was not.
 */
class ReservationAuditService
{
    /** @param array<string, mixed> $context */
    public function record(
        CapacityReservation $reservation,
        string $action,
        ?string $outcome = null,
        ?string $reason = null,
        array $context = [],
        ?int $actorId = null,
        ?string $actorName = null,
    ): ReservationAuditEntry {
        return ReservationAuditEntry::create([
            'company_id' => $reservation->company_id,
            'capacity_reservation_id' => $reservation->id,
            'action' => $action,
            'outcome' => $outcome,
            'reason' => $reason,
            'context' => $context === [] ? null : $context,
            'performed_at' => Carbon::now(),
            'actor_id' => $actorId,
            'actor_name' => $actorName,
        ]);
    }

    /**
     * The trail for one reservation, oldest first — a reservation's story only
     * reads in the order it happened.
     *
     * @return list<ReservationAuditEntry>
     */
    public function forReservation(CapacityReservation $reservation): array
    {
        return $reservation->auditEntries()
            ->orderBy('performed_at')
            ->orderBy('id')
            ->get()
            ->all();
    }
}
