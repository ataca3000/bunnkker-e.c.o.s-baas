<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Infrastructure\Repositories;

use Modules\POS\Promotion\Domain\Contracts\PromotionRepositoryInterface;
use Modules\POS\Promotion\Domain\Enums\PromotionStatus;
use Modules\POS\Promotion\Domain\Models\Promotion;

final class EloquentPromotionRepository implements PromotionRepositoryInterface
{
    public function findById(string $id): ?Promotion
    {
        return Promotion::find($id);
    }

    public function findAllActive(): array
    {
        return Promotion::where('status', PromotionStatus::Active->value)->get()->all();
    }

    public function save(Promotion $promotion): void
    {
        $promotion->save();
    }
}
