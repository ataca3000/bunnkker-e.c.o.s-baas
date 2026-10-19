<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Adapters;

use Modules\Commerce\Orders\Domain\Events\OrderBusinessContextCaptured;
use Modules\Commerce\Orders\Domain\Events\OrderFinancialSnapshotCreated;
use Modules\Commerce\Orders\Domain\Events\OrderFinancialSnapshotLocked;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderBusinessContextSnapshot;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Commerce\Orders\Domain\Models\OrderFinancialSnapshot;
use Modules\Commerce\Orders\Domain\Models\OrderLineSnapshot;
use Modules\Common\Snapshots\Domain\Contracts\SnapshotPersistenceAdapter;
use Modules\Common\Snapshots\Domain\DTOs\BusinessContextDTO;
use Modules\Common\Snapshots\Domain\DTOs\FinancialLineSnapshotDTO;
use Modules\Common\Snapshots\Domain\DTOs\FinancialSnapshotDTO;

/**
 * Orders implementation of SnapshotPersistenceAdapter.
 *
 * Writes business context and financial snapshot data to Order-specific Eloquent
 * models. Fires Order-specific domain events after each write for backward compat
 * with existing listeners (OrderFinancialSnapshotCreated, OrderFinancialSnapshotLocked,
 * OrderBusinessContextCaptured).
 */
final class OrderSnapshotPersistenceAdapter implements SnapshotPersistenceAdapter
{
    public function __construct(
        private readonly Order $order,
        private readonly ?string $actorId,
    ) {}

    public function businessContextExists(): bool
    {
        return OrderBusinessContextSnapshot::where('order_id', $this->order->id)->exists();
    }

    public function financialSnapshotExists(): bool
    {
        return OrderFinancialSnapshot::where('order_id', $this->order->id)->exists();
    }

    public function persistBusinessContext(BusinessContextDTO $dto, ?string $actorId): void
    {
        $snapshot = OrderBusinessContextSnapshot::create([
            'order_id' => $this->order->id,

            // PART 1: Policy versions
            'pricing_policy_version' => $dto->pricingPolicyVersion,
            'shipping_policy_version' => $dto->shippingPolicyVersion,

            // PART 2: Price provenance
            'price_source' => $dto->priceSource,
            'price_review_id' => $dto->priceReviewId,
            'cost_source' => $dto->costSource,
            'recipe_version' => $dto->recipeVersion,
            'cost_engine_version' => $dto->costEngineVersion,

            // PART 2: Discount provenance
            'discount_source' => $dto->discountSource,
            'discount_manual_override' => $dto->discountManualOverride,

            // PART 2: Shipping provenance
            'shipping_rule_id' => $dto->shippingRuleId,
            'shipping_zone' => $dto->shippingZone,

            // PART 3: Approval
            'approved_by' => $dto->approvedBy,
            'confirmation_user' => $dto->confirmationUser,
            'confirmation_time' => $dto->confirmationTime,
            'approval_workflow_version' => $dto->approvalWorkflowVersion,

            // PART 4: Customer context
            'delivery_success_rate' => $dto->deliverySuccessRate,

            // PART 5: Brand context
            'brand_name' => $dto->brandName,
            'brand_version' => $dto->brandVersion,
            'brand_commercial_strategy_version' => $dto->brandCommercialStrategyVersion,

            // PART 6: Channel context
            'channel_name' => $dto->channelName,
            'channel_type' => $dto->channelType,
            'marketplace_version' => $dto->marketplaceVersion,

            // PART 8: Fulfillment context
            'sla_policy_version' => $dto->slaPolicyVersion,

            'locked' => true,
            'locked_at' => now(),
            'created_by' => $actorId ?? $this->actorId,
        ]);

        event(new OrderBusinessContextCaptured($snapshot));
    }

