<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

/**
 * Persistence port for suppliers. Implemented by the Infrastructure layer.
 */
interface SupplierRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Supplier>
     */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Supplier;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Supplier;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Supplier $supplier, array $attributes): Supplier;

    public function delete(Supplier $supplier): void;
}
