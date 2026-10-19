<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;
use Modules\Logistics\Delivery\Domain\Enums\AttemptStatus;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;
use Modules\Logistics\Distribution\Domain\Models\Trip;

/** One physical attempt, executed from a Distribution stop. */
class DeliveryAttempt extends Model
{
    protected $table = 'delivery_attempts';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => AttemptStatus::Created->value,
    ];

    protected $fillable = [
        'uuid', 'delivery_id', 'stop_id', 'trip_id', 'attempt_no', 'status',
        'en_route_at', 'arrived_at', 'started_at', 'closed_at',
        'gps_lat', 'gps_lng', 'gps_accuracy_m',
        'recipient_name', 'recipient_relationship', 'notes', 'performed_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => AttemptStatus::class,
            'attempt_no' => 'integer',
            'gps_accuracy_m' => 'integer',
            'gps_lat' => 'decimal:7',
            'gps_lng' => 'decimal:7',
            'en_route_at' => 'datetime',
            'arrived_at' => 'datetime',
            'started_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $attempt): void {
            if ($attempt->uuid === null) {
                $attempt->uuid = (string) Str::uuid();
            }
        });
    }

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class, 'delivery_id');
    }

    /** Read-only references into Distribution. */
    public function stop(): BelongsTo
    {
        return $this->belongsTo(DeliveryStop::class, 'stop_id');
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    public function failure(): HasOne
    {
        return $this->hasOne(DeliveryFailure::class, 'attempt_id');
    }

    public function pod(): HasOne
    {
        return $this->hasOne(ProofOfDelivery::class, 'attempt_id');
    }

    public function codRecord(): HasOne
    {
        return $this->hasOne(CodRecord::class, 'attempt_id');
    }

    public function isClosed(): bool
    {
        return $this->status->isClosed();
    }

    public function isOpen(): bool
    {
        return $this->status->isOpen();
    }

    /** Minutes spent at the customer's door, once the attempt has closed. */
    public function dwellMinutes(): ?int
    {
        if ($this->arrived_at === null || $this->closed_at === null) {
            return null;
        }

        return (int) $this->arrived_at->diffInMinutes($this->closed_at);
    }
}
