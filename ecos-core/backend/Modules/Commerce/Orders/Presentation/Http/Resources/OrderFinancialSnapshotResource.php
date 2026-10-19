<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class OrderFinancialSnapshotResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            // Identity
            'id' => $this->id,
            'order_id' => $this->order_id,
            'snapshot_uuid' => $this->snapshot_uuid,
            'snapshot_version' => $this->snapshot_version,

            // Parties
            'company_id' => $this->company_id,
            'brand_id' => $this->brand_id,
            'channel_id' => $this->channel_id,
            'channel_name' => $this->channel_name,
            'customer_id' => $this->customer_id,
            'customer_name' => $this->customer_name,

            // Order financials
            'currency' => $this->currency,
            'payment_method' => $this->payment_method,
            'subtotal' => $this->subtotal,
            'discount_amount' => $this->discount_amount,
            'discount_type' => $this->discount_type,
            'shipping_cost' => $this->shipping_cost,
            'deposit_amount' => $this->deposit_amount,
            'remaining_balance' => $this->remaining_balance,
            'grand_total' => $this->grand_total,

            // Cost aggregates (PART 5)
            'total_cogs' => $this->total_cogs,
            'gross_profit' => $this->gross_profit,
            'total_raw_material_cost' => $this->total_raw_material_cost,
            'total_packaging_cost' => $this->total_packaging_cost,
            'total_manufacturing_cost' => $this->total_manufacturing_cost,
            'total_other_cost' => $this->total_other_cost,

            // Margin diagnostics (PART 7)
            'target_margin_percent' => $this->target_margin_percent,
            'actual_margin_percent' => $this->actual_margin_percent,
            'margin_difference' => $this->margin_difference,
            'margin_status' => $this->margin_status,

            // Shipping snapshot (PART 6)
            'shipping_rule_id' => $this->shipping_rule_id,
            'shipping_rule_name' => $this->shipping_rule_name,
            'shipping_zone' => $this->shipping_zone,
            'shipping_override_applied' => $this->shipping_override_applied,

            // Immutability + integrity (PART 13 + PART 5)
            'locked' => $this->locked,
            'locked_at' => $this->locked_at?->toIso8601String(),
            'integrity_hash' => $this->integrity_hash,
            'hash_verified' => $this->hash_verified ?? null,

            // Engine versions (PART 3)
            'pricing_engine_version' => $this->pricing_engine_version,
            'cost_engine_version' => $this->cost_engine_version,
            'recipe_version' => $this->recipe_version,
            'brand_pricing_policy_version' => $this->brand_pricing_policy_version,
            'shipping_pricing_version' => $this->shipping_pricing_version,

            // Audit
            'created_by' => $this->created_by,
            'snapshotted_at' => $this->created_at?->toIso8601String(),

            // Lines
            'lines' => OrderLineSnapshotResource::collection(
                $this->whenLoaded('lines'),
            ),

            // TASK-ORDER-006C PART 10: Business context snapshot (WHY layer)
            'business_context' => $this->business_context
                ? new OrderBusinessContextSnapshotResource($this->business_context)
                : null,
        ];
    }
}
