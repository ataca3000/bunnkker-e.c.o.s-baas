<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Adapters;

use DateTimeInterface;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Common\Snapshots\Domain\Contracts\BusinessContextProvider;
use Modules\CostManagement\Domain\Enums\PricingReviewStatus;
use Modules\CostManagement\Domain\Models\PricingReview;

/**
 * Orders implementation of BusinessContextProvider.
 *
 * Resolves policy versions, decision provenance, and commercial context from
 * the Order aggregate and its relations. The platform builder never queries
 * tables — all resolution happens here before the builder is invoked.
 */
final class OrderBusinessContextAdapter implements BusinessContextProvider
{
    // Resolved on first access, cached for the lifetime of the adapter
    private ?string $resolvedPriceSource = null;

    private ?string $resolvedPriceReviewId = null;

    private ?string $resolvedCostSource = null;

    private ?string $resolvedRecipeVersion = null;

    private ?float $resolvedDeliveryRate = null;

    private bool $contextResolved = false;

    public function __construct(
        private readonly Order $order,
        private readonly ?string $actorId,
        private readonly ?string $companyId,
    ) {}

    // ── Snapshotable ──────────────────────────────────────────────────────────

    public function getSnapshotAggregateId(): string
    {
        return $this->order->id;
    }

    public function getSnapshotAggregateType(): string
    {
        return 'order';
    }

    public function getSnapshotCompanyId(): ?string
    {
        return $this->companyId;
    }

    // ── PART 1: Policy versions ───────────────────────────────────────────────

    public function getPricingPolicyVersion(): ?string
    {
        return '1.0.0';
    }

    public function getShippingPolicyVersion(): ?string
    {
        return '1.0.0';
    }

    public function getBrandPolicyVersion(): ?string
    {
        return null;
    }

    public function getDiscountPolicyVersion(): ?string
    {
        return null;
    }

    public function getDeliverySlaVersion(): ?string
    {
        return null;
    }

    public function getSalesChannelConfigVersion(): ?string
    {
        return null;
    }

    public function getLoyaltyPolicyVersion(): ?string
    {
        return null;
    }

    public function getPromotionEngineVersion(): ?string
    {
        return null;
    }

    // ── PART 2: Decision provenance — Price ───────────────────────────────────

    public function getPriceSource(): string
    {
        $this->resolveContext();

        return $this->resolvedPriceSource ?? 'regular_price';
    }

    public function getPricingEngineRule(): ?string
    {
        return null;
    }

    public function getPriceReviewId(): ?string
    {
        $this->resolveContext();

        return $this->resolvedPriceReviewId;
    }

    // ── PART 2: Decision provenance — Discount ────────────────────────────────

    public function getDiscountSource(): ?string
    {
        return ($this->order->discount_amount ?? 0) > 0 ? 'manual' : null;
    }

    public function getCampaignId(): ?string
    {
        return null;
    }

    public function getDiscountManualOverride(): bool
    {
        return ($this->order->discount_amount ?? 0) > 0;
    }

    // ── PART 2: Decision provenance — Shipping ────────────────────────────────

    public function getContextShippingRuleId(): ?string
    {
        if ($this->order->shipping_cost_source === 'override') {
            return null;
        }

        return null; // Rule ID captured on financial snapshot; null here for provenance record
    }

    public function getContextShippingZone(): ?string
    {
        return implode(' › ', array_filter([$this->order->governorate, $this->order->area])) ?: null;
    }

    // ── PART 2: Decision provenance — Cost ───────────────────────────────────

    public function getCostSource(): string
    {
        $this->resolveContext();

        return $this->resolvedCostSource ?? 'manual';
    }

    public function getRecipeVersion(): ?string
    {
        $this->resolveContext();

        return $this->resolvedRecipeVersion;
    }

    public function getCostEngineVersion(): string
    {
        return '1.0.0';
    }

    // ── PART 3: Approval snapshot ─────────────────────────────────────────────

    public function getApprovedBy(): ?string
    {
        return $this->actorId;
    }

    public function getConfirmationUser(): ?string
    {
        return $this->actorId;
    }

    public function getConfirmationTime(): ?DateTimeInterface
    {
        return now()->toDateTime();
    }

    public function getApprovalWorkflowVersion(): ?string
    {
        return '1.0.0';
    }

    // ── PART 4: Customer commercial context ───────────────────────────────────

    public function getCustomerTier(): ?string
    {
        return null;
    }

    public function getCustomerSegment(): ?string
    {
        return null;
    }

