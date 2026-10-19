<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Organization\Brands\Domain\Models\Brand;

/**
 * Customer-Brand relationship — a first-class domain entity.
 *
 * Tracks a customer's commercial association with a specific brand.
 * One customer may hold many CustomerBrand records (one per brand).
 * The UNIQUE(customer_id, brand_id) constraint prevents duplicates.
 *
 * Statistics (orders_count, lifetime_value, first/last order dates)
 * are read-only here. They are updated exclusively by dedicated domain
 * services after order lifecycle events — never by CRUD operations.
 *
 * The is_primary flag is prepared for policy-driven assignment.
 * No promotion/demotion logic lives in this model.
 *
 * @property string                  $id
 * @property string                  $customer_id
 * @property string                  $brand_id
 * @property \Carbon\Carbon|null     $first_order_at
 * @property \Carbon\Carbon|null     $last_order_at
 * @property int                     $orders_count
 * @property float                   $lifetime_value
 * @property bool                    $is_primary
 * @property string                  $status
 * @property \Carbon\Carbon|null     $created_at
 * @property \Carbon\Carbon|null     $updated_at
 */
final class CustomerBrand extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'customer_id',
        'brand_id',
        'first_order_at',
        'last_order_at',
        'orders_count',
        'lifetime_value',
        'is_primary',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'first_order_at' => 'datetime',
            'last_order_at'  => 'datetime',
            'orders_count'   => 'integer',
            'lifetime_value' => 'decimal:2',
            'is_primary'     => 'boolean',
        ];
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
