<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Organization\Brands\Domain\Models\Brand;

/**
 * @property string $id
 * @property string $brand_id
 * @property string $company_id
 * @property string $name
 * @property string|null $name_ar
 * @property string|null $code
 * @property int $sort_order
 * @property bool $is_active
 * @property float|null $default_shipping_cost Governorate-level default; zones inherit unless overridden
 */
class DeliveryGeography extends Model
{
    use HasUuids;

    protected $table = 'config_delivery_geographies';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'brand_id',
        'company_id',
        'master_governorate_id',
        'name',
        'name_ar',
        'code',
        'sort_order',
        'is_active',
        'default_shipping_cost',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            'default_shipping_cost' => 'float',
        ];
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /** @return HasMany<DeliveryZone, $this> */
    public function zones(): HasMany
    {
        return $this->hasMany(DeliveryZone::class, 'delivery_geography_id')
            ->orderBy('sort_order');
    }
}
