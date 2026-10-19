<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Events;

use Modules\Commerce\Orders\Domain\Models\OrderBusinessContextSnapshot;

/**
 * TASK-ORDER-006C PART 12 — AI event fired after the business context snapshot is persisted.
 *
 * Carries denormalized payload for direct consumption by downstream AI/analytics systems
 * without needing to re-query the snapshot table.
 */
final class OrderBusinessContextCaptured
{
    public readonly string $orderId;

    public readonly string $snapshotId;

    public readonly ?string $brandName;

    public readonly ?string $channelName;

    public readonly ?string $channelType;

    public readonly ?string $priceSource;

    public readonly ?string $discountSource;

    public readonly bool $discountManualOverride;

    public readonly ?string $shippingZone;

    public readonly ?string $costSource;

    public readonly ?string $recipeVersion;

    public readonly ?float $deliverySuccessRate;

    public readonly ?string $customerTier;

    public readonly ?string $customerSegment;

    public readonly ?string $loyaltyLevel;

    public readonly ?string $pricingPolicyVersion;

    public readonly ?string $shippingPolicyVersion;

    public readonly string $capturedAt;

    public function __construct(public readonly OrderBusinessContextSnapshot $snapshot)
    {
        $this->orderId = $snapshot->order_id;
        $this->snapshotId = $snapshot->id;
        $this->brandName = $snapshot->brand_name;
        $this->channelName = $snapshot->channel_name;
        $this->channelType = $snapshot->channel_type;
        $this->priceSource = $snapshot->price_source;
        $this->discountSource = $snapshot->discount_source;
        $this->discountManualOverride = $snapshot->discount_manual_override;
        $this->shippingZone = $snapshot->shipping_zone;
        $this->costSource = $snapshot->cost_source;
        $this->recipeVersion = $snapshot->recipe_version;
        $this->deliverySuccessRate = $snapshot->delivery_success_rate;
        $this->customerTier = $snapshot->customer_tier;
        $this->customerSegment = $snapshot->customer_segment;
        $this->loyaltyLevel = $snapshot->loyalty_level;
        $this->pricingPolicyVersion = $snapshot->pricing_policy_version;
        $this->shippingPolicyVersion = $snapshot->shipping_policy_version;
        $this->capturedAt = $snapshot->created_at?->toIso8601String() ?? now()->toIso8601String();
    }
}
