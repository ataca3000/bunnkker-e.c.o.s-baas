<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Inventory\StockLedger\Domain\Contracts\StockMovementRepositoryInterface;
use Modules\Inventory\StockLedger\Domain\Models\StockMovement;

final class EloquentStockMovementRepository implements StockMovementRepositoryInterface
{
    private const SORTABLE = ['movement_date', 'quantity', 'movement_type', 'created_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = StockMovement::query()->with(['warehouse', 'product']);

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $b) use ($search): void {
                $b->whereHas('product', function (Builder $q) use ($search): void {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%");
                })->orWhereHas('warehouse', function (Builder $q) use ($search): void {
                    $q->where('name', 'like', "%{$search}%");
                });
            });
        }

        $productId = trim((string) ($filters['product_id'] ?? ''));
        if ($productId !== '') {
            $query->where('product_id', $productId);
        }

        $warehouseId = trim((string) ($filters['warehouse_id'] ?? ''));
        if ($warehouseId !== '') {
            $query->where('warehouse_id', $warehouseId);
        }

        $movementType = trim((string) ($filters['movement_type'] ?? ''));
        if ($movementType !== '' && $movementType !== 'all') {
            $query->where('movement_type', $movementType);
        }

        $dateFrom = trim((string) ($filters['date_from'] ?? ''));
        if ($dateFrom !== '') {
            $query->where('movement_date', '>=', $dateFrom);
        }

        $dateTo = trim((string) ($filters['date_to'] ?? ''));
        if ($dateTo !== '') {
            $query->where('movement_date', '<=', $dateTo);
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $perPage = max(1, min((int) ($filters['per_page'] ?? 10), 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }

    public function findById(string $id): ?StockMovement
    {
        return StockMovement::query()->with(['warehouse', 'product'])->find($id);
    }

    public function record(array $attributes): StockMovement
    {
        return StockMovement::query()->create($attributes);
    }
}
