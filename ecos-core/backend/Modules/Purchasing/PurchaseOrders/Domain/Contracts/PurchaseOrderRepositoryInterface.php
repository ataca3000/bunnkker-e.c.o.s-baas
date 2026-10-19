<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;

interface PurchaseOrderRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?PurchaseOrder;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function create(array $attributes, array $lines): PurchaseOrder;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function update(PurchaseOrder $order, array $attributes, array $lines): PurchaseOrder;

    public function delete(PurchaseOrder $order): void;

    public function nextPoNumber(): string;
}
