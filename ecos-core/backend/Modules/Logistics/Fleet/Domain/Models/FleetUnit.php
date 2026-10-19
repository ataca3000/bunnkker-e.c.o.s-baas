<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Fleet\Domain\Enums\DefectSeverity;
use Modules\Logistics\Fleet\Domain\Enums\FleetUnitLifecycle;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * FleetUnit — the operational shadow of one V1 vehicle.
 *
 * Holds CONDITION, never IDENTITY (Directive 2). Plate, VIN, capacity, type and
 * operational status live in logistics_vehicles and are reached through
 * $this->vehicle. Nothing here duplicates them.
 *
 * Directive 3: this model imports nothing from Distribution or Delivery, and
 * its fitness is computable with both modules uninstalled.
 */
class FleetUnit extends Model
{
    protected $table = 'fleet_units';

    /** @var array<string, mixed> */
    protected $attributes = [
        'lifecycle_state' => FleetUnitLifecycle::Draft->value,
    ];

    protected $fillable = [
        'uuid', 'vehicle_id', 'fleet_group_id', 'company_id',
        'lifecycle_state', 'lifecycle_reason', 'commissioned_at', 'retired_at',
        'current_odometer_km', 'odometer_updated_at',
        'acquisition_cost', 'currency', 'acquisition_date', 'useful_life_months',
        'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'lifecycle_state' => FleetUnitLifecycle::class,
            'current_odometer_km' => 'decimal:1',
            'acquisition_cost' => 'decimal:2',
            'useful_life_months' => 'integer',
            'commissioned_at' => 'datetime',
            'retired_at' => 'datetime',
            'odometer_updated_at' => 'datetime',
            'acquisition_date' => 'date:Y-m-d',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $unit): void {
            if ($unit->uuid === null) {
                $unit->uuid = (string) Str::uuid();
            }
        });
    }

    // ── Relations ─────────────────────────────────────────────────────────────

    /** The V1 vehicle. Read-only from Fleet's perspective. */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(FleetGroup::class, 'fleet_group_id');
    }

    public function groupHistory(): HasMany
    {
        return $this->hasMany(FleetUnitGroupHistory::class, 'fleet_unit_id')
            ->orderByDesc('effective_from');
    }

    public function maintenancePlans(): HasMany
    {
        return $this->hasMany(MaintenancePlan::class, 'fleet_unit_id');
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class, 'fleet_unit_id')->latest('id');
    }

    public function inspections(): HasMany
    {
        return $this->hasMany(Inspection::class, 'fleet_unit_id')->latest('id');
    }

    public function defects(): HasMany
    {
        return $this->hasMany(Defect::class, 'fleet_unit_id')->latest('id');
    }

    public function odometerReadings(): HasMany
    {
        return $this->hasMany(OdometerReading::class, 'fleet_unit_id')
            ->orderByDesc('recorded_at');
    }

    public function fuelTransactions(): HasMany
    {
        return $this->hasMany(FuelTransaction::class, 'fleet_unit_id')
            ->orderByDesc('transacted_at');
    }

    public function costEntries(): HasMany
    {
        return $this->hasMany(CostEntry::class, 'fleet_unit_id');
    }

    // ── Domain logic ──────────────────────────────────────────────────────────

    public function isRetired(): bool
    {
        return $this->lifecycle_state->isTerminal();
    }

    /**
     * Lifecycle permits dispatch. This is NOT the full fitness verdict — see
     * FleetReadinessService, which also weighs defects, maintenance,
     * inspections and documents.
     */
    public function isLifecycleDispatchable(): bool
    {
        return $this->lifecycle_state->isDispatchable();
    }

    public function hasOpenCriticalDefect(): bool
    {
        return $this->defects()
            ->where('severity', DefectSeverity::Critical->value)
            ->whereNull('resolved_at')
            ->whereNull('dismissed_by')
            ->exists();
    }

    public function openDefectCount(?DefectSeverity $severity = null): int
    {
        return $this->defects()
            ->when($severity !== null, fn ($q) => $q->where('severity', $severity->value))
            ->whereNull('resolved_at')
            ->whereNull('dismissed_by')
            ->count();
    }

    public function hasOpenWorkOrder(): bool
    {
        return $this->workOrders()
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->exists();
    }

    /**
     * Distance travelled in a window, from the governed odometer series.
     * Returns null when there are too few accepted readings to be meaningful —
     * a silent zero would corrupt every cost-per-km metric downstream.
     */
    public function distanceKmSince(\DateTimeInterface $since): ?float
    {
        $readings = $this->odometerReadings()
            ->where('is_accepted', true)
            ->where('recorded_at', '>=', $since)
            ->reorder('recorded_at')
            ->pluck('reading_km');

        if ($readings->count() < 2) {
            return null;
        }

        return round((float) $readings->last() - (float) $readings->first(), 1);
    }

    /** Straight-line monthly depreciation. Operational only — see D8. */
    public function monthlyDepreciation(): ?float
    {
        if ($this->acquisition_cost === null || ! $this->useful_life_months) {
            return null;
        }

        return round((float) $this->acquisition_cost / $this->useful_life_months, 2);
    }
}
