<?php

declare(strict_types=1);

namespace Modules\POS\Sale\Infrastructure\Repositories;

use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Sale\Domain\Models\Sale;

final class EloquentSaleRepository implements SaleRepositoryInterface
{
    public function findById(string $id): ?Sale
    {
        return Sale::find($id);
    }

    public function findByCartId(string $cartId): ?Sale
    {
        return Sale::where('cart_id', $cartId)->first();
    }

    public function findByReceiptNumber(string $receiptNumber): ?Sale
    {
        return Sale::where('receipt_number', $receiptNumber)->first();
    }

    public function save(Sale $sale): void
    {
        $sale->save();
    }
}
