<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Logistics\Fleet\Domain\Enums\WorkOrderStatus;

/**
 * An instance of due maintenance being executed.
 *
 * Completion writes the V1 record through LOG-003's VehicleMaintenanceService;
 * v1_maintenance_record_id is that call's receipt, which makes the boundary
 * auditable in the data rather than only in the code.
 */
class WorkOrder extends Model
{
    public const KIND_PREVENTIVE = 'preventive';

    public const KIND_CORRECTIVE = 'corrective';

    public const KIND_STATUTORY = 'statutory';

    protected $table = 'fleet_work_orders';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => WorkOrderStatus::Planned->value,
        'kind' => self::KIND_PREVENTIVE,
        'is_immobilising' => false,
    ];

    protected $fillable = [
        'uuid', 'fleet_unit_id', 'maintenance_plan_id', 'company_id',
        'status', 'maintenance_type', 'kind', 'description',
        'scheduled_for', 'vendor', 'started_at', 'completed_at',
        'odometer_at_start_km', 'odometer_at_completion_km',
        'cost', 'currency', 'v1_maintenance_record_id', 'is_immobilising',
        'cancellation_reason', 'created_by', 'completed_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => WorkOrderStatus::class,
            'scheduled_for' => 'date:Y-m-d',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'odometer_at_start_km' => 'decimal:1',
            'odometer_at_completion_km' => 'decimal:1',
            'cost' => 'decimal:2',
            'is_immobilising' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $order): void {
            if ($order->uuid === null) {
                $order->uuid = (string) Str::uuid();
            }
        });
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(FleetUnit::class, 'fleet_unit_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(MaintenancePlan::class, 'maintenance_plan_id');
    }

    public function isOpen(): bool
    {
        return $this->status->isOpen();
    }

    public function isCorrective(): bool
    {
        return $this->kind === self::KIND_CORRECTIVE;
    }

    /** Distance covered by the job — useful for repeat-repair analysis. */
    public function distanceKm(): ?float
    {
        if ($this->odometer_at_start_km === null || $this->odometer_at_completion_km === null) {
            return null;
        }

        return round((float) $this->odometer_at_completion_km - (float) $this->odometer_at_start_km, 1);
    }

    public function durationHours(): ?float
    {
        if ($this->started_at === null || $this->completed_at === null) {
            return null;
        }

        return round((float) $this->started_at->diffInMinutes($this->completed_at) / 60, 2);
    }

    /** True once the V1 maintenance record has been written. */
    public function isMirroredToV1(): bool
    {
        return $this->v1_maintenance_record_id !== null;
    }
}
