<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Application\Builders;

use Modules\Common\Snapshots\Domain\Contracts\BusinessContextProvider;
use Modules\Common\Snapshots\Domain\DTOs\BusinessContextDTO;

/**
 * Assembles a BusinessContextDTO from a BusinessContextProvider.
 *
 * The builder performs no database lookups. All data must be pre-resolved
 * by the implementing module before the provider is passed here.
 * Reusable across Orders, POS, Procurement, Manufacturing, etc.
 */
final class BusinessContextSnapshotBuilder
{
    public function build(BusinessContextProvider $provider): BusinessContextDTO
    {
        return new BusinessContextDTO(
            aggregateId: $provider->getSnapshotAggregateId(),
            aggregateType: $provider->getSnapshotAggregateType(),

            // PART 1: Policy versions
            brandPolicyVersion: $provider->getBrandPolicyVersion(),
            pricingPolicyVersion: $provider->getPricingPolicyVersion(),
            discountPolicyVersion: $provider->getDiscountPolicyVersion(),
            shippingPolicyVersion: $provider->getShippingPolicyVersion(),
            deliverySlaVersion: $provider->getDeliverySlaVersion(),
            salesChannelConfigVersion: $provider->getSalesChannelConfigVersion(),
            loyaltyPolicyVersion: $provider->getLoyaltyPolicyVersion(),
            promotionEngineVersion: $provider->getPromotionEngineVersion(),

            // PART 2: Price provenance
            priceSource: $provider->getPriceSource(),
            pricingEngineRule: $provider->getPricingEngineRule(),
            priceReviewId: $provider->getPriceReviewId(),

            // PART 2: Discount provenance
            discountSource: $provider->getDiscountSource(),
            campaignId: $provider->getCampaignId(),
            discountManualOverride: $provider->getDiscountManualOverride(),

            // PART 2: Shipping provenance
            shippingRuleId: $provider->getContextShippingRuleId(),
            shippingZone: $provider->getContextShippingZone(),

            // PART 2: Cost provenance
            costSource: $provider->getCostSource(),
            recipeVersion: $provider->getRecipeVersion(),
            costEngineVersion: $provider->getCostEngineVersion(),

            // PART 3: Approval
            approvedBy: $provider->getApprovedBy(),
            confirmationUser: $provider->getConfirmationUser(),
            confirmationTime: $provider->getConfirmationTime(),
            approvalWorkflowVersion: $provider->getApprovalWorkflowVersion(),

            // PART 4: Customer context
            customerTier: $provider->getCustomerTier(),
            customerSegment: $provider->getCustomerSegment(),
            loyaltyLevel: $provider->getLoyaltyLevel(),
            deliverySuccessRate: $provider->getDeliverySuccessRate(),

            // PART 5: Brand context
            brandName: $provider->getBrandName(),
            brandVersion: $provider->getBrandVersion(),
            brandCommercialStrategyVersion: $provider->getBrandCommercialStrategyVersion(),

            // PART 6: Channel context
            channelName: $provider->getChannelName(),
            channelType: $provider->getChannelType(),
            marketplaceVersion: $provider->getMarketplaceVersion(),

            // PART 7: Marketing context
            marketingCampaignId: $provider->getMarketingCampaignId(),
            campaignName: $provider->getCampaignName(),
            campaignVersion: $provider->getCampaignVersion(),
            utmSource: $provider->getUtmSource(),
            utmMedium: $provider->getUtmMedium(),
            utmCampaign: $provider->getUtmCampaign(),

            // PART 8: Fulfillment context
            preparationStrategy: $provider->getPreparationStrategy(),
            allocationPolicy: $provider->getAllocationPolicy(),
            shippingPriority: $provider->getShippingPriority(),
            slaPolicyVersion: $provider->getSlaPolicyVersion(),
        );
    }
}
