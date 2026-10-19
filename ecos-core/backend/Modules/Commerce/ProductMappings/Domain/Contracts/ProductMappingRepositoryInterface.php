<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;

interface ProductMappingRepositoryInterface
{
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?ProductMapping;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): ProductMapping;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(ProductMapping $mapping, array $attributes): ProductMapping;

    public function delete(ProductMapping $mapping): void;
}
