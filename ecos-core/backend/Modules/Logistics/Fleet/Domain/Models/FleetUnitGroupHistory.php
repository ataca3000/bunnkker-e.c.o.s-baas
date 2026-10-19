<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Versioned group membership, so a historical cost report attributes to the
 * group that was actually in force at the time rather than today's.
 */
class FleetUnitGroupHistory extends Model
{
    protected $table = 'fleet_unit_group_history';

    protected $fillable = [
        'fleet_unit_id', 'fleet_group_id',
        'effective_from', 'effective_to', 'reason', 'changed_by',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'datetime',
            'effective_to' => 'datetime',
        ];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(FleetUnit::class, 'fleet_unit_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(FleetGroup::class, 'fleet_group_id');
    }

    public function isCurrent(): bool
    {
        return $this->effective_to === null;
    }
}
