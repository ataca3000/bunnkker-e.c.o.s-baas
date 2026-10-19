<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Domain\Contracts;

use Modules\POS\Exchange\Domain\Exceptions\ExchangeNotFoundException;
use Modules\POS\Exchange\Domain\Models\Exchange;

interface ExchangeRepositoryInterface
{
    public function save(Exchange $exchange): void;

    /** @throws ExchangeNotFoundException */
    public function findById(string $id): Exchange;

    /** @throws ExchangeNotFoundException */
    public function findByNumber(string $exchangeNumber): Exchange;

    /** @return Exchange[] */
    public function findBySaleId(string $saleId): array;
}
