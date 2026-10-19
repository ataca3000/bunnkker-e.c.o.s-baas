<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An order assigned to a trip. The unique index on order_id enforces the
 * invariant that an order belongs to at most one trip at a time.
 */
class TripOrder extends Model
{
    protected $table = 'distribution_trip_orders';

    /** @var array<string, mixed> */
    protected $attributes = [
        'assignment_type' => 'auto',
    ];

    protected $fillable = [
        'trip_id',
        'order_id',
        'zone_code_snapshot',
        'governorate_snapshot',
        'assignment_type',
        'assigned_by',
        'assigned_at',
    ];

    protected function casts(): array
    {
        return ['assigned_at' => 'datetime'];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    public function isManual(): bool
    {
        return $this->assignment_type === 'manual';
    }
}
