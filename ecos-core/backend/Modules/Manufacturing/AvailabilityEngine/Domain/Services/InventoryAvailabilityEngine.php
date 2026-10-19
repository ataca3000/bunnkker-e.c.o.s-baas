<?php

declare(strict_types=1);

namespace Modules\Manufacturing\AvailabilityEngine\Domain\Services;

use DateTimeImmutable;
use DateTimeInterface;
use Modules\Manufacturing\AvailabilityEngine\Domain\Contracts\InventoryReadInterface;
use Modules\Manufacturing\AvailabilityEngine\Domain\Enums\ManufacturingEligibility;
use Modules\Manufacturing\AvailabilityEngine\Domain\ValueObjects\AvailabilityResult;
use Modules\Manufacturing\AvailabilityEngine\Domain\ValueObjects\RawMaterialAvailability;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeResolverInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions\RecipeResolverException;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeComponent;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;

/**
 * Analyses whether a product can be fulfilled from stock or must be manufactured.
 *
 * READ-ONLY GUARANTEE: this engine never writes to inventory, never creates
 * manufacturing transactions, and never reserves stock. Every call is side-effect-free.
 *
 * Decision flow:
 *   1. Check finished-goods availability at the warehouse.
 *   2. If stock is sufficient → Sufficient (no manufacturing needed).
 *   3. Resolve recipe; if none exists → NoRecipe.
 *   4. For each component, compute required vs. available (scaled by qty_to_manufacture).
 *   5. Classify eligibility:
 *        All satisfied              → CanManufacture
 *        Unsatisfied but all have allow_negative_stock → Partial  (RC-2)
 *        Any unsatisfied without allow_negative_stock  → CannotManufacture
 */
final class InventoryAvailabilityEngine
{
    public function __construct(
        private readonly InventoryReadInterface $inventory,
        private readonly RecipeResolverInterface $resolver,
    ) {}

    public function analyse(
        string $productId,
        string $warehouseId,
        float $requiredQty,
        string $companyId,
    ): AvailabilityResult {
        $evaluatedAt = (new DateTimeImmutable)->format(DateTimeInterface::ATOM);

        $availableFg = $this->inventory->availableQty($warehouseId, $productId, $companyId);

        // RC-1: partial manufacturing — only manufacture the shortage
        $qtyToManufacture = max(0.0, $requiredQty - $availableFg);

        if ($qtyToManufacture <= 0.0) {
            return $this->sufficientResult(
                productId: $productId,
                warehouseId: $warehouseId,
                requiredQty: $requiredQty,
                availableFg: $availableFg,
                evaluatedAt: $evaluatedAt,
            );
        }

        // Attempt recipe resolution — a missing recipe is a valid state, not an error
        try {
            $snapshot = $this->resolver->resolve($productId);
        } catch (RecipeResolverException) {
            return $this->noRecipeResult(
                productId: $productId,
                warehouseId: $warehouseId,
                requiredQty: $requiredQty,
                availableFg: $availableFg,
                qtyToManufacture: $qtyToManufacture,
                evaluatedAt: $evaluatedAt,
            );
        }

        $rawMaterials = $this->analyseComponents($snapshot, $warehouseId, $companyId, $qtyToManufacture);
        $eligibility = $this->classifyEligibility($rawMaterials);

        return new AvailabilityResult(
            product_id: $productId,
            warehouse_id: $warehouseId,
            required_qty: $requiredQty,
            available_finished_goods: $availableFg,
            qty_to_manufacture: $qtyToManufacture,
            needs_manufacturing: true,
            recipe_snapshot: $snapshot,
            raw_materials: $rawMaterials,
            can_manufacture: $eligibility->allowsManufacturing(),
            eligibility: $eligibility,
            evaluated_at: $evaluatedAt,
        );
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Builds per-component availability, scaling recipe quantities by qty_to_manufacture.
     *
     * @return list<RawMaterialAvailability>
     */
    private function analyseComponents(
        RecipeSnapshot $snapshot,
        string $warehouseId,
        string $companyId,
        float $qtyToManufacture,
    ): array {
        $results = [];

        foreach ($snapshot->components as $component) {
            $results[] = $this->analyseComponent($component, $warehouseId, $companyId, $qtyToManufacture);
        }

        return $results;
    }

    private function analyseComponent(
        RecipeComponent $component,
        string $warehouseId,
        string $companyId,
        float $qtyToManufacture,
    ): RawMaterialAvailability {
        // Scale: absolute quantity needed for the full manufacturing run
        $requiredQty = $component->quantity * $qtyToManufacture;
        $availableQty = $this->inventory->availableQty($warehouseId, $component->component_id, $companyId);
        $missingQty = max(0.0, $requiredQty - $availableQty);

        // RC-2: satisfied when stock covers the need OR negative stock is permitted
        $isSatisfied = $missingQty === 0.0 || $component->allow_negative_stock;

        return new RawMaterialAvailability(
            component_id: $component->component_id,
            sku: $component->sku,
            name: $component->name,
            unit_symbol: $component->unit_symbol,
            required_qty: $requiredQty,
            available_qty: $availableQty,
            missing_qty: $missingQty,
            allow_negative_stock: $component->allow_negative_stock,
            is_satisfied: $isSatisfied,
        );
    }

    /**
     * Derives ManufacturingEligibility from the per-component analysis.
     *
     * @param  list<RawMaterialAvailability>  $materials
     */
    private function classifyEligibility(array $materials): ManufacturingEligibility
    {
        if ($materials === []) {
            return ManufacturingEligibility::CanManufacture;
        }

        $hasHardBlocker = false;
        $hasSoftShortage = false;

        foreach ($materials as $material) {
            if ($material->missing_qty > 0.0) {
                if ($material->allow_negative_stock) {
                    $hasSoftShortage = true;
                } else {
                    $hasHardBlocker = true;
                }
            }
        }

        if ($hasHardBlocker) {
            return ManufacturingEligibility::CannotManufacture;
        }

        if ($hasSoftShortage) {
            return ManufacturingEligibility::Partial;
        }

        return ManufacturingEligibility::CanManufacture;
    }

    private function sufficientResult(
        string $productId,
        string $warehouseId,
        float $requiredQty,
        float $availableFg,
        string $evaluatedAt,
    ): AvailabilityResult {
        return new AvailabilityResult(
            product_id: $productId,
            warehouse_id: $warehouseId,
            required_qty: $requiredQty,
            available_finished_goods: $availableFg,
            qty_to_manufacture: 0.0,
            needs_manufacturing: false,
            recipe_snapshot: null,
            raw_materials: [],
            can_manufacture: true,
            eligibility: ManufacturingEligibility::Sufficient,
            evaluated_at: $evaluatedAt,
        );
    }

    private function noRecipeResult(
        string $productId,
        string $warehouseId,
        float $requiredQty,
        float $availableFg,
        float $qtyToManufacture,
        string $evaluatedAt,
    ): AvailabilityResult {
        return new AvailabilityResult(
            product_id: $productId,
            warehouse_id: $warehouseId,
            required_qty: $requiredQty,
            available_finished_goods: $availableFg,
            qty_to_manufacture: $qtyToManufacture,
            needs_manufacturing: true,
            recipe_snapshot: null,
            raw_materials: [],
            can_manufacture: false,
            eligibility: ManufacturingEligibility::NoRecipe,
            evaluated_at: $evaluatedAt,
        );
    }
}
