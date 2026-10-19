<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\DTOs;

/**
 * Fully assembled financial snapshot data ready for persistence.
 * Produced by FinancialSnapshotBuilder from a FinancialSnapshotProvider.
 * Contains both the pass-through financial data and the builder-computed aggregates.
 */
final readonly class FinancialSnapshotDTO
{
    public function __construct(
        // Identity
        public string $aggregateId,
        public string $aggregateType,
        public string $snapshotUuid,
        public int $snapshotVersion,

        // Parties (from provider)
        public ?string $companyId,
        public ?string $brandId,
        public ?string $channelId,
        public ?string $channelName,
        public ?string $customerId,
        public ?string $customerName,

        // Order financials (from provider)
        public string $currency,
        public ?string $paymentMethod,
        public float $subtotal,
        public float $discountAmount,
        public ?string $discountType,
        public float $shippingCost,
        public float $depositAmount,
        public float $remainingBalance,
        public float $grandTotal,

        // Shipping snapshot (from provider)
        public ?string $shippingRuleId,
        public ?string $shippingRuleName,
        public ?string $shippingZone,
        public bool $shippingOverrideApplied,
        public ?string $shippingOverrideBy,

        // Cost aggregates (computed by builder)
        public ?float $totalCogs,
        public ?float $grossProfit,
        public ?float $totalRawMaterialCost,
        public ?float $totalPackagingCost,
        public ?float $totalManufacturingCost,
        public ?float $totalOtherCost,

        // Margin diagnostics (computed by builder)
        public ?float $targetMarginPercent,
        public ?float $actualMarginPercent,
        public ?float $marginDifference,
        public ?string $marginStatus,

        // Engine metadata
        public string $pricingEngineVersion,
        public string $costEngineVersion,
        public ?string $recipeVersion,
        public string $brandPricingPolicyVersion,
        public string $shippingPricingVersion,

        // Integrity (computed by builder)
        public string $integrityHash,

        // Lines (from provider, passed through)
        /** @var FinancialLineSnapshotDTO[] */
        public array $lines,
    ) {}
}
