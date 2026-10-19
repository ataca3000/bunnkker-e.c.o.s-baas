<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

/**
 * Per-line immutable financial snapshot — see ADR-020.
 *
 * @property string $id
 * @property string $order_financial_snapshot_id
 * @property string $order_id
 * @property string|null $order_line_id
 * @property string|null $product_id
 * @property string|null $product_sku
 * @property string|null $product_name
 * @property float $quantity
 * @property float $unit_price_at_sale
 * @property float|null $regular_price_at_sale
 * @property float|null $sale_price_at_sale
 * @property float $line_total
 * @property float|null $raw_material_cost
 * @property float|null $packaging_cost
 * @property float|null $manufacturing_cost
 * @property float|null $other_cost
 * @property float|null $recipe_cost
 * @property float|null $unit_cost
 * @property float|null $line_cost
 * @property float|null $gross_profit
 * @property float|null $margin_percent
 * @property float|null $target_margin_percent
 * @property string|null $margin_status
 * @property string|null $bom_id
 * @property int|null $bom_version_number
 * @property string|null $source_recipe_version
 * @property string|null $price_review_id
 * @property \Illuminate\Support\Carbon|null $price_review_approved_at
 * @property string|null $price_review_approved_by
 * @property array|null $cost_snapshot
 */
final class OrderLineSnapshot extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'order_financial_snapshot_id',
        'order_id',
        'order_line_id',
        'product_id',
        'product_sku',
        'product_name',
        'quantity',
        'unit_price_at_sale',
        'regular_price_at_sale',
        'sale_price_at_sale',
        'line_total',
        'raw_material_cost',
        'packaging_cost',
        'manufacturing_cost',
        'other_cost',
        'recipe_cost',
        'unit_cost',
        'line_cost',
        'gross_profit',
        'margin_percent',
        'target_margin_percent',
        'margin_status',
        'bom_id',
        'bom_version_number',
        'source_recipe_version',
        'price_review_id',
        'price_review_approved_at',
        'price_review_approved_by',
        'cost_snapshot',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'float',
            'unit_price_at_sale' => 'float',
            'regular_price_at_sale' => 'float',
            'sale_price_at_sale' => 'float',
            'line_total' => 'float',
            'raw_material_cost' => 'float',
            'packaging_cost' => 'float',
            'manufacturing_cost' => 'float',
            'other_cost' => 'float',
            'recipe_cost' => 'float',
            'unit_cost' => 'float',
            'line_cost' => 'float',
            'gross_profit' => 'float',
            'margin_percent' => 'float',
            'target_margin_percent' => 'float',
            'bom_version_number' => 'integer',
            'price_review_approved_at' => 'datetime',
            'cost_snapshot' => 'array',
        ];
    }

    /** Immutability: updates silently rejected, deletes throw. */
    protected static function booted(): void
    {
        self::updating(static fn () => false);

        self::deleting(static function (self $model): never {
            throw new RuntimeException(
                "Line snapshots are immutable. Snapshot line {$model->id} cannot be deleted.",
            );
        });
    }

    /**
     * @return BelongsTo<OrderFinancialSnapshot, $this>
     */
    public function snapshot(): BelongsTo
    {
        return $this->belongsTo(OrderFinancialSnapshot::class, 'order_financial_snapshot_id');
    }
}
