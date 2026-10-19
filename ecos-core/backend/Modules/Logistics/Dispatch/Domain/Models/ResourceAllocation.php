<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Logistics\Dispatch\Domain\Enums\AllocationStatus;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * A recorded allocation decision.
 *
 * ┌─ DIRECTIVES 4/11/12 — RECORDS, NEVER RE-DERIVES ────────────────────────┐
 * │ fleet_verdict is a SNAPSHOT of Fleet's answer at allocation time, kept   │
 * │ so the decision stays explainable after conditions change. Dispatch      │
 * │ never recomputes fitness.                                               │
 * │                                                                          │
 * │ capacity_commitment_uuid is the RECEIPT from Network's ledger. Dispatch  │
 * │ holds the reference; Network owns the arithmetic.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class ResourceAllocation extends Model
{
    public const MODE_MANUAL = 'manual';

    public const MODE_AUTOMATIC = 'automatic';

    protected $table = 'dispatch_resource_allocations';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => AllocationStatus::Proposed->value,
        'allocation_mode' => self::MODE_MANUAL,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'dispatch_session_id', 'assignment_id',
        'trip_id', 'vehicle_id', 'driver_id',
        'status', 'allocation_mode', 'fleet_verdict', 'driver_ready',
        'capacity_commitment_uuid',
        'allocated_at', 'confirmed_at', 'released_at', 'release_reason', 'allocated_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => AllocationStatus::class,
            'driver_ready' => 'boolean',
            'allocated_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $allocation): void {
            if ($allocation->uuid === null) {
                $allocation->uuid = (string) Str::uuid();
            }

            if ($allocation->allocated_at === null) {
                $allocation->allocated_at = now();
            }
        });
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(DispatchSession::class, 'dispatch_session_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(DispatchProposedAssignment::class, 'assignment_id');
    }

    // ── V1 aggregates, read-only ──────────────────────────────────────────────

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }

    public function holdsResource(): bool
    {
        return $this->status->holdsResource();
    }

    public function isAutomatic(): bool
    {
        return $this->allocation_mode === self::MODE_AUTOMATIC;
    }

    /** True once Network's ledger is holding capacity for this allocation. */
    public function hasCapacityHold(): bool
    {
        return $this->capacity_commitment_uuid !== null;
    }

    /**
     * Whether the snapshotted verdicts were clean when the decision was made.
     * A null fleet verdict means Fleet had no opinion — an unregistered
     * vehicle — which is not the same as unfit.
     */
    public function wasCleanAtAllocation(): bool
    {
        return $this->fleet_verdict !== 'unfit' && $this->driver_ready !== false;
    }
}
