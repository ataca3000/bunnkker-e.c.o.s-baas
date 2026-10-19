<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\DTO;

use DateTimeImmutable;
use Modules\Operations\DemandAnalysis\Domain\Enums\InventoryStatus;

/**
 * Full output of a single Demand Analysis run.
 *
 * Becomes the official input for the Planning Engine in later sprints.
 */
final class DemandAnalysisResult
{
    /**
     * @param  list<DemandLine>  $demandLines  Sorted descending by orderedQty.
     */
    public function __construct(
        /** The date this analysis was generated for (Y-m-d). */
        public readonly string $operationalDay,

        /** UTC timestamp when the analysis was produced. */
        public readonly DateTimeImmutable $generatedAt,

        /** Total count of eligible operational orders included in this analysis. */
        public readonly int $totalOrders,

        /** Number of distinct products with at least one eligible order line. */
        public readonly int $totalProducts,

        /** Number of distinct SKUs — equals totalProducts in this system (1 SKU per product). */
        public readonly int $totalSkus,

        public readonly array $demandLines,
    ) {}

    public function readyCount(): int
    {
        return $this->countByStatus(InventoryStatus::Ready);
    }

    public function shortageCount(): int
    {
        return $this->countByStatus(InventoryStatus::Shortage);
    }

    public function outOfStockCount(): int
    {
        return $this->countByStatus(InventoryStatus::OutOfStock);
    }

    public function unknownCount(): int
    {
        return $this->countByStatus(InventoryStatus::Unknown);
    }

    private function countByStatus(InventoryStatus $status): int
    {
        return count(array_filter(
            $this->demandLines,
            fn (DemandLine $line) => $line->inventoryStatus === $status,
        ));
    }
}
