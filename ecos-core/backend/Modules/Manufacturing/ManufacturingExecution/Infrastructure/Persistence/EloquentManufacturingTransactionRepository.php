<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Infrastructure\Persistence;

use Modules\Manufacturing\ManufacturingExecution\Domain\Contracts\ManufacturingTransactionRepositoryInterface;
use Modules\Manufacturing\ManufacturingExecution\Domain\Models\ManufacturingTransaction;

final class EloquentManufacturingTransactionRepository implements ManufacturingTransactionRepositoryInterface
{
    public function findByPlanId(string $planId): ?ManufacturingTransaction
    {
        return ManufacturingTransaction::query()
            ->where('plan_id', $planId)
            ->first();
    }

    public function save(ManufacturingTransaction $transaction): void
    {
        $transaction->save();
    }
}
