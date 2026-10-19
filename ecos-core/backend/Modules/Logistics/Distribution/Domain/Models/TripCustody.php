<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Distribution\Domain\Enums\CustodyItemType;

/** Equipment or cash float handed to the driver for the trip. */
class TripCustody extends Model
{
    protected $table = 'distribution_trip_custody';

    /** @var array<string, mixed> */
    protected $attributes = [
        'quantity' => 1,
        'is_driver_confirmed' => false,
    ];

    protected $fillable = [
        'trip_id',
        'item_type',
        'description',
        'quantity',
        'notes',
        'received_quantity',
        'is_driver_confirmed',
        'driver_confirmed_at',
        'driver_confirmed_by',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'item_type' => CustodyItemType::class,
            'quantity' => 'integer',
            'received_quantity' => 'integer',
            'is_driver_confirmed' => 'boolean',
            'driver_confirmed_at' => 'datetime',
        ];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    /** The driver confirmed a different count than was handed out. */
    public function hasShortfall(): bool
    {
        return $this->received_quantity !== null
            && $this->received_quantity < $this->quantity;
    }

    public function shortfallQuantity(): int
    {
        return $this->hasShortfall() ? $this->quantity - (int) $this->received_quantity : 0;
    }
}
