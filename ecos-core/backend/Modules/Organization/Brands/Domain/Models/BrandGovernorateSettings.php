<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Geography\Domain\Models\Governorate;

class BrandGovernorateSettings extends Model
{
    protected $table = 'brand_governorate_settings';

    protected $fillable = [
        'brand_id',
        'governorate_id',
        'is_enabled',
        'shipping_price',
        'estimated_delivery_days',
        'same_day_supported',
        'display_order',
        'preferred_provider',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'shipping_price' => 'decimal:2',
            'estimated_delivery_days' => 'integer',
            'same_day_supported' => 'boolean',
            'display_order' => 'integer',
            'governorate_id' => 'integer',
        ];
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /** @return BelongsTo<Governorate, $this> */
    public function governorate(): BelongsTo
    {
        return $this->belongsTo(Governorate::class, 'governorate_id');
    }
}
