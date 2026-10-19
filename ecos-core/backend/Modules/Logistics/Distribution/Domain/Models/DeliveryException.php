<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Something went wrong on the road — raised against a trip, optionally a stop. */
class DeliveryException extends Model
{
    protected $table = 'distribution_delivery_exceptions';

    /** @var array<string, mixed> */
    protected $attributes = [
        'synced_to_cs' => false,
    ];

    protected $fillable = [
        'trip_id',
        'stop_id',
        'order_id',
        'exception_type',
        'description',
        'photos',
        'synced_to_cs',
        'resolved_at',
        'resolved_by',
        'resolution_notes',
        'reported_by',
    ];

    protected function casts(): array
    {
        return [
            'photos' => 'array',
            'synced_to_cs' => 'boolean',
            'resolved_at' => 'datetime',
        ];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    public function stop(): BelongsTo
    {
        return $this->belongsTo(DeliveryStop::class, 'stop_id');
    }

    public function isResolved(): bool
    {
        return $this->resolved_at !== null;
    }
}
