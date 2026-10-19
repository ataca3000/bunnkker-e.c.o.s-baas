<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Logistics\Drivers\Domain\Models\DriverVehicleAssignment;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingCompany;
use Modules\Logistics\Vehicles\Domain\Enums\FuelType;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleStatus;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleType;

/**
 * Fleet vehicle — master data owned by Logistics OS.
 *
 * This aggregate was seeded as a minimal registry by TASK-LOG-002 and promoted
 * here by TASK-LOG-003. The table was extended in place, so the driver↔vehicle
 * assignment ledger keeps pointing at the same rows.
 *
 * Business rules:
 *  - vehicle_code and plate_number are unique              (BR-1, BR-2)
 *  - archived vehicles accept no assignments               (BR-3)
 *  - status changes follow VehicleStatus's transition map  (BR-4)
 *  - at most one active driver assignment                  (BR-5)
 *  - capacities must be greater than zero                  (BR-6)
 *  - expired licence or insurance blocks dispatch          (BR-7)
 */
class Vehicle extends Model
{
    /** A document expiring within this many days is flagged as expiring soon. */
    public const EXPIRY_WARNING_DAYS = 30;

    protected $table = 'logistics_vehicles';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => VehicleStatus::Available->value,
    ];

    protected $fillable = [
        'uuid',
        'vehicle_code',
        'plate_number',
        'name',
        'type',
        'shipping_company_id',
        'company_id',
        'branch_id',
        'capacity_orders',
        'capacity_weight_kg',
        'capacity_volume_m3',
        'fuel_type',
        'manufacturer',
        'model',
        'year',
        'color',
        'vin',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'type' => VehicleType::class,
            'status' => VehicleStatus::class,
            'fuel_type' => FuelType::class,
            'year' => 'integer',
            'capacity_orders' => 'integer',
            'capacity_weight_kg' => 'decimal:2',
            'capacity_volume_m3' => 'decimal:3',
        ];
    }

    protected static function booted(): void
    {
        // UUID-ready: every row carries a stable external identifier from birth.
        static::creating(function (self $vehicle): void {
            if ($vehicle->uuid === null) {
                $vehicle->uuid = (string) Str::uuid();
            }
        });
    }

    // ── Relations ─────────────────────────────────────────────────────────────

    public function shippingCompany(): BelongsTo
    {
        return $this->belongsTo(ShippingCompany::class, 'shipping_company_id');
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(VehicleMaintenanceRecord::class, 'vehicle_id')
            ->orderByDesc('performed_on');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(VehicleDocument::class, 'vehicle_id')->latest('created_at');
    }

    /**
     * The assignment ledger stays owned by the Drivers module — this context
     * reads it rather than defining a competing pairing table.
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(DriverVehicleAssignment::class, 'vehicle_id')
            ->orderByDesc('assigned_at');
    }

    /** The single live driver assignment, if any (BR-5). */
    public function activeAssignment(): HasOne
    {
        return $this->hasOne(DriverVehicleAssignment::class, 'vehicle_id')
            ->whereNotNull('active_flag');
    }

    // ── Domain logic ──────────────────────────────────────────────────────────

    public function isArchived(): bool
    {
        return $this->status->isArchived();
    }

    public function hasActiveDriver(): bool
    {
        return $this->activeAssignment()->exists();
    }

    public function label(): string
    {
        $descriptor = trim(implode(' ', array_filter([$this->manufacturer, $this->model])));

        if ($this->name !== null && $this->name !== '' && $this->name !== $this->plate_number) {
            return "{$this->plate_number} — {$this->name}";
        }

        return $descriptor === '' ? $this->plate_number : "{$this->plate_number} — {$descriptor}";
    }

    /**
     * Documents of a dispatch-blocking type that have already lapsed (BR-7).
     *
     * @return \Illuminate\Support\Collection<int, VehicleDocument>
     */
    public function blockingExpiredDocuments()
    {
        return $this->documents
            ->filter(fn (VehicleDocument $d) => $d->blocksDispatchWhenExpired() && $d->isExpired())
            ->values();
    }

    /**
     * BR-7 — gate for the future Distribution engine.
     *
     * A vehicle may only be dispatched when it is engaged with a driver (or
     * free to be), is not off the road, and holds a current licence and
     * insurance. Trips are out of scope, so this predicate is the integration
     * point Distribution will call rather than re-deriving the rule.
     */
    public function canBeDispatched(): bool
    {
        if (! $this->relationLoaded('documents')) {
            $this->load('documents');
        }

        return in_array($this->status, [VehicleStatus::Available, VehicleStatus::Assigned], true)
            && $this->blockingExpiredDocuments()->isEmpty();
    }

    /** Earliest upcoming expiry across licence and insurance, for the UI warning. */
    public function nextDocumentExpiry(): ?Carbon
    {
        if (! $this->relationLoaded('documents')) {
            $this->load('documents');
        }

        return $this->documents
            ->filter(fn (VehicleDocument $d) => $d->blocksDispatchWhenExpired() && $d->expires_at !== null)
            ->pluck('expires_at')
            ->sort()
            ->first();
    }
}
