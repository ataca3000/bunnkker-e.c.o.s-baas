<?php

declare(strict_types=1);

namespace Modules\Logistics\Geography\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class City extends Model
{
    protected $table = 'logistics_cities';

    protected $fillable = [
        'governorate_id',
        'name_ar',
        'name_en',
        'shipping_price',
        'display_order',
        'is_active',
        'is_system',
    ];

    protected function casts(): array
    {
        return [
            'shipping_price' => 'decimal:2',
            'display_order' => 'integer',
            'is_active' => 'boolean',
            'is_system' => 'boolean',
        ];
    }

    public function governorate(): BelongsTo
    {
        return $this->belongsTo(Governorate::class, 'governorate_id');
    }

    public function aliases(): HasMany
    {
        return $this->hasMany(CityAlias::class, 'city_id')->orderBy('provider')->orderBy('alias');
    }

    /** Effective shipping price: custom city price or governorate default. */
    public function effectiveShippingPrice(): string
    {
        return $this->shipping_price ?? $this->governorate?->default_shipping_price ?? '0.00';
    }
}
