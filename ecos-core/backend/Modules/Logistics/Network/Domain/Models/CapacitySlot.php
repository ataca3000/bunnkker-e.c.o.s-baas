<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Network\Domain\Enums\CapacityUnit;

/**
 * Capacity within a window, tracked across every dimension.
 *
 * The BINDING dimension is whichever is tightest — a van full of pillows hits
 * volume long before weight. A single "capacity" number would be wrong for half
 * the catalogue, so each unit carries its own available/committed pair.
 */
class CapacitySlot extends Model
{
    protected $table = 'network_capacity_slots';

    /** @var array<string, mixed> */
    protected $attributes = [
        'available_orders' => 0,
        'committed_orders' => 0,
        'available_stops' => 0,
        'committed_stops' => 0,
        'available_weight_kg' => 0,
        'committed_weight_kg' => 0,
        'available_volume_m3' => 0,
        'committed_volume_m3' => 0,
        'warn_threshold' => 0.850,
    ];

    protected $fillable = [
        'uuid', 'capacity_plan_id', 'service_level_id',
        'window_start', 'window_end',
        'available_orders', 'committed_orders',
        'available_stops', 'committed_stops',
        'available_weight_kg', 'committed_weight_kg',
        'available_volume_m3', 'committed_volume_m3',
        'warn_threshold',
    ];

    protected function casts(): array
    {
        return [
            'available_orders' => 'integer',
            'committed_orders' => 'integer',
            'available_stops' => 'integer',
            'committed_stops' => 'integer',
            'available_weight_kg' => 'decimal:2',
            'committed_weight_kg' => 'decimal:2',
            'available_volume_m3' => 'decimal:3',
            'committed_volume_m3' => 'decimal:3',
            'warn_threshold' => 'decimal:3',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $slot): void {
            if ($slot->uuid === null) {
                $slot->uuid = (string) Str::uuid();
            }
        });
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(CapacityPlan::class, 'capacity_plan_id');
    }

    public function level(): BelongsTo
    {
        return $this->belongsTo(ServiceLevel::class, 'service_level_id');
    }

    public function commitments(): HasMany
    {
        return $this->hasMany(CapacityCommitment::class, 'capacity_slot_id');
    }

    public function availableFor(CapacityUnit $unit): float
    {
        return (float) $this->{'available_'.$unit->column()};
    }

    public function committedFor(CapacityUnit $unit): float
    {
        return (float) $this->{'committed_'.$unit->column()};
    }

    public function remainingFor(CapacityUnit $unit): float
    {
        return round($this->availableFor($unit) - $this->committedFor($unit), $unit->precision());
    }

    /** @return array<string, float> */
    public function remaining(): array
    {
        $out = [];
        foreach (CapacityUnit::cases() as $unit) {
            $out[$unit->value] = $this->remainingFor($unit);
        }

        return $out;
    }

    /** Utilisation on one dimension. Null when nothing is provisioned there. */
    public function utilisationFor(CapacityUnit $unit): ?float
    {
        $available = $this->availableFor($unit);

        if ($available <= 0.0) {
            return null;
        }

        return round($this->committedFor($unit) / $available, 4);
    }

    /**
     * The tightest dimension — the one that will actually stop us taking more.
     * Dimensions with nothing provisioned are ignored rather than treated as
     * full, so an area that only tracks orders is not reported as exhausted.
     */
    public function bindingUnit(): ?CapacityUnit
    {
        $worst = null;
        $worstUtilisation = -1.0;

        foreach (CapacityUnit::cases() as $unit) {
            $utilisation = $this->utilisationFor($unit);

            if ($utilisation !== null && $utilisation > $worstUtilisation) {
                $worstUtilisation = $utilisation;
                $worst = $unit;
            }
        }

        return $worst;
    }

    public function utilisation(): ?float
    {
        $binding = $this->bindingUnit();

        return $binding === null ? null : $this->utilisationFor($binding);
    }

    /** @param array<string, float> $requested */
    public function canAccommodate(array $requested): bool
    {
        return $this->shortfall($requested) === [];
    }

    /**
     * What is missing, per dimension. Empty means it fits.
     *
     * @param  array<string, float>  $requested
     * @return array<string, float>
     */
    public function shortfall(array $requested): array
    {
        $out = [];

        foreach (CapacityUnit::cases() as $unit) {
            $want = (float) ($requested[$unit->value] ?? 0);

            if ($want <= 0.0) {
                continue;
            }

            // Nothing provisioned on this dimension means it is not tracked,
            // not that it is full.
            if ($this->availableFor($unit) <= 0.0) {
                continue;
            }

            $short = round($want - $this->remainingFor($unit), $unit->precision());

            if ($short > 0) {
                $out[$unit->value] = $short;
            }
        }

        return $out;
    }

    public function isAtWarnThreshold(): bool
    {
        $utilisation = $this->utilisation();

        return $utilisation !== null && $utilisation >= (float) $this->warn_threshold;
    }

    public function isExhausted(): bool
    {
        $utilisation = $this->utilisation();

        return $utilisation !== null && $utilisation >= 1.0;
    }
}
