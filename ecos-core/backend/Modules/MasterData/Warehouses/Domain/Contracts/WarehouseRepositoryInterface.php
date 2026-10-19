<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;

/**
 * Persistence port for warehouses. Implemented by the Infrastructure layer.
 */
interface WarehouseRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Warehouse>
     */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Warehouse;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Warehouse;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Warehouse $warehouse, array $attributes): Warehouse;

    public function delete(Warehouse $warehouse): void;
}
