<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Distribution\Domain\Enums\PaymentType;

/** Money taken at a stop. Feeds the trip settlement. */
class PaymentCollection extends Model
{
    public const STATUS_RECORDED = 'recorded';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_REJECTED = 'rejected';

    protected $table = 'distribution_payment_collections';

    /** @var array<string, mixed> */
    protected $attributes = [
        'amount' => 0,
        'status' => self::STATUS_RECORDED,
    ];

    protected $fillable = [
        'trip_id',
        'stop_id',
        'payment_type',
        'amount',
        'reference_number',
        'image_path',
        'notes',
        'status',
        'verified_at',
        'verified_by',
        'collected_by',
    ];

    protected function casts(): array
    {
        return [
            'payment_type' => PaymentType::class,
            'amount' => 'decimal:2',
            'verified_at' => 'datetime',
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

    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED;
    }

    /** Only non-rejected physical cash is reconciled against the driver's hand-back. */
    public function countsTowardCashExpected(): bool
    {
        return ! $this->isRejected() && $this->payment_type->isPhysicalCash();
    }
}
