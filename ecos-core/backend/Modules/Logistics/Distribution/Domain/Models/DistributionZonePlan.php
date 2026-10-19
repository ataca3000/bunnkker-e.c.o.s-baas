<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DistributionZonePlan extends Model
{
    protected $table = 'distribution_zone_plans';

    protected $fillable = [
        'planning_date',
        'zone_id',
        'status',
        'notes',
        'planned_by',
        'planned_at',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'planning_date' => 'date',
            'planned_at' => 'datetime',
        ];
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(DistributionZone::class, 'zone_id');
    }
}
