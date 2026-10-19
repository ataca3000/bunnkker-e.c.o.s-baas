<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;

interface GoodsReceiptRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?GoodsReceipt;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function create(array $attributes, array $lines): GoodsReceipt;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function update(GoodsReceipt $receipt, array $attributes, array $lines): GoodsReceipt;

    public function delete(GoodsReceipt $receipt): void;

    public function nextReceiptNumber(): string;
}
