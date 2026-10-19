<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use RuntimeException;

/**
 * Immutable financial snapshot captured exactly once at order confirmation.
 *
 * REPORTING CONTRACT (ADR-020):
 *   Executive reports MUST read ONLY snapshot tables.
 *   Never join Products or Recipes for historical financial calculations.
 *   The snapshot IS the financial truth. Products and Recipes represent
 *   current state, which may differ from the state at sale time.
 *
 * IMMUTABILITY RULES:
 *   - Updates are silently rejected.
 *   - Deletes throw ImmutableSnapshotException.
 *   - Force-deletes throw ImmutableSnapshotException.
 *   - The integrity_hash detects any DB-level tampering.
 *
 * @property string $id
 * @property string $order_id
 * @property string|null $previous_snapshot_id
 * @property string|null $company_id
 * @property string|null $brand_id
 * @property string|null $channel_id
 * @property string|null $channel_name
 * @property string|null $customer_id
 * @property string|null $customer_name
 * @property string $currency
 * @property string|null $payment_method
 * @property string|null $shipping_rule_id
 * @property string|null $shipping_rule_name
 * @property string|null $shipping_zone
 * @property bool $shipping_override_applied
 * @property string|null $shipping_override_by
 * @property float $subtotal
 * @property float $discount_amount
 * @property string|null $discount_type
 * @property float $shipping_cost
 * @property float $deposit_amount
 * @property float $remaining_balance
 * @property float $grand_total
 * @property float|null $total_cogs
 * @property float|null $gross_profit
 * @property float|null $total_raw_material_cost
 * @property float|null $total_packaging_cost
 * @property float|null $total_manufacturing_cost
 * @property float|null $total_other_cost
 * @property float|null $target_margin_percent
 * @property float|null $actual_margin_percent
 * @property float|null $margin_difference
 * @property string|null $margin_status
 * @property string $snapshot_uuid
 * @property int $snapshot_version
 * @property string|null $created_by
 * @property string $pricing_engine_version
 * @property string $cost_engine_version
 * @property string|null $recipe_version
 * @property string|null $brand_pricing_policy_version
 * @property string|null $shipping_pricing_version
 * @property string|null $integrity_hash
 * @property bool $locked
 * @property \Illuminate\Support\Carbon|null $locked_at
 */
final class OrderFinancialSnapshot extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'order_id',
        'previous_snapshot_id',
        'company_id',
        'brand_id',
        'channel_id',
        'channel_name',
        'customer_id',
        'customer_name',
        'currency',
        'payment_method',
        'shipping_rule_id',
        'shipping_rule_name',
        'shipping_zone',
        'shipping_override_applied',
        'shipping_override_by',
        'subtotal',
        'discount_amount',
        'discount_type',
        'shipping_cost',
        'deposit_amount',
        'remaining_balance',
        'grand_total',
        'total_cogs',
        'gross_profit',
        'total_raw_material_cost',
        'total_packaging_cost',
        'total_manufacturing_cost',
        'total_other_cost',
        'target_margin_percent',
        'actual_margin_percent',
        'margin_difference',
        'margin_status',
        'snapshot_uuid',
        'snapshot_version',
        'created_by',
        'pricing_engine_version',
        'cost_engine_version',
        'recipe_version',
        'brand_pricing_policy_version',
        'shipping_pricing_version',
        'integrity_hash',
        'locked',
        'locked_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'subtotal' => 'float',
            'discount_amount' => 'float',
            'shipping_cost' => 'float',
            'deposit_amount' => 'float',
            'remaining_balance' => 'float',
            'grand_total' => 'float',
            'total_cogs' => 'float',
            'gross_profit' => 'float',
            'total_raw_material_cost' => 'float',
            'total_packaging_cost' => 'float',
            'total_manufacturing_cost' => 'float',
            'total_other_cost' => 'float',
            'target_margin_percent' => 'float',
            'actual_margin_percent' => 'float',
            'margin_difference' => 'float',
            'snapshot_version' => 'integer',
            'shipping_override_applied' => 'boolean',
            'locked' => 'boolean',
            'locked_at' => 'datetime',
        ];
    }

    /**
     * Immutability enforcement:
     *  - Updates silently rejected.
     *  - Deletes (soft or force) throw to prevent accidental removal.
     */
    protected static function booted(): void
    {
        self::updating(static fn () => false);

        self::deleting(static function (self $model): never {
            throw new RuntimeException(
                "Financial snapshots are immutable. Snapshot {$model->id} cannot be deleted.",
            );
        });
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return HasMany<OrderLineSnapshot, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(OrderLineSnapshot::class, 'order_financial_snapshot_id');
    }
}
