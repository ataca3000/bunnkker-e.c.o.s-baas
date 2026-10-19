<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Inventory\StockLedger\Domain\Models\StockMovement;

interface StockMovementRepositoryInterface
{
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?StockMovement;

    public function record(array $attributes): StockMovement;
}
