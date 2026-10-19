<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services;

use Modules\Operations\Preparation\Domain\Enums\ReservableType;
use Modules\Operations\Preparation\Domain\Enums\ReservationStatus;
use Modules\Operations\Preparation\Domain\Models\PreparationInventoryReservation;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Manages soft inventory reservations for preparation waves.
 *
 * A soft reservation does not remove stock from the ledger.
 * It signals that this quantity is intended for the given wave,
 * preventing other waves from assuming full availability.
 */
final class SoftReservationService
{
    /**
     * Reserve available raw materials and finished goods for the wave.
     * Called when StartPreparationAction transitions a wave to Preparing.
     */
    public function reserve(PreparationWave $wave, string $actorId): void
    {
        // Reserve raw material requirements.
        foreach ($wave->materialRequirements as $req) {
            // Reserve the lesser of required vs available (we can only soft-lock what exists).
            $qty = min((float) $req->quantity_required, (float) $req->quantity_available);
            if ($qty <= 0) {
                continue;
            }

            PreparationInventoryReservation::create([
                'company_id' => $wave->company_id,
                'preparation_wave_id' => $wave->id,
                'reservable_type' => ReservableType::RawMaterial->value,
                'reservable_id' => $req->raw_material_id,
                'reservable_name_snapshot' => $req->material_name_snapshot,
                'quantity_reserved' => $qty,
                'status' => ReservationStatus::Created->value,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
        }

        // Reserve finished goods production requirements.
        foreach ($wave->productionRequirements as $req) {
            $qty = min((float) $req->quantity_required, (float) $req->quantity_available);
            if ($qty <= 0) {
                continue;
            }

            PreparationInventoryReservation::create([
                'company_id' => $wave->company_id,
                'preparation_wave_id' => $wave->id,
                'reservable_type' => ReservableType::FinishedGood->value,
                'reservable_id' => $req->product_id,
                'reservable_name_snapshot' => $req->name_snapshot,
                'quantity_reserved' => $qty,
                'status' => ReservationStatus::Created->value,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
        }
    }

    /**
     * Release all active reservations for a cancelled wave.
     * Stock is freed for other waves to claim.
     */
    public function release(PreparationWave $wave, string $actorId): void
    {
        PreparationInventoryReservation::where('preparation_wave_id', $wave->id)
            ->whereIn('status', [ReservationStatus::Created->value, ReservationStatus::Updated->value])
            ->update([
                'status' => ReservationStatus::Released->value,
                'released_at' => now(),
                'released_by' => $actorId,
                'updated_by' => $actorId,
            ]);
    }

    /**
     * Mark all active reservations as consumed when a wave completes.
     * Stock has been physically used; reservation purpose fulfilled.
     */
    public function consume(PreparationWave $wave, string $actorId): void
    {
        PreparationInventoryReservation::where('preparation_wave_id', $wave->id)
            ->whereIn('status', [ReservationStatus::Created->value, ReservationStatus::Updated->value])
            ->update([
                'status' => ReservationStatus::Consumed->value,
                'consumed_at' => now(),
                'consumed_by' => $actorId,
                'updated_by' => $actorId,
            ]);
    }

    /**
     * Returns the total quantity soft-reserved (across all active waves) for a given resource.
     * Used by inventory queries to report effective available stock.
     */
    public function totalReserved(string $companyId, string $reservableId, string $reservableType): float
    {
        return (float) PreparationInventoryReservation::where('company_id', $companyId)
            ->where('reservable_id', $reservableId)
            ->where('reservable_type', $reservableType)
            ->whereIn('status', [ReservationStatus::Created->value, ReservationStatus::Updated->value])
            ->sum('quantity_reserved');
    }
}
