<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;

final class EloquentInventoryItemRepository implements InventoryItemRepositoryInterface
{
    private const SORTABLE = ['on_hand_qty', 'reserved_qty', 'created_at'];

    public function findOrCreate(string $warehouseId, string $productId, string $companyId): InventoryItem
    {
        // Fast path: the vast majority of calls find an existing item.
        $existing = $this->findByWarehouseAndProduct($warehouseId, $productId);
        if ($existing !== null) {
            return $existing;
        }

        // Slow path: first receipt for this (warehouse, product) pair.
        // `insertOrIgnore` maps to INSERT … ON CONFLICT DO NOTHING on PostgreSQL.
        // Under concurrent load both callers insert; one wins, the other silently
        // skips — no unique-constraint exception and no transaction abort, unlike
        // the firstOrCreate SELECT→INSERT race condition.
        DB::table('inventory_items')->insertOrIgnore([
            'id' => (string) Str::orderedUuid(),
            'warehouse_id' => $warehouseId,
            'product_id' => $productId,
            'company_id' => $companyId,
            'on_hand_qty' => 0,
            'reserved_qty' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return InventoryItem::query()
            ->where('warehouse_id', $warehouseId)
            ->where('product_id', $productId)
            ->firstOrFail();
    }

    public function lockForUpdate(string $id): ?InventoryItem
    {
        return InventoryItem::query()->lockForUpdate()->find($id);
    }

    public function save(InventoryItem $item): void
    {
        $item->save();
    }

    public function recordEntry(array $attributes): StockLedgerEntry
    {
        return StockLedgerEntry::query()->create($attributes);
    }

    public function findByWarehouseAndProduct(string $warehouseId, string $productId): ?InventoryItem
    {
        return InventoryItem::query()
            ->where('warehouse_id', $warehouseId)
            ->where('product_id', $productId)
            ->first();
    }

    public function findByWarehouseProductAndCompany(string $warehouseId, string $productId, string $companyId): ?InventoryItem
    {
        return InventoryItem::query()
            ->where('warehouse_id', $warehouseId)
            ->where('product_id', $productId)
            ->where('company_id', $companyId)
            ->first();
    }

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = InventoryItem::query()->with(['warehouse', 'product', 'company']);

        $companyId = trim((string) ($filters['company_id'] ?? ''));
        if ($companyId !== '') {
            $query->where('company_id', $companyId);
        }

        $warehouseId = trim((string) ($filters['warehouse_id'] ?? ''));
        if ($warehouseId !== '') {
            $query->where('warehouse_id', $warehouseId);
        }

        $productId = trim((string) ($filters['product_id'] ?? ''));
        if ($productId !== '') {
            $query->where('product_id', $productId);
        }

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

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $perPage = max(1, min((int) ($filters['per_page'] ?? 25), 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }
}
