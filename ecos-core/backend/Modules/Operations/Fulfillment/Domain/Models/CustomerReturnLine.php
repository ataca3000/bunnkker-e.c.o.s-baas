<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $customer_return_id
 * @property string $order_line_id
 * @property string $product_id
 * @property string $sku_snapshot
 * @property string $name_snapshot
 * @property float $quantity_returned
 * @property float|null $unit_cost_snapshot
 * @property string $condition sellable | damaged | destroyed
 * @property string|null $inspection_notes
 */
class CustomerReturnLine extends Model
{
    use HasUuids;

    protected $table = 'customer_return_lines';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'customer_return_id',
        'order_line_id',
        'product_id',
        'sku_snapshot',
        'name_snapshot',
        'quantity_returned',
        'unit_cost_snapshot',
        'condition',
        'inspection_notes',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'quantity_returned' => 'float',
            'unit_cost_snapshot' => 'float',
        ];
    }

    /** @return BelongsTo<CustomerReturn, $this> */
    public function customerReturn(): BelongsTo
    {
        return $this->belongsTo(CustomerReturn::class, 'customer_return_id');
    }

    public function isSellable(): bool
    {
        return $this->condition === 'sellable';
    }
}