    public function getLoyaltyLevel(): ?string
    {
        return null;
    }

    public function getDeliverySuccessRate(): ?float
    {
        $this->resolveContext();

        return $this->resolvedDeliveryRate;
    }

    // ── PART 5: Brand context ─────────────────────────────────────────────────

    public function getBrandName(): ?string
    {
        return $this->order->channel?->brand?->name;
    }

    public function getBrandVersion(): ?string
    {
        return '1.0.0';
    }

    public function getBrandCommercialStrategyVersion(): ?string
    {
        return '1.0.0';
    }

    // ── PART 6: Channel context ───────────────────────────────────────────────

    public function getChannelName(): ?string
    {
        return $this->order->channel?->name;
    }

    public function getChannelType(): ?string
    {
        return $this->order->channel?->channel_type;
    }

    public function getMarketplaceVersion(): ?string
    {
        return '1.0.0';
    }

    // ── PART 7: Marketing context ─────────────────────────────────────────────

    public function getMarketingCampaignId(): ?string
    {
        return null;
    }

    public function getCampaignName(): ?string
    {
        return null;
    }

    public function getCampaignVersion(): ?string
    {
        return null;
    }

    public function getUtmSource(): ?string
    {
        return null;
    }

    public function getUtmMedium(): ?string
    {
        return null;
    }

    public function getUtmCampaign(): ?string
    {
        return null;
    }

    // ── PART 8: Fulfillment context ───────────────────────────────────────────

    public function getPreparationStrategy(): ?string
    {
        return null;
    }

    public function getAllocationPolicy(): ?string
    {
        return null;
    }

    public function getShippingPriority(): ?string
    {
        return null;
    }

    public function getSlaPolicyVersion(): ?string
    {
        return '1.0.0';
    }

    // ── Actor ─────────────────────────────────────────────────────────────────

    public function getContextCreatedBy(): ?string
    {
        return $this->actorId;
    }

    // ── Private resolution helpers ────────────────────────────────────────────

    private function resolveContext(): void
    {
        if ($this->contextResolved) {
            return;
        }

        $this->contextResolved = true;

        $this->resolvedPriceSource = $this->resolvePriceSource();
        $this->resolvedPriceReviewId = $this->resolveFirstPriceReviewId();
        $this->resolvedCostSource = $this->resolveCostSource();
        $this->resolvedRecipeVersion = $this->resolveRecipeVersion();
        $this->resolvedDeliveryRate = $this->resolveDeliverySuccessRate();
    }

    private function resolvePriceSource(): string
    {
        foreach ($this->order->lines as $line) {
            if ($line->product?->sale_price !== null) {
                return 'sale_price';
            }
        }

        return 'regular_price';
    }

    private function resolveFirstPriceReviewId(): ?string
    {
        if ($this->companyId === null || $this->order->lines->isEmpty()) {
            return null;
        }

        foreach ($this->order->lines as $line) {
            $review = PricingReview::where('product_id', $line->product_id)
                ->where('company_id', $this->companyId)
                ->whereIn('status', [
                    PricingReviewStatus::Approved->value,
                    PricingReviewStatus::Kept->value,
                    PricingReviewStatus::CustomPrice->value,
                ])
                ->whereNotNull('resolved_at')
                ->orderByDesc('resolved_at')
                ->first();

            if ($review !== null) {
                return $review->id;
            }
        }

        return null;
    }

    private function resolveCostSource(): string
    {
        foreach ($this->order->lines as $line) {
            if ($line->product?->activeRecipe !== null) {
                return 'bom';
            }
        }

        return 'manual';
    }

    private function resolveRecipeVersion(): ?string
    {
        $versions = [];

        foreach ($this->order->lines as $line) {
            $recipe = $line->product?->activeRecipe;

            if ($recipe !== null && $recipe->version !== null) {
                $versions[] = $recipe->version;
            }
        }

        $unique = array_unique(array_filter($versions));

        if (count($unique) === 0) {
            return null;
        }

        return count($unique) === 1 ? array_values($unique)[0] : 'multiple';
    }

    private function resolveDeliverySuccessRate(): ?float
    {
        if ($this->order->customer_id === null) {
            return null;
        }

        $total = Order::where('customer_id', $this->order->customer_id)->count();

        if ($total === 0) {
            return null;
        }

        $delivered = Order::where('customer_id', $this->order->customer_id)
            ->whereIn('status', ['delivered', 'completed'])
            ->count();

        return round(($delivered / $total) * 100.0, 2);
    }
}
