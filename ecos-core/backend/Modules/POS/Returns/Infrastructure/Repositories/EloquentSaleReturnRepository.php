<?php

declare(strict_types=1);

namespace Modules\POS\Returns\Infrastructure\Repositories;

use Modules\POS\Returns\Domain\Contracts\SaleReturnRepositoryInterface;
use Modules\POS\Returns\Domain\Models\SaleReturn;

final class EloquentSaleReturnRepository implements SaleReturnRepositoryInterface
{
    public function findById(string $id): ?SaleReturn
    {
        return SaleReturn::find($id);
    }

    public function findByReturnNumber(string $returnNumber): ?SaleReturn
    {
        return SaleReturn::where('return_number', $returnNumber)->first();
    }

    /** @return SaleReturn[] */
    public function findBySaleId(string $saleId): array
    {
        return SaleReturn::where('sale_id', $saleId)->get()->all();
    }

    public function save(SaleReturn $saleReturn): void
    {
        $saleReturn->save();
    }
}
