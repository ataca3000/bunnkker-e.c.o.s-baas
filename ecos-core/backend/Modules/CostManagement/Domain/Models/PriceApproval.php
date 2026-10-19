<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Immutable audit record for every pricing decision.
 *
 * @property string $id
 * @property string $pricing_review_id
 * @property string $product_id
 * @property float $old_product_cost
 * @property float $new_product_cost
 * @property float $old_selling_price
 * @property float $new_selling_price
 * @property string $action
 * @property float|null $custom_price
 * @property string|null $reason
 * @property string|null $manager_name
 * @property array<string> $approved_channels
 * @property \Carbon\Carbon $approved_at
 * @property \Carbon\Carbon $created_at
 */
class PriceApproval extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'price_approvals';

    protected $fillable = [
        'pricing_review_id',
        'product_id',
        'old_product_cost',
        'new_product_cost',
        'old_selling_price',
        'new_selling_price',
        'action',
        'custom_price',
        'reason',
        'manager_name',
        'approved_channels',
        'old_sale_price',
        'new_sale_price',
        'margin_pct',
        'discount_pct',
        'approved_by',
        'approved_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'old_product_cost' => 'float',
            'new_product_cost' => 'float',
            'old_selling_price' => 'float',
            'new_selling_price' => 'float',
            'custom_price' => 'float',
            'approved_channels' => 'array',
            'old_sale_price' => 'float',
            'new_sale_price' => 'float',
            'margin_pct' => 'float',
            'discount_pct' => 'float',
            'approved_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<PricingReview, $this> */
    public function review(): BelongsTo
    {
        return $this->belongsTo(PricingReview::class, 'pricing_review_id');
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
