<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\CostManagement\Domain\Enums\CostUpdateSource;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Immutable audit record for every Material Cost change.
 *
 * @property string $id
 * @property string $product_id
 * @property float|null $previous_cost
 * @property float $new_cost
 * @property float $difference
 * @property float|null $change_pct
 * @property CostUpdateSource $source
 * @property string|null $goods_receipt_id
 * @property string|null $updated_by
 * @property array<string> $affected_recipe_ids
 * @property array<string> $affected_product_ids
 * @property \Carbon\Carbon $occurred_at
 * @property \Carbon\Carbon $created_at
 */
class MaterialCostHistory extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'material_cost_history';

    protected $fillable = [
        'product_id',
        'previous_cost',
        'new_cost',
        'difference',
        'change_pct',
        'source',
        'goods_receipt_id',
        'updated_by',
        'reason',
        'affected_recipe_ids',
        'affected_product_ids',
        'occurred_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'previous_cost' => 'float',
            'new_cost' => 'float',
            'difference' => 'float',
            'change_pct' => 'float',
            'source' => CostUpdateSource::class,
            'affected_recipe_ids' => 'array',
            'affected_product_ids' => 'array',
            'occurred_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
