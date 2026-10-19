<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Exceptions\SaleNotFoundException;
use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Sale\Domain\Models\Sale;

final class FindSaleService
{
    public function __construct(
        private readonly SaleRepositoryInterface $saleRepo,
    ) {}

    public function execute(string $saleId): Sale
    {
        $sale = $this->saleRepo->findById($saleId);

        if ($sale === null) {
            throw SaleNotFoundException::withId($saleId);
        }

        return $sale;
    }
}
