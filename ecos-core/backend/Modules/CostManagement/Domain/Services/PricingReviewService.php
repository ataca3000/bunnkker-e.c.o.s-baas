<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Services;

use Modules\Admin\Configuration\Domain\Services\ConfigurationManager;
use Modules\Commerce\ProductMappings\Domain\Enums\SyncStatus;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\CostManagement\Domain\Enums\PricingReviewStatus;
use Modules\CostManagement\Domain\Events\PriceReviewApproved;
use Modules\CostManagement\Domain\Events\PriceReviewCreated;
use Modules\CostManagement\Domain\Events\PriceReviewRejected;
use Modules\CostManagement\Domain\Models\PriceApproval;
use Modules\CostManagement\Domain\Models\PricingReview;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Manages the Price Review Center queue (Parts 5 & 7).
 *
 * When Product Cost changes, one pricing_review is created per product.
 * Management resolves each review. Selling Price never changes automatically.
 *
 * Default target_margin: 30%. Products should configure their own margin
 * target on the product record (future extension).
 */
final class PricingReviewService
{
    public const DEFAULT_TARGET_MARGIN = 30.0;

    public function __construct(
        private readonly ConfigurationManager $config,
    ) {}

    /**
     * Create or update a pending pricing review for a finished product.
     *
     * Rules enforced here:
     *  - If product_cost did not actually change: returns null (no-op).
     *  - If an open (pending/snoozed) review already exists: update it in-place.
     *  - Otherwise: create a new Pending review.
     *
     * Callers should call this inside the same DB transaction as the cost update
     * so that a concurrent cascade for the same product cannot race to create two rows.
     */
    public function upsertForProduct(
        Product $product,
        float $newProductCost,
        float $previousProductCost,
        string $companyId,
        ?string $historyId,
        ?string $triggerReason = null,
        ?string $triggerSource = null,
        ?array $costSnapshot = null,
        ?string $explanation = null,
    ): ?PricingReview {
        // No-op: cost did not move
        if (abs($newProductCost - $previousProductCost) < 0.0001) {
            return null;
        }

        $product->loadMissing('brand');
        $sellingPrice = (float) ($product->regular_price ?? 0.0);
        $targetMargin = $product->effectiveTargetMargin();
        $suggestedPrice = $targetMargin < 100
            ? round($newProductCost / (1 - $targetMargin / 100), 4)
            : $newProductCost;
        $discountPct = $product->effectiveDiscountPct();
        $suggestedSalePrice = round($suggestedPrice * (1 - $discountPct / 100), 4);
        $currentMargin = $sellingPrice > 0
            ? round((($sellingPrice - $newProductCost) / $sellingPrice) * 100, 4)
            : 0.0;

        $diff = $newProductCost - $previousProductCost;
        $impacts = $diff > 0 ? ['cost_increased'] : ['cost_decreased'];
        if ($currentMargin < $targetMargin) {
            $impacts[] = 'margin_below_target';
        }
        $impacts = array_values(array_unique($impacts));

        // Look for an open review (pending or snoozed) for this product+company
        $existing = PricingReview::query()
            ->where('product_id', $product->id)
            ->where('company_id', $companyId)
            ->whereNull('channel_id')
            ->whereIn('status', [
                PricingReviewStatus::Pending->value,
                PricingReviewStatus::Snoozed->value,
            ])
            ->lockForUpdate()
            ->first();

        if ($existing !== null) {
            // Keep the original previous_cost so the delta shows total drift.
            // cost_snapshot is refreshed each update (latest state wins); explanation is appended.
            $updateData = [
                'product_cost' => round($newProductCost, 4),
                'cost_difference' => round($newProductCost - (float) ($existing->previous_product_cost ?? $previousProductCost), 4),
                'selling_price' => $sellingPrice,
                'suggested_selling_price' => $suggestedPrice,
                'suggested_sale_price' => $suggestedSalePrice,
                'current_margin' => $currentMargin,
                'impacts' => $impacts,
                'status' => PricingReviewStatus::Pending->value,
                'snooze_until' => null,
                'triggered_by_cost_history_id' => $historyId,
                'trigger_reason' => $triggerReason,
                'trigger_source' => $triggerSource,
            ];
            if ($costSnapshot !== null) {
                $updateData['cost_snapshot'] = $costSnapshot;
            }
            if ($explanation !== null) {
                $updateData['explanation'] = $explanation;
            }
            $existing->update($updateData);

            return $existing->fresh();
        }

        $review = PricingReview::query()->create([
            'product_id' => $product->id,
            'company_id' => $companyId,
            'channel_id' => null,
            'product_cost' => round($newProductCost, 4),
            'previous_product_cost' => round($previousProductCost, 4),
            'cost_difference' => round($diff, 4),
            'selling_price' => $sellingPrice,
            'suggested_selling_price' => $suggestedPrice,
            'suggested_sale_price' => $suggestedSalePrice,
            'target_margin' => $targetMargin,
            'current_margin' => $currentMargin,
            'impacts' => $impacts,
            'status' => PricingReviewStatus::Pending->value,
            'triggered_by_cost_history_id' => $historyId,
            'trigger_reason' => $triggerReason,
            'trigger_source' => $triggerSource,
            'cost_snapshot' => $costSnapshot,
            'explanation' => $explanation,
        ]);

        PriceReviewCreated::dispatch(
            $review->id,
            $product->id,
            $companyId,
            $previousProductCost,
            $newProductCost,
            $triggerReason ?? 'cost_changed',
            $triggerSource,
        );

        return $review;
    }

