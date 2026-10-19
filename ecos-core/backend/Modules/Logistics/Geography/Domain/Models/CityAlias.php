<?php

declare(strict_types=1);

namespace Modules\Logistics\Geography\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CityAlias extends Model
{
    protected $table = 'logistics_city_aliases';

    protected $fillable = [
        'city_id',
        'provider',
        'alias',
        'code',
    ];

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class, 'city_id');
    }
}
