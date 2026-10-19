<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Logistics\Delivery\Domain\Enums\CodStatus;

/**
 * COD completion at the door.
 *
 * CTO decision 3 — Distribution is the single cash authority. This model
 * records that money changed hands and drives the CodCollected event.
 * It performs NO settlement arithmetic and writes nothing to any
 * distribution_* table.
 */
class CodRecord extends Model
{
    protected $table = 'delivery_cod_records';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => CodStatus::Due->value,
        'amount_due' => 0,
        'amount_collected' => 0,
        'currency' => 'EGP',
    ];

    protected $fillable = [
        'uuid', 'delivery_id', 'attempt_id', 'status',
        'amount_due', 'amount_collected', 'currency', 'method', 'reference_number',
        'collected_at', 'collected_by', 'verified_at', 'verified_by',
        'dispute_reason', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'status' => CodStatus::class,
            'amount_due' => 'decimal:2',
            'amount_collected' => 'decimal:2',
            'collected_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $record): void {
            if ($record->uuid === null) {
                $record->uuid = (string) Str::uuid();
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

    public function isOutstanding(): bool
    {
        return $this->status->isOutstanding();
    }

    public function blocksClosure(): bool
    {
        return $this->status->blocksClosure();
    }

    /** Positive means the customer paid less than was due. */
    public function shortfall(): float
    {
        return round((float) $this->amount_due - (float) $this->amount_collected, 2);
    }

    public function isFullyCollected(): bool
    {
        return abs($this->shortfall()) < 0.01;
    }
}
