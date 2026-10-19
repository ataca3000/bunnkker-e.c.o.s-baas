<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Infrastructure\Repositories;

use Illuminate\Database\Eloquent\Collection;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeRepositoryInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;

final class EloquentRecipeRepository implements RecipeRepositoryInterface
{
    /** Relations always loaded on detail queries. */
    private const WITH_DETAIL = ['product', 'components.component.unit'];

    public function findById(string $id): ?Recipe
    {
        return Recipe::with(self::WITH_DETAIL)->find($id);
    }

    public function findActiveByProduct(string $productId): ?Recipe
    {
        return Recipe::with(self::WITH_DETAIL)
            ->where('product_id', $productId)
            ->where('is_active', true)
            ->first();
    }

    /**
     * @return Collection<int, Recipe>
     */
    public function findAllByProduct(string $productId): Collection
    {
        return Recipe::with(['product'])
            ->where('product_id', $productId)
            ->orderByDesc('bom_version_number')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  list<array<string, mixed>>  $lines
     */
    public function create(array $attributes, array $lines): Recipe
    {
        if ($attributes['is_active'] ?? false) {
            $this->deactivateOthers((string) $attributes['product_id'], null);
        }

        $recipe = Recipe::create($attributes);
        $recipe->components()->createMany($lines);

        return $recipe->load(self::WITH_DETAIL);
    }

    public function activate(Recipe $recipe): void
    {
        $this->deactivateOthers($recipe->product_id, $recipe->id);
        $recipe->update(['is_active' => true]);
    }

    public function nextVersionNumber(string $productId): int
    {
        $max = Recipe::withTrashed()
            ->where('product_id', $productId)
            ->max('bom_version_number');

        return ($max === null ? 0 : (int) $max) + 1;
    }

    public function nextBomNumber(): string
    {
        $last = Recipe::withTrashed()
            ->where('bom_number', 'like', 'BOM-%')
            ->orderByRaw("CAST(REPLACE(bom_number, 'BOM-', '') AS UNSIGNED) DESC")
            ->value('bom_number');

        if ($last === null) {
            return 'BOM-00001';
        }

        $current = (int) str_replace('BOM-', '', (string) $last);

        return 'BOM-'.str_pad((string) ($current + 1), 5, '0', STR_PAD_LEFT);
    }

    private function deactivateOthers(string $productId, ?string $excludeId): void
    {
        $query = Recipe::where('product_id', $productId)->where('is_active', true);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        $query->update(['is_active' => false]);
    }
}