    /**
     * Create a pricing review for a finished product whose cost just changed.
     */
    public function createForProduct(
        Product $product,
        float $newProductCost,
        float $previousProductCost,
        array $impacts,
        string $companyId,
        ?string $channelId,
        ?string $triggeredByCostHistoryId,
    ): PricingReview {
        $product->loadMissing('brand');
        $sellingPrice = (float) ($product->regular_price ?? 0.0);
        $targetMargin = $product->effectiveTargetMargin();

        // Suggested Selling Price = cost / (1 - margin%)
        $suggestedPrice = $targetMargin < 100
            ? round($newProductCost / (1 - $targetMargin / 100), 4)
            : $newProductCost;

        $discountPct = $product->effectiveDiscountPct();
        $suggestedSalePrice = round($suggestedPrice * (1 - $discountPct / 100), 4);

        $currentMargin = $sellingPrice > 0
            ? round((($sellingPrice - $newProductCost) / $sellingPrice) * 100, 4)
            : 0.0;

        // Resolve dominant impact flags
        if (empty($impacts)) {
            $diff = $newProductCost - $previousProductCost;
            $impacts = $diff > 0 ? ['cost_increased'] : ($diff < 0 ? ['cost_decreased'] : []);
        }
        if ($currentMargin < $targetMargin) {
            $impacts = array_unique(array_merge($impacts, ['margin_below_target']));
        }

        return PricingReview::query()->create([
            'product_id' => $product->id,
            'company_id' => $companyId,
            'channel_id' => $channelId,
            'product_cost' => round($newProductCost, 4),
            'previous_product_cost' => round($previousProductCost, 4),
            'cost_difference' => round($newProductCost - $previousProductCost, 4),
            'selling_price' => $sellingPrice,
            'suggested_selling_price' => $suggestedPrice,
            'suggested_sale_price' => $suggestedSalePrice,
            'target_margin' => $targetMargin,
            'current_margin' => $currentMargin,
            'impacts' => array_values(array_unique($impacts)),
            'status' => PricingReviewStatus::Pending->value,
            'triggered_by_cost_history_id' => $triggeredByCostHistoryId,
        ]);
    }

