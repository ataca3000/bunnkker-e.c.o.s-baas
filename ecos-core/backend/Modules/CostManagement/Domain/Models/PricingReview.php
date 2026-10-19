<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\CostManagement\Domain\Enums\PricingReviewStatus;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * A pricing decision request created whenever Product Cost changes.
 *
 * Selling Price is NEVER updated automatically.
 * Management resolves each review through the Price Review Center.
 *
 * @property string $id
 * @property string $product_id
 * @property string $company_id
 * @property string|null $channel_id
 * @property float $product_cost
 * @property float|null $previous_product_cost
 * @property float $cost_difference
 * @property float $selling_price
 * @property float $suggested_selling_price
 * @property float|null $suggested_sale_price
 * @property float $target_margin
 * @property float $current_margin
 * @property array<string> $impacts
 * @property PricingReviewStatus $status
 * @property string|null $triggered_by_cost_history_id
 * @property string|null $reviewer_name
 * @property string|null $snooze_until
 * @property string|null $notes
 * @property \Carbon\Carbon|null $resolved_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class PricingReview extends Model
{
    use HasUuids;

    protected $table = 'pricing_reviews';

    protected $fillable = [
        'product_id',
        'company_id',
        'channel_id',
        'product_cost',
        'previous_product_cost',
        'cost_difference',
        'selling_price',
        'suggested_selling_price',
        'suggested_sale_price',
        'target_margin',
        'current_margin',
        'impacts',
        'status',
        'triggered_by_cost_history_id',
        'trigger_reason',
        'trigger_source',
        'cost_snapshot',
        'explanation',
        'reviewer_name',
        'snooze_until',
        'notes',
        'resolved_at',
        'publish_status',
        'approved_price',
        'approved_sale_price',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'product_cost' => 'float',
            'previous_product_cost' => 'float',
            'cost_difference' => 'float',
            'selling_price' => 'float',
            'suggested_selling_price' => 'float',
            'suggested_sale_price' => 'float',
            'target_margin' => 'float',
            'current_margin' => 'float',
            'impacts' => 'array',
            'cost_snapshot' => 'array',
            'status' => PricingReviewStatus::class,
            'snooze_until' => 'date:Y-m-d',
            'resolved_at' => 'datetime',
            'approved_price' => 'float',
            'approved_sale_price' => 'float',
            'published_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** @return HasMany<PriceApproval, $this> */
    public function approvals(): HasMany
    {
        return $this->hasMany(PriceApproval::class);
    }

    public function resolve(PricingReviewStatus $status): void
    {
        $this->status = $status;
        $this->resolved_at = now();
        $this->save();
    }
}
