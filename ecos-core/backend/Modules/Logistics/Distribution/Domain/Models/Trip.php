<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;
use Modules\Logistics\Distribution\Domain\Enums\TripStatus;
use Modules\Logistics\Distribution\Domain\Enums\TripType;
use Modules\Logistics\Drivers\Domain\Models\DriverVehicleAssignment;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingCompany;

/**
 * Trip — the Distribution aggregate root.
 *
 * Owns: lifecycle, order assignment, custody, dispatch, timeline.
 * Owns nothing about carriers, drivers or vehicles — those are referenced.
 *
 * The driver and vehicle are reached through ONE reference,
 * `driver_vehicle_assignment_id`, because the Drivers module already
 * guarantees at most one active driver per vehicle and one active vehicle per
 * driver via database-level unique indexes. Storing driver_id and vehicle_id
 * separately would let a trip record a pairing the ledger forbids.
 */
class Trip extends Model
{
    protected $table = 'distribution_trips';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => TripStatus::Planning->value,
        'type' => TripType::CompanyVehicle->value,
    ];

    protected $fillable = [
        'uuid',
        'company_id',
        'preparation_wave_id',
        'distribution_zone_id',
        'trip_number',
        'name',
        'type',
        'capacity',
        'shipping_company_id',
        'driver_vehicle_assignment_id',
        'status',
        'orders_count',
        'collection_amount',
        'notes',
        'finalized_at', 'finalized_by',
        'dispatched_at', 'dispatched_by', 'driver_notified_at',
        'driver_accepted_products', 'driver_accepted_custody', 'driver_accepted_equipment',
        'driver_acceptance_at', 'driver_acceptance_by',
        'has_discrepancy', 'discrepancy_notes',
        'departure_at', 'departure_by', 'odometer_start', 'fuel_level',
        'trip_started_at', 'trip_start_lat', 'trip_start_lng',
        'trip_finished_at', 'trip_finish_lat', 'trip_finish_lng', 'odometer_end',
        'total_cash_collected', 'total_bank_transfers', 'total_already_paid',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => TripStatus::class,
            'type' => TripType::class,
            'capacity' => 'integer',
            'orders_count' => 'integer',
            'collection_amount' => 'decimal:2',
            'driver_accepted_products' => 'boolean',
            'driver_accepted_custody' => 'boolean',
            'driver_accepted_equipment' => 'boolean',
            'has_discrepancy' => 'boolean',
            'finalized_at' => 'datetime',
            'dispatched_at' => 'datetime',
            'driver_notified_at' => 'datetime',
            'driver_acceptance_at' => 'datetime',
            'departure_at' => 'datetime',
            'trip_started_at' => 'datetime',
            'trip_finished_at' => 'datetime',
            'odometer_start' => 'integer',
            'odometer_end' => 'integer',
            'fuel_level' => 'decimal:2',
            'total_cash_collected' => 'decimal:2',
            'total_bank_transfers' => 'decimal:2',
            'total_already_paid' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $trip): void {
            if ($trip->uuid === null) {
                $trip->uuid = (string) Str::uuid();
            }
        });
    }

    // ── Consumed aggregates (references only) ─────────────────────────────────

    public function shippingCompany(): BelongsTo
    {
        return $this->belongsTo(ShippingCompany::class, 'shipping_company_id');
    }

    /** The approved Drivers-module pairing. Driver and vehicle are read through it. */
    public function driverVehicleAssignment(): BelongsTo
    {
        return $this->belongsTo(DriverVehicleAssignment::class, 'driver_vehicle_assignment_id');
    }

    // ── Owned entities ────────────────────────────────────────────────────────

    public function tripOrders(): HasMany
    {
        return $this->hasMany(TripOrder::class, 'trip_id');
    }

    public function custodyItems(): HasMany
    {
        return $this->hasMany(TripCustody::class, 'trip_id');
    }

    public function stops(): HasMany
    {
        return $this->hasMany(DeliveryStop::class, 'trip_id')->orderBy('sequence');
    }

    public function exceptions(): HasMany
    {
        return $this->hasMany(DeliveryException::class, 'trip_id')->latest();
    }

    public function returns(): HasMany
    {
        return $this->hasMany(TripReturn::class, 'trip_id')->latest();
    }

    public function paymentCollections(): HasMany
    {
        return $this->hasMany(PaymentCollection::class, 'trip_id')->latest();
    }

    public function settlement(): HasOne
    {
        return $this->hasOne(TripSettlement::class, 'trip_id');
    }

    // ── Domain logic ──────────────────────────────────────────────────────────

    public function isEditable(): bool
    {
        return $this->status->isEditable();
    }

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }

    /** Free capacity for further order assignment. */
    public function remainingCapacity(): int
    {
        return max(0, $this->capacity - $this->tripOrders()->count());
    }

    public function isAtCapacity(): bool
    {
        return $this->remainingCapacity() === 0;
    }

    /** All three driver confirmations must be present before dispatch. */
    public function hasFullDriverAcceptance(): bool
    {
        return $this->driver_accepted_products
            && $this->driver_accepted_custody
            && $this->driver_accepted_equipment;
    }

    /**
     * Readiness for dispatch, delegating resource checks to the aggregates that
     * own them rather than re-deriving the rules here.
     *
     * @return list<string> blocking reasons; empty means ready
     */
    public function dispatchBlockers(): array
    {
        $blockers = [];

        if ($this->tripOrders()->count() === 0) {
            $blockers[] = 'The trip has no orders assigned.';
        }

        if (! $this->hasFullDriverAcceptance()) {
            $blockers[] = 'The driver has not confirmed products, custody and equipment.';
        }

        if ($this->type->requiresDriverVehicleAssignment()) {
            $assignment = $this->driverVehicleAssignment;

            if ($assignment === null) {
                $blockers[] = 'No driver/vehicle assignment is linked to this trip.';
            } else {
                if (! $assignment->isActive()) {
                    $blockers[] = 'The linked driver/vehicle assignment is no longer active.';
                }
                // BR delegation — Drivers (LOG-002) and Vehicles (LOG-003) own these gates.
                if ($assignment->driver !== null && ! $assignment->driver->canStartDeliveries()) {
                    $blockers[] = 'The assigned driver cannot start deliveries (licence or status).';
                }
                if ($assignment->vehicle !== null && ! $assignment->vehicle->canBeDispatched()) {
                    $blockers[] = 'The assigned vehicle cannot be dispatched (status, licence or insurance).';
                }
            }
        } elseif ($this->shipping_company_id === null) {
            $blockers[] = 'An external-carrier trip must reference a shipping company.';
        }

        return $blockers;
    }

    public function isReadyForDispatch(): bool
    {
        return $this->dispatchBlockers() === [];
    }

    /** Stops still awaiting an outcome. */
    public function outstandingStopsCount(): int
    {
        return $this->stops()
            ->whereIn('status', ['pending', 'in_progress'])
            ->count();
    }

    public function allStopsSettled(): bool
    {
        return $this->stops()->count() > 0 && $this->outstandingStopsCount() === 0;
    }
}
