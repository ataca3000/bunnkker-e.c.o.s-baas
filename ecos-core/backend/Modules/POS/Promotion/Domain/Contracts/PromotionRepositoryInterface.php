<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\Contracts;

use Modules\POS\Promotion\Domain\Models\Promotion;

interface PromotionRepositoryInterface
{
    public function findById(string $id): ?Promotion;

    /** @return Promotion[] */
    public function findAllActive(): array;

    public function save(Promotion $promotion): void;
}
