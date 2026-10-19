<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Infrastructure\Repositories;

use Modules\POS\Discount\Domain\Contracts\DiscountRepositoryInterface;
use Modules\POS\Discount\Domain\Exceptions\DiscountNotFoundException;
use Modules\POS\Discount\Domain\Models\Discount;

final class EloquentDiscountRepository implements DiscountRepositoryInterface
{
    public function findById(string $id): Discount
    {
        return Discount::find($id) ?? throw DiscountNotFoundException::withId($id);
    }

    public function save(Discount $discount): void
    {
        $discount->save();
    }
}
