<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Domain\Contracts;

use Modules\POS\Discount\Domain\Models\Discount;

interface DiscountRepositoryInterface
{
    public function findById(string $id): Discount;

    public function save(Discount $discount): void;
}
