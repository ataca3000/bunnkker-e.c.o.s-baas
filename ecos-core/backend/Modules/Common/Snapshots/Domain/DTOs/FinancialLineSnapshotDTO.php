<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\DTOs;

/**
 * Pre-computed per-line financial data for snapshot creation.
 * All cost and pricing calculations must be performed before constructing this DTO.
 * The FinancialSnapshotBuilder only aggregates these values — it does not recalculate.
 */
final readonly class FinancialLineSnapshotDTO
{
    public function __construct(
        /** ID of the parent aggregate (e.g. order_id for Orders, sale_id for POS). */
        public string $aggregateId,

        /** ID of the source line entity (nullable for safety). */
        public ?string $sourceLineId,

        public ?string $productId,
        public ?string $productSku,
        public ?string $productName,

        public float $quantity,
        public float $unitPriceAtSale,
        public ?float $regularPriceAtSale,
        public ?float $salePriceAtSale,
        public float $lineTotal,

        // Cost breakdown per unit
        public ?float $rawMaterialCost,
        public ?float $packagingCost,
        public ?float $manufacturingCost,
        public ?float $otherCost,
        public ?float $recipeCost,
        public ?float $unitCost,
        public ?float $lineCost,

        // Margin (pre-computed by the calling module)
        public float $targetMarginPercent,

        // Recipe provenance
        public ?string $bomId,
        public ?int $bomVersionNumber,
        public ?string $sourceRecipeVersion,

        // Price review provenance
        public ?string $priceReviewId,
        public ?string $priceReviewApprovedAt,
        public ?string $priceReviewApprovedBy,

        // Full cost audit JSON
        public ?array $costSnapshot,
    ) {}
}
