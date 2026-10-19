<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\MasterData\Categories\Domain\Models\Category;

/**
 * Persistence port for categories. Implemented by the Infrastructure layer.
 */
interface CategoryRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Category>
     */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Category;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Category;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Category $category, array $attributes): Category;

    public function delete(Category $category): void;
}
