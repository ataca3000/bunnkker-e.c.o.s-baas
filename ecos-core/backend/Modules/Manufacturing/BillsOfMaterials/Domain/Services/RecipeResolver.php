<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\Services;

use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeRepositoryInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeResolverInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions\RecipeResolverException;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeComponent;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;

/**
 * RecipeResolver — read-only domain service.
 *
 * Locates the active Recipe for a product, validates its state, expands every
 * component line into a fully-resolved RecipeComponent (with unit from Product),
 * and returns an immutable RecipeSnapshot.
 *
 * This service MUST NOT:
 *   - Consume inventory
 *   - Calculate cost
 *   - Execute manufacturing
 *   - Create transactions
 *   - Update the database
 *   - Trigger the Decision Engine
 *
 * All recipe execution must go through this resolver. Do not bypass it.
 *
 * Callers: ManufacturingEngine, DecisionEngine, CostEngine, SimulationEngine, AIEngine.
 */
final class RecipeResolver implements RecipeResolverInterface
{
    public function __construct(
        private readonly RecipeRepositoryInterface $recipes,
    ) {}

    /**
     * Resolve the active Recipe for the given product into an immutable snapshot.
     *
     * @throws RecipeResolverException On any invalid state (no recipe, inactive
     *                                 components, missing units, etc.).
     */
    public function resolve(string $productId): RecipeSnapshot
    {
        // ── Step 1: Locate the active Recipe ─────────────────────────────────
        $recipe = $this->recipes->findActiveByProduct($productId);

        if ($recipe === null) {
            throw RecipeResolverException::noActiveRecipe($productId);
        }

        // ── Step 2: Validate the output product ───────────────────────────────
        $product = $recipe->product;

        if ($product === null || $product->trashed()) {
            throw RecipeResolverException::productUnavailable($recipe->product_id);
        }

        // ── Step 3: Expand Recipe Lines (fresh query — not relying on eager load) ──
        $lines = $recipe->components()->with(['component.unit'])->get();

        if ($lines->isEmpty()) {
            throw RecipeResolverException::noComponents($recipe->id);
        }

        // ── Step 4: Validate and resolve each component ───────────────────────
        $components = [];

        foreach ($lines as $line) {
            $component = $line->component;

            // Component product deleted (hard or soft)
            if ($component === null || $component->trashed()) {
                throw RecipeResolverException::componentNotFound($line->raw_material_id);
            }

            // Component product is inactive
            if (! $component->is_active) {
                throw RecipeResolverException::componentInactive($component->sku);
            }

            // Unit is required — unit comes from the Product (never from the line)
            if ($component->unit === null) {
                throw RecipeResolverException::componentMissingUnit($component->sku);
            }

            $components[] = new RecipeComponent(
                component_id: $component->id,
                sku: $component->sku,
                name: $component->name,
                unit_id: $component->unit->id,
                unit_name: $component->unit->name,
                unit_symbol: $component->unit->symbol,
                quantity: (float) $line->quantity,
                allow_negative_stock: (bool) $component->allow_negative_stock,
            );
        }

        // ── Step 5: Return immutable snapshot ─────────────────────────────────
        return new RecipeSnapshot(
            recipe_id: $recipe->id,
            bom_number: $recipe->bom_number,
            version: $recipe->version,
            bom_version_number: $recipe->bom_version_number,
            product_id: $product->id,
            product_sku: $product->sku,
            product_name: $product->name,
            components: $components,
            resolved_at: now()->toIso8601String(),
        );
    }
}
