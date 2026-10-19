<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;

interface InventoryItemRepositoryInterface
{
    /**
     * Return an existing InventoryItem or create a zeroed one for the given location.
     * Does NOT acquire a row-level lock — use lockForUpdate() inside a transaction
     * when mutations follow.
     */
    public function findOrCreate(string $warehouseId, string $productId, string $companyId): InventoryItem;

    /**
     * Return the InventoryItem with a pessimistic write lock (SELECT … FOR UPDATE).
     * Must be called inside a DB::transaction().
     */
    public function lockForUpdate(string $id): ?InventoryItem;

    public function save(InventoryItem $item): void;

    public function recordEntry(array $attributes): StockLedgerEntry;

    public function findByWarehouseAndProduct(string $warehouseId, string $productId): ?InventoryItem;

    /** Company-scoped lookup — enforces tenant isolation at the query level. */
    public function findByWarehouseProductAndCompany(string $warehouseId, string $productId, string $companyId): ?InventoryItem;

    /** @return LengthAwarePaginator<InventoryItem> */
    public function paginate(array $filters): LengthAwarePaginator;
}
