<?php

declare(strict_types=1);

namespace Modules\POS\Sale\Domain\Contracts;

use Modules\POS\Sale\Domain\Models\Sale;

interface SaleRepositoryInterface
{
    public function findById(string $id): ?Sale;

    public function findByCartId(string $cartId): ?Sale;

    public function findByReceiptNumber(string $receiptNumber): ?Sale;

    public function save(Sale $sale): void;
}
