<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Geography\Domain\Models\City;

class BrandCitySetting extends Model
{
    protected $table = 'brand_city_settings';

    protected $fillable = [
        'brand_id',
        'city_id',
        'is_enabled',
        'shipping_price',
        'supports_cod',
        'is_remote_override',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'shipping_price' => 'decimal:2',
            'supports_cod' => 'boolean',
            'is_remote_override' => 'boolean',
            'city_id' => 'integer',
        ];
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /** @return BelongsTo<City, $this> */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class, 'city_id');
    }
}
