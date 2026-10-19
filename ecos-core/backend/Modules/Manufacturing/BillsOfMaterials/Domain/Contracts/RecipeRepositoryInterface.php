<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\Contracts;

use Illuminate\Database\Eloquent\Collection;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;

interface RecipeRepositoryInterface
{
    public function findById(string $id): ?Recipe;

    /** Returns the active recipe for the product, or null if none exists. */
    public function findActiveByProduct(string $productId): ?Recipe;

    /**
     * Returns all recipe versions for a product, newest first.
     *
     * @return Collection<int, Recipe>
     */
    public function findAllByProduct(string $productId): Collection;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  list<array<string, mixed>>  $lines
     */
    public function create(array $attributes, array $lines): Recipe;

    /**
     * Set this recipe as the active version for its product.
     * Deactivates all other versions for the same product.
     */
    public function activate(Recipe $recipe): void;

    /**
     * Next sequential version number for the given product across all versions
     * including soft-deleted rows.
     */
    public function nextVersionNumber(string $productId): int;

    public function nextBomNumber(): string;
}
