<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Application\Queries;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;

/**
 * Paginated inventory summary across all warehouse-product locations.
 */
final class GetInventorySummaryQuery
{
    public function __construct(
        private readonly InventoryItemRepositoryInterface $inventory,
    ) {}

    /** @param array<string, mixed> $filters */
    public function execute(array $filters = []): LengthAwarePaginator
    {
        return $this->inventory->paginate($filters);
    }
}
