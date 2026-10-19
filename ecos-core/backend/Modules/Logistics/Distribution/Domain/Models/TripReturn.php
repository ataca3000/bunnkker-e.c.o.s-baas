<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Distribution\Domain\Enums\TripReturnKind;

/**
 * Unified return — replaces DriverDeliveryReturn and DriverCustodyReturn.
 *
 * `kind` discriminates product returns (order + product) from custody returns
 * (equipment and float). Both reconcile the same way, which is why they now
 * share one table and one set of discrepancy rules.
 */
class TripReturn extends Model
{
    protected $table = 'distribution_trip_returns';

    /** @var array<string, mixed> */
    protected $attributes = [
        'dispatched_qty' => 0,
        'returned_qty' => 0,
        'driver_liable' => false,
    ];

    protected $fillable = [
        'trip_id',
        'kind',
        'order_id',
        'product_id',
        'product_name',
        'disposition',
        'custody_type',
        'dispatched_qty',
        'returned_qty',
        'warehouse_confirmed_qty',
        'warehouse_confirmed_at',
        'warehouse_confirmed_by',
        'discrepancy_qty',
        'driver_liable',
        'reason',
        'photos',
        'notes',
        'reported_by',
    ];

    protected function casts(): array
    {
        return [
            'kind' => TripReturnKind::class,
            'dispatched_qty' => 'decimal:3',
            'returned_qty' => 'decimal:3',
            'warehouse_confirmed_qty' => 'decimal:3',
            'discrepancy_qty' => 'decimal:3',
            'warehouse_confirmed_at' => 'datetime',
            'driver_liable' => 'boolean',
            'photos' => 'array',
        ];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    public function isConfirmed(): bool
    {
        return $this->warehouse_confirmed_at !== null;
    }

    /**
     * Shortfall between what the driver declared and what the warehouse counted.
     * Positive means goods are missing.
     */
    public function calculateDiscrepancy(): ?float
    {
        if ($this->warehouse_confirmed_qty === null) {
            return null;
        }

        return round((float) $this->returned_qty - (float) $this->warehouse_confirmed_qty, 3);
    }

    public function hasDiscrepancy(): bool
    {
        $discrepancy = $this->calculateDiscrepancy();

        return $discrepancy !== null && abs($discrepancy) > 0.0001;
    }
}
