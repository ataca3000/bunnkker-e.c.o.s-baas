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
 * @property AbcClass $abc_class
 * @property int $frequency_days
 * @property \Illuminate\Support\Carbon|null $last_counted_at
 * @property \Illuminate\Support\Carbon|null $next_due_at
 * @property bool $is_overdue
 */
class CycleCountPlan extends Model
{
    use HasUuids;

    /** @var list<string> */
    protected $fillable = [
        'product_id',
        'abc_class',
        'frequency_days',
        'last_counted_at',
        'next_due_at',
        'is_overdue',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'abc_class' => AbcClass::class,
            'frequency_days' => 'integer',
            'last_counted_at' => 'date:Y-m-d',
            'next_due_at' => 'date:Y-m-d',
            'is_overdue' => 'boolean',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
