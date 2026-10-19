<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

/**
 * Immutable business context snapshot.
 *
 * Captures WHY a commercial decision was made at the moment of order confirmation.
 * Created once alongside the financial snapshot; never updated or deleted (ADR-020).
 *
 * @property string $id
 * @property string $order_id
 * @property string|null $brand_policy_version
 * @property string|null $pricing_policy_version
 * @property string|null $discount_policy_version
 * @property string|null $shipping_policy_version
 * @property string|null $delivery_sla_version
 * @property string|null $sales_channel_config_version
 * @property string|null $loyalty_policy_version
 * @property string|null $promotion_engine_version
 * @property string|null $price_source
 * @property string|null $pricing_engine_rule
 * @property string|null $price_review_id
 * @property string|null $discount_source
 * @property string|null $campaign_id
 * @property bool $discount_manual_override
 * @property string|null $shipping_rule_id
 * @property string|null $shipping_zone
 * @property string|null $cost_source
 * @property string|null $recipe_version
 * @property string|null $cost_engine_version
 * @property string|null $approved_by
 * @property string|null $confirmation_user
 * @property \Illuminate\Support\Carbon|null $confirmation_time
 * @property string|null $approval_workflow_version
 * @property string|null $customer_tier
 * @property string|null $customer_segment
 * @property string|null $loyalty_level
 * @property float|null $delivery_success_rate
 * @property string|null $brand_name
 * @property string|null $brand_version
 * @property string|null $brand_commercial_strategy_version
 * @property string|null $channel_name
 * @property string|null $channel_type
 * @property string|null $marketplace_version
 * @property string|null $marketing_campaign_id
 * @property string|null $campaign_name
 * @property string|null $campaign_version
 * @property string|null $utm_source
 * @property string|null $utm_medium
 * @property string|null $utm_campaign
 * @property string|null $preparation_strategy
 * @property string|null $allocation_policy
 * @property string|null $shipping_priority
 * @property string|null $sla_policy_version
 * @property bool $locked
 * @property \Illuminate\Support\Carbon|null $locked_at
 * @property string|null $created_by
 */
final class OrderBusinessContextSnapshot extends Model
{
    use HasUuids;

    protected $table = 'order_business_context_snapshots';

    protected $fillable = [
        'order_id',
        'brand_policy_version',
        'pricing_policy_version',
        'discount_policy_version',
        'shipping_policy_version',
        'delivery_sla_version',
        'sales_channel_config_version',
        'loyalty_policy_version',
        'promotion_engine_version',
        'price_source',
        'pricing_engine_rule',
        'price_review_id',
        'discount_source',
        'campaign_id',
        'discount_manual_override',
        'shipping_rule_id',
        'shipping_zone',
        'cost_source',
        'recipe_version',
        'cost_engine_version',
        'approved_by',
        'confirmation_user',
        'confirmation_time',
        'approval_workflow_version',
        'customer_tier',
        'customer_segment',
        'loyalty_level',
        'delivery_success_rate',
        'brand_name',
        'brand_version',
        'brand_commercial_strategy_version',
        'channel_name',
        'channel_type',
        'marketplace_version',
        'marketing_campaign_id',
        'campaign_name',
        'campaign_version',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'preparation_strategy',
        'allocation_policy',
        'shipping_priority',
        'sla_policy_version',
        'locked',
        'locked_at',
        'created_by',
    ];

    protected $casts = [
        'discount_manual_override' => 'boolean',
        'locked' => 'boolean',
        'locked_at' => 'datetime',
        'confirmation_time' => 'datetime',
        'delivery_success_rate' => 'float',
    ];

    protected static function booted(): void
    {
        // Immutable: updates are silently rejected
        self::updating(static fn () => false);

        // Immutable: deletes throw
        self::deleting(static function (): never {
            throw new RuntimeException('Business context snapshots are immutable and cannot be deleted.');
        });
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
