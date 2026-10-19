<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\MasterData\Units\Domain\Models\Unit;

/**
 * Persistence port for units of measure. Implemented by the Infrastructure layer.
 */
interface UnitRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Unit>
     */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Unit;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Unit;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Unit $unit, array $attributes): Unit;

    public function delete(Unit $unit): void;
}
