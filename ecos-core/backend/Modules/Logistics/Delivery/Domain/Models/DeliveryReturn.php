<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryReturnStatus;

/**
 * Customer-facing return, owned by Delivery OS (CTO decision 2).
 *
 * Distribution's TripReturn records what physically came back on the vehicle.
 * This records what the CUSTOMER did not accept, and reconciles it line by
 * line against what the warehouse actually counted.
 */
class DeliveryReturn extends Model
{
    protected $table = 'delivery_returns';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => DeliveryReturnStatus::Initiated->value,
        'has_discrepancy' => false,
    ];

    protected $fillable = [
        'uuid', 'delivery_id', 'attempt_id', 'status', 'reason_code', 'reason',
        'initiated_at', 'initiated_by', 'received_at', 'received_by',
        'verified_at', 'verified_by', 'has_discrepancy', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'status' => DeliveryReturnStatus::class,
            'has_discrepancy' => 'boolean',
            'initiated_at' => 'datetime',
            'received_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $return): void {
            if ($return->uuid === null) {
                $return->uuid = (string) Str::uuid();
            }
        });
    }

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class, 'delivery_id');
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(DeliveryAttempt::class, 'attempt_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(DeliveryReturnLine::class, 'return_id');
    }

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }

    /** True when any line's warehouse count differs from what was declared. */
    public function detectDiscrepancy(): bool
    {
        if (! $this->relationLoaded('lines')) {
            $this->load('lines');
        }

        return $this->lines->contains(fn (DeliveryReturnLine $line) => $line->hasDiscrepancy());
    }

    public function totalReturnedQty(): float
    {
        if (! $this->relationLoaded('lines')) {
            $this->load('lines');
        }

        return round((float) $this->lines->sum('returned_qty'), 3);
    }
}
