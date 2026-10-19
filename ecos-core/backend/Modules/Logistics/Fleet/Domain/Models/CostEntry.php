<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Fleet\Domain\Enums\CostType;

/**
 * An append-only operational cost fact.
 *
 * D8: Accounting remains the financial authority. These rows exist to compute
 * cost per km / per order / per zone and are posted onward — they are not a
 * ledger of record, and never trip cash.
 *
 * There is no update path. A correction is a REVERSING entry pointing at the
 * original, which is what makes month-end cost reproducible.
 */
class CostEntry extends Model
{
    protected $table = 'fleet_cost_entries';

    /** @var array<string, mixed> */
    protected $attributes = [
        'currency' => 'EGP',
    ];

    protected $fillable = [
        'fleet_unit_id', 'company_id', 'cost_type', 'amount', 'currency',
        'incurred_on', 'odometer_km', 'source_type', 'source_reference',
        'reverses_entry_id', 'reversal_reason', 'description', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'cost_type' => CostType::class,
            'amount' => 'decimal:2',
            'odometer_km' => 'decimal:1',
            'incurred_on' => 'date:Y-m-d',
        ];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(FleetUnit::class, 'fleet_unit_id');
    }

    public function reverses(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reverses_entry_id');
    }

    public function isReversal(): bool
    {
        return $this->reverses_entry_id !== null;
    }

    /** A reversal carries the negated amount, so sums stay honest. */
    public function signedAmount(): float
    {
        return (float) $this->amount;
    }
}
