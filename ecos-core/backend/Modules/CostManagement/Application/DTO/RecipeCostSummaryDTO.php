<?php

declare(strict_types=1);

namespace Modules\CostManagement\Application\DTO;

/**
 * Immutable cost breakdown for a single BOM / Recipe.
 *
 * Backend is the ONLY source of these numbers (TASK-COST-ARCH-002).
 * Frontend renders this DTO directly — no local recalculation permitted.
 */
final class RecipeCostSummaryDTO
{
    public function __construct(
        public readonly float $rawMaterialCost,
        public readonly float $packagingCost,
        public readonly float $manufacturingCost,
        public readonly float $otherCost,
        /** Total = raw + packaging + manufacturing + other */
        public readonly float $recipeCost,
        /** Alias for recipeCost; extended in future for overhead/yield adjustments */
        public readonly float $finishedProductCost,
        public readonly ?float $suggestedSellingPrice,
        public readonly ?float $currentSellingPrice,
        public readonly ?float $marginAmount,
        public readonly ?float $marginPercent,
        public readonly string $lastCalculatedAt,
        /** True when one or more component materials have no material_cost set. */
        public readonly bool $hasMissingCosts = false,
        /** Number of components with null material_cost. */
        public readonly int $missingMaterialCount = 0,
    ) {}

    /** Serialize to array for JSON storage and API responses. */
    public function toArray(): array
    {
        return [
            'raw_material_cost' => $this->rawMaterialCost,
            'packaging_cost' => $this->packagingCost,
            'manufacturing_cost' => $this->manufacturingCost,
            'other_cost' => $this->otherCost,
            'recipe_cost' => $this->recipeCost,
            'finished_product_cost' => $this->finishedProductCost,
            'suggested_selling_price' => $this->suggestedSellingPrice,
            'current_selling_price' => $this->currentSellingPrice,
            'margin_amount' => $this->marginAmount,
            'margin_percent' => $this->marginPercent,
            'last_calculated_at' => $this->lastCalculatedAt,
            'has_missing_costs' => $this->hasMissingCosts,
            'missing_material_count' => $this->missingMaterialCount,
        ];
    }

    /** Rehydrate from a stored JSON array (e.g. from the cost_summary column). */
    public static function fromArray(array $data): self
    {
        return new self(
            rawMaterialCost: (float) ($data['raw_material_cost'] ?? 0),
            packagingCost: (float) ($data['packaging_cost'] ?? 0),
            manufacturingCost: (float) ($data['manufacturing_cost'] ?? 0),
            otherCost: (float) ($data['other_cost'] ?? 0),
            recipeCost: (float) ($data['recipe_cost'] ?? 0),
            finishedProductCost: (float) ($data['finished_product_cost'] ?? 0),
            suggestedSellingPrice: isset($data['suggested_selling_price']) ? (float) $data['suggested_selling_price'] : null,
            currentSellingPrice: isset($data['current_selling_price']) ? (float) $data['current_selling_price'] : null,
            marginAmount: isset($data['margin_amount']) ? (float) $data['margin_amount'] : null,
            marginPercent: isset($data['margin_percent']) ? (float) $data['margin_percent'] : null,
            lastCalculatedAt: (string) ($data['last_calculated_at'] ?? now()->toIso8601String()),
            hasMissingCosts: (bool) ($data['has_missing_costs'] ?? false),
            missingMaterialCount: (int) ($data['missing_material_count'] ?? 0),
        );
    }
}