    /**
     * Approve/resolve a pricing review and publish selling price.
     *
     * @param  array<string>  $channels  e.g. ['pos','website','wholesale']
     */
    public function resolve(
        PricingReview $review,
        string $action,
        ?float $customPrice,
        ?string $reason,
        ?string $managerName,
        array $channels,
        ?string $approverId = null,
    ): PriceApproval {
        $product = $review->product;
        $product->loadMissing('brand');

        $oldPrice = $review->selling_price;
        $oldSalePrice = (float) ($product->sale_price ?? 0.0);

        $newPrice = match ($action) {
            'approve_suggested' => $review->suggested_selling_price,
            'keep_current' => $review->selling_price,
            'custom_price' => $customPrice ?? $review->selling_price,
            'reject' => $review->selling_price,
            default => $review->selling_price,
        };

        $newSalePrice = null;
        $discountPct = $product->effectiveDiscountPct();

        // Reject never updates prices; other actions check publishing strategy.
        if ($action !== 'reject') {
            // For approve_suggested: use the stored suggested_sale_price shown to the user.
            // For keep_current / custom_price: derive sale from the chosen price + live discount.
            $newSalePrice = $action === 'approve_suggested'
                ? ($review->suggested_sale_price ?? round($newPrice * (1 - $discountPct / 100), 4))
                : round($newPrice * (1 - $discountPct / 100), 4);

            // Read brand publishing strategy to decide immediate vs. staged publish.
            $product->loadMissing('brand');
            $brandId = (string) ($product->brand_id ?? '');
            $policy = $brandId !== '' ? $this->config->getBrandPolicy($brandId, 'pricing') : [];
            $strategy = $policy['publishing_strategy'] ?? 'automatic';

            if ($strategy === 'approval_only') {
                // Stage: store approved prices in the review row; do NOT update the product yet.
                $review->update([
                    'approved_price' => $newPrice,
                    'approved_sale_price' => $newSalePrice > 0.0 ? $newSalePrice : null,
                    'publish_status' => 'pending_publish',
                ]);
            } else {
                // Automatic: write prices immediately, mark channel mappings for sync.
                $product->update([
                    'regular_price' => $newPrice,
                    'sale_price' => $newSalePrice > 0.0 ? $newSalePrice : null,
                ]);

                ProductMapping::query()
                    ->where('product_id', $product->id)
                    ->update(['sync_status' => SyncStatus::Pending->value]);

                $review->update(['publish_status' => 'published']);
            }
        }

        $marginPct = $newPrice > 0
            ? round((($newPrice - $review->product_cost) / $newPrice) * 100, 4)
            : 0.0;

        // Create audit record
        $approval = PriceApproval::query()->create([
            'pricing_review_id' => $review->id,
            'product_id' => $review->product_id,
            'old_product_cost' => $review->previous_product_cost ?? $review->product_cost,
            'new_product_cost' => $review->product_cost,
            'old_selling_price' => $oldPrice,
            'new_selling_price' => $newPrice,
            'old_sale_price' => $oldSalePrice > 0.0 ? $oldSalePrice : null,
            'new_sale_price' => $newSalePrice,
            'margin_pct' => $marginPct,
            'discount_pct' => $discountPct,
            'action' => $action,
            'custom_price' => $action === 'custom_price' ? $customPrice : null,
            'reason' => $reason,
            'manager_name' => $managerName,
            'approved_by' => $approverId,
            'approved_channels' => $channels,
            'approved_at' => now(),
            'created_at' => now(),
        ]);

        // Mark review as resolved
        $status = match ($action) {
            'approve_suggested' => PricingReviewStatus::Approved,
            'keep_current' => PricingReviewStatus::Kept,
            'custom_price' => PricingReviewStatus::CustomPrice,
            'reject' => PricingReviewStatus::Rejected,
            default => PricingReviewStatus::Approved,
        };
        $review->resolve($status);

        // Fire domain events
        if ($action === 'reject') {
            PriceReviewRejected::dispatch(
                $review->id,
                $review->product_id,
                $review->company_id,
                $approverId ?? $managerName ?? 'unknown',
                $reason,
            );
        } else {
            PriceReviewApproved::dispatch(
                $review->id,
                $review->product_id,
                $review->company_id,
                $approverId ?? $managerName ?? 'unknown',
                $newPrice,
                $newSalePrice,
                $marginPct,
                $discountPct,
            );
        }

        return $approval;
    }

    /**
     * Snooze a review until a given date.
     */
    public function snooze(PricingReview $review, string $until): void
    {
        $review->update([
            'status' => PricingReviewStatus::Snoozed->value,
            'snooze_until' => $until,
        ]);
    }

    /**
     * Assign a reviewer to a review.
     */
    public function assign(PricingReview $review, string $reviewerName): void
    {
        $review->update(['reviewer_name' => $reviewerName]);
    }
}