    public function persistFinancialSnapshot(FinancialSnapshotDTO $dto, ?string $actorId): void
    {
        $createdBy = $actorId ?? $this->actorId;
        $now = now();

        $snapshot = OrderFinancialSnapshot::create([
            'order_id' => $this->order->id,
            'previous_snapshot_id' => null,
            'company_id' => $dto->companyId,
            'brand_id' => $dto->brandId,
            'channel_id' => $dto->channelId,
            'channel_name' => $dto->channelName,
            'customer_id' => $dto->customerId,
            'customer_name' => $dto->customerName,
            'currency' => $dto->currency,
            'payment_method' => $dto->paymentMethod,
            'shipping_rule_id' => $dto->shippingRuleId,
            'shipping_rule_name' => $dto->shippingRuleName,
            'shipping_zone' => $dto->shippingZone,
            'shipping_override_applied' => $dto->shippingOverrideApplied,
            'shipping_override_by' => $dto->shippingOverrideBy,
            'subtotal' => $dto->subtotal,
            'discount_amount' => $dto->discountAmount,
            'discount_type' => $dto->discountType,
            'shipping_cost' => $dto->shippingCost,
            'deposit_amount' => $dto->depositAmount,
            'remaining_balance' => $dto->remainingBalance,
            'grand_total' => $dto->grandTotal,
            'total_cogs' => $dto->totalCogs,
            'gross_profit' => $dto->grossProfit,
            'total_raw_material_cost' => $dto->totalRawMaterialCost,
            'total_packaging_cost' => $dto->totalPackagingCost,
            'total_manufacturing_cost' => $dto->totalManufacturingCost,
            'total_other_cost' => $dto->totalOtherCost,
            'target_margin_percent' => $dto->targetMarginPercent,
            'actual_margin_percent' => $dto->actualMarginPercent,
            'margin_difference' => $dto->marginDifference,
            'margin_status' => $dto->marginStatus,
            'snapshot_uuid' => $dto->snapshotUuid,
            'snapshot_version' => $dto->snapshotVersion,
            'created_by' => $createdBy,
            'pricing_engine_version' => $dto->pricingEngineVersion,
            'cost_engine_version' => $dto->costEngineVersion,
            'recipe_version' => $dto->recipeVersion,
            'brand_pricing_policy_version' => $dto->brandPricingPolicyVersion,
            'shipping_pricing_version' => $dto->shippingPricingVersion,
            'integrity_hash' => $dto->integrityHash,
            'locked' => true,
            'locked_at' => $now,
        ]);

        foreach ($dto->lines as $line) {
            $this->persistLine($snapshot->id, $line);
        }

        event(new OrderFinancialSnapshotCreated($snapshot));
        event(new OrderFinancialSnapshotLocked($snapshot));
    }

    public function logSnapshotEvent(string $type, string $description, array $metadata, ?string $actorId): void
    {
        OrderEvent::log(
            $this->order->id,
            $type,
            $description,
            $metadata,
            $actorId ?? $this->actorId,
        );
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function persistLine(string $snapshotId, FinancialLineSnapshotDTO $line): void
    {
        // Derive per-line gross_profit / margin_percent for reporting convenience
        $grossProfit = $line->lineCost !== null
            ? round($line->lineTotal - $line->lineCost, 4)
            : null;
        $marginPct = ($grossProfit !== null && $line->lineTotal > 0.0)
            ? round(($grossProfit / $line->lineTotal) * 100.0, 4)
            : null;

        OrderLineSnapshot::create([
            'order_financial_snapshot_id' => $snapshotId,
            'order_id' => $line->aggregateId,
            'order_line_id' => $line->sourceLineId,
            'product_id' => $line->productId,
            'product_sku' => $line->productSku,
            'product_name' => $line->productName,
            'quantity' => $line->quantity,
            'unit_price_at_sale' => $line->unitPriceAtSale,
            'regular_price_at_sale' => $line->regularPriceAtSale,
            'sale_price_at_sale' => $line->salePriceAtSale,
            'line_total' => $line->lineTotal,
            'raw_material_cost' => $line->rawMaterialCost,
            'packaging_cost' => $line->packagingCost,
            'manufacturing_cost' => $line->manufacturingCost,
            'other_cost' => $line->otherCost,
            'recipe_cost' => $line->recipeCost,
            'unit_cost' => $line->unitCost,
            'line_cost' => $line->lineCost,
            'gross_profit' => $grossProfit,
            'margin_percent' => $marginPct,
            'target_margin_percent' => $line->targetMarginPercent,
            'margin_status' => null, // derived at aggregate level; use order_financial_snapshots.margin_status
            'bom_id' => $line->bomId,
            'bom_version_number' => $line->bomVersionNumber,
            'source_recipe_version' => $line->sourceRecipeVersion,
            'price_review_id' => $line->priceReviewId,
            'price_review_approved_at' => $line->priceReviewApprovedAt,
            'price_review_approved_by' => $line->priceReviewApprovedBy,
            'cost_snapshot' => $line->costSnapshot,
        ]);
    }
}
