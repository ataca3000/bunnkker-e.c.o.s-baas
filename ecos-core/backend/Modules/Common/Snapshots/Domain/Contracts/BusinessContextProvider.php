<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Contracts;

use DateTimeInterface;

/**
 * Contract for aggregates that provide business context data for snapshot creation.
 *
 * Implementing classes resolve policy versions, decision provenance, and
 * commercial context from their domain entities. The BusinessContextSnapshotBuilder
 * only assembles the DTO — it never queries tables directly.
 */
interface BusinessContextProvider extends Snapshotable
{
    // ── PART 1: Policy versions ───────────────────────────────────────────────

    public function getPricingPolicyVersion(): ?string;

    public function getShippingPolicyVersion(): ?string;

    public function getBrandPolicyVersion(): ?string;

    public function getDiscountPolicyVersion(): ?string;

    public function getDeliverySlaVersion(): ?string;

    public function getSalesChannelConfigVersion(): ?string;

    public function getLoyaltyPolicyVersion(): ?string;

    public function getPromotionEngineVersion(): ?string;

    // ── PART 2: Decision provenance — Price ───────────────────────────────────

    public function getPriceSource(): string;

    public function getPricingEngineRule(): ?string;

    public function getPriceReviewId(): ?string;

    // ── PART 2: Decision provenance — Discount ────────────────────────────────

    public function getDiscountSource(): ?string;

    public function getCampaignId(): ?string;

    public function getDiscountManualOverride(): bool;

    // ── PART 2: Decision provenance — Shipping ────────────────────────────────

    public function getContextShippingRuleId(): ?string;

    public function getContextShippingZone(): ?string;

    // ── PART 2: Decision provenance — Cost ───────────────────────────────────

    public function getCostSource(): string;

    public function getRecipeVersion(): ?string;

    public function getCostEngineVersion(): string;

    // ── PART 3: Approval snapshot ─────────────────────────────────────────────

    public function getApprovedBy(): ?string;

    public function getConfirmationUser(): ?string;

    public function getConfirmationTime(): ?DateTimeInterface;

    public function getApprovalWorkflowVersion(): ?string;

    // ── PART 4: Customer commercial context ───────────────────────────────────

    public function getCustomerTier(): ?string;

    public function getCustomerSegment(): ?string;

    public function getLoyaltyLevel(): ?string;

    public function getDeliverySuccessRate(): ?float;

    // ── PART 5: Brand context ─────────────────────────────────────────────────

    public function getBrandName(): ?string;

    public function getBrandVersion(): ?string;

    public function getBrandCommercialStrategyVersion(): ?string;

    // ── PART 6: Channel context ───────────────────────────────────────────────

    public function getChannelName(): ?string;

    public function getChannelType(): ?string;

    public function getMarketplaceVersion(): ?string;

    // ── PART 7: Marketing context (nullable) ──────────────────────────────────

    public function getMarketingCampaignId(): ?string;

    public function getCampaignName(): ?string;

    public function getCampaignVersion(): ?string;

    public function getUtmSource(): ?string;

    public function getUtmMedium(): ?string;

    public function getUtmCampaign(): ?string;

    // ── PART 8: Fulfillment context ───────────────────────────────────────────

    public function getPreparationStrategy(): ?string;

    public function getAllocationPolicy(): ?string;

    public function getShippingPriority(): ?string;

    public function getSlaPolicyVersion(): ?string;

    // ── Actor ─────────────────────────────────────────────────────────────────

    public function getContextCreatedBy(): ?string;
}
