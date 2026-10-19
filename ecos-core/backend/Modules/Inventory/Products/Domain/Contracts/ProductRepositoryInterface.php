<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Persistence port for products. Implemented by the Infrastructure layer.
 */
interface ProductRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Product>
     */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Product;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Product;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Product $product, array $attributes): Product;

    public function delete(Product $product): void;
}
