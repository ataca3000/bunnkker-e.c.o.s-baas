<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\InventoryControl\Domain\Enums\AbcClass;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * @property string $id
 * @property string $product_id
 * @property AbcClass $classification
 * @property numeric-string $annual_consumption_value
 * @property numeric-string $cumulative_percentage
 * @property \Illuminate\Support\Carbon $calculated_at
 */
class InventoryAbcClassification extends Model
{
    use HasUuids;

    /** @var list<string> */
    protected $fillable = [
        'product_id',
        'classification',
        'annual_consumption_value',
        'cumulative_percentage',
        'calculated_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'classification' => AbcClass::class,
            'annual_consumption_value' => 'decimal:2',
            'cumulative_percentage' => 'decimal:4',
            'calculated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
