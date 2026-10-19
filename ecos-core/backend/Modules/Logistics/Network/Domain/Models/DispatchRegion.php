<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A planning grouping of service areas, anchored to a dispatch origin.
 *
 * This is the level Dispatch opens boards against. It holds no geography — the
 * places live under its service areas, which in turn only reference V1 rows.
 */
class DispatchRegion extends Model
{
    protected $table = 'network_dispatch_regions';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_active' => true,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'warehouse_id', 'branch_id',
        'code', 'name', 'description', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $region): void {
            if ($region->uuid === null) {
                $region->uuid = (string) Str::uuid();
            }
        });
    }

    public function serviceAreas(): HasMany
    {
        return $this->hasMany(ServiceArea::class, 'dispatch_region_id');
    }

    /** Origins Routing plans from and Dispatch releases against. */
    public function hasOrigin(): bool
    {
        return $this->warehouse_id !== null || $this->branch_id !== null;
    }
}
