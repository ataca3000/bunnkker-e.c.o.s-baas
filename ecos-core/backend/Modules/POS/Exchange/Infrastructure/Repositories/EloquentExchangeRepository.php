<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Infrastructure\Repositories;

use Modules\POS\Exchange\Domain\Contracts\ExchangeRepositoryInterface;
use Modules\POS\Exchange\Domain\Exceptions\ExchangeNotFoundException;
use Modules\POS\Exchange\Domain\Models\Exchange;

final class EloquentExchangeRepository implements ExchangeRepositoryInterface
{
    public function save(Exchange $exchange): void
    {
        $exchange->save();
    }

    public function findById(string $id): Exchange
    {
        return Exchange::find($id) ?? throw ExchangeNotFoundException::withId($id);
    }

    public function findByNumber(string $exchangeNumber): Exchange
    {
        return Exchange::where('exchange_number', $exchangeNumber)->first()
            ?? throw ExchangeNotFoundException::withNumber($exchangeNumber);
    }

    public function findBySaleId(string $saleId): array
    {
        return Exchange::where('original_sale_id', $saleId)->get()->all();
    }
}
