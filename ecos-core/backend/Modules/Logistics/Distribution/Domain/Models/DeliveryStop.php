<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;
use Modules\Logistics\Distribution\Domain\Enums\DeliveryStopStatus;

/** One customer visit on a trip. */
class DeliveryStop extends Model
{
    protected $table = 'distribution_delivery_stops';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => DeliveryStopStatus::Pending->value,
        'sequence' => 0,
        'collected_amount' => 0,
    ];

    protected $fillable = [
        'uuid',
        'trip_id',
        'order_id',
        'sequence',
        'status',
        'delivery_type',
        'collected_amount',
        'payment_method',
        'attempted_at',
        'completed_at',
        'gps_lat',
        'gps_lng',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'status' => DeliveryStopStatus::class,
            'sequence' => 'integer',
            'collected_amount' => 'decimal:2',
            'attempted_at' => 'datetime',
            'completed_at' => 'datetime',
            'gps_lat' => 'decimal:7',
            'gps_lng' => 'decimal:7',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $stop): void {
            if ($stop->uuid === null) {
                $stop->uuid = (string) Str::uuid();
            }
        });
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(DeliveryAction::class, 'stop_id')->latest();
    }

    public function proof(): HasOne
    {
        return $this->hasOne(DeliveryProof::class, 'stop_id')->latestOfMany();
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PaymentCollection::class, 'stop_id');
    }

    public function isSettled(): bool
    {
        return $this->status->isSettled();
    }

    public function acceptsPayment(): bool
    {
        return $this->status->acceptsPayment();
    }
}
