<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $brand_id
 * @property string $company_id
 * @property string|null $delivery_zone_id
 * @property string|null $delivery_geography_id
 * @property float $shipping_cost
 * @property bool $is_enabled
 * @property string|null $effective_date
 * @property string|null $notes
 */
class BrandShippingRule extends Model
{
    use HasUuids;

    protected $table = 'config_brand_shipping_rules';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'brand_id',
        'company_id',
        'delivery_zone_id',
        'delivery_geography_id',
        'shipping_cost',
        'is_enabled',
        'effective_date',
        'notes',
        'delivery_window_id',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'shipping_cost' => 'float',
            'is_enabled' => 'boolean',
        ];
    }

    /** @return BelongsTo<DeliveryWindow, $this> */
    public function deliveryWindow(): BelongsTo
    {
        return $this->belongsTo(DeliveryWindow::class, 'delivery_window_id');
    }

    /** @return BelongsTo<DeliveryZone, $this> */
    public function zone(): BelongsTo
    {
        return $this->belongsTo(DeliveryZone::class, 'delivery_zone_id');
    }

    /** @return BelongsTo<DeliveryGeography, $this> */
    public function geography(): BelongsTo
    {
        return $this->belongsTo(DeliveryGeography::class, 'delivery_geography_id');
    }
}
