<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BrandShippingSettings extends Model
{
    protected $table = 'brand_shipping_settings';

    protected $fillable = [
        'brand_id',
        'unsupported_governorate_action',
        'unsupported_city_action',
        'default_cod_enabled',
        'default_free_shipping_threshold',
        'default_shipping_provider',
    ];

    protected function casts(): array
    {
        return [
            'default_cod_enabled' => 'boolean',
            'default_free_shipping_threshold' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
