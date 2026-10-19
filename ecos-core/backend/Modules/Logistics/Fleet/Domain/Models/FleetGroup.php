<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A capability cohort — "Refrigerated", "Light Vans".
 *
 * Decides which inspection template applies, which is why membership changes
 * are versioned in FleetUnitGroupHistory.
 */
class FleetGroup extends Model
{
    protected $table = 'fleet_groups';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_active' => true,
    ];

    protected $fillable = [
        'uuid', 'fleet_id', 'company_id',
        'code', 'name', 'description', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $group): void {
            if ($group->uuid === null) {
                $group->uuid = (string) Str::uuid();
            }
        });
    }

    public function fleet(): BelongsTo
    {
        return $this->belongsTo(Fleet::class, 'fleet_id');
    }

    public function units(): HasMany
    {
        return $this->hasMany(FleetUnit::class, 'fleet_group_id');
    }

    public function inspectionTemplates(): HasMany
    {
        return $this->hasMany(InspectionTemplate::class, 'fleet_group_id');
    }
}
