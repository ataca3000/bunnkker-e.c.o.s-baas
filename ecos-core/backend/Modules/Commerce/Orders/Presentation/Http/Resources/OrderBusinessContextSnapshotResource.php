<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * TASK-ORDER-006C PART 10 — Business context snapshot API representation.
 */
final class OrderBusinessContextSnapshotResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_id' => $this->order_id,

            // PART 1: Business Policy Versions
            'policy_versions' => [
                'brand' => $this->brand_policy_version,
                'pricing' => $this->pricing_policy_version,
                'discount' => $this->discount_policy_version,
                'shipping' => $this->shipping_policy_version,
                'delivery_sla' => $this->delivery_sla_version,
                'sales_channel_config' => $this->sales_channel_config_version,
                'loyalty' => $this->loyalty_policy_version,
                'promotion_engine' => $this->promotion_engine_version,
            ],

            // PART 2: Decision Provenance
            'decision_provenance' => [
                'price' => [
                    'source' => $this->price_source,
                    'pricing_engine_rule' => $this->pricing_engine_rule,
                    'price_review_id' => $this->price_review_id,
                ],
                'discount' => [
                    'source' => $this->discount_source,
                    'campaign_id' => $this->campaign_id,
                    'manual_override' => $this->discount_manual_override,
                ],
                'shipping' => [
                    'rule_id' => $this->shipping_rule_id,
                    'zone' => $this->shipping_zone,
                ],
                'cost' => [
                    'source' => $this->cost_source,
                    'recipe_version' => $this->recipe_version,
                    'engine_version' => $this->cost_engine_version,
                ],
            ],

            // PART 3: Approval Snapshot
            'approval' => [
                'approved_by' => $this->approved_by,
                'confirmation_user' => $this->confirmation_user,
                'confirmation_time' => $this->confirmation_time?->toIso8601String(),
                'workflow_version' => $this->approval_workflow_version,
            ],

            // PART 4: Customer Commercial Context
            'customer_context' => [
                'tier' => $this->customer_tier,
                'segment' => $this->customer_segment,
                'loyalty_level' => $this->loyalty_level,
                'delivery_success_rate' => $this->delivery_success_rate,
            ],

            // PART 5: Brand Context
            'brand_context' => [
                'name' => $this->brand_name,
                'version' => $this->brand_version,
                'commercial_strategy_version' => $this->brand_commercial_strategy_version,
            ],

            // PART 6: Channel Context
            'channel_context' => [
                'name' => $this->channel_name,
                'type' => $this->channel_type,
                'marketplace_version' => $this->marketplace_version,
            ],

            // PART 7: Marketing Context
            'marketing_context' => [
                'campaign_id' => $this->marketing_campaign_id,
                'campaign_name' => $this->campaign_name,
                'campaign_version' => $this->campaign_version,
                'utm_source' => $this->utm_source,
                'utm_medium' => $this->utm_medium,
                'utm_campaign' => $this->utm_campaign,
            ],

            // PART 8: Fulfillment Context
            'fulfillment_context' => [
                'preparation_strategy' => $this->preparation_strategy,
                'allocation_policy' => $this->allocation_policy,
                'shipping_priority' => $this->shipping_priority,
                'sla_policy_version' => $this->sla_policy_version,
            ],

            // Immutability
            'locked' => $this->locked,
            'locked_at' => $this->locked_at?->toIso8601String(),
            'created_by' => $this->created_by,
            'captured_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
