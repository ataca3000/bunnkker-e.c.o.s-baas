<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Network\Domain\Enums\CapacityUnit;
use Modules\Logistics\Network\Domain\Models\CapacityCommitment;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;
use Modules\Logistics\Operations\Domain\Enums\ReservationStatus;

/**
 * The operational envelope around a ledger commitment.
 *
 * ┌─ WHAT THIS ROW IS, AND IS NOT ──────────────────────────────────────────┐
 * │ IS:     who asked, for what, why, and what Network answered.             │
 * │ IS NOT: a record of how much capacity is held. That lives on the slot,   │
 * │         written only by CapacityLedgerService.                           │
 * │                                                                          │
 * │ ledgerStatus() reads through to the commitment rather than caching it,   │
 * │ so a sweep that expires the hold is visible here immediately.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class CapacityReservation extends Model
{
    protected $table = 'ops_capacity_reservations';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => ReservationStatus::Pending->value,
        'requested_orders' => 0,
        'requested_stops' => 0,
        'requested_weight_kg' => 0,
        'requested_volume_m3' => 0,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'capacity_slot_id', 'capacity_commitment_id', 'resource_pool_id',
        'status',
        'requested_orders', 'requested_stops', 'requested_weight_kg', 'requested_volume_m3',
        'reference_type', 'reference_id', 'purpose',
        'requested_at', 'requested_by',
        'confirmed_at', 'released_at', 'release_reason', 'failure_reason',
        'rebalanced_from_slot_id',
    ];

    protected function casts(): array
    {
        return [
            'status' => ReservationStatus::class,
            'requested_orders' => 'integer',
            'requested_stops' => 'integer',
            'requested_weight_kg' => 'decimal:2',
            'requested_volume_m3' => 'decimal:3',
            'requested_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $reservation): void {
            if ($reservation->uuid === null) {
                $reservation->uuid = (string) Str::uuid();
            }

            if ($reservation->requested_at === null) {
                $reservation->requested_at = now();
            }
        });
    }

    public function slot(): BelongsTo
    {
        return $this->belongsTo(CapacitySlot::class, 'capacity_slot_id');
    }

    public function commitment(): BelongsTo
    {
        return $this->belongsTo(CapacityCommitment::class, 'capacity_commitment_id');
    }

    public function pool(): BelongsTo
    {
        return $this->belongsTo(ResourcePool::class, 'resource_pool_id');
    }

    public function auditEntries(): HasMany
    {
        return $this->hasMany(ReservationAuditEntry::class, 'capacity_reservation_id');
    }

    /**
     * What was asked for, in the ledger's own vocabulary.
     *
     * @return array<string, float>
     */
    public function requestedQuantities(): array
    {
        return [
            CapacityUnit::Orders->value => (float) $this->requested_orders,
            CapacityUnit::Stops->value => (float) $this->requested_stops,
            CapacityUnit::WeightKg->value => (float) $this->requested_weight_kg,
            CapacityUnit::VolumeM3->value => (float) $this->requested_volume_m3,
        ];
    }

    public function hasAnyQuantity(): bool
    {
        return array_sum($this->requestedQuantities()) > 0.0;
    }

    public function holdsCapacity(): bool
    {
        return $this->status->holdsCapacity();
    }

    /**
     * Network's verdict, read live. Never cached onto this row — a stale copy of
     * the ledger is worse than no copy.
     */
    public function ledgerStatus(): ?string
    {
        return $this->commitment?->status?->value;
    }
}
