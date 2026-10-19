<?php

declare(strict_types=1);

namespace Modules\Logistics\Geography\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Governorate extends Model
{
    protected $table = 'logistics_governorates';

    protected $fillable = [
        'country_id',
        'name_ar',
        'name_en',
        'default_shipping_price',
        'display_order',
        'is_active',
        'is_system',
    ];

    protected function casts(): array
    {
        return [
            'default_shipping_price' => 'decimal:2',
            'display_order' => 'integer',
            'is_active' => 'boolean',
            'is_system' => 'boolean',
            'country_id' => 'integer',
        ];
    }

    public function cities(): HasMany
    {
        return $this->hasMany(City::class, 'governorate_id')->orderBy('display_order')->orderBy('name_en');
    }

    public function activeCities(): HasMany
    {
        return $this->hasMany(City::class, 'governorate_id')->where('is_active', true);
    }
}
