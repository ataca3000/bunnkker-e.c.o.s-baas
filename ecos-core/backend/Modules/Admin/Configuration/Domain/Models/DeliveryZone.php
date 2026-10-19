<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property string $id
 * @property string $delivery_geography_id
 * @property string $brand_id
 * @property string $name
 * @property string|null $name_ar
 * @property int $sort_order
 * @property bool $is_active
 */
class DeliveryZone extends Model
{
    use HasUuids;

    protected $table = 'config_delivery_zones';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'delivery_geography_id',
        'brand_id',
        'master_zone_id',
        'name',
        'name_ar',
        'sort_order',
        'is_active',
        'custom_shipping_cost',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            'custom_shipping_cost' => 'float',
        ];
    }

    /** @return BelongsTo<DeliveryGeography, $this> */
    public function geography(): BelongsTo
    {
        return $this->belongsTo(DeliveryGeography::class, 'delivery_geography_id');
    }

    /** @return HasOne<BrandShippingRule, $this> */
    public function shippingRule(): HasOne
    {
        return $this->hasOne(BrandShippingRule::class, 'delivery_zone_id');
    }
}
