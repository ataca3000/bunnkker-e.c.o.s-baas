<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Logistics\Fleet\Domain\Enums\FuelTransactionStatus;

/**
 * A fuel purchase.
 *
 * Cash boundary (D8): this is an EXPENSE fact posted onward to Accounting. It
 * never touches trip cash — Distribution remains the Single Cash Authority.
 */
class FuelTransaction extends Model
{
    public const ANOMALY_ODOMETER_ROLLBACK = 'odometer_rollback';

    public const ANOMALY_TANK_IMPLAUSIBLE = 'tank_implausible';

    public const ANOMALY_EFFICIENCY_OUTLIER = 'efficiency_outlier';

    public const ANOMALY_TEMPORAL_OVERLAP = 'temporal_overlap';

    protected $table = 'fleet_fuel_transactions';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => FuelTransactionStatus::Captured->value,
        'source' => 'manual',
        'currency' => 'EGP',
        'has_anomaly' => false,
    ];

    protected $fillable = [
        'uuid', 'fleet_unit_id', 'fuel_card_id', 'company_id',
        'status', 'source', 'litres', 'cost', 'currency', 'price_per_litre',
        'odometer_km', 'station', 'reference_number', 'transacted_at',
        'has_anomaly', 'anomaly_flags', 'efficiency_l_per_100km',
        'photos', 'notes', 'resolution_reason',
        'recorded_by', 'reconciled_by', 'reconciled_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => FuelTransactionStatus::class,
            'litres' => 'decimal:3',
            'cost' => 'decimal:2',
            'price_per_litre' => 'decimal:3',
            'odometer_km' => 'decimal:1',
            'efficiency_l_per_100km' => 'decimal:3',
            'has_anomaly' => 'boolean',
            'anomaly_flags' => 'array',
            'photos' => 'array',
            'transacted_at' => 'datetime',
            'reconciled_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $transaction): void {
            if ($transaction->uuid === null) {
                $transaction->uuid = (string) Str::uuid();
            }

            if ($transaction->price_per_litre === null
                && $transaction->litres !== null
                && (float) $transaction->litres > 0) {
                $transaction->price_per_litre = round(
                    (float) $transaction->cost / (float) $transaction->litres,
                    3,
                );
            }
        });
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(FleetUnit::class, 'fleet_unit_id');
    }

    public function card(): BelongsTo
    {
        return $this->belongsTo(FuelCard::class, 'fuel_card_id');
    }

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }

    public function postsCost(): bool
    {
        return $this->status->postsCost();
    }

    /** @return list<string> */
    public function anomalies(): array
    {
        return $this->anomaly_flags ?? [];
    }

    public function hasAnomaly(string $flag): bool
    {
        return in_array($flag, $this->anomalies(), true);
    }

    /**
     * Litres per 100 km against the previous accepted fill-up. Null when there
     * is no prior reading — the first fill-up on a vehicle has no baseline, and
     * inventing one would produce a meaningless outlier.
     */
    public function computeEfficiency(?float $previousOdometerKm): ?float
    {
        if ($previousOdometerKm === null) {
            return null;
        }

        $distance = (float) $this->odometer_km - $previousOdometerKm;

        if ($distance <= 0) {
            return null;
        }

        return round(((float) $this->litres / $distance) * 100, 3);
    }
}
