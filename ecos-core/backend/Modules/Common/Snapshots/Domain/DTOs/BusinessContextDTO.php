<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\DTOs;

use DateTimeInterface;

/**
 * Assembled business context data ready for persistence.
 * Produced by BusinessContextSnapshotBuilder from a BusinessContextProvider.
 */
final readonly class BusinessContextDTO
{
    public function __construct(
        public string $aggregateId,
        public string $aggregateType,

        // PART 1: Policy versions
        public ?string $brandPolicyVersion,
        public ?string $pricingPolicyVersion,
        public ?string $discountPolicyVersion,
        public ?string $shippingPolicyVersion,
        public ?string $deliverySlaVersion,
        public ?string $salesChannelConfigVersion,
        public ?string $loyaltyPolicyVersion,
        public ?string $promotionEngineVersion,

        // PART 2: Decision provenance — Price
        public string $priceSource,
        public ?string $pricingEngineRule,
        public ?string $priceReviewId,

        // PART 2: Decision provenance — Discount
        public ?string $discountSource,
        public ?string $campaignId,
        public bool $discountManualOverride,

        // PART 2: Decision provenance — Shipping
        public ?string $shippingRuleId,
        public ?string $shippingZone,

        // PART 2: Decision provenance — Cost
        public string $costSource,
        public ?string $recipeVersion,
        public string $costEngineVersion,

        // PART 3: Approval snapshot
        public ?string $approvedBy,
        public ?string $confirmationUser,
        public ?DateTimeInterface $confirmationTime,
        public ?string $approvalWorkflowVersion,

        // PART 4: Customer commercial context
        public ?string $customerTier,
        public ?string $customerSegment,
        public ?string $loyaltyLevel,
        public ?float $deliverySuccessRate,

        // PART 5: Brand context
        public ?string $brandName,
        public ?string $brandVersion,
        public ?string $brandCommercialStrategyVersion,

        // PART 6: Channel context
        public ?string $channelName,
        public ?string $channelType,
        public ?string $marketplaceVersion,

        // PART 7: Marketing context
        public ?string $marketingCampaignId,
        public ?string $campaignName,
        public ?string $campaignVersion,
        public ?string $utmSource,
        public ?string $utmMedium,
        public ?string $utmCampaign,

        // PART 8: Fulfillment context
        public ?string $preparationStrategy,
        public ?string $allocationPolicy,
        public ?string $shippingPriority,
        public ?string $slaPolicyVersion,
    ) {}
}
