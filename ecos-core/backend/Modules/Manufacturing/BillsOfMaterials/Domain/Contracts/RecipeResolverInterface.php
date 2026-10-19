<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\Contracts;

use Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions\RecipeResolverException;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;

/**
 * Contract for resolving a product's active Recipe into an immutable snapshot.
 *
 * Implementations:
 *   - RecipeResolver         — current: Eloquent-backed, loads from DB
 *   - CachedRecipeResolver   — future: in-memory cache layer
 *   - SimulatedRecipeResolver — future: simulation engine uses synthetic recipes
 *
 * All recipe access in the Manufacturing domain must go through this interface.
 * Never read Recipe models directly.
 */
interface RecipeResolverInterface
{
    /**
     * Resolve the active Recipe for the given product.
     *
     * @throws RecipeResolverException on invalid state (no recipe, inactive components, etc.)
     */
    public function resolve(string $productId): RecipeSnapshot;
}
