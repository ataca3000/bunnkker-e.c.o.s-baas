<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Logistics\Distribution\Domain\Enums\SettlementStatus;

/** End-of-trip cash reconciliation. Exactly one per trip. */
class TripSettlement extends Model
{
    protected $table = 'distribution_trip_settlements';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => SettlementStatus::Draft->value,
        'cash_collected' => 0,
        'bank_transfers_pending' => 0,
        'already_paid' => 0,
        'total_collected' => 0,
        'cash_expected' => 0,
    ];

    protected $fillable = [
        'uuid',
        'trip_id',
        'cash_collected',
        'bank_transfers_pending',
        'already_paid',
        'total_collected',
        'cash_expected',
        'driver_cash_submitted',
        'discrepancy',
        'status',
        'submitted_at',
        'reconciled_at',
        'finalized_at',
        'finalized_by',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'status' => SettlementStatus::class,
            'cash_collected' => 'decimal:2',
            'bank_transfers_pending' => 'decimal:2',
            'already_paid' => 'decimal:2',
            'total_collected' => 'decimal:2',
            'cash_expected' => 'decimal:2',
            'driver_cash_submitted' => 'decimal:2',
            'discrepancy' => 'decimal:2',
            'submitted_at' => 'datetime',
            'reconciled_at' => 'datetime',
            'finalized_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $settlement): void {
            if ($settlement->uuid === null) {
                $settlement->uuid = (string) Str::uuid();
            }
        });
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    /** Positive = driver handed back more than expected; negative = short. */
    public function calculateDiscrepancy(): ?float
    {
        if ($this->driver_cash_submitted === null) {
            return null;
        }

        return round((float) $this->driver_cash_submitted - (float) $this->cash_expected, 2);
    }

    public function isBalanced(): bool
    {
        $discrepancy = $this->calculateDiscrepancy();

        return $discrepancy !== null && abs($discrepancy) < 0.01;
    }

    public function isShort(): bool
    {
        $discrepancy = $this->calculateDiscrepancy();

        return $discrepancy !== null && $discrepancy <= -0.01;
    }

    public function isFinal(): bool
    {
        return $this->status->isFinal();
    }
}
