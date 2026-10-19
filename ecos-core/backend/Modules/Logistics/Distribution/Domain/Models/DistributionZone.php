<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Logistics\Geography\Domain\Models\City;

class DistributionZone extends Model
{
    use SoftDeletes;

    protected $table = 'distribution_zones';

    protected $fillable = [
        'code',
        'name_ar',
        'name_en',
        'description',
        'color',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function areas(): HasMany
    {
        return $this->hasMany(City::class, 'distribution_zone_id');
    }
}
