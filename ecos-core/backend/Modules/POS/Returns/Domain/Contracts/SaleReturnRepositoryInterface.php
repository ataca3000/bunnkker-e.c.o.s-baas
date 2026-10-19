<?php

declare(strict_types=1);

namespace Modules\POS\Returns\Domain\Contracts;

use Modules\POS\Returns\Domain\Models\SaleReturn;

interface SaleReturnRepositoryInterface
{
    public function findById(string $id): ?SaleReturn;

    public function findByReturnNumber(string $returnNumber): ?SaleReturn;

    /** @return SaleReturn[] */
    public function findBySaleId(string $saleId): array;

    public function save(SaleReturn $saleReturn): void;
}
