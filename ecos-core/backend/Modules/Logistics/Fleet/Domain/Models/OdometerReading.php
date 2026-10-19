<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Fleet\Domain\Enums\OdometerSource;

/**
 * One reading in the governed series.
 *
 * Written only by OdometerService. A rejected reading is retained — a
 * rolled-back odometer is evidence of a data or hardware problem, and every
 * distance-based cost metric must be auditable back to its inputs.
 */
class OdometerReading extends Model
{
    protected $table = 'fleet_odometer_readings';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_accepted' => true,
    ];

    protected $fillable = [
        'fleet_unit_id', 'company_id', 'reading_km', 'source', 'recorded_at',
        'is_accepted', 'rejection_reason', 'source_reference', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'source' => OdometerSource::class,
            'reading_km' => 'decimal:1',
            'recorded_at' => 'datetime',
            'is_accepted' => 'boolean',
        ];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(FleetUnit::class, 'fleet_unit_id');
    }

    public function trust(): int
    {
        return $this->source->trust();
    }

    public function wasRejected(): bool
    {
        return ! $this->is_accepted;
    }
}
